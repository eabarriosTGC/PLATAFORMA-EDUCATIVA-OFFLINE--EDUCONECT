(function () {
  'use strict';
  var STORAGE_KEY = 'educonect:module:cie-405';
  var SOLIDS = [
    {id:'cubo',name:'Cubo',icon:'🧊',type:'poly',color:0x64dfa1,description:'Sólido con seis caras cuadradas iguales.',faces:'6',edges:'12',vertices:'8',volume:'lado × lado × lado',example:'💡 Los bloques de sal de las salinas de Manaure se forman como cubos.'},
    {id:'esfera',name:'Esfera',icon:'⚽',type:'round',color:0x5dc9ff,description:'Cuerpo redondo donde toda su superficie está a la misma distancia del centro.',faces:'0',edges:'0',vertices:'0',volume:'4/3 × π × radio³',example:'💡 Un balón de fútbol y un melón de castilla tienen forma de esfera.'},
    {id:'cilindro',name:'Cilindro',icon:'🛢️',type:'round',color:0xffc760,description:'Cuerpo redondo con dos bases circulares iguales y una superficie lateral curva.',faces:'2',edges:'2',vertices:'0',volume:'π × radio² × altura',example:'💡 Las torres de los molinos de viento de Jepírachi son casi cilindros.'},
    {id:'cono',name:'Cono',icon:'🍦',type:'round',color:0xff7ca8,description:'Cuerpo redondo con una base circular y una superficie curva que termina en punta.',faces:'1',edges:'1',vertices:'1',volume:'(π × radio² × altura) ÷ 3',example:'💡 Un cucurucho de helado tiene forma de cono.'},
    {id:'piramide',name:'Pirámide',icon:'🔺',type:'poly',color:0xa78bfa,description:'Poliédro con base cuadrada y cuatro caras triangulares que se unen en la punta.',faces:'5',edges:'8',vertices:'5',volume:'(área de la base × altura) ÷ 3',example:'💡 Las montañas de la Serranía de la Macuira, vistas de lejos, recuerdan pirámides.'}
  ];
  var MISSIONS = [
    {id:'cubo',title:'Encuentra el cuerpo con seis caras cuadradas',hint:'Toca el sólido cuyas caras son todos cuadrados.'},
    {id:'esfera',title:'Localiza el cuerpo que rueda sin aristas',hint:'Toca el sólido sin caras planas, aristas ni vértices.'},
    {id:'cilindro',title:'Busca el cuerpo con dos bases circulares',hint:'Toca el sólido que se apoya en dos círculos iguales.'},
    {id:'cono',title:'Encuentra el cuerpo con una sola base',hint:'Toca el sólido con base circular que termina en punta.'},
    {id:'piramide',title:'Busca el cuerpo con caras triangulares',hint:'Toca el sólido con base cuadrada y cuatro caras triangulares.'},
    {id:'cilindro',title:'Encuentra el cuerpo del molino de viento',hint:'Toca el sólido con la forma de la torre de un molino de Jepírachi.'}
  ];
  var QUESTIONS = [
    {q:'¿Cuántas caras tiene un cubo?',options:['4','6','8','12'],answer:'6'},
    {q:'¿Qué cuerpo geométrico no tiene aristas ni vértices?',options:['Cubo','Esfera','Cono','Pirámide'],answer:'Esfera'},
    {q:'¿Qué forma tiene la base de una pirámide cuadrangular?',options:['Triángulo','Círculo','Cuadrado','Rectángulo'],answer:'Cuadrado'},
    {q:'¿Qué cuerpo tiene dos bases circulares?',options:['Cilindro','Cono','Esfera','Cubo'],answer:'Cilindro'},
    {q:'¿Cuántos vértices tiene un cono?',options:['2','1','0','3'],answer:'1'},
    {q:'¿Qué cuerpo puedes imaginar enrollando un rectángulo?',options:['Cono','Pirámide','Cilindro','Cubo'],answer:'Cilindro'}
  ];
  var state=loadState(),dom={},scene,camera,renderer,modelRoot,raycaster,pointer,animationId=0;
  var solids=[],labels=[],wireMeshes=[],selected='cubo',autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,moved=false,startX=0,startY=0,pinch=0,rotationX=.25,rotationY=.35,distance=13;

  function $(id){return document.getElementById(id);}
  function solid(id){return SOLIDS.find(function(x){return x.id===id;})||SOLIDS[0];}
  function loadState(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{mission:Math.min(Number(d.mission)||0,MISSIONS.length),quiz:Math.min(Number(d.quiz)||0,QUESTIONS.length),correct:Number(d.correct)||0,selected:d.selected||'cubo'};}catch(_){return{mission:0,quiz:0,correct:0,selected:'cubo'};}}
  function save(){state.selected=selected;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateProgress();}
  function updateProgress(){var done=state.mission+state.quiz,total=MISSIONS.length+QUESTIONS.length,pct=Math.round(done/total*100);dom.progressText.textContent=pct+'%';dom.progressBar.style.width=pct+'%';}
  function cache(){['progressText','progressBar','scene','labels','fallback','viewerTitle','wireToggle','labelsToggle','solidButtons','solidType','solidName','solidDescription','solidFaces','solidEdges','solidVertices','solidVolume','solidExample','missionTitle','missionHint','missionStatus','question','answers','feedback','rotateButton','resetButton'].forEach(function(id){dom[id]=$(id);});}
  function mat(color){return new THREE.MeshStandardMaterial({color:color,roughness:.5,metalness:.06});}
  function addLabel(id,x,y){var el=document.createElement('span');el.className='label';el.textContent=solid(id).icon+' '+solid(id).name;dom.labels.appendChild(el);labels.push({id:id,el:el,anchor:new THREE.Vector3(x,y,0)});}
  function lineMat(){return new THREE.LineBasicMaterial({color:0x9be8ff,transparent:true,opacity:.9});}
  function circleLoop(r,y,mat){var pts=[];for(var i=0;i<=40;i++){var a=i/40*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));}return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),mat);}
  function seg(a,b,mat){return new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],a[1],a[2]),new THREE.Vector3(b[0],b[1],b[2])]),mat);}
  function buildWire(d){var g=new THREE.Group(),m=lineMat();
    switch(d.id){
      case 'cubo':g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.7,1.7,1.7)),m));break;
      case 'esfera':g.add(new THREE.Mesh(new THREE.SphereGeometry(1.15,16,12),new THREE.MeshBasicMaterial({wireframe:true,color:0x9be8ff,transparent:true,opacity:.4})));break;
      case 'cilindro':g.add(circleLoop(.95,0,m));g.add(circleLoop(.95,1.9,m));break;
      case 'cono':g.add(circleLoop(1.05,0,m));g.add(seg([1.05,0,0],[0,1.85,0],m));g.add(seg([-1.05,0,0],[0,1.85,0],m));g.add(seg([0,0,1.05],[0,1.85,0],m));g.add(seg([0,0,-1.05],[0,1.85,0],m));break;
      case 'piramide':g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.813,0,.813),new THREE.Vector3(-.813,0,.813),new THREE.Vector3(-.813,0,-.813),new THREE.Vector3(.813,0,-.813)]),m));g.add(seg([.813,0,.813],[0,1.7,0],m));g.add(seg([-.813,0,.813],[0,1.7,0],m));g.add(seg([-.813,0,-.813],[0,1.7,0],m));g.add(seg([.813,0,-.813],[0,1.7,0],m));break;
    }
    g.position.y=d.y;g.visible=false;return g;
  }
  function buildSolids(){
    modelRoot=new THREE.Group();scene.add(modelRoot);
    var defs=[
      {id:'cubo',geo:new THREE.BoxGeometry(1.7,1.7,1.7),y:.85,labelY:2.5},
      {id:'esfera',geo:new THREE.SphereGeometry(1.15,32,32),y:1.15,labelY:2.75},
      {id:'cilindro',geo:new THREE.CylinderGeometry(.95,.95,1.9,28),y:.95,labelY:2.5},
      {id:'cono',geo:new THREE.ConeGeometry(1.05,1.85,28),y:.925,labelY:2.65},
      {id:'piramide',geo:new THREE.ConeGeometry(1.15,1.7,4),y:.85,labelY:2.4}
    ],xs=[-4.3,-2.15,0,2.15,4.3];
    defs.forEach(function(d,i){
      var g=new THREE.Group(),mesh=new THREE.Mesh(d.geo,mat(solid(d.id).color));
      g.userData.solidId=d.id;g.position.x=xs[i];mesh.position.y=d.y;
      if(d.id==='piramide')mesh.rotation.y=Math.PI/4;
      if(d.id==='esfera'){var ring=new THREE.Mesh(new THREE.TorusGeometry(1.45,.035,8,64),mat(0x8fd8ff));ring.position.y=d.y;ring.rotation.x=1.25;g.add(ring);}
      g.add(mesh);modelRoot.add(g);solids.push({id:d.id,mesh:mesh});
      var wire=buildWire(d);wireMeshes.push(wire);g.add(wire);
      addLabel(d.id,xs[i],d.labelY);
    });
  }
  function renderSolidButtons(){dom.solidButtons.innerHTML='';SOLIDS.forEach(function(item){var b=document.createElement('button');b.type='button';b.dataset.solid=item.id;b.textContent=item.icon+' '+item.name;b.addEventListener('click',function(){selectSolid(item.id,true);});dom.solidButtons.appendChild(b);});}
  function selectSolid(id,countMission){var item=solid(id);selected=id;
    dom.solidType.textContent=item.type==='poly'?'Poliédro':'Cuerpo redondo';
    dom.solidType.style.background=item.type==='poly'?'var(--gold)':'var(--blue)';
    dom.solidName.textContent=item.name;dom.solidDescription.textContent=item.description;
    dom.solidFaces.textContent=item.faces;dom.solidEdges.textContent=item.edges;dom.solidVertices.textContent=item.vertices;dom.solidVolume.textContent=item.volume;dom.solidExample.textContent=item.example;
    Array.prototype.forEach.call(dom.solidButtons.children,function(b){b.classList.toggle('active',b.dataset.solid===id);});
    solids.forEach(function(x){if(x.mesh.material&&x.mesh.material.emissive)x.mesh.material.emissive.setHex(x.id===id?0x242424:0);});
    if(countMission&&state.mission<MISSIONS.length&&MISSIONS[state.mission].id===id){state.mission++;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';save();setTimeout(renderMission,750);}
    save();
  }
  function renderMission(){if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Geometría explorada!';dom.missionHint.textContent='Identificaste los cinco cuerpos geométricos.';dom.missionStatus.textContent='6 de 6 misiones';dom.missionStatus.className='status success';return;}var m=MISSIONS[state.mission];dom.missionTitle.textContent=m.title;dom.missionHint.textContent=m.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';}
  function renderQuestion(){dom.answers.innerHTML='';dom.feedback.textContent='';if(state.quiz>=QUESTIONS.length){dom.question.textContent='¡Reto completado!';dom.feedback.textContent='Resultado: '+state.correct+' de '+QUESTIONS.length+' respuestas correctas.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state.quiz=0;state.correct=0;save();renderQuestion();});dom.answers.appendChild(reset);return;}var q=QUESTIONS[state.quiz];dom.question.textContent=q.q;q.options.forEach(function(option){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){var right=option===q.answer;b.classList.add(right?'correct':'wrong');dom.feedback.textContent=right?'✓ ¡Correcto!':'Respuesta correcta: '+q.answer+'.';Array.prototype.forEach.call(dom.answers.children,function(x){x.disabled=true;});state.quiz++;if(right)state.correct++;save();setTimeout(renderQuestion,850);});dom.answers.appendChild(b);});}
  function initThree(){if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,100);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');scene.add(new THREE.HemisphereLight(0xd9ecff,0x1a1030,1.15));var light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(7,12,12);scene.add(light);var rim=new THREE.PointLight(0xa78bfa,.7,45);rim.position.set(-7,4,8);scene.add(rim);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildSolids();bindScene();resize();animate();}
  function bindScene(){var c=renderer.domElement;c.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;rotationY+=dx*.007;rotationX=Math.max(-.85,Math.min(.85,rotationX+dy*.006));startX=e.clientX;startY=e.clientY;});c.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});c.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(10,Math.min(20,distance+e.deltaY*.02));},{passive:false});c.addEventListener('touchstart',function(e){if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});c.addEventListener('touchmove',function(e){if(e.touches.length===2){var n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(10,Math.min(20,distance+(pinch-n)*.03));pinch=n;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hit=raycaster.intersectObjects(solids.map(function(x){return x.mesh;}),false)[0];if(hit&&hit.object.parent.userData.solidId)selectSolid(hit.object.parent.userData.solidId,true);}
  function updateLabels(){if(!camera)return;var show=dom.labelsToggle.checked;labels.forEach(function(x){var world=x.anchor.clone().applyMatrix4(modelRoot.matrixWorld);world.project(camera);x.el.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';x.el.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';x.el.style.opacity=show&&world.z<1?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);if(autoRotate&&!dragging)rotationY+=.0022;modelRoot.rotation.y=rotationY;modelRoot.rotation.x=rotationX;camera.position.set(0,1.1,distance);camera.lookAt(0,.6,0);renderer.render(scene,camera);updateLabels();}
  function bind(){dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){rotationX=.25;rotationY=.35;distance=13;});dom.labelsToggle.addEventListener('change',updateLabels);dom.wireToggle.addEventListener('change',function(){wireMeshes.forEach(function(w){w.visible=dom.wireToggle.checked;});});addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cache();bind();renderMission();renderQuestion();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}renderSolidButtons();selectSolid(state.selected,false);window.geometryLabReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
