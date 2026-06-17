// ========================================
// MÓDULO: SUMAS CON MANIPULATIVOS
// Drag & Drop funcional en táctil y ratón
// ========================================

const niveles = [
    { a: 2, b: 3, texto: "Tengo 2 semillas de maíz y planto 3 de frijol. ¿Cuántas tengo?" },
    { a: 1, b: 4, texto: "Encontré 1 piedra y luego 4 más. ¿Cuántas piedras tengo?" },
    { a: 3, b: 2, texto: "Mi mamá tejió 3 cestas y mi abuela 2. ¿Cuántas en total?" },
    { a: 4, b: 1, texto: "Hay 4 chivos y llega 1 más. ¿Cuántos chivos hay?" },
    { a: 2, b: 2, texto: "Junte 2 iguarayas y luego 2 más. ¿Cuántas tengo?" }
];

let nivelActual = 0;
let estrellas = 0;
let aciertos = 0;
let semillasEnA = 0;
let semillasEnB = 0;
let idSemilla = 0;

const el = {
    numA: document.getElementById('num-a'),
    numB: document.getElementById('num-b'),
    resultado: document.getElementById('resultado'),
    areaA: document.getElementById('area-a'),
    areaB: document.getElementById('area-b'),
    areaTotal: document.getElementById('area-total'),
    contA: document.getElementById('cont-a'),
    contB: document.getElementById('cont-b'),
    contTotal: document.getElementById('cont-total'),
    pool: document.getElementById('pool'),
    barra: document.getElementById('barra'),
    estrellas: document.getElementById('estrellas'),
    aciertos: document.getElementById('aciertos'),
    total: document.getElementById('total'),
    btnVerificar: document.getElementById('btn-verificar'),
    btnLimpiar: document.getElementById('btn-limpiar'),
    btnSiguiente: document.getElementById('btn-siguiente'),
    mensajeFinal: document.getElementById('mensaje-final'),
    operacion: document.getElementById('operacion')
};

el.total.textContent = niveles.length;

// SVG de semilla (maíz/frijol estilizado)
const svgSemilla = `<svg class="semilla-svg" viewBox="0 0 40 40">
    <ellipse cx="20" cy="22" rx="12" ry="14" fill="#F4D03F" stroke="#B7950B" stroke-width="2"/>
    <ellipse cx="20" cy="18" rx="8" ry="10" fill="#FCF3CF"/>
    <path d="M20 8 Q24 4 20 2 Q16 4 20 8" fill="#27AE60"/>
    <path d="M15 12 Q12 10 14 8" fill="#27AE60" stroke="#1E8449" stroke-width="1"/>
    <path d="M25 12 Q28 10 26 8" fill="#27AE60" stroke="#1E8449" stroke-width="1"/>
</svg>`;

// ========================================
// DRAG & DROP UNIVERSAL (Ratón + Táctil)
// ========================================

let arrastrando = null;
let offsetX = 0;
let offsetY = 0;
let origenPool = true;
let semillaOriginal = null;

function crearSemillaPool() {
    const div = document.createElement('div');
    div.className = 'semilla';
    div.innerHTML = svgSemilla;
    div.dataset.id = 'pool-' + (idSemilla++);

    div.addEventListener('mousedown', iniciarArrastre);
    div.addEventListener('touchstart', iniciarArrastre, { passive: false });

    return div;
}

function iniciarArrastre(e) {
    e.preventDefault();
    const esTouch = e.type === 'touchstart';
    const punto = esTouch ? e.touches[0] : e;

    semillaOriginal = e.currentTarget;
    origenPool = semillaOriginal.parentElement === el.pool;

    // Crear clon para arrastrar
    arrastrando = semillaOriginal.cloneNode(true);
    arrastrando.classList.add('arrastrando');
    arrastrando.dataset.id = 'drag-' + Date.now();

    const rect = semillaOriginal.getBoundingClientRect();
    offsetX = punto.clientX - rect.left;
    offsetY = punto.clientY - rect.top;

    arrastrando.style.left = (punto.clientX - offsetX) + 'px';
    arrastrando.style.top = (punto.clientY - offsetY) + 'px';
    arrastrando.style.width = rect.width + 'px';
    arrastrando.style.height = rect.height + 'px';

    document.body.appendChild(arrastrando);
    semillaOriginal.style.opacity = '0.3';

    if (esTouch) {
        document.addEventListener('touchmove', moverArrastre, { passive: false });
        document.addEventListener('touchend', finalizarArrastre);
    } else {
        document.addEventListener('mousemove', moverArrastre);
        document.addEventListener('mouseup', finalizarArrastre);
    }
}

function moverArrastre(e) {
    if (!arrastrando) return;
    e.preventDefault();
    const punto = e.type === 'touchmove' ? e.touches[0] : e;
    arrastrando.style.left = (punto.clientX - offsetX) + 'px';
    arrastrando.style.top = (punto.clientY - offsetY) + 'px';

    // Highlight zonas
    const centro = {
        x: punto.clientX - offsetX + arrastrando.offsetWidth / 2,
        y: punto.clientY - offsetY + arrastrando.offsetHeight / 2
    };

    [el.areaA, el.areaB, el.areaTotal].forEach(zona => {
        const rect = zona.getBoundingClientRect();
        if (centro.x >= rect.left && centro.x <= rect.right &&
            centro.y >= rect.top && centro.y <= rect.bottom) {
            zona.parentElement.classList.add('activa');
        } else {
            zona.parentElement.classList.remove('activa');
        }
    });
}

function finalizarArrastre(e) {
    if (!arrastrando) return;

    const punto = e.type === 'touchend' ? e.changedTouches[0] : e;
    const centro = {
        x: parseInt(arrastrando.style.left) + arrastrando.offsetWidth / 2,
        y: parseInt(arrastrando.style.top) + arrastrando.offsetHeight / 2
    };

    let soltado = false;
    const zonas = [
        { area: el.areaA, cont: 'a' },
        { area: el.areaB, cont: 'b' },
        { area: el.areaTotal, cont: 'total' }
    ];

    for (const { area, cont } of zonas) {
        const rect = area.getBoundingClientRect();
        if (centro.x >= rect.left && centro.x <= rect.right &&
            centro.y >= rect.top && centro.y <= rect.bottom) {

            // Crear semilla en zona
            const nuevaSemilla = document.createElement('div');
            nuevaSemilla.className = 'semilla semilla-en-zona';
            nuevaSemilla.innerHTML = svgSemilla;
            nuevaSemilla.dataset.id = 'zona-' + (idSemilla++);
            nuevaSemilla.dataset.zona = cont;

            // Doble click/tap para eliminar
            nuevaSemilla.addEventListener('dblclick', () => eliminarSemilla(nuevaSemilla));
            nuevaSemilla.addEventListener('touchstart', function(ev) {
                if (ev.touches.length > 1) eliminarSemilla(nuevaSemilla);
            });

            area.appendChild(nuevaSemilla);
            actualizarContadores();
            soltado = true;
            break;
        }
    }

    // Limpiar
    arrastrando.remove();
    arrastrando = null;
    semillaOriginal.style.opacity = '1';
    [el.areaA, el.areaB, el.areaTotal].forEach(z => z.parentElement.classList.remove('activa'));

    document.removeEventListener('mousemove', moverArrastre);
    document.removeEventListener('mouseup', finalizarArrastre);
    document.removeEventListener('touchmove', moverArrastre);
    document.removeEventListener('touchend', finalizarArrastre);

    if (!origenPool && soltado) {
        semillaOriginal.remove();
    }

    verificarHabilitarBoton();
}

function eliminarSemilla(semilla) {
    semilla.style.transform = 'scale(0)';
    setTimeout(() => {
        semilla.remove();
        actualizarContadores();
        verificarHabilitarBoton();
    }, 200);
}

function actualizarContadores() {
    semillasEnA = el.areaA.children.length;
    semillasEnB = el.areaB.children.length;
    const total = semillasEnA + semillasEnB;

    el.contA.textContent = semillasEnA;
    el.contB.textContent = semillasEnB;
    el.contTotal.textContent = total;

    // Animar contadores
    [el.contA, el.contB, el.contTotal].forEach(c => {
        c.parentElement.style.transform = 'scale(1.2)';
        setTimeout(() => c.parentElement.style.transform = 'scale(1)', 200);
    });
}

function verificarHabilitarBoton() {
    const nivel = niveles[nivelActual];
    const total = semillasEnA + semillasEnB;
    el.btnVerificar.disabled = !(semillasEnA === nivel.a && semillasEnB === nivel.b && total === nivel.a + nivel.b);
}

// ========================================
// LÓGICA DEL JUEGO
// ========================================

function cargarNivel() {
    const nivel = niveles[nivelActual];
    if (!nivel) {
        mostrarFinal();
        return;
    }

    // Reset visual
    el.areaA.innerHTML = '';
    el.areaB.innerHTML = '';
    el.areaTotal.innerHTML = '';
    semillasEnA = 0;
    semillasEnB = 0;
    actualizarContadores();

    el.numA.textContent = '?';
    el.numB.textContent = '?';
    el.resultado.textContent = '?';
    el.numA.classList.remove('revelado');
    el.numB.classList.remove('revelado');
    el.resultado.classList.remove('revelado');

    el.btnVerificar.disabled = true;
    el.btnVerificar.style.display = 'inline-block';
    el.btnSiguiente.style.display = 'none';

    // Generar pool de semillas
    el.pool.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        el.pool.appendChild(crearSemillaPool());
    }

    // Barra progreso
    const progreso = (nivelActual / niveles.length) * 100;
    el.barra.style.width = progreso + '%';
}

function verificar() {
    const nivel = niveles[nivelActual];
    const correcto = semillasEnA === nivel.a && semillasEnB === nivel.b;

    // Revelar números
    el.numA.textContent = nivel.a;
    el.numB.textContent = nivel.b;
    el.resultado.textContent = nivel.a + nivel.b;

    [el.numA, el.numB, el.resultado].forEach((el, i) => {
        setTimeout(() => el.classList.add('revelado'), i * 300);
    });

    // Mover semillas al total visualmente
    if (correcto) {
        estrellas += 1;
        aciertos += 1;
        mostrarFeedback('⭐');

        // Animar semillas al área total
        const semillas = [...el.areaA.children, ...el.areaB.children];
        semillas.forEach((s, i) => {
            setTimeout(() => {
                s.style.transition = 'all 0.5s ease';
                s.style.transform = 'scale(0)';
                setTimeout(() => {
                    s.remove();
                    const nueva = document.createElement('div');
                    nueva.className = 'semilla semilla-en-zona';
                    nueva.innerHTML = svgSemilla;
                    el.areaTotal.appendChild(nueva);
                }, 500);
            }, i * 100);
        });
    } else {
        mostrarFeedback('❌');
        el.areaA.parentElement.style.borderColor = 'var(--color-error)';
        el.areaB.parentElement.style.borderColor = 'var(--color-error)';
        setTimeout(() => {
            el.areaA.parentElement.style.borderColor = '';
            el.areaB.parentElement.style.borderColor = '';
        }, 1000);
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

function limpiar() {
    el.areaA.innerHTML = '';
    el.areaB.innerHTML = '';
    el.areaTotal.innerHTML = '';
    semillasEnA = 0;
    semillasEnB = 0;
    actualizarContadores();
    el.btnVerificar.disabled = true;

    // Regenerar pool
    el.pool.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        el.pool.appendChild(crearSemillaPool());
    }
}

function siguienteNivel() {
    nivelActual++;
    cargarNivel();
}

function mostrarFinal() {
    document.querySelector('.operacion-display').style.display = 'none';
    document.querySelector('.zonas-suma').style.display = 'none';
    document.querySelector('.deposito-semillas').style.display = 'none';
    document.querySelector('.controles-conteo').style.display = 'none';
    el.barra.style.width = '100%';
    el.mensajeFinal.style.display = 'block';
}

// Event listeners
el.btnVerificar.addEventListener('click', verificar);
el.btnLimpiar.addEventListener('click', limpiar);
el.btnSiguiente.addEventListener('click', siguienteNivel);

// Iniciar
cargarNivel();
