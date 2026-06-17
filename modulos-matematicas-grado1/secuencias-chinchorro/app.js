// ========================================
// MÓDULO: PATRONES WAYUU
// Secuencias y patrones de colores
// ========================================

const nivelesPatrones = [
    {
        secuencia: ['rojo', 'azul', 'rojo', 'azul', 'rojo'],
        respuesta: 'azul',
        patron: 'Alternado: rojo, azul, rojo, azul...',
        emoji: '🔴🔵🔴🔵🔴'
    },
    {
        secuencia: ['amarillo', 'amarillo', 'verde', 'amarillo', 'amarillo'],
        respuesta: 'verde',
        patron: 'Dos amarillos, uno verde, dos amarillos...',
        emoji: '🟡🟡🟢🟡🟡'
    },
    {
        secuencia: ['rojo', 'azul', 'amarillo', 'rojo', 'azul'],
        respuesta: 'amarillo',
        patron: 'Tres colores que se repiten: rojo, azul, amarillo...',
        emoji: '🔴🔵🟡🔴🔵'
    },
    {
        secuencia: ['verde', 'verde', 'verde', 'amarillo', 'verde'],
        respuesta: 'verde',
        patron: 'Mayoría verde con un amarillo en medio...',
        emoji: '🟢🟢🟢🟡🟢'
    },
    {
        secuencia: ['azul', 'rojo', 'rojo', 'azul', 'rojo'],
        respuesta: 'rojo',
        patron: 'Alternado con doble: azul, rojo-rojo, azul, rojo-rojo...',
        emoji: '🔵🔴🔴🔵🔴'
    }
];

const colores = {
    rojo:     { bg: '#C41E3A', emoji: '🔴', nombre: 'Rojo Wayuu' },
    azul:     { bg: '#1E6091', emoji: '🔵', nombre: 'Azul Mar' },
    amarillo: { bg: '#F4D03F', emoji: '🟡', nombre: 'Amarillo Sol' },
    verde:    { bg: '#27AE60', emoji: '🟢', nombre: 'Verde Cactus' },
    naranja:  { bg: '#E67E22', emoji: '🟠', nombre: 'Naranja Tierra' },
    morado:   { bg: '#8E44AD', emoji: '🟣', nombre: 'Morado Flor' }
};

let nivelActual = 0;
let estrellas = 0;
let aciertos = 0;
let seleccionColor = null;

const el = {
    secuencia: document.getElementById('secuencia'),
    casillaVacia: document.getElementById('casilla-vacia'),
    opciones: document.getElementById('opciones'),
    barra: document.getElementById('barra'),
    estrellas: document.getElementById('estrellas'),
    aciertos: document.getElementById('aciertos'),
    total: document.getElementById('total'),
    btnVerificar: document.getElementById('btn-verificar'),
    btnSiguiente: document.getElementById('btn-siguiente'),
    mensajeFinal: document.getElementById('mensaje-final'),
    instruccion: document.getElementById('instruccion')
};

el.total.textContent = nivelesPatrones.length;

// ========================================
// LÓGICA DEL JUEGO
// ========================================

function cargarNivel() {
    const nivel = nivelesPatrones[nivelActual];
    if (!nivel) {
        mostrarFinal();
        return;
    }

    seleccionColor = null;
    el.btnVerificar.disabled = true;
    el.btnVerificar.style.display = 'inline-block';
    el.btnSiguiente.style.display = 'none';

    // Renderizar secuencia
    el.secuencia.innerHTML = '';
    nivel.secuencia.forEach((color, i) => {
        const cuadro = document.createElement('div');
        cuadro.className = 'cuadro-patron';
        cuadro.style.backgroundColor = colores[color].bg;
        cuadro.style.animationDelay = (i * 0.15) + 's';
        cuadro.innerHTML = colores[color].emoji;
        el.secuencia.appendChild(cuadro);
    });

    // Reset casilla vacía
    el.casillaVacia.innerHTML = '<span class="signo-pregunta">?</span>';
    el.casillaVacia.classList.remove('llena');
    el.casillaVacia.style.backgroundColor = 'rgba(255,255,255,0.1)';

    // Generar opciones (respuesta + 3 distractores)
    const distractorKeys = Object.keys(colores).filter(c => c !== nivel.respuesta);
    const mezclados = [nivel.respuesta, ...distractorKeys.slice(0, 3)].sort(() => Math.random() - 0.5);

    el.opciones.innerHTML = '';
    mezclados.forEach(colorKey => {
        const btn = document.createElement('button');
        btn.className = 'boton-color';
        btn.style.backgroundColor = colores[colorKey].bg;
        btn.innerHTML = colores[colorKey].emoji;
        btn.title = colores[colorKey].nombre;
        btn.dataset.color = colorKey;
        btn.onclick = () => seleccionarColor(colorKey, btn);
        el.opciones.appendChild(btn);
    });

    // Barra progreso
    const progreso = (nivelActual / nivelesPatrones.length) * 100;
    el.barra.style.width = progreso + '%';
}

function seleccionarColor(color, btn) {
    document.querySelectorAll('.boton-color').forEach(b => b.classList.remove('seleccionado'));
    btn.classList.add('seleccionado');
    seleccionColor = color;

    // Previsualizar en casilla vacía
    el.casillaVacia.innerHTML = colores[color].emoji;
    el.casillaVacia.style.backgroundColor = colores[color].bg;
    el.casillaVacia.classList.add('llena');

    el.btnVerificar.disabled = false;
}

function verificar() {
    const nivel = nivelesPatrones[nivelActual];
    const correcto = seleccionColor === nivel.respuesta;

    const botones = document.querySelectorAll('.boton-color');
    botones.forEach(btn => {
        btn.disabled = true;
        const color = btn.dataset.color;
        if (color === nivel.respuesta) {
            btn.classList.add('correcto');
        } else if (color === seleccionColor && !correcto) {
            btn.classList.add('incorrecto');
        }
    });

    if (correcto) {
        estrellas += 1;
        aciertos += 1;
        mostrarFeedback('⭐');

        // Animar casilla vacía con éxito
        el.casillaVacia.style.boxShadow = '0 0 20px var(--color-exito)';
    } else {
        mostrarFeedback('❌');
        el.casillaVacia.style.boxShadow = '0 0 20px var(--color-error)';

        // Mostrar la respuesta correcta
        setTimeout(() => {
            el.casillaVacia.innerHTML = colores[nivel.respuesta].emoji;
            el.casillaVacia.style.backgroundColor = colores[nivel.respuesta].bg;
        }, 500);
    }

    el.estrellas.textContent = estrellas;
    el.aciertos.textContent = aciertos;

    el.btnVerificar.style.display = 'none';
    el.btnSiguiente.style.display = 'inline-block';
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
    el.secuencia.parentElement.style.display = 'none';
    el.opciones.style.display = 'none';
    document.querySelector('.flecha-continua').style.display = 'none';
    document.querySelector('.controles-conteo').style.display = 'none';
    el.instruccion.style.display = 'none';
    el.barra.style.width = '100%';
    el.mensajeFinal.style.display = 'block';
}

// Event listeners
el.btnVerificar.addEventListener('click', verificar);
el.btnSiguiente.addEventListener('click', siguienteNivel);

// Iniciar
cargarNivel();
