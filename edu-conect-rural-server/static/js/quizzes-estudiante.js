(function () {
  'use strict';
  var catalogo = document.getElementById('quiz-catalog');
  var player = document.getElementById('quiz-player');
  if (!catalogo || !player) return;

  function texto(valor) {
    var nodo = document.createElement('div');
    nodo.textContent = valor == null ? '' : String(valor);
    return nodo.innerHTML;
  }
  function atributo(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function api(ruta, opciones) {
    return fetch(ruta, opciones).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) throw new Error(body.error || 'No se pudo completar la operación');
        return body;
      });
    });
  }
  function mostrarCatalogo() {
    player.hidden = true;
    catalogo.hidden = false;
    catalogo.innerHTML = '<div class="empty-state">Cargando cuestionarios…</div>';
    api('/api/quizzes').then(function (items) {
      document.getElementById('badge-quizzes').textContent = items.length;
      document.getElementById('qa-quizzes-count').textContent = items.length;
      if (!items.length) {
        catalogo.innerHTML = '<div class="empty-state">El profesor todavía no ha creado cuestionarios.</div>';
        return;
      }
      catalogo.innerHTML = items.map(function (q) {
        return '<article class="quiz-card-student" data-quiz="' + q.id + '" tabindex="0" role="button">' +
          '<span class="quiz-topic">' + texto(q.tema) + '</span><h3>' + texto(q.titulo) + '</h3>' +
          '<p>' + texto(q.descripcion || 'Actividad de práctica') + '</p>' +
          '<small>' + q.total_preguntas + ' pregunta' + (q.total_preguntas === 1 ? '' : 's') + '</small></article>';
      }).join('');
      catalogo.querySelectorAll('[data-quiz]').forEach(function (card) {
        function abrir() { cargar(Number(card.dataset.quiz)); }
        card.onclick = abrir;
        card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
      });
    }).catch(function (e) { catalogo.innerHTML = '<div class="empty-state">' + texto(e.message) + '</div>'; });
  }
  function campoPregunta(q, i) {
    var nombre = 'quiz-q-' + i;
    if (q.type === 'choice' || q.type === 'truefalse') {
      return '<div class="quiz-answers">' + q.options.map(function (o, n) {
        return '<label class="quiz-answer"><input type="radio" name="' + nombre + '" value="' + n + '"><span>' + texto(o) + '</span></label>';
      }).join('') + '</div>';
    }
    if (q.type === 'multi') {
      return '<div class="quiz-answers">' + q.options.map(function (o, n) {
        return '<label class="quiz-answer"><input type="checkbox" name="' + nombre + '" value="' + n + '"><span>' + texto(o) + '</span></label>';
      }).join('') + '</div>';
    }
    if (q.type === 'order') {
      return '<div class="quiz-answers">' + q.items.map(function (_, pos) {
        return '<label class="quiz-order-row"><strong>' + (pos + 1) + '.</strong><select name="' + nombre + '"><option value="">Selecciona…</option>' + q.items.map(function (item) { return '<option value="' + atributo(item) + '">' + texto(item) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '</div>';
    }
    var tipo = q.type === 'numeric' ? 'number' : 'text';
    var limites = q.type === 'numeric' ? ' step="any" min="' + q.min + '" max="' + q.max + '"' : '';
    return '<input class="quiz-text-answer" name="' + nombre + '" type="' + tipo + '"' + limites + ' autocomplete="off">';
  }
  function cargar(id) {
    catalogo.hidden = true;
    player.hidden = false;
    player.innerHTML = '<div class="empty-state">Preparando actividad…</div>';
    api('/api/quizzes/' + id + '/jugar').then(function (quiz) {
      player.innerHTML = '<button class="quiz-secondary" id="quiz-back" type="button">← Volver</button>' +
        '<h2>' + texto(quiz.titulo) + '</h2><p>' + texto(quiz.descripcion) + '</p><form id="quiz-form">' +
        quiz.preguntas.map(function (q, i) { return '<section class="quiz-question" data-question="' + i + '"><h3>' + (i + 1) + '. ' + texto(q.text) + '</h3>' + campoPregunta(q, i) + '</section>'; }).join('') +
        '<div class="quiz-actions"><button class="quiz-primary" type="submit">Calificar actividad</button></div></form>';
      document.getElementById('quiz-back').onclick = mostrarCatalogo;
      document.getElementById('quiz-form').onsubmit = function (e) { e.preventDefault(); enviar(quiz); };
    }).catch(function (e) { player.innerHTML = '<button class="quiz-secondary" id="quiz-back">← Volver</button><div class="empty-state">' + texto(e.message) + '</div>'; document.getElementById('quiz-back').onclick = mostrarCatalogo; });
  }
  function respuestas(quiz) {
    return quiz.preguntas.map(function (q, i) {
      var nombre = 'quiz-q-' + i;
      if (q.type === 'multi') return Array.from(player.querySelectorAll('[name="' + nombre + '"]:checked')).map(function (n) { return Number(n.value); });
      if (q.type === 'order') return Array.from(player.querySelectorAll('[name="' + nombre + '"]')).map(function (n) { return n.value; });
      var marcado = player.querySelector('[name="' + nombre + '"]:checked');
      if (q.type === 'choice' || q.type === 'truefalse') return marcado ? Number(marcado.value) : null;
      var entrada = player.querySelector('[name="' + nombre + '"]');
      if (q.type === 'numeric') return entrada && entrada.value !== '' ? Number(entrada.value) : null;
      return entrada ? entrada.value : '';
    });
  }
  function enviar(quiz) {
    var boton = player.querySelector('[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Calificando…';
    api('/api/quizzes/' + quiz.id + '/responder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuestas: respuestas(quiz) }) })
      .then(function (resultado) {
        var estudiante = localStorage.getItem('educonect_estudiante') || 'Estudiante';
        localStorage.setItem('educonect_quiz_ultimo_' + quiz.id, JSON.stringify({ porcentaje: resultado.porcentaje, fecha: new Date().toISOString(), estudiante: estudiante }));
        player.querySelectorAll('[data-question]').forEach(function (n, i) { n.classList.add(resultado.detalle[i] ? 'quiz-correct' : 'quiz-wrong'); });
        var form = document.getElementById('quiz-form');
        form.querySelectorAll('input,select,button').forEach(function (n) { n.disabled = true; });
        form.insertAdjacentHTML('beforeend', '<div class="quiz-result"><div class="quiz-score">' + resultado.porcentaje + '%</div><strong>' + resultado.correctas + ' de ' + resultado.total + ' correctas</strong><div class="quiz-actions" style="justify-content:center"><button class="quiz-primary" id="quiz-retry" type="button">Intentar de nuevo</button><button class="quiz-secondary" id="quiz-finish" type="button">Volver al catálogo</button></div></div>');
        document.getElementById('quiz-retry').onclick = function () { cargar(quiz.id); };
        document.getElementById('quiz-finish').onclick = mostrarCatalogo;
      }).catch(function (e) { boton.disabled = false; boton.textContent = 'Calificar actividad'; alert(e.message); });
  }
  mostrarCatalogo();
  if (location.hash === '#cuestionarios') setTimeout(function () { setView('cuestionarios'); }, 0);
  window.addEventListener('hashchange', function () { if (location.hash === '#cuestionarios') setView('cuestionarios'); });
})();
