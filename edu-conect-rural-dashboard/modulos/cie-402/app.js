(function () {
  'use strict';

  var MODULE_ID = 'cie-402';
  var STORAGE_KEY = 'educonect:module:' + MODULE_ID;
  var PLANETS = [
    { id:'sun', name:'Sol', icon:'☀️', color:0xffc247, radius:3.5, distance:0, speed:0, distanceText:'0 km', year:'—', summary:'La estrella que ilumina y calienta nuestro sistema planetario.', fact:'Concentra casi toda la masa del Sistema Solar.', type:'Estrella' },
    { id:'mercury', name:'Mercurio', icon:'⚪', color:0xa9a49b, radius:.48, distance:5.2, speed:4.15, distanceText:'57,9 millones de km', year:'88 días', summary:'Es pequeño, rocoso y el planeta más cercano al Sol.', fact:'Entre el día y la noche su temperatura cambia muchísimo.', type:'Planeta rocoso' },
    { id:'venus', name:'Venus', icon:'🟡', color:0xe7a84c, radius:.72, distance:7.1, speed:1.62, distanceText:'108,2 millones de km', year:'225 días', summary:'Un planeta rocoso cubierto por nubes muy densas.', fact:'Es el planeta más caliente, incluso más que Mercurio.', type:'Planeta rocoso' },
    { id:'earth', name:'Tierra', icon:'🌍', color:0x3b8ddb, radius:.78, distance:9.2, speed:1, distanceText:'149,6 millones de km', year:'365 días', summary:'Nuestro hogar: tiene agua líquida, atmósfera y gran diversidad de vida.', fact:'La Luna ayuda a estabilizar la inclinación del planeta.', type:'Planeta rocoso' },
    { id:'mars', name:'Marte', icon:'🔴', color:0xc85b3c, radius:.58, distance:11.2, speed:.53, distanceText:'227,9 millones de km', year:'687 días', summary:'El planeta rojo, frío y rocoso, con volcanes y antiguos cauces.', fact:'Su color rojizo se debe al óxido de hierro del suelo.', type:'Planeta rocoso' },
    { id:'jupiter', name:'Júpiter', icon:'🟠', color:0xd6a66b, radius:1.72, distance:14.5, speed:.084, distanceText:'778,5 millones de km', year:'11,86 años', summary:'El planeta más grande, formado principalmente por hidrógeno y helio.', fact:'Su Gran Mancha Roja es una tormenta gigantesca.', type:'Gigante gaseoso' },
    { id:'saturn', name:'Saturno', icon:'🪐', color:0xe5cc83, radius:1.48, distance:18.1, speed:.034, distanceText:'1.434 millones de km', year:'29,5 años', summary:'Un gigante gaseoso reconocido por su espectacular sistema de anillos.', fact:'Sus anillos están hechos de hielo, polvo y roca.', type:'Gigante gaseoso', ring:true },
    { id:'uranus', name:'Urano', icon:'🔵', color:0x78d4dc, radius:1.04, distance:21.6, speed:.012, distanceText:'2.871 millones de km', year:'84 años', summary:'Un gigante helado de color azul verdoso que gira casi acostado.', fact:'Su eje está inclinado cerca de 98 grados.', type:'Gigante helado' },
    { id:'neptune', name:'Neptuno', icon:'🔷', color:0x426bd7, radius:1.02, distance:24.8, speed:.006, distanceText:'4.495 millones de km', year:'164,8 años', summary:'El planeta más lejano, azul, frío y azotado por vientos extremos.', fact:'Tiene los vientos más rápidos medidos en el Sistema Solar.', type:'Gigante helado' }
  ];
  var MISSIONS = [
    { id:'mars', title:'Encuentra el planeta rojo', hint:'Selecciona el planeta conocido por el óxido de hierro de su superficie.' },
    { id:'jupiter', title:'Encuentra el planeta más grande', hint:'Busca el gigante que tiene la Gran Mancha Roja.' },
    { id:'saturn', title:'Encuentra el planeta de los anillos', hint:'Selecciona el gigante gaseoso con el sistema de anillos más visible.' },
    { id:'earth', title:'Regresa a nuestro hogar', hint:'Selecciona el planeta con océanos de agua líquida y vida conocida.' }
  ];
  var QUESTIONS = [
    { q:'¿Cuál es el planeta más cercano al Sol?', options:['Venus','Mercurio','Marte','Tierra'], answer:'Mercurio' },
    { q:'¿Qué planeta tarda cerca de 365 días en orbitar el Sol?', options:['Tierra','Júpiter','Mercurio','Neptuno'], answer:'Tierra' },
    { q:'¿Cuál es el planeta más grande?', options:['Saturno','Marte','Urano','Júpiter'], answer:'Júpiter' },
    { q:'¿Por qué Marte parece rojo?', options:['Por el agua','Por el óxido de hierro','Por sus nubes','Por el hielo'], answer:'Por el óxido de hierro' },
    { q:'¿Cuál tarda más en completar una órbita?', options:['Venus','Tierra','Neptuno','Júpiter'], answer:'Neptuno' }
  ];

  var state = loadProgress();
  var dom = {};
  var scene, camera, renderer, system, raycaster, pointer;
  var bodies = [], orbitLines = [], animationId = 0, lastTime = 0;
  var angleX = -.28, angleY = .22, cameraDistance = 38;
  var dragging = false, moved = false, startX = 0, startY = 0;
  var running = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  function loadProgress() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { mission: Math.min(Number(saved.mission) || 0, MISSIONS.length), quiz: Math.min(Number(saved.quiz) || 0, QUESTIONS.length), correct: Number(saved.correct) || 0, selected: saved.selected || 'sun' };
    } catch (_) { return { mission:0, quiz:0, correct:0, selected:'sun' }; }
  }
  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateProgress();
  }
  function updateProgress() {
    var completed = state.mission + state.quiz;
    var total = MISSIONS.length + QUESTIONS.length;
    var pct = Math.round(completed / total * 100);
    dom.progressText.textContent = pct + '%';
    dom.progressBar.style.width = pct + '%';
  }
  function cacheDom() {
    ['progressText','progressBar','planetButtons','planetBadge','planetName','planetSummary','planetDistance','planetYear','planetFact','missionTitle','missionHint','missionStatus','question','answers','quizFeedback','playButton','resetButton','speed','speedValue','orbits','scale','scene','fallback'].forEach(function (id) { dom[id] = $(id); });
  }
  function renderPlanetButtons() {
    dom.planetButtons.innerHTML = '';
    PLANETS.forEach(function (planet) {
      var button = document.createElement('button');
      button.type = 'button'; button.dataset.planet = planet.id;
      button.textContent = planet.icon + ' ' + planet.name;
      button.addEventListener('click', function () { selectPlanet(planet.id, true); });
      dom.planetButtons.appendChild(button);
    });
  }
  function selectPlanet(id, countMission) {
    var planet = PLANETS.find(function (item) { return item.id === id; }) || PLANETS[0];
    state.selected = planet.id;
    dom.planetBadge.textContent = planet.icon + ' ' + planet.type;
    dom.planetName.textContent = planet.name;
    dom.planetSummary.textContent = planet.summary;
    dom.planetDistance.textContent = planet.distanceText;
    dom.planetYear.textContent = planet.year;
    dom.planetFact.textContent = planet.fact;
    Array.prototype.forEach.call(dom.planetButtons.children, function (button) { button.classList.toggle('active', button.dataset.planet === planet.id); });
    bodies.forEach(function (body) {
      if (body.mesh.material.emissive) body.mesh.material.emissive.setHex(body.data.id === planet.id ? 0x333333 : 0x000000);
    });
    if (countMission && state.mission < MISSIONS.length && MISSIONS[state.mission].id === planet.id) {
      state.mission += 1;
      dom.missionStatus.textContent = '✓ ¡Misión cumplida!'; dom.missionStatus.className = 'status success';
      saveProgress();
      window.setTimeout(renderMission, 800);
    }
    saveProgress();
  }
  function renderMission() {
    if (state.mission >= MISSIONS.length) {
      dom.missionTitle.textContent = '¡Exploración completada!';
      dom.missionHint.textContent = 'Ya identificaste cuatro mundos importantes del Sistema Solar.';
      dom.missionStatus.textContent = '4 de 4 misiones'; dom.missionStatus.className = 'status success'; return;
    }
    var mission = MISSIONS[state.mission];
    dom.missionTitle.textContent = mission.title; dom.missionHint.textContent = mission.hint;
    dom.missionStatus.textContent = 'Misión ' + (state.mission + 1) + ' de ' + MISSIONS.length; dom.missionStatus.className = 'status';
  }
  function renderQuestion() {
    dom.answers.innerHTML = ''; dom.quizFeedback.textContent = '';
    if (state.quiz >= QUESTIONS.length) {
      dom.question.textContent = '¡Quiz completado!';
      dom.quizFeedback.textContent = 'Resultado: ' + state.correct + ' de ' + QUESTIONS.length + ' respuestas correctas.';
      var reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Repetir quiz';
      reset.addEventListener('click', function () { state.quiz = 0; state.correct = 0; saveProgress(); renderQuestion(); });
      dom.answers.appendChild(reset); return;
    }
    var question = QUESTIONS[state.quiz]; dom.question.textContent = question.q;
    question.options.forEach(function (option) {
      var button = document.createElement('button'); button.type = 'button'; button.textContent = option;
      button.addEventListener('click', function () {
        var correct = option === question.answer;
        button.classList.add(correct ? 'correct' : 'wrong');
        dom.quizFeedback.textContent = correct ? '✓ ¡Correcto!' : 'La respuesta correcta es: ' + question.answer + '.';
        Array.prototype.forEach.call(dom.answers.children, function (item) { item.disabled = true; });
        state.quiz += 1; if (correct) state.correct += 1; saveProgress();
        window.setTimeout(renderQuestion, 900);
      });
      dom.answers.appendChild(button);
    });
  }

  function makeOrbit(radius) {
    var points = [], segments = 96;
    for (var i = 0; i <= segments; i += 1) { var a = i / segments * Math.PI * 2; points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)); }
    var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color:0x426083, transparent:true, opacity:.42 }));
    orbitLines.push(line); system.add(line);
  }
  function initThree() {
    if (!window.THREE) throw new Error('Three.js no disponible');
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(48, 1, .1, 140);
    renderer = new THREE.WebGLRenderer({ antialias: !(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4), alpha:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x000000, 0);
    dom.scene.insertBefore(renderer.domElement, dom.fallback); renderer.domElement.setAttribute('aria-hidden', 'true');
    system = new THREE.Group(); scene.add(system);
    scene.add(new THREE.AmbientLight(0x61799e, .65)); var sunLight = new THREE.PointLight(0xffffff, 2.2, 90); system.add(sunLight);
    var stars = new THREE.BufferGeometry(), starPoints = [];
    for (var s = 0; s < 650; s += 1) { var r = 36 + Math.random() * 45, p = Math.random() * Math.PI * 2, t = Math.acos(2 * Math.random() - 1); starPoints.push(new THREE.Vector3(r*Math.sin(t)*Math.cos(p), r*Math.cos(t), r*Math.sin(t)*Math.sin(p))); }
    stars.setFromPoints(starPoints); scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color:0xffffff, size:.08, transparent:true, opacity:.75 })));
    var segments = window.innerWidth < 600 ? 20 : 30;
    PLANETS.forEach(function (planet, index) {
      var geometry = new THREE.SphereGeometry(planet.radius, segments, Math.max(14, segments - 4));
      var material = planet.id === 'sun' ? new THREE.MeshBasicMaterial({ color:planet.color }) : new THREE.MeshStandardMaterial({ color:planet.color, roughness:.75, metalness:.03 });
      var mesh = new THREE.Mesh(geometry, material); mesh.userData.planetId = planet.id;
      var angle = index * 1.14; mesh.position.set(Math.cos(angle)*planet.distance, 0, Math.sin(angle)*planet.distance); system.add(mesh);
      if (planet.ring) { var ring = new THREE.Mesh(new THREE.RingGeometry(planet.radius*1.35, planet.radius*2.05, 48), new THREE.MeshBasicMaterial({ color:0xc7ad75, side:THREE.DoubleSide, transparent:true, opacity:.72 })); ring.rotation.x = Math.PI/2.3; mesh.add(ring); }
      bodies.push({ data:planet, mesh:mesh, angle:angle }); if (planet.distance) makeOrbit(planet.distance);
    });
    raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2(); bindSceneEvents(); resize(); animate(0);
  }
  function bindSceneEvents() {
    var canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', function (event) { dragging=true; moved=false; startX=event.clientX; startY=event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', function (event) { if (!dragging) return; var dx=event.clientX-startX, dy=event.clientY-startY; if (Math.abs(dx)+Math.abs(dy)>3) moved=true; angleX += dx*.006; angleY=Math.max(-1.05,Math.min(1.05,angleY+dy*.006)); startX=event.clientX; startY=event.clientY; });
    canvas.addEventListener('pointerup', function (event) { dragging=false; if (!moved) pickPlanet(event); });
    canvas.addEventListener('wheel', function (event) { event.preventDefault(); cameraDistance=Math.max(18,Math.min(62,cameraDistance+event.deltaY*.025)); }, { passive:false });
  }
  function pickPlanet(event) {
    var rect=renderer.domElement.getBoundingClientRect(); pointer.x=(event.clientX-rect.left)/rect.width*2-1; pointer.y=-(event.clientY-rect.top)/rect.height*2+1;
    raycaster.setFromCamera(pointer,camera); var hits=raycaster.intersectObjects(bodies.map(function (body) { return body.mesh; }),false);
    if (hits.length) selectPlanet(hits[0].object.userData.planetId,true);
  }
  function resize() { if (!renderer) return; var width=dom.scene.clientWidth, height=dom.scene.clientHeight; renderer.setSize(width,height,false); camera.aspect=width/height; camera.updateProjectionMatrix(); }
  function animate(time) {
    animationId=requestAnimationFrame(animate); var dt=Math.min((time-lastTime)/1000,.05)||0; lastTime=time;
    if (running) { var multiplier=Number(dom.speed.value); bodies.forEach(function (body) { if (!body.data.distance) return; body.angle += dt*body.data.speed*.28*multiplier; body.mesh.position.set(Math.cos(body.angle)*body.data.distance,0,Math.sin(body.angle)*body.data.distance); body.mesh.rotation.y += dt*.3; }); }
    system.rotation.y=angleX; system.rotation.x=angleY; camera.position.set(0,15,cameraDistance); camera.lookAt(0,0,0); renderer.render(scene,camera);
  }
  function applyScale(realistic) { bodies.forEach(function (body) { if (body.data.id==='sun') return; var value=realistic ? Math.max(.18,body.data.radius*.55) : body.data.radius; body.mesh.scale.setScalar(value/body.data.radius); }); }
  function bindControls() {
    dom.playButton.textContent = running ? '⏸ Pausar' : '▶ Animar'; dom.playButton.setAttribute('aria-pressed', String(!running));
    dom.playButton.addEventListener('click', function () { running=!running; dom.playButton.textContent=running?'⏸ Pausar':'▶ Animar'; dom.playButton.setAttribute('aria-pressed',String(!running)); });
    dom.resetButton.addEventListener('click', function () { angleX=-.28; angleY=.22; cameraDistance=38; selectPlanet('sun',false); });
    dom.speed.addEventListener('input', function () { dom.speedValue.textContent=dom.speed.value+'×'; });
    dom.orbits.addEventListener('change', function () { orbitLines.forEach(function (line) { line.visible=dom.orbits.checked; }); });
    dom.scale.addEventListener('change', function () { applyScale(dom.scale.checked); });
    window.addEventListener('resize', resize);
    window.addEventListener('pagehide', function () { if (animationId) cancelAnimationFrame(animationId); });
  }
  function start() {
    cacheDom(); renderPlanetButtons(); renderMission(); renderQuestion(); updateProgress(); bindControls(); selectPlanet(state.selected,false);
    try { initThree(); } catch (error) { dom.fallback.hidden=false; dom.fallback.querySelector('strong').textContent='Vista 3D no disponible'; console.warn('EduConect 3D fallback:',error.message); }
    window.solarLabReady = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
