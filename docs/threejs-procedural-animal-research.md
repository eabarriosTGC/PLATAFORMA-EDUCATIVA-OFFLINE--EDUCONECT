# Three.js Procedural Animal Geometry - Research Report

## Summary of techniques for creating detailed 3D animals using only procedural geometry (no external .glb/.obj files)

---

## 1. LatheGeometry — Cuerpos redondeados (chivo, iguana, cerámica)

**Concepto:** LatheGeometry rota un perfil 2D (Vector2[]) alrededor del eje Y para crear cuerpos con simetría axial. Ideal para torsos de animales redondeados.

**URLs de referencia:**
- Source: https://github.com/mrdoob/three.js/blob/dev/src/geometries/LatheGeometry.js
- Demos: https://threejs.org/examples/#webgl_geometry_lathe (en el geometry browser)
- Video demo: "Lathe geometry and 2d curves - threejs demo" en YouTube

**Técnica para cuerpos de animales:**
```
// Perfil para cuerpo de chivo/oveja (vista lateral)
const points = [];
points.push(new THREE.Vector2(0, -1.0));     // base
points.push(new THREE.Vector2(0.3, -0.8));   // pata trasera
points.push(new THREE.Vector2(0.5, -0.4));   // vientre
points.push(new THREE.Vector2(0.7, 0.0));    // torso medio
points.push(new THREE.Vector2(0.6, 0.3));    // lomo
points.push(new THREE.Vector2(0.4, 0.5));    // cuello
points.push(new THREE.Vector2(0.2, 0.8));    // cabeza
points.push(new THREE.Vector2(0.0, 1.0));    // punta
const geometry = new THREE.LatheGeometry(points, 24);
```

**Mejora:** Usar asimetría con phiStart/phiLength para crear cuerpos que no son completamente simétricos. Segmentos (24-32) dan balance entre detalle y performance.

**Para hocicos:** Perfiles asimétricos con curvatura suave al frente, más planos atrás.

---

## 2. CatmullRomCurve3 + TubeGeometry — Cuellos, colas, patas curvas

**Concepto:** CatmullRomCurve3 crea una curva suave 3D a partir de puntos de control. TubeGeometry extruye un tubo a lo largo de esa curva. Perfecto para cuellos de flamenco, colas de iguana/león, patas dobladas.

**URLs de referencia:**
- Source: https://github.com/mrdoob/three.js/blob/dev/src/geometries/TubeGeometry.js
- Demo oficial: https://threejs.org/examples/#webgl_geometry_extrude_splines
- Curvas paramétricas: Curves.js (CatmullRomCurve3, CubicBezierCurve3, QuadraticBezierCurve3)

**Técnica para cuello de flamenco/ave:**
```
const neckPoints = [
    new THREE.Vector3(0, 0, 0),     // base (pecho)
    new THREE.Vector3(0.2, 1, 0.1), // subiendo
    new THREE.Vector3(0.1, 2, -0.1),// curvando atrás
    new THREE.Vector3(-0.1, 2.5, 0.05), // curva que baja
    new THREE.Vector3(0, 3, 0)      // cabeza
];
const neckCurve = new THREE.CatmullRomCurve3(neckPoints);
const neckGeometry = new THREE.TubeGeometry(neckCurve, 12, 0.15, 8, false);
```

**Para cola de iguana:**
```
const tailPoints = [
    new THREE.Vector3(0, 0, 0),     // base (unión al cuerpo)
    new THREE.Vector3(0.5, -0.1, 0.3),
    new THREE.Vector3(1.0, -0.3, 0.5),
    new THREE.Vector3(1.8, -0.1, 0.8),  // curva ascendente
    new THREE.Vector3(2.5, 0.2, 0.6)
];
const tailCurve = new THREE.CatmullRomCurve3(tailPoints);
const tailGeometry = new THREE.TubeGeometry(tailCurve, 16, 0.1, 6, false);
```

**Variación de radio:** Para colas que se angostan, usar un `TubeGeometry` simple y escalar con matrix después, o usar `BufferGeometry` manual con vértices personalizados.

**Closed curves:** Pasar `closed=true` para anillos/órbitas (como anillos de serpiente enroscada).

---

## 3. ShapeGeometry — Alas, aletas, orejas, crestas

**Concepto:** Shape permite dibujar formas 2D con curvas Bezier, arcos, líneas. ShapeGeometry triangula esa forma en un mesh plano 2D. Ideal para alas de flamenco/murciélago, aletas de pez, orejas, crestas.

**URLs de referencia:**
- Source: https://github.com/mrdoob/three.js/blob/dev/src/geometries/ShapeGeometry.js
- Demo oficial: https://threejs.org/examples/#webgl_geometry_shapes
- Shape API: https://threejs.org/docs/#api/en/extras/core/Shape

**Técnica para ala de flamenco:**
```
const wingShape = new THREE.Shape();
wingShape.moveTo(0, 0);
wingShape.quadraticCurveTo(0.8, 0.5, 1.5, 0.2);
wingShape.quadraticCurveTo(1.8, -0.1, 1.2, -0.5);
wingShape.quadraticCurveTo(0.5, -0.3, 0, 0);
const wingGeometry = new THREE.ShapeGeometry(wingShape);
```

**Técnica para oreja de chivo:**
```
const earShape = new THREE.Shape();
earShape.moveTo(0, 0);
earShape.bezierCurveTo(0.1, 0.3, 0.05, 0.5, 0, 0.6);
earShape.bezierCurveTo(-0.05, 0.5, -0.1, 0.3, 0, 0);
const earGeometry = new THREE.ShapeGeometry(earShape);
```

**Usar con ExtrudeGeometry para dar grosor:**
```
const wingExtruded = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSegments: 2
});
```

---

## 4. Combinación de geometrías para animales completos

**Estrategia principal:** Crear el animal como un grupo de meshes (Group), cada parte con su geometría procedural, todas unidas con posiciones/rotaciones relativas.

**Estructura típica:**
```
const animal = new THREE.Group();

// Cuerpo principal (LatheGeometry)
animal.add(bodyMesh);

// Cabeza + hocico (SphereGeometry deformada o LatheGeometry más pequeño)
animal.add(headMesh);

// Cuello (TubeGeometry con CatmullRomCurve3)
animal.add(neckMesh);

// Patas (CylinderGeometry o TubeGeometry)
animal.add(frontLeftLeg);
animal.add(frontRightLeg);
animal.add(backLeftLeg);
animal.add(backRightLeg);

// Cola (TubeGeometry)
animal.add(tailMesh);

// Orejas (ShapeGeometry)
animal.add(leftEar);
animal.add(rightEar);

// Ojos (SphereGeometry)
animal.add(eyeLeft);
animal.add(eyeRight);
```

**Técnicas de detalle adicional:**
- Hocicos: SphereGeometry escalada + posicionada
- Cuernos: ConeGeometry delgado y curvo, o TubeGeometry con curva
- Pezuñas: Esferas aplanadas (SphereGeometry.scale(1, 0.5, 0.8))
- Pico: ConeGeometry rotado
- Lengua: TubeGeometry delgada y rosada

---

## 5. Three.js Geometry Browser — Ejemplos oficiales relevantes

**URL:** https://threejs.org/examples/

Ejemplos oficiales útiles:
- **geometry / extrude / splines** — TubeGeometry con CatmullRomCurve3
- **geometry / shapes** — ShapeGeometry para formas 2D
- **geometries** — demos de todas las geometrías básicas
- **geometry / teapot** — ejemplo de geometría procedural compleja (bezier patches)
- **geometry / terrain** — generación procedural de terreno

---

## 6. Técnicas avanzadas para más realismo

### a) BufferGeometry personalizado (custom vertex data)
Para formas que ninguna geometría estándar puede hacer, crear BufferGeometry manual con arrays de vértices, normales, UVs e índices.

URL: https://threejs.org/manual/#en/custom-buffergeometry

### b) Morph targets para animación
Agregar morph targets a geometrías procedurales para animar el animal (abrir boca, mover cola). Esto funciona con cualquier BufferGeometry.

### c) Vertex deformation en CPU
Modificar position attribute directamente con animación sinusoidal para simular respiración, movimiento del pelaje, etc.

### d) Curvas paramétricas personalizadas (CurveExtras)
Three.js incluye curvas paramétricas interesantes como HeartCurve, GrannyKnot, VivianiCurve. Se pueden usar como base para formas orgánicas.

Source: https://github.com/mrdoob/three.js/blob/dev/examples/jsm/curves/CurveExtras.js

### e) Materials con canvas texture
Crear texturas procedurales con Canvas 2D para dar color, patrones (manchas de chivo, rayas de tigre).

---

## 7. Ejemplos conocidos en la comunidad

- **"Scroll-Powered 3D Particle Animal Morph | Three.js Demo"** — YouTube (1.2K views). Técnica de morphing de partículas en formas de animales.

- **Three.js Journey** (curso de Bruno Simon): Lección sobre creación de "Low Poly Fox" con geometrías combinadas (BoxGeometry, SphereGeometry, CylinderGeometry).

- **Discourse Three.js** — "Best way to create low poly animals?" discusiones de la comunidad sobre creación de animales con geometrías básicas.

---

## 8. Código de ejemplo funcional (standalone con three.min.js)

```html
<!DOCTYPE html>
<html>
<head>
<title>Procedural Goat</title>
<style>body { margin: 0; overflow: hidden; }</style>
</head>
<body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(5, 3, 5);
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// LUZ
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

const goat = new THREE.Group();

// CUERPO (LatheGeometry)
const bodyPts = [];
bodyPts.push(new THREE.Vector2(0, -0.8));
bodyPts.push(new THREE.Vector2(0.4, -0.6));
bodyPts.push(new THREE.Vector2(0.8, -0.2));
bodyPts.push(new THREE.Vector2(1.0, 0.2));
bodyPts.push(new THREE.Vector2(0.9, 0.5));
bodyPts.push(new THREE.Vector2(0.6, 0.6));
bodyPts.push(new THREE.Vector2(0.3, 0.5));
bodyPts.push(new THREE.Vector2(0.06, 0.8));
bodyPts.push(new THREE.Vector2(0, 0.8));
const bodyGeo = new THREE.LatheGeometry(bodyPts, 20);
const bodyMat = new THREE.MeshLambertMaterial({color: 0xc8a882});
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.scale.set(1, 1, 1);
goat.add(body);

// CABEZA (SphereGeometry)
const headMat = new THREE.MeshLambertMaterial({color: 0xd4b896});
const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), headMat);
head.position.set(-0.15, 0.9, 0);
head.scale.set(1.2, 0.8, 0.9);
goat.add(head);

// HOCICO
const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), headMat);
snout.position.set(-0.08, 0.82, -0.32);
snout.scale.set(1.2, 0.6, 0.6);
goat.add(snout);

// CUELLO (CylinderGeometry)
const neckMat = new THREE.MeshLambertMaterial({color: 0xc8a882});
const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 0.35, 8), neckMat);
neck.position.set(0.35, 0.65, 0);
neck.rotation.z = -0.3;
goat.add(neck);

// PATAS (CylinderGeometry)
const legMat = new THREE.MeshLambertMaterial({color: 0xb8956e});
function addLeg(x, z, rotZ) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.6, 6), legMat);
    leg.position.set(x, -0.5, z);
    if (rotZ) leg.rotation.z = rotZ;
    goat.add(leg);
}
addLeg(0.5, 0.35);
addLeg(0.5, -0.35);
addLeg(-0.5, 0.35);
addLeg(-0.5, -0.35);

// COLA (TubeGeometry)
const tailPoints = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.1, 0.2, 0.1),
    new THREE.Vector3(-0.3, 0.1, 0.2),
    new THREE.Vector3(-0.4, 0.3, 0.1)
];
const tailCurve = new THREE.CatmullRomCurve3(tailPoints);
const tailMat = new THREE.MeshLambertMaterial({color: 0xc8a882});
const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 8, 0.04, 5, false), tailMat);
tail.position.set(-0.9, 0.1, 0);
goat.add(tail);

// OREJAS (ShapeGeometry)
function addEar(xScale) {
    const earShape = new THREE.Shape();
    earShape.moveTo(0, 0);
    earShape.quadraticCurveTo(0.1 * xScale, 0.15, 0, 0.2);
    earShape.quadraticCurveTo(-0.05 * xScale, 0.1, 0, 0);
    const earMat = new THREE.MeshLambertMaterial({color: 0xd4b896, side: THREE.DoubleSide});
    const ear = new THREE.Mesh(new THREE.ShapeGeometry(earShape), earMat);
    ear.position.set(-0.25 + (xScale > 0 ? 0.06 : -0.06), 1.0, 0.1 * xScale);
    ear.rotation.y = -0.3 * xScale;
    ear.rotation.x = 0.2;
    goat.add(ear);
}
addEar(1);
addEar(-1);

// OJOS
const eyeMat = new THREE.MeshLambertMaterial({color: 0x222222});
const pupilMat = new THREE.MeshLambertMaterial({color: 0x111111});
[-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
    eye.position.set(-0.15, 1.0, 0.18 * side);
    goat.add(eye);
});

goat.scale.set(1.5, 1.5, 1.5);
goat.position.y = 0.5;
scene.add(goat);

// PISO
const floorMat = new THREE.MeshLambertMaterial({color: 0x88aa88});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.5;
scene.add(floor);

function animate() {
    requestAnimationFrame(animate);
    goat.rotation.y += 0.005;
    renderer.render(scene, camera);
}
animate();
</script>
</body>
</html>
```

---

## 9. API Reference para standalone (three.min.js)

### LatheGeometry (r128+)
```javascript
new THREE.LatheGeometry(points, segments, phiStart, phiLength)
// points: Vector2[] - perfil 2D a rotar
// segments: int (default 12) - segmentos de circunferencia
// phiStart: float (default 0) - ángulo inicial
// phiLength: float (default 2*PI) - ángulo de rotación
```

### CatmullRomCurve3
```javascript
new THREE.CatmullRomCurve3(points, closed, curveType, tension)
// points: Vector3[] - puntos de control
// closed: boolean (default false)
// curveType: 'catmullrom' | 'centripetal' | 'chordal'
// tension: float (default 0.5) - 0=más recto, 1=más curvo
```

### TubeGeometry
```javascript
new THREE.TubeGeometry(path, tubularSegments, radius, radialSegments, closed)
// path: Curve - curva 3D (ej. CatmullRomCurve3)
// tubularSegments: int (default 64)
// radius: float (default 1)
// radialSegments: int (default 8)
// closed: boolean (default false)
```

### Shape & ShapeGeometry
```javascript
const shape = new THREE.Shape();
shape.moveTo(x, y);
shape.lineTo(x, y);
shape.quadraticCurveTo(cpx, cpy, x, y);
shape.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
shape.absarc(cx, cy, radius, startAngle, endAngle, clockwise);
new THREE.ShapeGeometry(shape, curveSegments);
```

---

## 10. Recomendaciones para implementation

1. **LatheGeometry para el torso** es la técnica más efectiva para dar forma orgánica. El perfil 2D (Vector2[]) permite controlar silueta con precisión.

2. **CatmullRomCurve3 + TubeGeometry** reemplaza CylinderGeometry para cuellos/colas curvas. La curva se define con pocos puntos de control.

3. **ShapeGeometry** para elementos planos (orejas, alas, crestas, aletas). Usar DoubleSide en el material.

4. **Estrategia híbrida**: LatheGeometry para torso + CatmullRomCurve3/TubeGeometry para cuello/cola + ShapeGeometry para orejas + geometrías básicas (Sphere, Cylinder) para extremidades da el mejor balance entre detalle y simplicidad de código.

5. **Usar Group** para armar el animal completo con posiciones relativas. Cada parte es un Mesh independiente.

6. **CanvasTexture** para patrones de color (manchas, rayas, ojos) hace que animales iguales geométricamente se vean diferentes.
