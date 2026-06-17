/* js/state.js — Estado global y pub/sub simple */
var AppState = {
  usuario: 'estudiante',
  isTeacher: false,
  activeView: 'dashboard',
  activeCategory: null,
  cursos: [],
  libros: [],
  videos: [],
  multimedia: [],
  todosModulos: [],
  progreso: [],
  loading: true
};

var listeners = [];

function onStateChange(fn) {
  listeners.push(fn);
}

function notifyState() {
  listeners.forEach(function(fn) { fn(AppState); });
}

function setView(view) {
  // Update sidebar active state
  document.querySelectorAll('#sidebar a[data-view]').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('#sidebar a[data-cat]').forEach(function(el) {
    el.classList.remove('active');
  });

  // Handle the fixed "Inicio" button separately
  var inicioBtn = document.getElementById('sidebar-inicio-btn');
  if (inicioBtn) {
    if (view === 'dashboard') {
      inicioBtn.classList.add('active');
    } else {
      inicioBtn.classList.remove('active');
    }
  }

  // Also handle regular data-view links (legacy support)
  if (view === 'dashboard') {
    var dashLink = document.querySelector('#sidebar a[data-view="dashboard"]');
    if (dashLink) dashLink.classList.add('active');
  } else {
    var viewLink = document.querySelector('#sidebar a[data-view="' + view + '"]');
    if (viewLink) viewLink.classList.add('active');
  }

  AppState.activeView = view;
  AppState.activeCategory = null;

  // Show/hide sections
  document.querySelectorAll('.view-section').forEach(function(el) {
    el.classList.add('view-hidden');
  });
  var target = document.getElementById('view-' + view);
  if (target) target.classList.remove('view-hidden');

  notifyState();
}

// Mapping: sidebar label → data category slug
var CATEGORY_MAP = {
  'Ciencias y Naturaleza': 'ciencias',
  'Comunidad y Sociedad': 'cultura',
  'Lenguajes': 'lenguaje',
  'Lógica': 'matematicas',
  'Cuerpo y Expresión': 'juegos',
  'Tecnología': 'tecnologia',
  'Transversales': 'emprendimiento'
};

// Reverse lookup: data slug → sidebar label (for highlighting)
function getCategoryLabel(slug) {
  for (var label in CATEGORY_MAP) {
    if (CATEGORY_MAP[label] === slug) return label;
  }
  return null;
}

function setCategory(cat) {
  // Translate UI label to data slug if mapping exists
  var dataCat = CATEGORY_MAP[cat] || cat;
  AppState.activeCategory = dataCat;

  // Update sidebar active state
  document.querySelectorAll('#sidebar a[data-view]').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('#sidebar a[data-cat]').forEach(function(el) {
    if (el.getAttribute('data-cat') === cat) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Inicio button loses active when viewing a category
  var inicioBtn = document.getElementById('sidebar-inicio-btn');
  if (inicioBtn) inicioBtn.classList.remove('active');

  AppState.activeView = 'cursos';
  document.querySelectorAll('.view-section').forEach(function(el) {
    el.classList.add('view-hidden');
  });
  var target = document.getElementById('view-cursos');
  if (target) target.classList.remove('view-hidden');

  notifyState();
}
