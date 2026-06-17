/* js/wikipedia-viewer.js — Visor de Wikipedia Offline vía API local */
(function() {
  var searchInput, searchResults, articleContainer, wikiEmpty, wikiLoading, zimSelector;
  var debounceTimer = null;
  var currentZim = null; // null = buscar en todos

  function init() {
    searchInput = document.getElementById('wiki-search-input');
    searchResults = document.getElementById('wiki-search-results');
    articleContainer = document.getElementById('wiki-article-container');
    wikiEmpty = document.getElementById('wiki-empty');
    wikiLoading = document.getElementById('wiki-loading');
    zimSelector = document.getElementById('wiki-zim-selector');

    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var q = searchInput.value.trim();
      if (!q) { hideResults(); return; }
      debounceTimer = setTimeout(function() { doSearch(q); }, 350);
    });

    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', function(e) {
      if (searchResults && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        hideResults();
      }
    });

    // Cargar ZIMs disponibles
    loadZims();
  }

  function loadZims() {
    fetch('/api/wikipedia/zims')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.zims || data.zims.length === 0) {
          if (zimSelector) zimSelector.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">No hay archivos de Wikipedia cargados</span>';
          return;
        }
        currentZim = data.default || data.zims[0].slug;
        renderZimPills(data.zims, data.default);
      })
      .catch(function() {
        if (zimSelector) zimSelector.innerHTML = '<span style="color:var(--accent);font-size:0.85rem;">⚠️ Error al cargar fuentes</span>';
      });
  }

  function renderZimPills(zims, defaultSlug) {
    if (!zimSelector) return;
    zimSelector.innerHTML = '';
    zims.forEach(function(z) {
      var pill = document.createElement('button');
      pill.className = 'wiki-zim-pill';
      if (z.slug === defaultSlug) pill.classList.add('active');
      pill.textContent = (z.icon || '📦') + ' ' + z.nombre + ' (' + z.articles + ')';
      pill.setAttribute('data-zim', z.slug);
      pill.style.cssText = 'padding:6px 12px;border-radius:20px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);cursor:pointer;font-size:0.8rem;transition:all 0.2s;';
      pill.addEventListener('click', function() {
        currentZim = z.slug;
        zimSelector.querySelectorAll('.wiki-zim-pill').forEach(function(p) { p.classList.remove('active'); p.style.background='var(--bg-card)'; });
        pill.classList.add('active');
        pill.style.background = 'var(--accent)';
        pill.style.color = '#fff';
        // Re-buscar si hay query activa
        var q = searchInput.value.trim();
        if (q) doSearch(q);
      });
      zimSelector.appendChild(pill);
    });
    // Activar visual del default
    var defPill = zimSelector.querySelector('[data-zim="' + defaultSlug + '"]');
    if (defPill) { defPill.classList.add('active'); defPill.style.background = 'var(--accent)'; defPill.style.color = '#fff'; }
  }

  function doSearch(q) {
    var url = '/api/wikipedia/search?q=' + encodeURIComponent(q);
    if (currentZim) url += '&zim=' + encodeURIComponent(currentZim);

    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.results || data.results.length === 0) {
          searchResults.innerHTML = '<div style="padding:12px;color:var(--text-muted);text-align:center;">Sin resultados para "' + escHtml(q) + '"</div>';
          searchResults.style.display = 'block';
          return;
        }
        renderResults(data.results);
      })
      .catch(function() {
        searchResults.innerHTML = '<div style="padding:12px;color:var(--accent);text-align:center;">Error al buscar</div>';
        searchResults.style.display = 'block';
      });
  }

  function renderResults(results) {
    var html = '';
    results.forEach(function(r) {
      html += '<div class="wiki-result-item" data-path="' + escAttr(r.path) + '" data-zim="' + escAttr(r.zim_slug) + '"'
        + ' style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;transition:background 0.15s;"'
        + ' onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">'
        + '<span style="font-size:1.2rem;">📄</span>'
        + '<div style="flex:1;min-width:0;">'
        +   '<div style="font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(r.title) + '</div>'
        +   '<div style="font-size:0.75rem;color:var(--text-muted);">' + escHtml(r.zim_name) + '</div>'
        + '</div>'
        + '</div>';
    });
    searchResults.innerHTML = html;
    searchResults.style.display = 'block';

    // Click handlers
    searchResults.querySelectorAll('.wiki-result-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var path = item.getAttribute('data-path');
        var zim = item.getAttribute('data-zim');
        hideResults();
        searchInput.value = '';
        loadArticle(path, zim);
      });
    });
  }

  function hideResults() {
    if (searchResults) searchResults.style.display = 'none';
  }

  function loadArticle(path, zimSlug) {
    showLoading();
    var url = '/api/wikipedia/article?path=' + encodeURIComponent(path);
    if (zimSlug) url += '&zim=' + encodeURIComponent(zimSlug);

    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(article) {
        hideLoading();
        renderArticle(article);
      })
      .catch(function() {
        hideLoading();
        articleContainer.innerHTML = '<div class="empty-state" style="padding:32px;text-align:center;color:var(--accent);">❌ Error al cargar el artículo</div>';
      });
  }

  function renderArticle(article) {
    if (!articleContainer) return;

    // Sanitizar: remover scripts, event handlers, y <style> tags que targetean body/html/* (globales)
    var cleanHtml = article.html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/ on\w+="[^"]*"/gi, '')
      .replace(/ on\w+='[^']*'/gi, '')
      // Remover <style> tags que puedan tener reglas globales que NO sean ya .wiki-article-content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, function(match) {
        // Conservar solo si ya está scoped con .wiki-article-content
        if (match.indexOf('.wiki-article-content') !== -1) return match;
        return '';
      });

    var html = '<div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">'
      + '<button id="wiki-back-btn" style="background:var(--bg-card);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85rem;">← Volver</button>'
      + '<span style="font-size:0.8rem;color:var(--text-muted);">' + escHtml(article.zim_name) + '</span>'
      + '</div>'
      + '<h2 style="color:var(--accent);margin-bottom:16px;font-size:1.3rem;">' + escHtml(article.title) + '</h2>'
      + '<div class="wiki-article-content" style="line-height:1.7;font-size:0.95rem;">' + cleanHtml + '</div>';

    articleContainer.innerHTML = html;

    // Wire back button
    var backBtn = document.getElementById('wiki-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function() {
        articleContainer.innerHTML =
          '<div class="empty-state" style="padding:48px 24px;text-align:center;">' +
          '<div style="font-size:3rem;margin-bottom:16px;">🌐</div>' +
          '<p style="font-size:1.1rem;color:var(--text);margin-bottom:8px;">Wikipedia Offline</p>' +
          '<p style="font-size:0.85rem;color:var(--text-muted);">Busca artículos de la enciclopedia libre. Todo el contenido funciona sin conexión a internet.</p>' +
          '</div>';
      });
    }
  }

  function showLoading() {
    if (wikiEmpty) wikiEmpty.style.display = 'none';
    if (wikiLoading) wikiLoading.style.display = 'block';
    if (articleContainer) articleContainer.innerHTML = '';
  }

  function hideLoading() {
    if (wikiLoading) wikiLoading.style.display = 'none';
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
  window.wikipediaViewerInit = init;
})();
