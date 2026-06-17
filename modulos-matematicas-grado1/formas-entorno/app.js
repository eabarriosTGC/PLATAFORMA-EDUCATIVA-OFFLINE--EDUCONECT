// ========================================
// MÓDULO: FORMAS EN MI ENTORNO
// SVG Interactivo - Encuentra la forma
// ========================================

const nivelesFormas = [
    { forma: 'circulo', nombre: 'círculos', emoji: '🔴' },
    { forma: 'triangulo', nombre: 'triángulos', emoji: '🔺' },
    { forma: 'rectangulo', nombre: 'rectángulos', emoji: '🟦' }
];

let nivelActual = 0;
let estrellas = 0;
let aciertos = 0;
let encontradosEnNivel = 0;
let metaNivel = 0;
let formaActual = null;

const el = {
    instruccion: document.getElementById('instruccion'),
    formaBuscar: document.getElementById('forma-buscar'),
    svg: document.getElementById('svg-escena'),
    encontrados: document.getElementById('encontrados'),
    meta: document.getElementById('meta'),
    barra: document.getElementById('barra'),
    estrellas: document.getElementById('estrellas'),
    aciertos: document.getElementById('aciertos'),
    total: document.getElementById('total'),
    btnSiguiente: document.getElementById('btn-siguiente'),
    mensajeFinal: document.getElementById('mensaje-final'),
    leyendaCirculo: document.getElementById('leyenda-circulo'),
    leyendaTriangulo: document.getElementById('leyenda-triangulo'),
    leyendaRectangulo: document.getElementById('leyenda-rectangulo')
};

el.total.textContent = nivelesFormas.length;

// ========================================
// LÓGICA DEL JUEGO
// ========================================

function cargarNivel() {
    const nivel = nivelesFormas[nivelActual];
    if (!nivel) {
        mostrarFinal();
        return;
    }

    formaActual = nivel.forma;
    encontradosEnNivel = 0;

    // Contar cuántas formas hay en el SVG
    const formas = document.querySelectorAll(`.objeto-forma[data-forma="${nivel.forma}"]`);
    metaNivel = formas.length;

    // Reset visual
    el.formaBuscar.textContent = nivel.nombre;
    el.encontrados.textContent = '0';
    el.meta.textContent = metaNivel;
    el.btnSiguiente.style.display = 'none';

    // Actualizar leyenda
    [el.leyendaCirculo, el.leyendaTriangulo, el.leyendaRectangulo].forEach(l => {
        l.classList.remove('forma-activa', 'completada');
        l.classList.add('forma-inactiva');
    });

    const leyendas = {
        circulo: el.leyendaCirculo,
        triangulo: el.leyendaTriangulo,
        rectangulo: el.leyendaRectangulo
    };

    // Marcar completadas las anteriores
    for (let i = 0; i < nivelActual; i++) {
        const prev = nivelesFormas[i];
        leyendas[prev.forma].classList.remove('forma-inactiva');
        leyendas[prev.forma].classList.add('completada');
        leyendas[prev.forma].textContent = prev.emoji + ' ' + prev.nombre + ' ✓';
    }

    // Activar actual
    leyendas[nivel.forma].classList.remove('forma-inactiva');
    leyendas[nivel.forma].classList.add('forma-activa');
    leyendas[nivel.forma].textContent = nivel.emoji + ' ' + nivel.nombre;

    // Reset objetos SVG
    document.querySelectorAll('.objeto-forma').forEach(obj => {
        obj.classList.remove('encontrado', 'error-click');
        obj.style.pointerEvents = 'auto';
    });

    // Barra progreso
    const progreso = (nivelActual / nivelesFormas.length) * 100;
    el.barra.style.width = progreso + '%';
}

function manejarClick(e) {
    const obj = e.target.closest('.objeto-forma');
    if (!obj || obj.classList.contains('encontrado')) return;

    const formaObj = obj.dataset.forma;

    if (formaObj === formaActual) {
        // Correcto
        obj.classList.add('encontrado');
        obj.style.pointerEvents = 'none';
        encontradosEnNivel++;
        el.encontrados.textContent = encontradosEnNivel;

        // Tooltip
        mostrarTooltip(e.clientX, e.clientY, '¡Sí!');

        if (encontradosEnNivel >= metaNivel) {
            estrellas += 1;
            aciertos += 1;
            el.estrellas.textContent = estrellas;
            el.aciertos.textContent = aciertos;

            setTimeout(() => {
                mostrarFeedback('⭐');
                el.btnSiguiente.style.display = 'inline-block';
            }, 500);
        }
    } else {
        // Incorrecto
        obj.classList.add('error-click');
        mostrarTooltip(e.clientX, e.clientY, 'Ese no es...');

        setTimeout(() => {
            obj.classList.remove('error-click');
        }, 400);
    }
}

function mostrarTooltip(x, y, texto) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip-forma';
    tooltip.textContent = texto;
    tooltip.style.left = (x - 30) + 'px';
    tooltip.style.top = (y - 40) + 'px';
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 1000);
}

function mostrarFeedback(emoji) {
    const div = document.createElement('div');
    div.className = 'feedback';
    div.textContent = emoji;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

function siguienteNivel() {
    nivelActual++;
    cargarNivel();
}

function mostrarFinal() {
    document.querySelector('.escena-formas').style.display = 'none';
    document.querySelector('.leyenda-formas').style.display = 'none';
    document.querySelector('.controles-conteo').style.display = 'none';
    el.instruccion.style.display = 'none';
    el.barra.style.width = '100%';
    el.mensajeFinal.style.display = 'block';

    // Marcar todas las leyendas como completadas
    [el.leyendaCirculo, el.leyendaTriangulo, el.leyendaRectangulo].forEach((l, i) => {
        l.classList.remove('forma-activa', 'forma-inactiva');
        l.classList.add('completada');
        l.textContent = nivelesFormas[i].emoji + ' ' + nivelesFormas[i].nombre + ' ✓';
    });
}

// Event listeners (ratón y táctil)
el.svg.addEventListener('click', manejarClick);
el.svg.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    if (elem) {
        manejarClick({ target: elem, clientX: touch.clientX, clientY: touch.clientY });
    }
}, { passive: false });

el.btnSiguiente.addEventListener('click', siguienteNivel);

// Iniciar
cargarNivel();
