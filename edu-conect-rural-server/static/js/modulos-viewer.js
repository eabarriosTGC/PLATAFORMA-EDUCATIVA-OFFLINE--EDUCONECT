/* js/modulos-viewer.js — Visor de Módulos Interactivos Educativos */
(function() {
  var grid, empty, loading, viewerModal;

  function init() {
    grid = document.getElementById('modulos-grid');
    empty = document.getElementById('modulos-empty');
    loading = document.getElementById('modulos-loading');

    // Cargar cuando se active la vista
    onStateChange(function(state) {
      if (state.activeView === 'modulos') {
        loadModulos();
      }
    });

    // Cargar inmediatamente si ya estamos en modulos
    if (AppState.activeView === 'modulos') {
      loadModulos();
    }
  }

  function loadModulos() {
    if (!grid) return;
    if (grid.children.length > 0) return; // ya cargados

    showLoading();
    
    fetch('/api/modulos')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        hideLoading();
        if (!data.modulos || data.modulos.length === 0) {
          showEmpty();
          return;
        }
        renderGrid(data.modulos);
      })
      .catch(function() {
        hideLoading();
        showEmpty();
      });
  }

  function renderGrid(modulos) {
    grid.innerHTML = '';
    modulos.forEach(function(mod) {
      var card = createCard(mod);
      grid.appendChild(card);
    });
  }

  function createCard(mod) {
    var card = document.createElement('div');
    card.className = 'modulo-card';
    card.style.cssText = 'background:var(--bg-card);border-radius:16px;padding:20px;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;gap:8px;border:1px solid var(--border);';
    card.onmouseenter = function() { this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.15)'; };
    card.onmouseleave = function() { this.style.transform=''; this.style.boxShadow=''; };

    var etiquetaClass = mod.etiqueta === 'PhET' ? 'etiqueta-phet' : 'etiqueta-dba';
    var etiquetaColor = mod.etiqueta === 'PhET' ? '#4ECDC4' : '#FF6B6B';

    card.innerHTML = 
      '<div style="font-size:2.5rem;text-align:center;">' + escHtml(mod.icono) + '</div>' +
      '<h3 style="font-size:1rem;color:var(--text);margin:0;">' + escHtml(mod.titulo) + '</h3>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);">' + escHtml(mod.categoria) + '</div>' +
      '<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-size:0.7rem;padding:2px 8px;border-radius:8px;background:' + etiquetaColor + ';color:#fff;">' + escHtml(mod.etiqueta) + '</span>' +
        '<span style="font-size:0.8rem;color:var(--accent);">Abrir →</span>' +
      '</div>';

    card.addEventListener('click', function() {
      abrirModulo(mod);
    });

    return card;
  }

  function abrirModulo(mod) {
    // Crear modal con iframe
    removeViewer();

    var overlay = document.createElement('div');
    overlay.className = 'modulo-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:1000;display:flex;flex-direction:column;';

    var toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--bg-card);border-bottom:1px solid var(--border);';
    toolbar.innerHTML = 
      '<button class="modulo-close" style="background:var(--accent);border:none;color:#fff;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.9rem;">✕ Cerrar</button>' +
      '<span style="color:var(--text);font-weight:600;flex:1;">' + escHtml(mod.titulo) + '</span>' +
      '<span style="color:var(--text-muted);font-size:0.8rem;">' + escHtml(mod.categoria) + '</span>' +
      '<a href="' + escAttr(mod.path) + '" target="_blank" style="color:var(--accent);text-decoration:none;font-size:0.8rem;">🔗 Abrir en pestaña</a>';

    var iframe = document.createElement('iframe');
    iframe.src = mod.path;
    iframe.style.cssText = 'flex:1;width:100%;border:none;background:#fff;';

    overlay.appendChild(toolbar);
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    overlay.querySelector('.modulo-close').addEventListener('click', function() {
      removeViewer();
    });

    // Esc para cerrar
    var escHandler = function(e) {
      if (e.key === 'Escape') { removeViewer(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    viewerModal = overlay;
  }

  function removeViewer() {
    if (viewerModal) {
      viewerModal.remove();
      viewerModal = null;
    }
  }

  function showLoading() {
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
  }

  function hideLoading() {
    if (loading) loading.style.display = 'none';
  }

  function showEmpty() {
    if (empty) empty.style.display = 'block';
  }

  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  window.modulosViewerInit = init;
  window.abrirModulo = abrirModulo;
})();
