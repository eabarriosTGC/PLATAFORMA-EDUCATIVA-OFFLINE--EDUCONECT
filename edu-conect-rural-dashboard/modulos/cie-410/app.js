(function () {
  'use strict';
  var STORAGE_KEY = 'educonect:module:cie-410';
  var LEN=4,GROSOR=.5,NUM=300;
  var PARTS = [
    {id:'norte',name:'Polo norte',icon:'🔴',type:'Polo',color:0xff3b30,description:'Extremo rojo del imán: de aquí salen las líneas de campo magnético.',role:'De donde sale el campo',detail:'Color rojo',example:'💡 Los polos iguales se repelen y los distintos se atraen.'},
    {id:'sur',name:'Polo sur',icon:'🔵',type:'Polo',color:0x1e6fff,description:'Extremo azul del imán: hacia aquí entran las líneas de campo magnético.',role:'A donde llega el campo',detail:'Color azul',example:'💡 Si acercas dos imanes por el mismo color, se rechazan.'},
    {id:'campo',name:'Líneas de campo',icon:'✨',type:'Campo',color:0xffd60a,description:'Partículas que viajan del polo norte al polo sur siguiendo arcos invisibles.',role:'Mostrar el campo',detail:'Trayectoria norte → sur',example:'💡 El campo magnético existe aunque no lo veamos: las partículas lo revelan.'}
  ];
  var MISSIONS = [
    {id:'norte',title:'Encuentra el polo norte',hint:'Toca el extremo rojo del imán.'},
    {id:'sur',title:'Localiza el polo sur',hint:'Toca el extremo azul del imán.'},
    {id:'campo',title:'Busca las líneas de campo',hint:'Toca una de las partículas amarillas.'},
    {id:'norte',title:'Encuentra por dónde sale el campo',hint:'Toca el extremo rojo.'},
    {id:'sur',title:'Localiza a dónde llega el campo',hint:'Toca el extremo azul.'},
    {id:'campo',title:'Observa el viaje de las partículas',hint:'Toca una partícula amarilla en movimiento.'}
  ];
  var QUESTIONS = [
    {q:'¿Qué color tiene el polo norte?',options:['Azul','Rojo','Verde','Amarillo'],answer:'Rojo'},
    {q:'¿Hacia dónde viajan las líneas de campo?',options:['Sur a norte','Norte a sur','No se mueven','En círculos'],answer:'Norte a sur'},
    {q:'Si acercas dos polos iguales…',options:['Se atraen','Se repelen','Se unen','Explotan'],answer:'Se repelen'},
    {q:'Si acercas un polo norte y un polo sur…',options:['Se repelen','Se atraen','Se ignoran','Se enfrían'],answer:'Se atraen'},
    {q:'¿Cuántos polos tiene un imán?',options:['1','2','3','4'],answer:'2'},
    {q:'¿Qué revelan las partículas amarillas?',options:['La temperatura','El campo magnético','El peso','El sonido'],answer:'El campo magnético'}
  ];
  var state=loadState(),dom={},scene,camera,renderer,modelRoot,raycaster,pointer,animationId=0;
  var objects=[],labels=[],particles=[],selected='norte',autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,moved=false,startX=0,startY=0,pinch=0,rotationX=-.15,rotationY=.4,distance=9;

  function $(id){return document.getElementById(id);}
  function part(id){return PARTS.find(function(x){return x.id===id;})||PARTS[0];}
  function loadState(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{mission:Math.min(Number(d.mission)||0,MISSIONS.length),quiz:Math.min(Number(d.quiz)||0,QUESTIONS.length),correct:Number(d.correct)||0,selected:d.selected||'norte'};}catch(_){return{mission:0,quiz:0,correct:0,selected:'norte'};}}
  function save(){state.selected=selected;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateProgress();}
  function updateProgress(){var done=state.mission+state.quiz,total=MISSIONS.length+QUESTIONS.length,pct=Math.round(done/total*100);dom.progressText.textContent=pct+'%';dom.progressBar.style.width=pct+'%';}
  function cache(){['progressText','progressBar','scene','labels','fallback','labelsToggle','partButtons','partType','partName','partDescription','partRole','partDetail','partExample','missionTitle','missionHint','missionStatus','question','answers','feedback','rotateButton','resetButton'].forEach(function(id){dom[id]=$(id);});}
  function mat(color){return new THREE.MeshStandardMaterial({color:color,roughness:.5,metalness:.05});}
  function addLabel(id,x,y,z){var el=document.createElement('span');el.className='label';el.textContent=part(id).icon+' '+part(id).name;dom.labels.appendChild(el);labels.push({id:id,el:el,anchor:new THREE.Vector3(x,y,z)});}
  function addMesh(geo,material,pos){var m=new THREE.Mesh(geo,material);m.position.set(pos[0],pos[1],pos[2]);return m;}
  function register(id,mesh){mesh.userData.partId=id;objects.push({id:id,mesh:mesh});}
  function buildScene(){
    modelRoot=new THREE.Group();scene.add(modelRoot);
    var norte=addMesh(new THREE.CylinderGeometry(GROSOR,GROSOR,LEN/2,32),mat(0xff3b30),[0,LEN/4,0]);register('norte',norte);
    var sur=addMesh(new THREE.CylinderGeometry(GROSOR,GROSOR,LEN/2,32),mat(0x1e6fff),[0,-LEN/4,0]);register('sur',sur);
    modelRoot.add(norte);modelRoot.add(sur);
    var geoP=new THREE.SphereGeometry(.07,8,8),matP=new THREE.MeshBasicMaterial({color:0xffd60a});
    for(var i=0;i<NUM;i++){
      var p=addMesh(geoP,matP,[0,0,0]);register('campo',p);
      p.userData={angulo:Math.random()*Math.PI*2,progreso:Math.random()*Math.PI,radioCurva:1.4+Math.random()*2.6,velocidad:.012+Math.random()*.02};
      modelRoot.add(p);particles.push(p);
    }
    addLabel('norte',LEN/2+.7,0,0);addLabel('sur',-(LEN/2+.7),0,0);addLabel('campo',0,1.9,0);
  }
  function renderPartButtons(){dom.partButtons.innerHTML='';PARTS.forEach(function(item){var b=document.createElement('button');b.type='button';b.dataset.part=item.id;b.textContent=item.icon+' '+item.name;b.addEventListener('click',function(){selectPart(item.id,true);});dom.partButtons.appendChild(b);});}
  function selectPart(id,countMission){var item=part(id);selected=id;
    dom.partType.textContent=item.type;dom.partType.style.background=item.type==='Polo'?'var(--gold)':'var(--blue)';
    dom.partName.textContent=item.name;dom.partDescription.textContent=item.description;
    dom.partRole.textContent=item.role;dom.partDetail.textContent=item.detail;dom.partExample.textContent=item.example;
    Array.prototype.forEach.call(dom.partButtons.children,function(b){b.classList.toggle('active',b.dataset.part===id);});
    objects.forEach(function(x){if(x.mesh.material&&x.mesh.material.emissive)x.mesh.material.emissive.setHex(x.id===id?0x1a1a1a:0);});
    if(countMission&&state.mission<MISSIONS.length&&MISSIONS[state.mission].id===id){state.mission++;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';save();setTimeout(renderMission,750);}
    save();
  }
  function renderMission(){if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Campo explorado!';dom.missionHint.textContent='Identificaste los polos y las líneas de campo.';dom.missionStatus.textContent='6 de 6 misiones';dom.missionStatus.className='status success';return;}var m=MISSIONS[state.mission];dom.missionTitle.textContent=m.title;dom.missionHint.textContent=m.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';}
  function renderQuestion(){dom.answers.innerHTML='';dom.feedback.textContent='';if(state.quiz>=QUESTIONS.length){dom.question.textContent='¡Reto completado!';dom.feedback.textContent='Resultado: '+state.correct+' de '+QUESTIONS.length+' respuestas correctas.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state.quiz=0;state.correct=0;save();renderQuestion();});dom.answers.appendChild(reset);return;}var q=QUESTIONS[state.quiz];dom.question.textContent=q.q;q.options.forEach(function(option){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){var right=option===q.answer;b.classList.add(right?'correct':'wrong');dom.feedback.textContent=right?'✓ ¡Correcto!':'Respuesta correcta: '+q.answer+'.';Array.prototype.forEach.call(dom.answers.children,function(x){x.disabled=true;});state.quiz++;if(right)state.correct++;save();setTimeout(renderQuestion,850);});dom.answers.appendChild(b);});}
  function initThree(){if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(50,1,.1,200);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');scene.add(new THREE.HemisphereLight(0xd9e4ff,0x101018,1.1));var light=new THREE.DirectionalLight(0xffffff,1.3);light.position.set(6,10,8);scene.add(light);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildScene();bindScene();resize();animate();}
  function bindScene(){var c=renderer.domElement;c.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;rotationY+=dx*.007;rotationX=Math.max(-.85,Math.min(.85,rotationX+dy*.006));startX=e.clientX;startY=e.clientY;});c.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});c.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(5,Math.min(16,distance+e.deltaY*.02));},{passive:false});c.addEventListener('touchstart',function(e){if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});c.addEventListener('touchmove',function(e){if(e.touches.length===2){var n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(5,Math.min(16,distance+(pinch-n)*.03));pinch=n;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hit=raycaster.intersectObjects(objects.map(function(x){return x.mesh;}),false)[0];if(hit&&hit.object.userData.partId)selectPart(hit.object.userData.partId,true);}
  function updateLabels(){if(!camera)return;var show=dom.labelsToggle.checked;labels.forEach(function(x){var world=x.anchor.clone().applyMatrix4(modelRoot.matrixWorld);world.project(camera);x.el.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';x.el.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';x.el.style.opacity=show&&world.z<1?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);
    particles.forEach(function(p){
      var d=p.userData;d.progreso+=d.velocidad;if(d.progreso>Math.PI)d.progreso=0;
      p.position.set(Math.cos(d.progreso)*(LEN/2+.5),Math.sin(d.progreso)*d.radioCurva*Math.sin(d.angulo),Math.sin(d.progreso)*d.radioCurva*Math.cos(d.angulo));
    });
    if(autoRotate&&!dragging)rotationY+=.0022;modelRoot.rotation.y=rotationY;modelRoot.rotation.x=rotationX;
    camera.position.set(0,1.2,distance);camera.lookAt(0,0,0);renderer.render(scene,camera);updateLabels();
  }
  function bind(){dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){rotationX=-.15;rotationY=.4;distance=9;});dom.labelsToggle.addEventListener('change',updateLabels);addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cache();bind();renderMission();renderQuestion();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}renderPartButtons();selectPart(state.selected,false);window.magnetismo3dReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
