// ========================================
// MÓDULO: CONTEO WAYUU
// Canvas + Interacción táctil/ratón
// ========================================

const canvas = document.getElementById('canvas-conteo');
const ctx = canvas.getContext('2d');
const preguntaEl = document.getElementById('pregunta');
const opcionesEl = document.getElementById('opciones');
const btnVerificar = document.getElementById('btn-verificar');
const btnSiguiente = document.getElementById('btn-siguiente');
const barraEl = document.getElementById('barra');
const estrellasEl = document.getElementById('estrellas');
const aciertosEl = document.getElementById('aciertos');
const totalEl = document.getElementById('total');
const mensajeFinal = document.getElementById('mensaje-final');
const escena = document.getElementById('escena');

// Datos de niveles contextualizados para La Guajira
const niveles = [
    {
        pregunta: "¿Cuántos chivos hay en la ranchería?",
        cantidad: 3,
        tipo: 'chivo',
        opciones: [2, 3, 4, 5],
        fondo: 'dia'
    },
    {
        pregunta: "¿Cuántas cestas Wayuu tejió la abuela?",
        cantidad: 5,
        tipo: 'cesta',
        opciones: [4, 5, 6, 7],
        fondo: 'tarde'
    },
    {
        pregunta: "¿Cuántos chinchorros cuelgan del árbol?",
        cantidad: 2,
        tipo: 'chinchorro',
        opciones: [1, 2, 3, 4],
        fondo: 'dia'
    },
    {
        pregunta: "¿Cuántas piñas de iguaraya hay?",
        cantidad: 7,
        tipo: 'iguaraya',
        opciones: [6, 7, 8, 9],
        fondo: 'atardecer'
    },
    {
        pregunta: "¿Cuántos cactus hay en el desierto?",
        cantidad: 4,
        tipo: 'cactus',
        opciones: [3, 4, 5, 6],
        fondo: 'dia'
    }
];

let nivelActual = 0;
let seleccion = null;
let estrellas = 0;
let aciertos = 0;
let animacionId = null;
let objetosAnimados = [];

totalEl.textContent = niveles.length;

// ========================================
// DIBUJO EN CANVAS (sin imágenes externas)
// ========================================

function dibujarFondo(tipo) {
    const gradientes = {
        dia: ['#87CEEB', '#E8F4FD', '#F5E6C8', '#D4A373'],
        tarde: ['#FF6B35', '#F7C59F', '#E8D5B7', '#C9A87C'],
        atardecer: ['#6B5B95', '#FF6B6B', '#FFE66D', '#D4A373']
    };
    const colores = gradientes[tipo] || gradientes.dia;

    // Cielo
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, colores[0]);
    grad.addColorStop(0.4, colores[1]);
    grad.addColorStop(0.7, colores[2]);
    grad.addColorStop(1, colores[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sol o luna
    ctx.fillStyle = tipo === 'atardecer' ? '#FFF8DC' : '#FFD700';
    ctx.beginPath();
    ctx.arc(520, 60, 35, 0, Math.PI * 2);
    ctx.fill();

    // Arena ondulada
    ctx.fillStyle = '#E6C9A8';
    ctx.beginPath();
    ctx.moveTo(0, 280);
    ctx.quadraticCurveTo(150, 260, 300, 275);
    ctx.quadraticCurveTo(450, 290, 600, 270);
    ctx.lineTo(600, 350);
    ctx.lineTo(0, 350);
    ctx.fill();
}

function dibujarChivo(x, y, escala = 1, frame = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);

    // Cuerpo
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cabeza
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath();
    ctx.ellipse(25, -10, 18, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuernos
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, -22);
    ctx.quadraticCurveTo(35, -35, 40, -28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, -22);
    ctx.quadraticCurveTo(15, -35, 10, -28);
    ctx.stroke();

    // Ojo
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(28, -12, 3, 0, Math.PI * 2);
    ctx.fill();

    // Patas
    ctx.fillStyle = '#F5F5DC';
    ctx.fillRect(-20, 15, 8, 18);
    ctx.fillRect(-5, 15, 8, 18);
    ctx.fillRect(10, 15, 8, 18);
    ctx.fillRect(20, 15, 8, 18);

    // Cola animada
    const colaY = Math.sin(frame * 0.1) * 5;
    ctx.strokeStyle = '#F5F5DC';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-28, -5);
    ctx.quadraticCurveTo(-40, -10 + colaY, -38, 5 + colaY);
    ctx.stroke();

    ctx.restore();
}

function dibujarCesta(x, y, escala = 1, frame = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);

    // Base cesta
    ctx.fillStyle = '#D2691E';
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.lineTo(20, 30);
    ctx.lineTo(-20, 30);
    ctx.closePath();
    ctx.fill();

    // Patrón Wayuu (líneas horizontales coloridas)
    const colores = ['#C41E3A', '#1E6091', '#F4D03F', '#27AE60'];
    for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = colores[i];
        ctx.lineWidth = 3;
        ctx.beginPath();
        const yPos = 5 + i * 6;
        const ancho = 22 - i * 1.5;
        ctx.moveTo(-ancho, yPos);
        ctx.lineTo(ancho, yPos);
        ctx.stroke();
    }

    // Asa
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20, Math.PI, 0);
    ctx.stroke();

    // Brillo sutil
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-15, 5, 8, 20);

    ctx.restore();
}

function dibujarChinchorro(x, y, escala = 1, frame = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);

    // Hamaca curva
    const swing = Math.sin(frame * 0.05) * 5;

    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, -30);
    ctx.quadraticCurveTo(0 + swing, 20, 40, -30);
    ctx.stroke();

    // Tela del chinchorro
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.moveTo(-35, -25);
    ctx.quadraticCurveTo(0 + swing, 25, 35, -25);
    ctx.lineTo(30, -20);
    ctx.quadraticCurveTo(0 + swing, 20, -30, -20);
    ctx.closePath();
    ctx.fill();

    // Patrón Wayuu en tela
    ctx.strokeStyle = '#F4D03F';
    ctx.lineWidth = 2;
    for (let i = -20; i < 20; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i + swing * 0.3, -10);
        ctx.lineTo(i + 4 + swing * 0.3, 5);
        ctx.stroke();
    }

    ctx.restore();
}

function dibujarIguaraya(x, y, escala = 1, frame = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);

    // Fruto ovalado
    ctx.fillStyle = '#8B0000';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Espinas características
    ctx.strokeStyle = '#556B2F';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
        const angulo = (i / 8) * Math.PI * 2;
        const ex = Math.cos(angulo) * 12;
        const ey = Math.sin(angulo) * 18;
        ctx.beginPath();
        ctx.moveTo(ex * 0.7, ey * 0.7);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    // Brillo
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(-3, -5, 4, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function dibujarCactus(x, y, escala = 1, frame = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);

    // Tallo principal
    ctx.fillStyle = '#2E8B57';
    ctx.fillRect(-8, -40, 16, 45);

    // Brazo izquierdo
    ctx.fillRect(-22, -30, 14, 8);
    ctx.fillRect(-22, -35, 8, 12);

    // Brazo derecho
    ctx.fillRect(8, -25, 14, 8);
    ctx.fillRect(14, -30, 8, 12);

    // Espinas
    ctx.strokeStyle = '#F5F5DC';
    ctx.lineWidth = 1;
    const espinas = [[0, -35], [-5, -20], [5, -15], [-18, -32], [18, -27]];
    espinas.forEach(([ex, ey]) => {
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + (Math.random() - 0.5) * 4, ey - 5);
        ctx.stroke();
    });

    // Flor en cima (animada)
    if (Math.sin(frame * 0.03) > 0) {
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.arc(0, -42, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, -42, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

const dibujadores = {
    chivo: dibujarChivo,
    cesta: dibujarCesta,
    chinchorro: dibujarChinchorro,
    iguaraya: dibujarIguaraya,
    cactus: dibujarCactus
};

function generarPosiciones(cantidad) {
    const posiciones = [];
    const margenX = 80;
    const margenY = 80;
    const ancho = canvas.width - margenX * 2;
    const alto = canvas.height - margenY * 2 - 50;

    for (let i = 0; i < cantidad; i++) {
        let x, y, intentos = 0;
        do {
            x = margenX + Math.random() * ancho;
            y = margenY + Math.random() * alto;
            intentos++;
        } while (intentos < 50 && posiciones.some(p => Math.hypot(p.x - x, p.y - y) < 60));
        posiciones.push({ x, y, offset: Math.random() * Math.PI * 2 });
    }
    return posiciones;
}

function animarEscena() {
    const nivel = niveles[nivelActual];
    if (!nivel) return;

    const frame = Date.now() / 16;
    dibujarFondo(nivel.fondo);

    // Dibujar objetos con animación flotante
    if (objetosAnimados.length === 0) {
        objetosAnimados = generarPosiciones(nivel.cantidad);
    }

    const dibujador = dibujadores[nivel.tipo];
    objetosAnimados.forEach((obj, i) => {
        const flotar = Math.sin(frame * 0.05 + obj.offset) * 3;
        dibujador(obj.x, obj.y + flotar, 1, frame + i * 10);
    });

    animacionId = requestAnimationFrame(animarEscena);
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

    // Reset
    seleccion = null;
    objetosAnimados = [];
    btnVerificar.disabled = true;
    btnVerificar.style.display = 'inline-block';
    btnSiguiente.style.display = 'none';

    // Pregunta
    preguntaEl.textContent = nivel.pregunta;
    preguntaEl.style.animation = 'none';
    setTimeout(() => preguntaEl.style.animation = '', 10);

    // Opciones barajadas
    opcionesEl.innerHTML = '';
    const ops = [...nivel.opciones].sort(() => Math.random() - 0.5);
    ops.forEach(num => {
        const btn = document.createElement('button');
        btn.className = 'opcion-numero';
        btn.textContent = num;
        btn.onclick = () => seleccionarOpcion(num, btn);
        opcionesEl.appendChild(btn);
    });

    // Actualizar barra
    const progreso = (nivelActual / niveles.length) * 100;
    barraEl.style.width = progreso + '%';

    // Iniciar animación canvas
    if (animacionId) cancelAnimationFrame(animacionId);
    animarEscena();
}

function seleccionarOpcion(numero, btn) {
    document.querySelectorAll('.opcion-numero').forEach(b => b.classList.remove('seleccionada'));
    btn.classList.add('seleccionada');
    seleccion = numero;
    btnVerificar.disabled = false;
}

function verificar() {
    const nivel = niveles[nivelActual];
    const correcto = seleccion === nivel.cantidad;
    const botones = document.querySelectorAll('.opcion-numero');

    botones.forEach(btn => {
        const num = parseInt(btn.textContent);
        btn.disabled = true;
        if (num === nivel.cantidad) {
            btn.classList.add('correcta');
        } else if (num === seleccion && !correcto) {
            btn.classList.add('incorrecta');
        }
    });

    if (correcto) {
        estrellas += 1;
        aciertos += 1;
        mostrarFeedback('⭐');
    } else {
        mostrarFeedback('❌');
    }

    estrellasEl.textContent = estrellas;
    aciertosEl.textContent = aciertos;

    btnVerificar.style.display = 'none';
    btnSiguiente.style.display = 'inline-block';
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
    escena.style.display = 'none';
    opcionesEl.style.display = 'none';
    document.querySelector('.controles-conteo').style.display = 'none';
    barraEl.style.width = '100%';
    mensajeFinal.style.display = 'block';

    if (animacionId) cancelAnimationFrame(animacionId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar celebración
    let frame = 0;
    function celebrar() {
        ctx.fillStyle = '#F4E4BC';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < 20; i++) {
            const x = (Math.sin(frame * 0.02 + i) * 0.5 + 0.5) * canvas.width;
            const y = (Math.cos(frame * 0.03 + i * 2) * 0.5 + 0.5) * canvas.height;
            ctx.fillStyle = `hsl(${(frame + i * 30) % 360}, 70%, 60%)`;
            ctx.beginPath();
            ctx.arc(x, y, 8 + Math.sin(frame * 0.1 + i) * 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#2C1810';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`¡${estrellas} estrellas!`, canvas.width / 2, canvas.height / 2);

        frame++;
        animacionId = requestAnimationFrame(celebrar);
    }
    celebrar();
}

// Event listeners
btnVerificar.addEventListener('click', verificar);
btnSiguiente.addEventListener('click', siguienteNivel);

// Iniciar
cargarNivel();
