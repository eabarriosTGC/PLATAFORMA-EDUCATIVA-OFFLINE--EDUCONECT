/* volver.js — Botón flotante para volver a Módulos Interactivos */
(function() {
  var btn = document.createElement('a');
  btn.href = '../index.html';
  btn.textContent = '🏠 Volver';
  btn.style.cssText =
    'position:fixed;top:12px;left:12px;z-index:9999;' +
    'background:#fff;color:#2D3047;text-decoration:none;' +
    'padding:8px 16px;border-radius:20px;' +
    'font-family:system-ui,sans-serif;font-size:0.9rem;font-weight:700;' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.15);' +
    'transition:transform 0.2s;' +
    'display:flex;align-items:center;gap:6px;';
  btn.onmouseenter = function() { this.style.transform = 'scale(1.05)'; };
  btn.onmouseleave = function() { this.style.transform = 'scale(1)'; };
  document.body.appendChild(btn);
})();
