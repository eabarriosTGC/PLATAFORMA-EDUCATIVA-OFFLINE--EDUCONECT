/* js/progreso-dashboard.js — Datos reales de progreso */
(function() {
  var qaProgresoCard = null;
  var qaProgresoPct = null;
  var qaProgresoBar = null;
  var statIniciados = null;
  var statCompletados = null;
  var statPromedio = null;
  var statTotal = null;
  var progresoList = null;
  var progresoEmpty = null;

  function loadProgreso() {
    getProgreso(AppState.usuario).then(function(progreso) {
      AppState.progreso = progreso || [];
      updateUI();
    }).catch(function() {
      // Fallback to empty
      AppState.progreso = [];
      updateUI();
    });
  }

  function updateUI() {
    var prog = AppState.progreso;
    var totalCursos = AppState.cursos.length;

    // Count localStorage progress items too
    var localCount = 0;
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('curso-progreso-') === 0 || keys[i].indexOf('video-pos-') === 0) {
          localCount++;
        }
      }
    } catch(e) {}

    // Quick access card
    if (qaProgresoCard && qaProgresoPct) {
      if (prog.length > 0 || localCount > 0) {
        qaProgresoCard.classList.add('qa-has-data');
        var avg = 0;
        if (prog.length > 0) {
          avg = prog.reduce(function(sum, p) { return sum + p.porcentaje; }, 0) / prog.length;
        }
        var completados = prog.filter(function(p) { return p.porcentaje >= 100; }).length;
        var modulosTotal = totalCursos || prog.length;
        qaProgresoPct.textContent = completados + ' de ' + modulosTotal + ' módulos · ' + Math.round(avg) + '% completado';
        // Update progress bar
        if (qaProgresoBar) {
          qaProgresoBar.style.width = Math.round(avg) + '%';
        }
      } else {
        qaProgresoCard.classList.remove('qa-has-data');
        qaProgresoPct.textContent = 'Tu avance y actividades';
        if (qaProgresoBar) qaProgresoBar.style.width = '0%';
      }
    }

    // Stats
    if (statIniciados) statIniciados.textContent = prog.length;
    if (statCompletados) statCompletados.textContent = prog.filter(function(p) { return p.porcentaje >= 100; }).length;
    if (statTotal) statTotal.textContent = totalCursos;
    if (statPromedio) {
      var avg = prog.length > 0
        ? Math.round(prog.reduce(function(sum, p) { return sum + p.porcentaje; }, 0) / prog.length)
        : 0;
      statPromedio.textContent = avg + '%';
    }

    // Progreso list
    if (progresoList && progresoEmpty) {
      progresoList.innerHTML = '';

      if (prog.length === 0) {
        progresoEmpty.style.display = 'block';
      } else {
        progresoEmpty.style.display = 'none';

        prog.forEach(function(p) {
          var curso = AppState.cursos.find(function(c) { return c.id === p.curso_id; });
          var titulo = curso ? curso.titulo : 'Curso #' + p.curso_id;

          var item = document.createElement('div');
          item.className = 'progreso-item';
          item.innerHTML =
            '<div class="progreso-item-title">' +
              escapeHtml(titulo) +
              '<div class="progress-bar-wrap" style="margin-top:6px;">' +
                '<div class="progress-bar-fill" style="width:' + Math.round(p.porcentaje) + '%;"></div>' +
              '</div>' +
            '</div>' +
            '<span class="progreso-item-pct">' + Math.round(p.porcentaje) + '%</span>' +
            '<span class="progreso-item-time">' + formatDate(p.ultima_vez) + '</span>';
          progresoList.appendChild(item);
        });
      }
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    } catch(e) {
      return dateStr;
    }
  }

  function init() {
    qaProgresoCard = document.getElementById('qa-progreso-card');
    qaProgresoPct = document.getElementById('qa-progreso-pct');
    qaProgresoBar = document.getElementById('qa-progreso-bar');
    statIniciados = document.getElementById('stat-iniciados');
    statCompletados = document.getElementById('stat-completados');
    statPromedio = document.getElementById('stat-promedio');
    statTotal = document.getElementById('stat-total');
    progresoList = document.getElementById('progreso-list');
    progresoEmpty = document.getElementById('progreso-empty');
  }

  // Export
  window.progresoDashboardInit = init;
  window.loadProgreso = loadProgreso;
  window.updateProgresoUI = updateUI;
})();
