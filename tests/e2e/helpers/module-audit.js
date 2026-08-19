// @ts-check
// helpers/module-audit.js — Auditoría de un módulo del catálogo.
//
// Produce una fila con las columnas del contrato:
//   route, desktop_load, mobile_load, console_errors, failed_requests,
//   external_requests, back_navigation, interactive_controls,
//   horizontal_overflow, offline_load, result
//
// La función auditModule recibe una página NUEVA por llamada (contexto limpio)
// y ejecuta la secuencia completa: carga escritorio, móvil 390x844, offline
// (bloqueando requests a origins externos), y navegación de regreso.

const { createOriginPolicy } = require('./origin-policy');

// Interno = mismo origin que E2E_BASE_URL; externo = cualquier otro origin.
const policy = createOriginPolicy(process.env.E2E_BASE_URL || 'http://localhost:8080');
const BASE_URL = policy.baseUrl;
const { isExternalRequest } = policy;

/**
 * Recoge errores de consola, pageerror, requests fallidos y requests externos
 * de la página. Devuelve un objeto con contadores y detalles.
 */
function attachCollectors(page) {
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    externalRequests: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      state.consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push(String(err));
  });
  page.on('requestfailed', (req) => {
    state.failedRequests.push(`${req.url()} :: ${req.failure()?.errorText || 'unknown'}`);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      state.failedRequests.push(`${resp.url()} :: HTTP ${resp.status()}`);
    }
  });
  page.on('request', (req) => {
    if (isExternalRequest(req.url())) {
      state.externalRequests.push(req.url());
    }
  });

  return state;
}

/**
 * Carga una URL esperando a que el DOM esté listo y a que el JS inicial corra.
 * Devuelve true si el servidor respondió 200.
 */
async function loadOk(page, url) {
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!resp || resp.status() !== 200) return false;
    // Deja que los scripts inline (Three.js, TTS, HUD) se inicialicen.
    await page.waitForTimeout(1200);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Cuenta controles interactivos detectables en el DOM.
 */
async function countInteractiveControls(page) {
  return page.evaluate(() => {
    const selectors = [
      'button',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="slider"]',
      '[role="tab"]',
      'a[href]:not([href^="#"])',
    ];
    return document.querySelectorAll(selectors.join(',')).length;
  }).catch(() => 0);
}

/**
 * Comprueba si existe un enlace de regreso al catálogo y si navega a él.
 * Acepta los patrones reales del proyecto: '../', '../index.html',
 * '/modulos/', '/modulos', '/app/' (volver.js puede inyectar el botón por JS, así que
 * se espera al DOM). Usa el requestContext global (no page.request, que
 * depende del estado de la página). Devuelve 'ok' | 'no-link' | 'broken'.
 */
async function checkBackNavigation(page, requestCtx, baseUrl) {
  try {
    // Espera hasta 5s a que volver.js o el HTML estático inyecten el enlace.
    const handle = await page
      .waitForFunction(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const candidates = links
          .map((a) => a.getAttribute('href') || '')
          .filter((h) =>
            h === '../' ||
            h === '../index.html' ||
            h === '/modulos/' ||
            h === '/modulos' ||
            h === '/app/' ||
            h === '/app' ||
            h.endsWith('/modulos/')
          );
        return candidates.length ? candidates[0] : null;
      }, null, { timeout: 5000 })
      .catch(() => null);
    const href = handle ? await handle.jsonValue() : null;
    if (!href) return 'no-link';
    // Resuelve la URL como lo haría el navegador, sin asumir profundidad de carpeta.
    const target = new URL(href, page.url()).toString();
    const resp = await requestCtx.get(target);
    return resp.status() === 200 ? 'ok' : 'broken';
  } catch (e) {
    return 'broken';
  }
}

/**
 * Comprueba el desbordamiento horizontal en el viewport actual.
 * Devuelve px de overflow (0 = sin desbordamiento).
 */
async function horizontalOverflowPx(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  }).catch(() => 0);
}

/**
 * Carga la URL bloqueando requests a cualquier origin externo
 * (distinto del origin de E2E_BASE_URL).
 * Devuelve true si la página carga con 200 y sin errores de red.
 */
async function loadOffline(page, url) {
  let offlineFailed = false;
  const handler = (route) => route.abort();
  await page.route((urlObj) => isExternalRequest(urlObj.href), handler);
  try {
    const ok = await loadOk(page, url);
    // Tras la carga, comprueba que ningún recurso crítico falló por el bloqueo.
    const failed = await page.evaluate(() => {
      return performance
        .getEntriesByType('resource')
        .filter((entry) => {
          try {
            const url = new URL(entry.name, location.href);
            return (
              (url.protocol === 'http:' || url.protocol === 'https:') &&
              url.origin !== location.origin
            );
          } catch {
            return false;
          }
        })
        .length;
    }).catch(() => 0);
    offlineFailed = !ok || failed > 0;
  } finally {
    await page.unroute((urlObj) => isExternalRequest(urlObj.href), handler);
  }
  return !offlineFailed;
}

/**
 * Audita un módulo completo. Devuelve la fila CSV como objeto.
 * Nunca lanza: si la página muere a mitad (algunos juegos cierran la ventana),
 * marca FAIL en lo que falte y continúa — el barrido no debe cortarse por un módulo.
 */
async function auditModule(page, requestCtx, route) {
  const url = `${BASE_URL}${route}`;
  const collectors = attachCollectors(page);

  // 1. Carga en escritorio (1280x720 por defecto de Playwright)
  const desktopOk = await loadOk(page, url);

  // 2. Controles interactivos + navegación de regreso (tras carga desktop)
  let interactiveControls = 0;
  let backNavigation = 'no-link';
  try {
    if (!page.isClosed()) interactiveControls = await countInteractiveControls(page);
    if (!page.isClosed()) backNavigation = await checkBackNavigation(page, requestCtx, BASE_URL);
  } catch (e) { /* página cerrada: se registra como está */ }

  // 3. Carga en móvil 390x844
  let mobileOk = false;
  let horizontalOverflow = 0;
  try {
    if (!page.isClosed()) await page.setViewportSize({ width: 390, height: 844 });
    mobileOk = await loadOk(page, url);
    if (!page.isClosed()) horizontalOverflow = await horizontalOverflowPx(page);
  } catch (e) { mobileOk = false; }

  // 4. Carga offline (bloqueando hosts externos) en escritorio
  let offlineOk = false;
  try {
    if (!page.isClosed()) await page.setViewportSize({ width: 1280, height: 720 });
    offlineOk = await loadOffline(page, url);
  } catch (e) { offlineOk = false; }

  const consoleErrors = collectors.consoleErrors.length;
  const pageErrors = collectors.pageErrors.length;
  const failedRequests = collectors.failedRequests.length;
  const externalRequests = collectors.externalRequests.length;

  // Clasificación
  let result = 'PASS';
  if (!desktopOk || !mobileOk || !offlineOk || failedRequests > 0 || pageErrors > 0 || consoleErrors > 0) {
    result = 'FAIL';
  } else if (externalRequests > 0 || horizontalOverflow > 0 || backNavigation === 'broken') {
    result = 'WARN';
  }

  return {
    route,
    desktop_load: desktopOk ? 'ok' : 'FAIL',
    mobile_load: mobileOk ? 'ok' : 'FAIL',
    console_errors: consoleErrors,
    page_errors: pageErrors,
    failed_requests: failedRequests,
    external_requests: externalRequests,
    back_navigation: backNavigation,
    interactive_controls: interactiveControls,
    horizontal_overflow: horizontalOverflow,
    offline_load: offlineOk ? 'ok' : 'FAIL',
    result,
    _detail: {
      consoleErrors: collectors.consoleErrors.slice(0, 5),
      pageErrors: collectors.pageErrors.slice(0, 5),
      failedRequests: collectors.failedRequests.slice(0, 5),
      externalRequests: collectors.externalRequests.slice(0, 5),
    },
  };
}

module.exports = { auditModule, checkBackNavigation, BASE_URL };
