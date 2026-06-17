/* js/api.js — Funciones de API para EduConect Rural */
var API_BASE = '';

function fetchJSON(url) {
  return fetch(API_BASE + url).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
}

function getCursos() {
  return fetchJSON('/api/cursos');
}

function getBiblioteca() {
  return fetchJSON('/api/biblioteca');
}

function getVideos() {
  return fetchJSON('/api/videos');
}

function getMultimedia() {
  return fetchJSON('/api/multimedia');
}

function getProgreso(usuario) {
  return fetchJSON('/api/progreso/' + encodeURIComponent(usuario));
}

function saveProgreso(usuario, cursoId, porcentaje) {
  return fetch(API_BASE + '/api/progreso', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({usuario: usuario, curso_id: cursoId, porcentaje: porcentaje})
  });
}

function buscarAPI(query) {
  if (!query.trim()) return Promise.resolve([]);
  return fetchJSON('/api/buscar?q=' + encodeURIComponent(query) + '&limite=8');
}
