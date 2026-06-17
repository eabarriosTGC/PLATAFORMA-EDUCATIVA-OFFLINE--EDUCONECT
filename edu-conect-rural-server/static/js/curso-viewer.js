/* js/curso-viewer.js — Visor de curso con progreso y confeti */
(function() {
  var modal = null;
  var closeBtn = null;
  var closeBtnFooter = null;
  var iframe = null;
  var titleEl = null;
  var currentCurso = null;
  var currentPage = 1;
  var totalPages = 1;
  var navDiv = null;
  var pageInput = null;
  var pageTotal = null;
  var progressFill = null;
  var progressPct = null;
  var btnCompletar = null;
  var progressWrap = null;

  function getProgresoKey(id) {
    return 'curso-progreso-' + id;
  }

  function getProgresoLocal(id) {
    try {
      var stored = localStorage.getItem(getProgresoKey(id));
      if (stored) {
        var data = JSON.parse(stored);
        return data;
      }
    } catch(e) {}
    return null;
  }

  function saveProgresoLocal(id, page, pct) {
    try {
      localStorage.setItem(getProgresoKey(id), JSON.stringify({
        page: page,
        porcentaje: pct,
        timestamp: Date.now()
      }));
    } catch(e) {}
  }

  function updateProgress(page, total) {
    if (!total || total <= 0) total = 1;
    var pct = Math.min(100, Math.round((page / total) * 100));
    if (progressFill) progressFill.style.width = pct + '%';
    if (progressPct) progressPct.textContent = pct + '%';
    return pct;
  }

  // ── Buscar módulo interactivo correspondiente ───────────────────
  function encontrarModuloInteractivo(cursoData) {
    if (!AppState.todosModulos || !AppState.todosModulos.length) return null;

    // Estrategia 1: Extraer código del título (ej: "CIEN-301: Seres Vivos" → "cien-301")
    var titulo = cursoData.titulo || '';
    var match = titulo.match(/[A-Z]{2,5}-\d{3}/i);
    var codigo = match ? match[0].toLowerCase() : null;

    // Estrategia 2: Extraer código del archivo_path (ej: "modulos/cien-301/...")
    var archivo = cursoData.archivo_path || '';
    var matchPath = archivo.match(/([a-z]{2,5}-\d{3})/i);
    var codigoPath = matchPath ? matchPath[0].toLowerCase() : null;

    var codigoFinal = codigo || codigoPath;

    if (codigoFinal) {
      // Buscar match exacto por ID de módulo
      for (var i = 0; i < AppState.todosModulos.length; i++) {
        var mod = AppState.todosModulos[i];
        if (mod.id === codigoFinal) {
          return '/modulos/' + mod.id + '/';
        }
      }
    }

    return null;
  }

  function abrirCurso(cursoData) {
    currentCurso = cursoData;

    // ── Intentar match con módulo interactivo ──
    var moduloMatch = encontrarModuloInteractivo(cursoData);
    if (moduloMatch) {
      // Redirigir al módulo interactivo en vez del PDF
      window.location.href = moduloMatch;
      return;
    }

    if (!modal) return;

    titleEl.textContent = cursoData.titulo || 'Curso';

    // Show PDF in iframe
    var fileUrl = '/api/cursos/' + cursoData.id + '/archivo';
    iframe.src = fileUrl;

    // Check local storage for progress
    var localProg = getProgresoLocal(cursoData.id);
    if (localProg && localProg.page > 1) {
      // Show custom confirm dialog instead of native confirm()
      mostrarConfirmacionContinuar(localProg);
      modal.classList.add('visible');
      return; // Will continue in callback
    }

    // Update nav
    if (pageInput) pageInput.value = currentPage;
    updateProgress(currentPage, totalPages);

    // Update button text based on progress
    var apiProg = null;
    AppState.progreso.forEach(function(p) {
      if (p.curso_id === cursoData.id) apiProg = p;
    });
    if (apiProg && apiProg.porcentaje >= 100) {
      btnCompletar.textContent = '✓ Completado';
      btnCompletar.style.background = 'var(--success)';
      btnCompletar.disabled = true;
    } else if (apiProg && apiProg.porcentaje > 0) {
      btnCompletar.textContent = '✓ Marcar completado';
      btnCompletar.style.background = 'var(--success)';
      btnCompletar.disabled = false;
    } else {
      btnCompletar.textContent = '✓ Marcar completado';
      btnCompletar.style.background = 'var(--success)';
      btnCompletar.disabled = false;
    }

    modal.classList.add('visible');
  }

  function cerrarCurso() {
    if (!modal) return;

    // Save progress before closing
    if (currentCurso) {
      var pct = currentPage > 0 ? Math.min(100, Math.round((currentPage / Math.max(1, totalPages)) * 100)) : 0;
      saveProgresoLocal(currentCurso.id, currentPage, pct);

      // Also POST to API
      if (pct > 0) {
        saveProgreso(AppState.usuario, currentCurso.id, pct).catch(function() {});
      }
    }

    modal.classList.remove('visible');
    iframe.src = '';
    currentCurso = null;
  }

  function completarCurso() {
    if (!currentCurso) return;
    currentPage = totalPages || 1;
    updateProgress(currentPage, totalPages);
    var pct = 100;

    saveProgresoLocal(currentCurso.id, currentPage, pct);

    saveProgreso(AppState.usuario, currentCurso.id, pct).then(function() {
      btnCompletar.textContent = '✓ Completado';
      btnCompletar.style.background = 'var(--success)';
      btnCompletar.disabled = true;

      // Confetti!
      lanzarConfeti();
    }).catch(function() {
      btnCompletar.textContent = '✓ Completado';
      btnCompletar.style.background = 'var(--success)';
      btnCompletar.disabled = true;
      lanzarConfeti();
    });
  }

  function lanzarConfeti() {
    var colors = ['#c45a2c', '#e8a82e', '#2d7d5f', '#D4322F', '#F4A100', '#1A8FDD', '#8B3E9D', '#E84393'];
    var count = 40;

    for (var i = 0; i < count; i++) {
      setTimeout(function() {
        var piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.top = -(Math.random() * 40 + 10) + 'px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = (Math.random() * 8 + 6) + 'px';
        piece.style.height = (Math.random() * 8 + 6) + 'px';
        piece.style.animationDuration = (Math.random() * 1.5 + 1) + 's';
        piece.style.animationDelay = '0s';
        document.body.appendChild(piece);

        setTimeout(function() {
          if (piece.parentNode) piece.parentNode.removeChild(piece);
        }, 2000);
      }, i * 25);
    }
  }

  function navPrev() {
    if (currentPage > 1) {
      currentPage--;
      if (pageInput) pageInput.value = currentPage;
      iframe.src = '/api/cursos/' + currentCurso.id + '/archivo#page=' + currentPage;
      updateProgress(currentPage, totalPages);
    }
  }

  function navNext() {
    if (currentPage < totalPages) {
      currentPage++;
      if (pageInput) pageInput.value = currentPage;
      iframe.src = '/api/cursos/' + currentCurso.id + '/archivo#page=' + currentPage;
      updateProgress(currentPage, totalPages);
    }
  }

  // ── Custom confirmation modal ──────────────────────────────────────
  var confirmModal = null;
  var confirmText = null;
  var confirmBtn = null;
  var reiniciarBtn = null;
  var confirmClose = null;
  var confirmCallback = null;

  function mostrarConfirmacionContinuar(localProg) {
    if (!confirmModal || !confirmText) {
      if (confirm('Estabas en la página ' + localProg.page + '. ¿Continuar desde ahí?')) {
        currentPage = localProg.page;
        var fileUrl = '/api/cursos/' + currentCurso.id + '/archivo';
        iframe.src = fileUrl + '#page=' + currentPage;
        if (pageInput) pageInput.value = currentPage;
        updateProgress(currentPage, totalPages);
      }
      return;
    }

    confirmText.textContent = 'Estabas en la página ' + localProg.page + ' (' + localProg.porcentaje + '% completado). ¿Quieres continuar desde ahí?';
    confirmModal.classList.add('visible');
    confirmCallback = function(continuar) {
      if (continuar) {
        currentPage = localProg.page;
        var fileUrl = '/api/cursos/' + currentCurso.id + '/archivo';
        iframe.src = fileUrl + '#page=' + currentPage;
        if (pageInput) pageInput.value = currentPage;
        updateProgress(currentPage, totalPages);
      }
      confirmCallback = null;
    };
  }

  function initConfirmModal() {
    confirmModal = document.getElementById('confirm-continuar-modal');
    confirmText = document.getElementById('confirm-continuar-text');
    confirmBtn = document.getElementById('confirm-continuar-btn');
    reiniciarBtn = document.getElementById('confirm-reiniciar-btn');
    confirmClose = document.getElementById('confirm-continuar-close');

    function cerrarConfirm() {
      if (confirmModal) confirmModal.classList.remove('visible');
      if (confirmCallback) {
        confirmCallback(false);
        confirmCallback = null;
      }
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function() {
        confirmModal.classList.remove('visible');
        if (confirmCallback) {
          confirmCallback(true);
          confirmCallback = null;
        }
      });
    }

    if (reiniciarBtn) {
      reiniciarBtn.addEventListener('click', function() {
        confirmModal.classList.remove('visible');
        if (confirmCallback) {
          confirmCallback(false);
          confirmCallback = null;
        }
      });
    }

    if (confirmClose) confirmClose.addEventListener('click', cerrarConfirm);

    if (confirmModal) {
      confirmModal.addEventListener('click', function(e) {
        if (e.target === confirmModal) cerrarConfirm();
      });
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && confirmModal && confirmModal.classList.contains('visible')) {
        cerrarConfirm();
      }
    });
  }

  function init() {
    modal = document.getElementById('curso-modal');
    closeBtn = document.getElementById('curso-modal-close');
    closeBtnFooter = document.getElementById('curso-modal-close-btn');
    iframe = document.getElementById('curso-iframe');
    titleEl = document.getElementById('curso-modal-title');
    navDiv = document.getElementById('curso-nav');
    pageInput = document.getElementById('curso-page-input');
    pageTotal = document.getElementById('curso-page-total');
    progressFill = document.getElementById('curso-progress-fill');
    progressPct = document.getElementById('curso-progress-pct');
    btnCompletar = document.getElementById('curso-btn-completar');
    progressWrap = document.getElementById('curso-progress-wrap');

    if (!modal) return;

    initConfirmModal();

    if (closeBtn) closeBtn.addEventListener('click', cerrarCurso);
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', cerrarCurso);

    // Close on overlay click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) cerrarCurso();
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        cerrarCurso();
      }
    });

    if (btnCompletar) btnCompletar.addEventListener('click', completarCurso);

    // Navigation buttons
    var prevBtn = document.getElementById('curso-nav-prev');
    var nextBtn = document.getElementById('curso-nav-next');
    if (prevBtn) prevBtn.addEventListener('click', navPrev);
    if (nextBtn) nextBtn.addEventListener('click', navNext);

    // Page input
    if (pageInput) {
      pageInput.addEventListener('change', function() {
        var newPage = parseInt(pageInput.value, 10);
        if (!isNaN(newPage) && newPage >= 1 && newPage <= totalPages) {
          currentPage = newPage;
          iframe.src = '/api/cursos/' + currentCurso.id + '/archivo#page=' + currentPage;
          updateProgress(currentPage, totalPages);
        }
      });
    }
  }

  // Export
  window.abrirCurso = abrirCurso;
  window.cursoViewerInit = init;
})();
