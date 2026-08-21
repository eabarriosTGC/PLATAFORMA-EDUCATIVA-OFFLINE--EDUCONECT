(function () {
  'use strict';

  var MODULE_ID = 'cie-403';
  var STORAGE_KEY = 'educonect:module:' + MODULE_ID;
  var ORGANELLES = [
    { id:'membrane', name:'Membrana celular', icon:'🫧', kind:'Límite celular', description:'Envuelve la célula y controla qué sustancias entran y salen.', functionText:'Proteger y regular el intercambio', presence:'Presente en células animales y vegetales.', cells:['animal','plant'], color:0x51d4c5 },
    { id:'nucleus', name:'Núcleo', icon:'🟣', kind:'Centro de control', description:'Contiene la mayor parte del ADN y dirige las actividades de la célula.', functionText:'Guardar información genética y coordinar', presence:'Presente en células animales y vegetales.', cells:['animal','plant'], color:0x9d72e8 },
    { id:'mitochondria', name:'Mitocondria', icon:'⚡', kind:'Orgánulo energético', description:'Transforma nutrientes en energía utilizable para las actividades celulares.', functionText:'Producir energía mediante respiración celular', presence:'Presente en células animales y vegetales.', cells:['animal','plant'], color:0xf07b52 },
    { id:'ribosomes', name:'Ribosomas', icon:'•', kind:'Fábrica molecular', description:'Son pequeñas estructuras que unen aminoácidos para formar proteínas.', functionText:'Fabricar proteínas', presence:'Presentes en células animales y vegetales.', cells:['animal','plant'], color:0xf4d65d },
    { id:'er', name:'Retículo endoplasmático', icon:'〰️', kind:'Red de transporte', description:'Una red de membranas que fabrica y transporta proteínas y lípidos.', functionText:'Producir y transportar sustancias', presence:'Presente en células animales y vegetales.', cells:['animal','plant'], color:0x63a8ed },
    { id:'golgi', name:'Aparato de Golgi', icon:'🥞', kind:'Centro de empaquetado', description:'Modifica, clasifica y empaca moléculas para enviarlas a su destino.', functionText:'Empacar y distribuir moléculas', presence:'Presente en células animales y vegetales.', cells:['animal','plant'], color:0xff9fc8 },
    { id:'lysosome', name:'Lisosoma', icon:'♻️', kind:'Sistema de reciclaje', description:'Contiene sustancias que descomponen residuos y componentes deteriorados.', functionText:'Digerir y reciclar materiales', presence:'Característico de la célula animal.', cells:['animal'], color:0x74d779 },
    { id:'wall', name:'Pared celular', icon:'🧱', kind:'Soporte exterior', description:'Capa resistente de celulosa que rodea la membrana de la célula vegetal.', functionText:'Dar soporte, protección y forma', presence:'Exclusiva de la célula vegetal.', cells:['plant'], color:0x8ecb57 },
    { id:'chloroplast', name:'Cloroplasto', icon:'🌿', kind:'Captador de luz', description:'Contiene clorofila y transforma la energía solar en alimento.', functionText:'Realizar la fotosíntesis', presence:'Exclusivo de células vegetales fotosintéticas.', cells:['plant'], color:0x40b85a },
    { id:'vacuole', name:'Vacuola central', icon:'💧', kind:'Depósito celular', description:'Gran compartimento que almacena agua y ayuda a mantener la presión interna.', functionText:'Almacenar agua y mantener la turgencia', presence:'Muy grande y central en la célula vegetal.', cells:['plant'], color:0x57bfe5 }
  ];
  var MISSIONS = [
    { cell:'animal', id:'nucleus', title:'Encuentra el centro de control', hint:'Selecciona el orgánulo que contiene la mayor parte del ADN.' },
    { cell:'animal', id:'mitochondria', title:'Localiza la central de energía', hint:'Busca el orgánulo que transforma nutrientes en energía.' },
    { cell:'animal', id:'golgi', title:'Encuentra el centro de empaquetado', hint:'Selecciona la estructura que clasifica y distribuye moléculas.' },
    { cell:'plant', id:'chloroplast', title:'Cambia a vegetal y encuentra la fotosíntesis', hint:'Busca el orgánulo verde que captura energía solar.' },
    { cell:'plant', id:'wall', title:'Identifica la estructura rígida', hint:'Selecciona la capa exclusiva que protege y da forma a la célula vegetal.' }
  ];
  var ASSEMBLY = [
    { q:'¿Qué orgánulo produce energía?', options:['Núcleo','Mitocondria','Golgi'], answer:'Mitocondria' },
    { q:'¿Qué estructura fabrica proteínas?', options:['Ribosomas','Vacuola','Pared celular'], answer:'Ribosomas' },
    { q:'¿Qué orgánulo empaca moléculas?', options:['Cloroplasto','Membrana','Aparato de Golgi'], answer:'Aparato de Golgi' },
    { q:'¿Qué orgánulo realiza la fotosíntesis?', options:['Lisosoma','Cloroplasto','Núcleo'], answer:'Cloroplasto' }
  ];
  var QUIZ = [
    { q:'¿Qué estructura da rigidez a la célula vegetal?', options:['Membrana','Pared celular','Ribosoma','Lisosoma'], answer:'Pared celular' },
    { q:'¿Dónde se encuentra la mayor parte del ADN?', options:['Núcleo','Golgi','Vacuola','Membrana'], answer:'Núcleo' },
    { q:'¿Cuál está en la célula animal y vegetal?', options:['Pared celular','Cloroplasto','Mitocondria','Gran vacuola'], answer:'Mitocondria' },
    { q:'¿Qué almacena agua en la célula vegetal?', options:['Vacuola central','Ribosoma','Núcleo','Golgi'], answer:'Vacuola central' },
    { q:'¿Qué controla la entrada y salida de sustancias?', options:['Membrana celular','Cloroplasto','Pared celular','Núcleo'], answer:'Membrana celular' }
  ];

  var state = loadState();
  var dom = {}, scene, camera, renderer, modelRoot, raycaster, pointer;
  var objects = [], labels = [], membraneObjects = [], animationId = 0;
  var rotationX = -.2, rotationY = .35, distance = 17, autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  var dragging = false, moved = false, startX = 0, startY = 0, pinchDistance = 0;

  function $(id) { return document.getElementById(id); }
  function loadState() {
    try {
      var data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { cell:data.cell === 'plant' ? 'plant' : 'animal', selected:data.selected || 'membrane', mission:Math.min(Number(data.mission)||0,MISSIONS.length), assembly:Math.min(Number(data.assembly)||0,ASSEMBLY.length), quiz:Math.min(Number(data.quiz)||0,QUIZ.length), correct:Number(data.correct)||0 };
    } catch (_) { return { cell:'animal', selected:'membrane', mission:0, assembly:0, quiz:0, correct:0 }; }
  }
  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateProgress(); }
  function updateProgress() {
    var done=state.mission+state.assembly+state.quiz, total=MISSIONS.length+ASSEMBLY.length+QUIZ.length, pct=Math.round(done/total*100);
    dom.progressText.textContent=pct+'%'; dom.progressBar.style.width=pct+'%';
  }
  function cacheDom() {
    ['progressText','progressBar','viewerTitle','scene','labels','fallback','organelleButtons','organelleKind','organelleName','organelleDescription','organelleFunction','cellPresence','missionTitle','missionHint','missionStatus','assemblyQuestion','assemblyOptions','assemblyFeedback','quizQuestion','quizOptions','quizFeedback','rotateButton','resetButton','labelsToggle','membraneToggle'].forEach(function(id){dom[id]=$(id);});
  }
  function availableOrganelles() { return ORGANELLES.filter(function(item){return item.cells.indexOf(state.cell)!==-1;}); }
  function getOrganelle(id) { return ORGANELLES.find(function(item){return item.id===id;}) || ORGANELLES[0]; }
  function renderButtons() {
    dom.organelleButtons.innerHTML='';
    availableOrganelles().forEach(function(item){
      var button=document.createElement('button'); button.type='button'; button.dataset.organelle=item.id; button.textContent=item.icon+' '+item.name;
      button.addEventListener('click',function(){selectOrganelle(item.id,true);}); dom.organelleButtons.appendChild(button);
    });
  }
  function selectOrganelle(id, countMission) {
    var item=getOrganelle(id); if(item.cells.indexOf(state.cell)===-1) return;
    state.selected=id; dom.organelleKind.textContent=item.kind; dom.organelleName.textContent=item.name; dom.organelleDescription.textContent=item.description; dom.organelleFunction.textContent=item.functionText; dom.cellPresence.textContent=item.presence;
    Array.prototype.forEach.call(dom.organelleButtons.children,function(button){button.classList.toggle('active',button.dataset.organelle===id);});
    objects.forEach(function(entry){if(entry.mesh.material&&entry.mesh.material.emissive)entry.mesh.material.emissive.setHex(entry.id===id?0x303030:0x000000);});
    if(countMission && state.mission<MISSIONS.length){var mission=MISSIONS[state.mission];if(mission.cell===state.cell&&mission.id===id){state.mission+=1;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';saveState();setTimeout(renderMission,750);}}
    saveState();
  }
  function switchCell(type, fromMission) {
    if(type!=='animal'&&type!=='plant')return; state.cell=type;
    document.querySelectorAll('[data-cell]').forEach(function(button){button.classList.toggle('active',button.dataset.cell===type);});
    dom.viewerTitle.textContent=type==='plant'?'Célula vegetal':'Célula animal'; dom.scene.setAttribute('aria-label','Modelo tridimensional de una célula '+(type==='plant'?'vegetal':'animal'));
    buildCell(); renderButtons(); var desired=getOrganelle(state.selected).cells.indexOf(type)!==-1?state.selected:(type==='plant'?'wall':'membrane'); selectOrganelle(desired,false);
    if(!fromMission) saveState();
  }
  function renderMission() {
    if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Exploración completada!';dom.missionHint.textContent='Ya reconoces estructuras compartidas y exclusivas de ambas células.';dom.missionStatus.textContent='5 de 5 misiones';dom.missionStatus.className='status success';return;}
    var mission=MISSIONS[state.mission];dom.missionTitle.textContent=mission.title;dom.missionHint.textContent=mission.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';
  }
  function renderActivity(list,indexKey,questionEl,optionsEl,feedbackEl,scoreQuiz) {
    optionsEl.innerHTML='';feedbackEl.textContent='';var index=state[indexKey];
    if(index>=list.length){questionEl.textContent=indexKey==='assembly'?'¡Célula ensamblada!':'¡Reto completado!';feedbackEl.textContent=indexKey==='quiz'?'Respuestas correctas: '+state.correct+' de '+list.length+'.':'Relacionaste correctamente los orgánulos con sus funciones.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state[indexKey]=0;if(scoreQuiz)state.correct=0;saveState();renderActivities();});optionsEl.appendChild(reset);return;}
    var item=list[index];questionEl.textContent=item.q;
    item.options.forEach(function(option){var button=document.createElement('button');button.type='button';button.textContent=option;button.addEventListener('click',function(){var correct=option===item.answer;button.classList.add(correct?'correct':'wrong');feedbackEl.textContent=correct?'✓ ¡Correcto!':'Respuesta correcta: '+item.answer+'.';Array.prototype.forEach.call(optionsEl.children,function(child){child.disabled=true;});state[indexKey]+=1;if(scoreQuiz&&correct)state.correct+=1;saveState();setTimeout(renderActivities,850);});optionsEl.appendChild(button);});
  }
  function renderActivities(){renderActivity(ASSEMBLY,'assembly',dom.assemblyQuestion,dom.assemblyOptions,dom.assemblyFeedback,false);renderActivity(QUIZ,'quiz',dom.quizQuestion,dom.quizOptions,dom.quizFeedback,true);}

  function material(color,transparent,opacity){return new THREE.MeshStandardMaterial({color:color,roughness:.65,metalness:.02,transparent:!!transparent,opacity:opacity===undefined?1:opacity,side:transparent?THREE.DoubleSide:THREE.FrontSide,depthWrite:!transparent});}
  function addMesh(id,geometry,mat,position,scale,rotation){var mesh=new THREE.Mesh(geometry,mat);mesh.position.set(position[0],position[1],position[2]);if(scale)mesh.scale.set(scale[0],scale[1],scale[2]);if(rotation)mesh.rotation.set(rotation[0],rotation[1],rotation[2]);mesh.userData.organelleId=id;modelRoot.add(mesh);objects.push({id:id,mesh:mesh});return mesh;}
  function addLabel(id,text,mesh){var label=document.createElement('span');label.className='label';label.textContent=text;label.dataset.organelle=id;dom.labels.appendChild(label);labels.push({element:label,mesh:mesh});}
  function addSharedOrganelles(plant){
    var nucleus=addMesh('nucleus',new THREE.SphereGeometry(1.55,28,22),material(0x9d72e8),plant?[-1.5,.3,.4]:[-.8,.4,.3]);addMesh('nucleus',new THREE.SphereGeometry(.65,20,16),material(0xd3a8ff),plant?[-1.2,.55,1.25]:[-.5,.65,1.15]);addLabel('nucleus','Núcleo',nucleus);
    [[-3,-1.3,1.2],[2.7,1.25,-.3],[2.4,-1.7,1]].forEach(function(pos,i){var m=addMesh('mitochondria',new THREE.SphereGeometry(.75,20,14),material(0xf07b52),pos,[1.65,.68,.72],[0,i*.7,i*.45]);addLabel('mitochondria',i?'':'Mitocondria',m);});
    var er=addMesh('er',new THREE.TorusGeometry(2.25,.16,10,48,Math.PI*1.45),material(0x63a8ed),plant?[-.9,.15,.1]:[-.3,.1,.1],[1,.75,1],[1.2,.25,.4]);addLabel('er','Retículo',er);
    for(var g=0;g<4;g++){var golgi=addMesh('golgi',new THREE.TorusGeometry(1.05+g*.14,.11,9,34,Math.PI*1.3),material(0xff9fc8),plant?[2.6,-1,.6]:[2.25,-.8,.8],[1,.55,1],[1.25,.2,.25]);if(g===2)addLabel('golgi','Golgi',golgi);}
    for(var r=0;r<28;r++){var a=r*2.399,rad=1.7+(r%5)*.65,y=-2+(r%7)*.62;addMesh('ribosomes',new THREE.SphereGeometry(.11,8,6),material(0xf4d65d),[Math.cos(a)*rad,y,Math.sin(a)*rad]);}
  }
  function buildAnimal(){var membrane=addMesh('membrane',new THREE.SphereGeometry(5.25,34,26),material(0x51d4c5,true,.2),[0,0,0],[1, .82, .9]);membraneObjects.push(membrane);addLabel('membrane','Membrana',membrane);addSharedOrganelles(false);[[-2.1,1.8,1.6],[1.2,-2.2,-.2]].forEach(function(pos,i){var lys=addMesh('lysosome',new THREE.SphereGeometry(.48,16,12),material(0x74d779),pos);if(!i)addLabel('lysosome','Lisosoma',lys);});}
  function buildPlant(){var wall=addMesh('wall',new THREE.BoxGeometry(10.7,8.3,7.1,2,2,2),material(0x8ecb57,true,.16),[0,0,0]);membraneObjects.push(wall);addLabel('wall','Pared celular',wall);var membrane=addMesh('membrane',new THREE.BoxGeometry(10.1,7.7,6.5),material(0x51d4c5,true,.12),[0,0,0]);membraneObjects.push(membrane);var vac=addMesh('vacuole',new THREE.SphereGeometry(2.35,26,20),material(0x57bfe5,true,.28),[.35,.15,-.65],[1.25,1.05,.8]);addLabel('vacuole','Vacuola',vac);addSharedOrganelles(true);[[-3.5,1.9,.9],[3.3,1.6,.4],[-3.1,-2,.3]].forEach(function(pos,i){var chlor=addMesh('chloroplast',new THREE.SphereGeometry(.7,20,14),material(0x40b85a),pos,[1.6,.62,.75],[0,i*.6,i*.35]);if(!i)addLabel('chloroplast','Cloroplasto',chlor);});}
  function clearModel(){objects=[];labels=[];membraneObjects=[];dom.labels.innerHTML='';while(modelRoot&&modelRoot.children.length)modelRoot.remove(modelRoot.children[0]);}
  function buildCell(){if(!modelRoot)return;clearModel();if(state.cell==='plant')buildPlant();else buildAnimal();dom.membraneToggle.checked=true;updateLabels();}
  function initThree(){
    if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,100);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0x000000,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');
    modelRoot=new THREE.Group();scene.add(modelRoot);scene.add(new THREE.HemisphereLight(0xc9ffff,0x163642,1.15));var key=new THREE.DirectionalLight(0xffffff,1.4);key.position.set(8,10,12);scene.add(key);var rim=new THREE.PointLight(0x62e6b4,.8,40);rim.position.set(-8,-4,8);scene.add(rim);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildCell();bindScene();resize();animate();
  }
  function bindScene(){var canvas=renderer.domElement;canvas.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;rotationY+=dx*.007;rotationX=Math.max(-1.1,Math.min(1.1,rotationX+dy*.007));startX=e.clientX;startY=e.clientY;});canvas.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});canvas.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(10,Math.min(28,distance+e.deltaY*.018));},{passive:false});canvas.addEventListener('touchstart',function(e){if(e.touches.length===2)pinchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});canvas.addEventListener('touchmove',function(e){if(e.touches.length===2){var next=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(10,Math.min(28,distance+(pinchDistance-next)*.025));pinchDistance=next;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hits=raycaster.intersectObjects(objects.map(function(entry){return entry.mesh;}),false);if(hits.length){var inner=hits.find(function(hit){var id=hit.object.userData.organelleId;return id!=='membrane'&&id!=='wall';});selectOrganelle((inner||hits[0]).object.userData.organelleId,true);}}
  function updateLabels(){if(!camera||!renderer)return;var visible=dom.labelsToggle.checked;labels.forEach(function(item){var world=new THREE.Vector3();item.mesh.getWorldPosition(world);world.project(camera);var behind=world.z>1;item.element.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';item.element.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';item.element.style.opacity=visible&&!behind&&item.element.textContent?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);if(autoRotate&&!dragging)rotationY+=.0025;modelRoot.rotation.y=rotationY;modelRoot.rotation.x=rotationX;camera.position.set(0,1.2,distance);camera.lookAt(0,0,0);renderer.render(scene,camera);updateLabels();}
  function bindControls(){document.querySelectorAll('[data-cell]').forEach(function(button){button.addEventListener('click',function(){switchCell(button.dataset.cell,false);});});dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){rotationX=-.2;rotationY=.35;distance=17;});dom.labelsToggle.addEventListener('change',updateLabels);dom.membraneToggle.addEventListener('change',function(){membraneObjects.forEach(function(mesh){mesh.visible=dom.membraneToggle.checked;});});addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cacheDom();bindControls();renderMission();renderActivities();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}switchCell(state.cell,false);window.cellLabReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
