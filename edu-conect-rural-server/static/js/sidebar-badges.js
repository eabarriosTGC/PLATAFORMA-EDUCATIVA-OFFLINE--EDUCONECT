/* js/sidebar-badges.js — Conteos dinámicos en sidebar */
(function() {
  function updateBadges() {
    // Count by category from cursos (backend uses slug names)
    var counts = {};
    AppState.cursos.forEach(function(curso) {
      var cat = curso.categoria || 'Sin categoría';
      counts[cat] = (counts[cat] || 0) + 1;
    });

    // Update each badge using CATEGORY_MAP for reverse lookup
    document.querySelectorAll('.nav-badge[data-cat]').forEach(function(badge) {
      var label = badge.getAttribute('data-cat');
      // Convert sidebar label to backend slug using CATEGORY_MAP
      var slug = CATEGORY_MAP[label] || label;
      var count = counts[slug] || 0;
      badge.textContent = count > 0 ? '(' + count + ')' : '';
      // Hide empty badges
      badge.style.display = count > 0 ? '' : 'none';
    });

    // Videos badge (Videos Descargados)
    var badgeVideos = document.getElementById('badge-videos');
    if (badgeVideos) {
      var videoTotal = AppState.videos.length;
      badgeVideos.textContent = videoTotal > 0 ? '(' + videoTotal + ')' : '';
      badgeVideos.style.display = videoTotal > 0 ? '' : 'none';
    }

    // Biblioteca badge
    var badgeBiblioteca = document.getElementById('badge-biblioteca');
    if (badgeBiblioteca) {
      var biblioTotal = AppState.libros.length;
      badgeBiblioteca.textContent = biblioTotal > 0 ? '(' + biblioTotal + ')' : '';
      badgeBiblioteca.style.display = biblioTotal > 0 ? '' : 'none';
    }

    // Módulos count in sidebar description
    var modulosCount = document.getElementById('sidebar-modulos-count');
    if (modulosCount && AppState.multimedia) {
      modulosCount.textContent = AppState.multimedia.length + ' juegos y lecciones';
    }
  }

  // Listen for state changes to update badges
  onStateChange(function() {
    updateBadges();
  });

  function init() {
    // Initial update will happen when data loads and notifyState fires
  }

  // Export
  window.sidebarBadgesInit = init;
  window.updateSidebarBadges = updateBadges;
})();
