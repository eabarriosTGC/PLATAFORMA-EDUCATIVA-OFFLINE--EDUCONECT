// @ts-check
// helpers/origin-policy.js — Clasificador puro de tráfico interno/externo.
//
// Regla: interno = mismo origin que E2E_BASE_URL; externo = cualquier otro.
// Un origin incluye protocolo, host y puerto. No confía en nombres
// hardcodeados (localhost/127.0.0.1) porque la suite también corre contra
// la IP real de la LAN.

/**
 * Crea la política de origin para una base URL dada.
 * @param {string} baseUrl URL base (p. ej. http://192.168.1.50:8080)
 */
function createOriginPolicy(baseUrl) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const baseOrigin = new URL(normalizedBaseUrl).origin;

  /**
   * ¿Es una request a un origin distinto del base?
   * Los protocolos no-HTTP (data:, blob:, javascript:) no se clasifican
   * como tráfico HTTP externo.
   * @param {string} rawUrl
   */
  function isExternalRequest(rawUrl) {
    try {
      const parsed = new URL(rawUrl, normalizedBaseUrl);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }

      return parsed.origin !== baseOrigin;
    } catch {
      return false;
    }
  }

  return {
    baseUrl: normalizedBaseUrl,
    baseOrigin,
    isExternalRequest,
  };
}

module.exports = { createOriginPolicy };
