/* js/libro-viewer.js — Visor de libro con banner Wayuu */
(function() {
  var modal = null;
  var closeBtn = null;
  var closeBtnFooter = null;
  var iframe = null;
  var titleEl = null;
  var wayuuBanner = null;
  var descargarBtn = null;
  var currentLibro = null;

  function getLibroProgresoKey(id) {
    return 'libro-page-' + id;
  }

  function savePageFromHash() {
    if (!currentLibro || !iframe) return;
    try {
      // Check if iframe has src with #page=
      var src = iframe.src;
      var match = src.match(/#page=(\d+)/);
      if (match) {
        var page = parseInt(match[1], 10);
        localStorage.setItem(getLibroProgresoKey(currentLibro.id), page.toString());
      }
    } catch(e) {}
  }

  function abrirLibro(libroData) {
    currentLibro = libroData;
    if (!modal) return;

    titleEl.textContent = libroData.titulo || 'Libro';

    // Build URL: /modulos/comun/visor-pdf.html?file=/biblioteca/{path}
    var archivoPath = (libroData.archivo_path || '').replace('data/biblioteca/', '');
    var pdfUrl = '/modulos/comun/visor-pdf.html?file=/biblioteca/' + encodeURIComponent(archivoPath);

    // Check for stored page
    var storedPage = null;
    try {
      storedPage = localStorage.getItem(getLibroProgresoKey(libroData.id));
    } catch(e) {}

    if (storedPage) {
      pdfUrl += '#page=' + storedPage;
    }

    iframe.src = pdfUrl;

    // Show Wayuu banner if applicable
    if (wayuuBanner) {
      var isWayuu = false;
      // Check archivo_path (most reliable)
      if (libroData.archivo_path && libroData.archivo_path.toLowerCase().indexOf('wayuu') !== -1) {
        isWayuu = true;
      } else if (libroData.idioma === 'Wayuu' || libroData.categoria === 'Wayuu') {
        isWayuu = true;
      } else if (libroData.titulo && libroData.titulo.toLowerCase().indexOf('wayuu') !== -1) {
        isWayuu = true;
      }
      wayuuBanner.style.display = isWayuu ? 'flex' : 'none';
    }

    // Update download button
    if (descargarBtn && archivoPath) {
      var pdfDirectUrl = '/biblioteca/' + archivoPath;
      descargarBtn.setAttribute('data-url', pdfDirectUrl);
    }

    modal.classList.add('visible');
  }

  function cerrarLibro() {
    if (!modal) return;
    savePageFromHash();
    modal.classList.remove('visible');
    iframe.src = '';
    currentLibro = null;
  }

  function descargarPDF() {
    if (!descargarBtn) return;
    var url = descargarBtn.getAttribute('data-url');
    if (url) {
      // Use a direct <a> download click
      var a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  function init() {
    modal = document.getElementById('libro-modal');
    closeBtn = document.getElementById('libro-modal-close');
    closeBtnFooter = document.getElementById('libro-modal-close-btn');
    iframe = document.getElementById('libro-iframe');
    titleEl = document.getElementById('libro-modal-title');
    wayuuBanner = document.getElementById('libro-wayuu-banner');
    descargarBtn = document.getElementById('libro-btn-descargar');

    if (!modal) return;

    if (closeBtn) closeBtn.addEventListener('click', cerrarLibro);
    if (closeBtnFooter) closeBtnFooter.addEventListener('click', cerrarLibro);

    // Close on overlay click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) cerrarLibro();
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        cerrarLibro();
      }
    });

    if (descargarBtn) {
      descargarBtn.addEventListener('click', descargarPDF);
    }
  }

  // Export
  window.abrirLibro = abrirLibro;
  window.libroViewerInit = init;
})();
