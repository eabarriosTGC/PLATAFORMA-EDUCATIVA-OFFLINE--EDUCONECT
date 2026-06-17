/**
 * Diario de Aprendizaje — EduConect Rural
 * ============================================
 * API de journal con localStorage, timeline visual,
 * rachas (streaks), y estadísticas de progreso.
 *
 * Clave localStorage: 'educonect_diario'
 *
 * Uso:
 *   Diario.registrar('cien-301', 'modulo_completado', { estrellas: 3, puntos: 150 });
 *   Diario.renderizarWall('contenedor-timeline');
 */

const Diario = (function () {
  'use strict';

  // ─── Configuración ──────────────────────────────────────────────
  const STORAGE_KEY = 'educonect_diario';
  const MAX_ENTRADAS = 500; // límite para no saturar localStorage

  // Mapa de tipos de evento → emoji + etiqueta legible
  const TIPO_META = {
    modulo_completado:  { emoji: '✅', label: 'Módulo completado' },
    logro_desbloqueado: { emoji: '🏆', label: 'Logro desbloqueado' },
    estrella_ganada:    { emoji: '⭐', label: 'Estrella ganada' },
    quiz_completado:    { emoji: '📝', label: 'Quiz completado' },
  };

  // Emojis de respaldo para módulos sin emoji explícito
  const EMOJI_POR_TIPO = {
    modulo_completado:  '📘',
    logro_desbloqueado: '🎖️',
    estrella_ganada:    '🌟',
    quiz_completado:    '✅',
  };

  // ─── Persistencia ───────────────────────────────────────────────

  function _cargar() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[Diario] Error al cargar entradas, reiniciando.', e);
      return [];
    }
  }

  function _guardar(entradas) {
    // Truncar si excede el máximo
    if (entradas.length > MAX_ENTRADAS) {
      entradas = entradas.slice(entradas.length - MAX_ENTRADAS);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entradas));
    } catch (e) {
      console.error('[Diario] Error al guardar en localStorage:', e);
    }
  }

  // ─── API pública ────────────────────────────────────────────────

  /**
   * Registrar una nueva entrada en el diario.
   *
   * @param {string} moduloId      - ID del módulo (ej. 'cien-301')
   * @param {string} tipo          - Tipo de evento: 'modulo_completado',
   *                                 'logro_desbloqueado', 'estrella_ganada',
   *                                 'quiz_completado'
   * @param {object} [datos={}]    - Datos extra: { estrellas, puntos, tiempo, ... }
   * @param {string} [moduloNombre] - Nombre legible del módulo
   * @param {string} [emoji]       - Emoji personalizado para el módulo
   * @returns {object} La entrada creada
   */
  function registrar(moduloId, tipo, datos, moduloNombre, emoji) {
    datos = datos || {};
    moduloNombre = moduloNombre || moduloId;
    emoji = emoji || datos.emoji || EMOJI_POR_TIPO[tipo] || '📌';

    const entrada = {
      fecha: new Date().toISOString(),
      moduloId: moduloId,
      moduloNombre: moduloNombre,
      tipo: tipo,
      datos: {
        estrellas: datos.estrellas || 0,
        puntos: datos.puntos || 0,
        tiempo: datos.tiempo || 0,
        ...datos,
      },
      emoji: emoji,
    };

    const entradas = _cargar();
    entradas.push(entrada);
    _guardar(entradas);

    return entrada;
  }

  /**
   * Obtener las últimas N entradas.
   * @param {number} [dias=30] - Cantidad de días hacia atrás (0 = sin límite)
   * @returns {object[]} Entradas ordenadas de más antigua a más reciente
   */
  function obtenerEntradas(dias) {
    dias = (dias === undefined) ? 30 : dias;
    const entradas = _cargar();

    if (dias <= 0) return entradas;

    const corte = new Date();
    corte.setDate(corte.getDate() - dias);
    const corteISO = corte.toISOString();

    return entradas.filter(function (e) {
      return e.fecha >= corteISO;
    });
  }

  /**
   * Obtener estadísticas agregadas del progreso.
   * @returns {object} { total_modulos, total_estrellas, total_puntos,
   *                     racha_dias, ultimo_dia, modulos_completados, ... }
   */
  function obtenerEstadisticas() {
    const entradas = _cargar();
    const stats = {
      total_modulos: 0,
      total_estrellas: 0,
      total_puntos: 0,
      racha_dias: 0,
      ultimo_dia: null,
      total_entradas: entradas.length,
      modulos_completados: 0,
      logros: 0,
      quizzes: 0,
    };

    if (entradas.length === 0) return stats;

    // Conjunto de módulos únicos completados
    const modulosUnicos = new Set();
    // Mapa día → actividad (para racha)
    const diasActivos = new Set();

    entradas.forEach(function (e) {
      if (e.tipo === 'modulo_completado') {
        modulosUnicos.add(e.moduloId);
        stats.modulos_completados++;
      }
      if (e.tipo === 'logro_desbloqueado') stats.logros++;
      if (e.tipo === 'quiz_completado') stats.quizzes++;

      stats.total_estrellas += (e.datos.estrellas || 0);
      stats.total_puntos += (e.datos.puntos || 0);

      // Marcar día activo (formato YYYY-MM-DD)
      const dia = e.fecha.slice(0, 10);
      diasActivos.add(dia);
    });

    stats.total_modulos = modulosUnicos.size;

    // Último día activo
    const ultimaEntrada = entradas[entradas.length - 1];
    stats.ultimo_dia = ultimaEntrada.fecha.slice(0, 10);

    // Calcular racha (días consecutivos hacia atrás desde hoy)
    stats.racha_dias = _calcularRachaDesde(diasActivos);

    return stats;
  }

  /**
   * Obtener la racha actual de días consecutivos de actividad.
   * @returns {object} { racha_dias, ultimo_dia, estado }
   */
  function obtenerRacha() {
    const entradas = _cargar();
    if (entradas.length === 0) {
      return { racha_dias: 0, ultimo_dia: null, estado: 'sin_actividad' };
    }

    const diasActivos = new Set();
    entradas.forEach(function (e) {
      diasActivos.add(e.fecha.slice(0, 10));
    });

    const racha = _calcularRachaDesde(diasActivos);
    const ultimaEntrada = entradas[entradas.length - 1];
    const ultimoDia = ultimaEntrada.fecha.slice(0, 10);
    const hoy = _fechaHoy();
    const ayer = _fechaOffset(-1);

    let estado = 'activa';
    if (ultimoDia !== hoy && ultimoDia !== ayer) {
      estado = 'rota';
    }

    return {
      racha_dias: racha,
      ultimo_dia: ultimoDia,
      fecha_hoy: hoy,
      estado: estado,
    };
  }

  // ─── Renderizado visual ─────────────────────────────────────────

  /** Inyecta el CSS del timeline en el <head> del documento */
  let _cssInyectado = false;

  function _inyectarCSS() {
    if (_cssInyectado) return;
    _cssInyectado = true;

    const style = document.createElement('style');
    style.textContent = `
/* ═══════════════════════════════════════════════════════════════
   Diario de Aprendizaje — Timeline Visual
   EduConect Rural
   ═══════════════════════════════════════════════════════════════ */

.diario-wall {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  max-width: 680px;
  margin: 0 auto;
  padding: 24px 16px;
  color: #1a1a2e;
}

/* ─── Encabezado de estadísticas ─── */
.diario-stats-header {
  background: linear-gradient(135deg, #2d6a4f 0%, #40916c 100%);
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 32px;
  color: #fff;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-around;
  box-shadow: 0 4px 20px rgba(45, 106, 79, 0.3);
}

.diario-stat-item {
  text-align: center;
  min-width: 70px;
}

.diario-stat-valor {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
}

.diario-stat-label {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ─── Racha ─── */
.diario-racha-badge {
  background: #ffb703;
  color: #1a1a2e;
  border-radius: 12px;
  padding: 6px 14px;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(255, 183, 3, 0.4);
}

.diario-racha-rota {
  background: #e9ecef;
  color: #6c757d;
  box-shadow: none;
}

/* ─── Timeline ─── */
.diario-timeline {
  position: relative;
  padding-left: 40px;
}

/* Línea vertical conectora */
.diario-timeline::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(to bottom, #40916c, #95d5b2, #b7e4c7);
  border-radius: 2px;
}

.diario-entrada {
  position: relative;
  margin-bottom: 28px;
  padding: 14px 18px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.diario-entrada:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Punto en la línea del timeline */
.diario-entrada::before {
  content: '';
  position: absolute;
  left: -30px;
  top: 22px;
  width: 14px;
  height: 14px;
  background: #40916c;
  border: 3px solid #d8f3dc;
  border-radius: 50%;
  z-index: 1;
  box-shadow: 0 0 0 4px rgba(64, 145, 108, 0.15);
}

.diario-entrada-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 6px;
}

.diario-entrada-emoji {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.diario-entrada-info {
  flex: 1;
  min-width: 0;
}

.diario-entrada-tipo {
  font-size: 13px;
  color: #6c757d;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
}

.diario-entrada-modulo {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
  margin-top: 2px;
  word-break: break-word;
}

.diario-entrada-fecha {
  font-size: 12px;
  color: #adb5bd;
  margin-top: 8px;
}

.diario-entrada-estrellas {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  background: #fff9db;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #e67700;
}

.diario-entrada-puntos {
  font-size: 12px;
  color: #868e96;
  margin-top: 4px;
}

/* ─── Vacío ─── */
.diario-vacio {
  text-align: center;
  padding: 60px 20px;
  color: #adb5bd;
}

.diario-vacio-emoji {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.diario-vacio-texto {
  font-size: 16px;
}

/* ─── Responsive ─── */
@media (max-width: 480px) {
  .diario-wall {
    padding: 16px 8px;
  }
  .diario-timeline {
    padding-left: 32px;
  }
  .diario-timeline::before {
    left: 14px;
  }
  .diario-entrada::before {
    left: -25px;
    width: 12px;
    height: 12px;
  }
  .diario-stats-header {
    padding: 14px 12px;
    gap: 8px;
  }
  .diario-stat-valor {
    font-size: 22px;
  }
}
    `.trim();
    document.head.appendChild(style);
  }

  /**
   * Renderiza el timeline visual de logros en un contenedor.
   * @param {string} containerId - ID del elemento DOM donde renderizar
   * @param {object} [opts]      - Opciones: { dias: 30, limite: 50, mostrarEstadisticas: true }
   */
  function renderizarWall(containerId, opts) {
    opts = opts || {};
    var dias = opts.dias !== undefined ? opts.dias : 30;
    var limite = opts.limite || 50;
    var mostrarEstadisticas = opts.mostrarEstadisticas !== false;

    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[Diario] Contenedor no encontrado:', containerId);
      return;
    }

    _inyectarCSS();

    var entradas = obtenerEntradas(dias);
    var stats = obtenerEstadisticas();
    var racha = obtenerRacha();

    // ─── Construir HTML ────────────────────────────────────────
    var html = '<div class="diario-wall">';

    // Estadísticas superiores
    if (mostrarEstadisticas) {
      html += '<div class="diario-stats-header">';
      html += _statHTML('📘', stats.total_modulos, 'Módulos');
      html += _statHTML('⭐', stats.total_estrellas, 'Estrellas');
      html += _statHTML('🔥', stats.racha_dias, 'Racha (días)');
      html += _statHTML('💎', stats.total_puntos, 'Puntos');
      html += '</div>';
    }

    // Badge de racha
    var rachaClase = racha.estado === 'rota' ? ' diario-racha-rota' : '';
    var rachaIcono = racha.estado === 'rota' ? '💤' : '🔥';
    var rachaTexto = racha.estado === 'rota'
      ? 'Racha pausada — ¡vuelve hoy!'
      : '🔥 Racha activa: ' + racha.racha_dias + ' día' + (racha.racha_dias !== 1 ? 's' : '') + ' seguido' + (racha.racha_dias > 1 ? 's' : '');
    html += '<div class="diario-racha-badge' + rachaClase + '">' + rachaIcono + ' ' + rachaTexto + '</div>';

    // Timeline
    if (entradas.length === 0) {
      html += '<div class="diario-vacio">';
      html += '<span class="diario-vacio-emoji">📭</span>';
      html += '<p class="diario-vacio-texto">Aún no hay actividad registrada.<br>¡Completa tu primer módulo para empezar!</p>';
      html += '</div>';
    } else {
      html += '<div class="diario-timeline">';

      // Mostrar del más reciente al más antiguo, limitado
      var recientes = entradas.slice().reverse().slice(0, limite);

      for (var i = 0; i < recientes.length; i++) {
        var e = recientes[i];
        var meta = TIPO_META[e.tipo] || { emoji: '📌', label: e.tipo };
        var fechaRelativa = _fechaRelativa(e.fecha);

        html += '<div class="diario-entrada">';
        html += '  <div class="diario-entrada-header">';
        html += '    <span class="diario-entrada-emoji">' + _esc(e.emoji) + '</span>';
        html += '    <div class="diario-entrada-info">';
        html += '      <div class="diario-entrada-tipo">' + _esc(meta.label) + '</div>';
        html += '      <div class="diario-entrada-modulo">' + _esc(e.moduloNombre) + '</div>';
        html += '    </div>';
        html += '  </div>';

        // Estrellas
        if (e.datos.estrellas > 0) {
          html += '  <div class="diario-entrada-estrellas">⭐ ' + e.datos.estrellas + ' estrella' + (e.datos.estrellas !== 1 ? 's' : '') + '</div>';
        }

        // Puntos
        if (e.datos.puntos > 0) {
          html += '  <div class="diario-entrada-puntos">+ ' + e.datos.puntos + ' puntos</div>';
        }

        // Fecha relativa + hora
        html += '  <div class="diario-entrada-fecha">' + _esc(fechaRelativa) + '</div>';
        html += '</div>';
      }

      html += '</div>'; // .diario-timeline
    }

    html += '</div>'; // .diario-wall
    container.innerHTML = html;
  }

  // ─── Helpers privados ───────────────────────────────────────────

  /** Calcula la racha de días consecutivos hacia atrás desde hoy */
  function _calcularRachaDesde(diasSet) {
    var racha = 0;
    var hoy = new Date();

    // Empezamos desde hoy hacia atrás
    for (var offset = 0; offset < 365; offset++) {
      var d = new Date(hoy);
      d.setDate(d.getDate() - offset);
      var iso = d.toISOString().slice(0, 10);
      if (diasSet.has(iso)) {
        racha++;
      } else {
        break;
      }
    }
    return racha;
  }

  /** Devuelve la fecha de hoy en YYYY-MM-DD */
  function _fechaHoy() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Devuelve fecha con offset en días en YYYY-MM-DD */
  function _fechaOffset(offsetDias) {
    var d = new Date();
    d.setDate(d.getDate() + offsetDias);
    return d.toISOString().slice(0, 10);
  }

  /** Convierte una fecha ISO a texto relativo ("Hoy", "Ayer", "Hace 3 días") */
  function _fechaRelativa(fechaISO) {
    var ahora = new Date();
    var fecha = new Date(fechaISO);

    // Diferencia en días (truncando horas)
    var hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    var fechaInicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    var diffDias = Math.floor((hoyInicio - fechaInicio) / (1000 * 60 * 60 * 24));

    var hora = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    if (diffDias === 0) {
      return 'Hoy a las ' + hora;
    } else if (diffDias === 1) {
      return 'Ayer a las ' + hora;
    } else if (diffDias < 7) {
      return 'Hace ' + diffDias + ' días';
    } else if (diffDias < 30) {
      var semanas = Math.floor(diffDias / 7);
      return 'Hace ' + semanas + ' semana' + (semanas !== 1 ? 's' : '');
    } else {
      return fecha.toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  /** Helper: genera un ítem de estadística */
  function _statHTML(emoji, valor, label) {
    return (
      '<div class="diario-stat-item">' +
      '<div class="diario-stat-valor">' + _esc(emoji) + ' ' + valor + '</div>' +
      '<div class="diario-stat-label">' + _esc(label) + '</div>' +
      '</div>'
    );
  }

  /** Escape básico de HTML (evita XSS) */
  function _esc(str) {
    if (!str) return '';
    str = String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Exportar API ───────────────────────────────────────────────
  return {
    registrar: registrar,
    obtenerEntradas: obtenerEntradas,
    obtenerEstadisticas: obtenerEstadisticas,
    obtenerRacha: obtenerRacha,
    renderizarWall: renderizarWall,
    // Utilidades expuestas para depuración / extensión
    _limpiar: function () {
      localStorage.removeItem(STORAGE_KEY);
    },
    _exportar: function () {
      return _cargar();
    },
  };
})();

// Exportar para entornos de módulos (ESM / bundlers)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Diario;
}
