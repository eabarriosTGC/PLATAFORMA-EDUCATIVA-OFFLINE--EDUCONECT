/* js/dashboard.js — Lógica principal del dashboard */
(function() {
  // DOM refs
  var sidebar = null;
  var hamburgerBtn = null;
  var sidebarOverlay = null;
  var greetingText = null;
  var rolCheckbox = null;
  var rolLabel = null;

  // Quick access refs
  var qaCursosCount = null;
  var qaBibliotecaCount = null;

  // Dashboard sections
  var bibliotecaPreviewGrid = null;

  // View grids
  var cursosGrid = null;
  var cursosFilters = null;
  var bibliotecaGrid = null;
  var bibliotecaFilters = null;
  var bibliotecaStats = null;
  var videosGrid = null;
  var videosEmpty = null;

  var currentBibliotecaFilter = 'todos';

  function init() {
    // Grab DOM refs
    sidebar = document.getElementById('sidebar');
    hamburgerBtn = document.getElementById('hamburger-btn');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    greetingText = document.getElementById('greeting-text');
    rolCheckbox = document.getElementById('rol-checkbox');
    rolLabel = document.getElementById('rol-label');

    qaCursosCount = document.getElementById('qa-cursos-count');
    qaBibliotecaCount = document.getElementById('qa-biblioteca-count');

    bibliotecaPreviewGrid = document.getElementById('biblioteca-preview-grid');

    cursosGrid = document.getElementById('cursos-grid');
    cursosFilters = document.getElementById('cursos-filters');
    bibliotecaGrid = document.getElementById('biblioteca-grid');
    bibliotecaFilters = document.getElementById('biblioteca-filters');
    bibliotecaStats = document.getElementById('biblioteca-stats');
    videosGrid = document.getElementById('videos-grid');
    videosEmpty = document.getElementById('videos-empty');
    var youtubeVideosGrid = document.getElementById('youtube-videos-grid');
    var youtubeVideosEmpty = document.getElementById('youtube-videos-empty');

    // Hamburger menu
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', toggleSidebar);
    }
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Sidebar navigation clicks
    if (sidebar) {
      sidebar.addEventListener('click', function(e) {
        var link = e.target.closest('a[data-view]');
        if (link) {
          e.preventDefault();
          var view = link.getAttribute('data-view');
          setView(view);
          closeSidebar();
          return;
        }

        var catLink = e.target.closest('a[data-cat]');
        if (catLink) {
          e.preventDefault();
          var cat = catLink.getAttribute('data-cat');
          setCategory(cat);
          closeSidebar();
          return;
        }
      });
    }

    // Quick access cards
    document.querySelectorAll('.qa-card[data-view]').forEach(function(card) {
      card.addEventListener('click', function() {
        var view = card.getAttribute('data-view');
        setView(view);
      });
    });

    // View all links
    document.querySelectorAll('.view-all-link[data-view]').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var view = link.getAttribute('data-view');
        setView(view);
      });
    });

    // Toggle rol
    if (rolCheckbox) {
      rolCheckbox.addEventListener('change', function() {
        AppState.isTeacher = rolCheckbox.checked;
        AppState.usuario = AppState.isTeacher ? 'profesor' : 'estudiante';
        if (rolLabel) {
          rolLabel.textContent = AppState.isTeacher ? 'Docente' : 'Estudiante';
        }
        updateGreeting();
        loadProgreso();
      });
    }

    // Biblioteca filters
    if (bibliotecaFilters) {
      bibliotecaFilters.addEventListener('click', function(e) {
        var btn = e.target.closest('.filter-btn');
        if (!btn) return;
        var filter = btn.getAttribute('data-filter');
        currentBibliotecaFilter = filter;
        bibliotecaFilters.querySelectorAll('.filter-btn').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        renderBiblioteca();
      });
    }

    // Listen for state changes
    onStateChange(function(state) {
      if (state.activeView === 'youtube') {
        renderVideos();
      }
      if (state.activeView === 'cursos') {
        renderCursos();
      }
      if (state.activeView === 'biblioteca') {
        renderBiblioteca();
      }
      if (state.activeView === 'progreso') {
        updateProgresoUI();
      }
      if (state.activeView === 'dashboard') {
        renderBibliotecaPreview();
      }
    });

    // Load all data
    loadAllData();
  }

  function toggleSidebar() {
    if (!sidebar) return;
    var isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      closeSidebar();
    } else {
      sidebar.classList.add('open');
      if (sidebarOverlay) sidebarOverlay.classList.add('visible');
    }
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('visible');
  }

  function updateGreeting() {
    if (!greetingText) return;
    if (AppState.isTeacher) {
      greetingText.textContent = '¡Hola, Docente! 👨‍🏫';
    } else {
      greetingText.textContent = '¡Hola, Estudiante! 👋';
    }
  }

  function loadAllData() {
    AppState.loading = true;

    var promises = [
      getCursos().then(function(data) {
        AppState.cursos = Array.isArray(data) ? data : (data.cursos || []);
      }).catch(function() {
        AppState.cursos = [];
      }),
      getBiblioteca().then(function(data) {
        var all = data.libros || [];
        // DEDUP: filtrar duplicados por archivo_path
        var seen = {};
        AppState.libros = all.filter(function(l) {
          var key = l.archivo_path || l.titulo || '';
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });
      }).catch(function() {
        AppState.libros = [];
      }),
      getVideos().then(function(data) {
        AppState.videos = data.videos || [];
      }).catch(function() {
        AppState.videos = [];
      }),
      getMultimedia().then(function(data) {
        AppState.multimedia = data.multimedia || [];
      }).catch(function() {
        AppState.multimedia = [];
      }),
      // Fetch all modulos (for course→module matching)
      fetch('/api/modulos').then(function(r) { return r.json(); }).then(function(data) {
        AppState.todosModulos = data.modulos || [];
      }).catch(function() {
        AppState.todosModulos = [];
      }),
      getProgreso(AppState.usuario).then(function(data) {
        AppState.progreso = data || [];
      }).catch(function() {
        AppState.progreso = [];
      })
    ];

    Promise.all(promises).then(function() {
      AppState.loading = false;

      // Update quick access counts
      if (qaCursosCount) qaCursosCount.textContent = AppState.cursos.length;
      if (qaBibliotecaCount) qaBibliotecaCount.textContent = AppState.libros.length;

      // Notify all listeners
      notifyState();

      // Render all sections
      renderBibliotecaPreview();
      renderCursos();
      renderBiblioteca();
      renderVideos();
      updateProgresoUI();

      // Set initial view (shows dashboard by default)
      setView('dashboard');
    }).catch(function() {
      AppState.loading = false;
      notifyState();
      // Set initial view even on error
      setView('dashboard');
    });
  }

  // ── Biblioteca Preview ──
  function renderBibliotecaPreview() {
    if (!bibliotecaPreviewGrid) return;
    bibliotecaPreviewGrid.innerHTML = '';

    if (AppState.libros.length === 0) {
      bibliotecaPreviewGrid.innerHTML = '<div class="empty-state">No hay libros disponibles</div>';
      return;
    }

    AppState.libros.slice(0, 5).forEach(function(libro, idx) {
      var card = createLibroCard(libro, idx);
      bibliotecaPreviewGrid.appendChild(card);
    });
  }

  // ── All Cursos ──
  function renderCursos() {
    if (!cursosGrid) return;

    var filtered = AppState.cursos;
    if (AppState.activeCategory && AppState.activeView === 'cursos') {
      filtered = AppState.cursos.filter(function(c) {
        return c.categoria === AppState.activeCategory;
      });
    }

    // Render filter buttons
    if (cursosFilters) {
      var cats = {};
      AppState.cursos.forEach(function(c) {
        cats[c.categoria] = (cats[c.categoria] || 0) + 1;
      });

      cursosFilters.innerHTML = '<button class="filter-btn' + (AppState.activeCategory ? '' : ' active') + '" data-filter="">Todos (' + AppState.cursos.length + ')</button>';
      Object.keys(cats).sort().forEach(function(cat) {
        var active = AppState.activeCategory === cat ? ' active' : '';
        cursosFilters.innerHTML += '<button class="filter-btn' + active + '" data-filter="' + escAttr(cat) + '">' + escHtml(cat) + ' (' + cats[cat] + ')</button>';
      });

      // Filter click handler
      cursosFilters.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var cat = btn.getAttribute('data-filter');
          if (cat) {
            // Find the sidebar label for this category slug
            var sideLabel = getCategoryLabel(cat);
            setCategory(sideLabel || cat);
          } else {
            // "Todos" — clear category filter
            AppState.activeCategory = null;
            AppState.activeView = 'cursos';
            document.querySelectorAll('#sidebar a[data-cat]').forEach(function(a) {
              a.classList.remove('active');
            });
            notifyState();
          }
        });
      });
    }

    cursosGrid.innerHTML = '';

    if (filtered.length === 0) {
      cursosGrid.innerHTML = '<div class="empty-state">No se encontraron cursos en esta categoría</div>';
      return;
    }

    filtered.forEach(function(curso) {
      var card = document.createElement('div');
      card.className = 'curso-card card-clickable';

      // Check progress
      var prog = AppState.progreso.find(function(p) { return p.curso_id === curso.id; });
      var hasProgress = prog && prog.porcentaje > 0;
      var isComplete = prog && prog.porcentaje >= 100;

      var progressHtml = '';
      if (hasProgress) {
        progressHtml = '<div class="progress-bar-wrap" style="margin-top:6px;">' +
          '<div class="progress-bar-fill" style="width:' + Math.round(prog.porcentaje) + '%;"></div>' +
        '</div>' +
        '<div style="font-size:0.75rem;color:var(--accent);margin-top:2px;">' + Math.round(prog.porcentaje) + '%</div>';
      }

      var buttonHtml = '';
      if (isComplete) {
        buttonHtml = '<button class="curso-btn" style="background:var(--success);">✓ Completado</button>';
      } else if (hasProgress) {
        buttonHtml = '<button class="curso-btn continuar-btn-verde">Continuar</button>';
      } else {
        buttonHtml = '<button class="curso-btn">Iniciar →</button>';
      }

      card.innerHTML =
        '<div class="curso-icon">📚</div>' +
        '<div class="curso-body">' +
          '<div class="curso-titulo">' + escHtml(curso.titulo) + '</div>' +
          '<div class="curso-desc">' + escHtml(curso.descripcion || '') + '</div>' +
          '<span class="curso-cat">' + escHtml(curso.categoria) + '</span>' +
          progressHtml +
        '</div>' +
        '<div class="curso-action">' + buttonHtml + '</div>';

      card.querySelector('.curso-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        abrirCurso(curso);
      });
      card.addEventListener('click', function() {
        abrirCurso(curso);
      });

      cursosGrid.appendChild(card);
    });
  }

  // Helper: check if a book is Wayuu (checks archivo_path and categoria)
  function isWayuu(libro) {
    if (!libro) return false;
    // Check archivo_path (e.g., "data/biblioteca/wayuu/...")
    if (libro.archivo_path && libro.archivo_path.toLowerCase().indexOf('wayuu') !== -1) return true;
    // Check categoria field
    if (libro.categoria && libro.categoria.toLowerCase() === 'wayuu') return true;
    return false;
  }

  // Helper: check if a book is Cuento
  function isCuento(libro) {
    if (!libro) return false;
    if (libro.archivo_path && libro.archivo_path.toLowerCase().indexOf('/cuentos/') !== -1) return true;
    if (libro.categoria && libro.categoria.toLowerCase() === 'cuento') return true;
    return false;
  }
  function renderBiblioteca() {
    if (!bibliotecaGrid) return;

    var filtered = AppState.libros;
    if (currentBibliotecaFilter && currentBibliotecaFilter !== 'todos') {
      filtered = AppState.libros.filter(function(l) {
        if (currentBibliotecaFilter === 'Wayuu') return isWayuu(l);
        if (currentBibliotecaFilter === 'Cuento') return isCuento(l);
        return true;
      });
    }

    // Stats
    if (bibliotecaStats) {
      var wayuuCount = AppState.libros.filter(function(l) { return isWayuu(l); }).length;
      var cuentosCount = AppState.libros.filter(function(l) { return isCuento(l); }).length;
      bibliotecaStats.textContent = 'Total: ' + AppState.libros.length + ' | Wayuu: ' + wayuuCount + ' | Cuentos: ' + cuentosCount;
    }

    bibliotecaGrid.innerHTML = '';

    if (filtered.length === 0) {
      bibliotecaGrid.innerHTML = '<div class="empty-state">No se encontraron libros</div>';
      return;
    }

    filtered.forEach(function(libro, idx) {
      var card = createLibroCard(libro, idx);
      bibliotecaGrid.appendChild(card);
    });
  }

  // ── All Videos (YouTube/videos descargados) ──
  function renderVideos() {
    if (videosGrid) {
      videosGrid.innerHTML = '';
      if (AppState.videos.length === 0) {
        if (videosEmpty) videosEmpty.style.display = 'block';
      } else {
        if (videosEmpty) videosEmpty.style.display = 'none';
        AppState.videos.forEach(function(video, idx) {
          var card = createVideoCard(video, idx);
          videosGrid.appendChild(card);
        });
      }
    }
  }

  // ── Helpers ──

  function createVideoCard(video, idx) {
    var card = document.createElement('div');
    card.className = 'video-card';
    card.style.position = 'relative';

    var thumbClass = 'thumb-bg-' + (idx % 5);
    var thumbHtml = '';
    if (video.thumbnail) {
      // Usar thumbnail_api si existe, sino usar thumbnail directo
      var thumbSrc = video.thumbnail_api || video.thumbnail;
      thumbHtml =
        '<img class="video-thumb" src="' + escAttr(thumbSrc) + '" ' +
        'alt="' + escAttr(video.title) + '" loading="lazy" ' +
        'onerror="this.parentElement.querySelector(\'.thumb-fallback\').style.display=\'flex\';this.style.display=\'none\';">' +
        '<div class="thumb-fallback video-thumb-fallback ' + thumbClass + '" style="display:none;">' +
        '<span style="font-size:2rem;">🎬</span>' +
        '<span style="font-size:0.7rem;padding:0 8px;">' + escHtml((video.title || '').substring(0, 25)) + '</span>' +
        '</div>';
    } else {
      thumbHtml =
        '<div class="thumb-fallback video-thumb-fallback ' + thumbClass + '">' +
        '<span style="font-size:2rem;">🎬</span>' +
        '<span style="font-size:0.7rem;padding:0 8px;">' + escHtml((video.title || '').substring(0, 25)) + '</span>' +
        '</div>';
    }

    var sizeStr = '';
    if (video.size) {
      if (video.size > 1024 * 1024) {
        sizeStr = (video.size / (1024 * 1024)).toFixed(1) + ' MB';
      } else {
        sizeStr = Math.round(video.size / 1024) + ' KB';
      }
    }

    card.innerHTML =
      thumbHtml +
      '<div class="video-card-body">' +
        '<div class="video-card-title">' + escHtml(video.title) + '</div>' +
        '<div class="video-card-meta">' +
          '<span>' + escHtml(video.type || 'mp4') + '</span>' +
          '<span>' + sizeStr + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="video-play-overlay">' +
        '<div class="video-play-btn">▶</div>' +
      '</div>';

    card.addEventListener('click', function() {
      abrirVideo(video);
    });

    return card;
  }

  function createLibroCard(libro, idx) {
    var card = document.createElement('div');
    card.className = 'libro-card';

    var thumbClass = 'thumb-bg-' + (idx % 5);
    var libroIsWayuu = isWayuu(libro);
    var libroIsCuento = isCuento(libro);

    var badgeHtml = '';
    if (libroIsWayuu) {
      badgeHtml = '<span class="libro-badge libro-badge-wayuu">🌵 Wayuu</span>';
    } else if (libroIsCuento) {
      badgeHtml = '<span class="libro-badge libro-badge-cuento">📘 Cuento</span>';
    }

    var archivoPath = (libro.archivo_path || '').replace('data/biblioteca/', '');

    card.innerHTML =
      '<div class="libro-thumb ' + thumbClass + '">📖</div>' +
      '<div class="libro-title">' + escHtml(libro.titulo) + '</div>' +
      badgeHtml +
      '<div class="libro-actions">' +
        '<button class="libro-btn libro-btn-abrir">Abrir</button>' +
        '<a class="libro-btn libro-btn-pdf" href="/biblioteca/' + escAttr(archivoPath) + '" download>PDF</a>' +
      '</div>';

    card.querySelector('.libro-btn-abrir').addEventListener('click', function(e) {
      e.stopPropagation();
      abrirLibro(libro);
    });

    card.addEventListener('click', function() {
      abrirLibro(libro);
    });

    return card;
  }

  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Export
  window.dashboardInit = init;
})();

// ── Boot everything when DOM is ready ──
var dashboardBooted = false;

function bootDashboard() {
  if (dashboardBooted) return;
  dashboardBooted = true;

  // Initialize all modules
  if (window.videoPlayerInit) videoPlayerInit();
  if (window.cursoViewerInit) cursoViewerInit();
  if (window.libroViewerInit) libroViewerInit();
  if (window.progresoDashboardInit) progresoDashboardInit();
  if (window.sidebarBadgesInit) sidebarBadgesInit();
  if (window.wikipediaViewerInit) wikipediaViewerInit();
  if (window.modulosViewerInit) modulosViewerInit();
  if (window.buscadorInit) buscadorInit();
  if (window.dashboardInit) dashboardInit();

  // Safety net: ensure a view is shown even if data loading stalls
  // If after 3 seconds no view is visible, force dashboard
  setTimeout(function() {
    var visible = document.querySelector('.view-section:not(.view-hidden)');
    if (!visible) {
      setView('dashboard');
    }
    // Ensure Inicio is highlighted in sidebar
    var inicioLink = document.querySelector('#sidebar a[data-view="dashboard"]');
    if (inicioLink && !inicioLink.classList.contains('active')) {
      inicioLink.classList.add('active');
    }
  }, 3000);
}

// DOMContentLoaded: first load
document.addEventListener('DOMContentLoaded', bootDashboard);

// pageshow + visibilitychange: keep "Inicio" button in sync
function syncInicioButton() {
  var btn = document.getElementById('sidebar-inicio-btn');
  if (!btn) return;
  if (AppState.activeView === 'dashboard') {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
}

window.addEventListener('pageshow', function() {
  setTimeout(syncInicioButton, 50);
});

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) syncInicioButton();
});
