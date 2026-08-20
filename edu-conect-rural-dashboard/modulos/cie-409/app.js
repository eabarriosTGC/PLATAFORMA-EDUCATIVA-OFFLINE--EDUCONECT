(function () {
  'use strict';
  var STORAGE_KEY = 'educonect:module:cie-409';
  var PARTS = [
    {id:'onda',name:'Onda matemática',icon:'🌊',type:'Gráfica',color:0x00d2ff,description:'Superficie generada por la función y = sen(x) + cos(z): cada punto del plano se eleva según sus coordenadas.',role:'Representar la función',detail:'y = sen(x) + cos(z)',example:'💡 En los puntos altos, sen(x) + cos(z) suman más; en los bajos, casi se cancelan.'},
    {id:'cuadricula',name:'Cuadrícula',icon:'▦',type:'Referencia',color:0x6b6b8a,description:'Plano de referencia XZ que ayuda a ubicar la altura de cada punto de la onda.',role:'Referencia espacial',detail:'Ejes X (ancho) y Z (fondo)',example:'💡 La altura de la onda se mide siempre desde este plano de referencia.'}
  ];
  var MISSIONS = [
    {id:'onda',title:'Encuentra la onda',hint:'Toca la superficie de color cian.'},
    {id:'cuadricula',title:'Localiza el plano de referencia',hint:'Toca la cuadrícula debajo de la onda.'},
    {id:'onda',title:'Busca el punto más alto de la gráfica',hint:'Toca la superficie en una de sus crestas.'},
    {id:'cuadricula',title:'Encuentra los ejes X y Z',hint:'Toca la cuadrícula gris.'},
    {id:'onda',title:'Localiza la función de dos variables',hint:'Toca la superficie de la onda.'},
    {id:'cuadricula',title:'Busca el plano desde donde se mide la altura',hint:'Toca la cuadrícula.'}
  ];
  var QUESTIONS = [
    {q:'¿Qué forma tiene la superficie?',options:['Plano inclinado','Onda','Cubo','Cilindro'],answer:'Onda'},
    {q:'¿Cuántas variables usa la función graficada?',options:['1','2','3','Ninguna'],answer:'2'},
    {q:'¿Qué función se graficó?',options:['x + y','sen(x) + cos(z)','x² + y²','|x|'],answer:'sen(x) + cos(z)'},
    {q:'¿Para qué sirve la cuadrícula?',options:['Decorar','Referencia espacial','Sostener el modelo','Nada'],answer:'Referencia espacial'},
    {q:'¿En qué eje se mide la altura de cada punto?',options:['X','Y','Z','Ninguno'],answer:'Y'},
    {q:'Si giras el modelo, ¿cambia la función?',options:['Sí, se deforma','No, solo cambia la vista','Desaparece','Se duplica'],answer:'No, solo cambia la vista'}
  ];
  var state=loadState(),dom={},scene,camera,renderer,modelRoot,raycaster,pointer,animationId=0;
  var objects=[],labels=[],selected='onda',autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,moved=false,startX=0,startY=0,pinch=0,rotationX=-.3,rotationY=.5,distance=10;

  function $(id){return document.getElementById(id);}
  function part(id){return PARTS.find(function(x){return x.id===id;})||PARTS[0];}
  function loadState(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{mission:Math.min(Number(d.mission)||0,MISSIONS.length),quiz:Math.min(Number(d.quiz)||0,QUESTIONS.length),correct:Number(d.correct)||0,selected:d.selected||'onda'};}catch(_){return{mission:0,quiz:0,correct:0,selected:'onda'};}}
  function save(){state.selected=selected;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateProgress();}
  function updateProgress(){var done=state.mission+state.quiz,total=MISSIONS.length+QUESTIONS.length,pct=Math.round(done/total*100);dom.progressText.textContent=pct+'%';dom.progressBar.style.width=pct+'%';}
  function cache(){['progressText','progressBar','scene','labels','fallback','labelsToggle','partButtons','partType','partName','partDescription','partRole','partDetail','partExample','missionTitle','missionHint','missionStatus','question','answers','feedback','rotateButton','resetButton'].forEach(function(id){dom[id]=$(id);});}
  function mat(color){return new THREE.MeshStandardMaterial({color:color,roughness:.55,metalness:.05});}
  function addLabel(id,x,y,z){var el=document.createElement('span');el.className='label';el.textContent=part(id).icon+' '+part(id).name;dom.labels.appendChild(el);labels.push({id:id,el:el,anchor:new THREE.Vector3(x,y,z)});}
  function addMesh(geo,material,pos){var m=new THREE.Mesh(geo,material);m.position.set(pos[0],pos[1],pos[2]);return m;}
  function register(id,mesh){mesh.userData.partId=id;objects.push({id:id,mesh:mesh});}
  function buildScene(){
    modelRoot=new THREE.Group();scene.add(modelRoot);
    var geo=new THREE.PlaneGeometry(10,10,48,48);geo.rotateX(-Math.PI/2);
    var pos=geo.attributes.position;
    for(var i=0;i<pos.count;i++){var x=pos.getX(i),z=pos.getZ(i);pos.setY(i,Math.sin(x)+Math.cos(z));}
    geo.computeVertexNormals();
    var surf=addMesh(geo,new THREE.MeshPhongMaterial({color:0x00d2ff,side:THREE.DoubleSide,flatShading:true}),[0,0,0]);register('onda',surf);modelRoot.add(surf);
    var grid=new THREE.GridHelper(15,15,0x8a8ab0,0x4a4a68);grid.position.y=-2.6;register('cuadricula',grid);modelRoot.add(grid);
    addLabel('onda',0,3.2,0);addLabel('cuadricula',4.5,-2.1,0);
  }
  function renderPartButtons(){dom.partButtons.innerHTML='';PARTS.forEach(function(item){var b=document.createElement('button');b.type='button';b.dataset.part=item.id;b.textContent=item.icon+' '+item.name;b.addEventListener('click',function(){selectPart(item.id,true);});dom.partButtons.appendChild(b);});}
  function selectPart(id,countMission){var item=part(id);selected=id;
    dom.partType.textContent=item.type;dom.partType.style.background=item.type==='Gráfica'?'var(--blue)':'var(--gold)';
    dom.partName.textContent=item.name;dom.partDescription.textContent=item.description;
    dom.partRole.textContent=item.role;dom.partDetail.textContent=item.detail;dom.partExample.textContent=item.example;
    Array.prototype.forEach.call(dom.partButtons.children,function(b){b.classList.toggle('active',b.dataset.part===id);});
    objects.forEach(function(x){if(x.mesh.material&&x.mesh.material.emissive)x.mesh.material.emissive.setHex(x.id===id?0x1a1a1a:0);});
    if(countMission&&state.mission<MISSIONS.length&&MISSIONS[state.mission].id===id){state.mission++;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';save();setTimeout(renderMission,750);}
    save();
  }
  function renderMission(){if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Gráfica explorada!';dom.missionHint.textContent='Identificaste la onda y su plano de referencia.';dom.missionStatus.textContent='6 de 6 misiones';dom.missionStatus.className='status success';return;}var m=MISSIONS[state.mission];dom.missionTitle.textContent=m.title;dom.missionHint.textContent=m.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';}
  function renderQuestion(){dom.answers.innerHTML='';dom.feedback.textContent='';if(state.quiz>=QUESTIONS.length){dom.question.textContent='¡Reto completado!';dom.feedback.textContent='Resultado: '+state.correct+' de '+QUESTIONS.length+' respuestas correctas.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state.quiz=0;state.correct=0;save();renderQuestion();});dom.answers.appendChild(reset);return;}var q=QUESTIONS[state.quiz];dom.question.textContent=q.q;q.options.forEach(function(option){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){var right=option===q.answer;b.classList.add(right?'correct':'wrong');dom.feedback.textContent=right?'✓ ¡Correcto!':'Respuesta correcta: '+q.answer+'.';Array.prototype.forEach.call(dom.answers.children,function(x){x.disabled=true;});state.quiz++;if(right)state.correct++;save();setTimeout(renderQuestion,850);});dom.answers.appendChild(b);});}
  function initThree(){if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(50,1,.1,200);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');scene.add(new THREE.HemisphereLight(0xdffaff,0x0d0d1f,1.1));var light=new THREE.DirectionalLight(0xffffff,1.3);light.position.set(8,12,8);scene.add(light);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildScene();bindScene();resize();animate();}
  function bindScene(){var c=renderer.domElement;c.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;rotationY+=dx*.007;rotationX=Math.max(-.85,Math.min(.85,rotationX+dy*.006));startX=e.clientX;startY=e.clientY;});c.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});c.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(6,Math.min(16,distance+e.deltaY*.02));},{passive:false});c.addEventListener('touchstart',function(e){if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});c.addEventListener('touchmove',function(e){if(e.touches.length===2){var n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(6,Math.min(16,distance+(pinch-n)*.03));pinch=n;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hit=raycaster.intersectObjects(objects.map(function(x){return x.mesh;}),false)[0];if(hit&&hit.object.userData.partId)selectPart(hit.object.userData.partId,true);}
  function updateLabels(){if(!camera)return;var show=dom.labelsToggle.checked;labels.forEach(function(x){var world=x.anchor.clone().applyMatrix4(modelRoot.matrixWorld);world.project(camera);x.el.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';x.el.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';x.el.style.opacity=show&&world.z<1?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);if(autoRotate&&!dragging)rotationY+=.0022;modelRoot.rotation.y=rotationY;modelRoot.rotation.x=rotationX;camera.position.set(0,1,distance);camera.lookAt(0,0,0);renderer.render(scene,camera);updateLabels();}
  function bind(){dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){rotationX=-.3;rotationY=.5;distance=10;});dom.labelsToggle.addEventListener('change',updateLabels);addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cache();bind();renderMission();renderQuestion();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}renderPartButtons();selectPart(state.selected,false);window.graficas3dReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
