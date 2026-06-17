/* js/buscador.js — Búsqueda en tiempo real con índice local */
(function() {
  var searchIndex = [];
  var searchInput = null;
  var searchDropdown = null;
  var debounceTimer = null;

  function buildIndex() {
    searchIndex = [];

    // Add cursos
    AppState.cursos.forEach(function(curso) {
      searchIndex.push({
        tipo: 'curso',
        id: 'curso-' + curso.id,
        titulo: curso.titulo,
        descripcion: curso.descripcion,
        categoria: curso.categoria,
        data: curso
      });
    });

    // Add libros
    AppState.libros.forEach(function(libro) {
      searchIndex.push({
        tipo: 'libro',
        id: 'libro-' + libro.id,
        titulo: libro.titulo,
        descripcion: libro.descripcion || '',
        categoria: libro.categoria || libro.idioma || '',
        data: libro
      });
    });

    // Add videos
    AppState.videos.forEach(function(video) {
      searchIndex.push({
        tipo: 'video',
        id: 'video-' + video.id,
        titulo: video.title,
        descripcion: '',
        categoria: 'Video',
        data: video
      });
    });
  }

  function filterIndex(query) {
    var q = query.toLowerCase().trim();
    if (!q) return [];

    return searchIndex.filter(function(item) {
      var titleMatch = item.titulo.toLowerCase().indexOf(q) !== -1;
      var descMatch = item.descripcion.toLowerCase().indexOf(q) !== -1;
      return titleMatch || descMatch;
    }).slice(0, 8);
  }

  function getTypeIcon(tipo) {
    switch (tipo) {
      case 'curso': return '📚';
      case 'libro': return '📖';
      case 'video': return '🎬';
      default: return '📄';
    }
  }

  function getTypeLabel(tipo) {
    switch (tipo) {
      case 'curso': return 'Curso';
      case 'libro': return 'Libro';
      case 'video': return 'Video';
      default: return tipo;
    }
  }

  function renderResults(results) {
    if (!searchDropdown) return;

    searchDropdown.innerHTML = '';

    if (results.length === 0) {
      searchDropdown.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:0.85rem;">Sin resultados</div>';
    } else {
      results.forEach(function(item) {
        var el = document.createElement('div');
        el.className = 'search-result-item';
        el.innerHTML = '<span class="search-result-icon">' + getTypeIcon(item.tipo) + '</span>' +
          '<div class="search-result-info">' +
            '<div class="search-result-title">' + escapeHtml(item.titulo) + '</div>' +
            '<div class="search-result-cat">' + escapeHtml(item.categoria) + '</div>' +
          '</div>' +
          '<span class="search-result-badge">' + getTypeLabel(item.tipo) + '</span>';

        el.addEventListener('click', function() {
          navigateToResult(item);
          hideDropdown();
        });
        searchDropdown.appendChild(el);
      });
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function navigateToResult(item) {
    searchInput.value = item.titulo;

    switch (item.tipo) {
      case 'curso':
        if (window.abrirCurso) {
          abrirCurso(item.data);
        }
        break;
      case 'libro':
        if (window.abrirLibro) {
          abrirLibro(item.data);
        }
        break;
      case 'video':
        if (window.abrirVideo) {
          abrirVideo(item.data);
        }
        break;
      default:
        break;
    }
  }

  function showDropdown() {
    if (searchDropdown) searchDropdown.classList.add('visible');
  }

  function hideDropdown() {
    if (searchDropdown) searchDropdown.classList.remove('visible');
  }

  function handleInput() {
    showDropdown();
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(function() {
      var query = searchInput.value;
      var results = filterIndex(query);
      renderResults(results);
    }, 300);
  }

  function init() {
    searchInput = document.getElementById('search-input');
    searchDropdown = document.getElementById('search-dropdown');

    if (!searchInput || !searchDropdown) return;

    // Build index when data is ready
    onStateChange(function(state) {
      if (state.cursos.length > 0 || state.libros.length > 0 || state.videos.length > 0) {
        buildIndex();
      }
    });

    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('focus', function() {
      if (searchInput.value.trim()) {
        handleInput();
      }
    });

    // Close on escape
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        hideDropdown();
        searchInput.blur();
      }
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        hideDropdown();
      }
    });
  }

  // Export
  window.buscadorInit = init;
})();
