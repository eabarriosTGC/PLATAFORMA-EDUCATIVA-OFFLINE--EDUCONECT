(function () {
  'use strict';
  var STORAGE_KEY = 'educonect:module:cie-406';
  var ANG = 104.5 * Math.PI / 180, BOND = 1.35, HX = Math.sin(ANG / 2) * BOND, HY = -Math.cos(ANG / 2) * BOND;
  var PARTS = [
    {id:'oxigeno',name:'Oxígeno',icon:'🔴',type:'Átomo',color:0xff5252,description:'Átomo central de la molécula: es el más grande y atrae los electrones compartidos.',role:'Átomo central',detail:'Símbolo O · 8 protones',example:'💡 El oxígeno "jala" los electrones: por eso la molécula se dobla en 104.5°.'},
    {id:'hidrogeno',name:'Hidrógeno',icon:'⚪',type:'Átomo',color:0xffffff,description:'Átomo pequeño que se une al oxígeno compartiendo un electrón (enlace covalente).',role:'Se une al oxígeno',detail:'Símbolo H · 1 protón',example:'💡 Hay dos hidrógenos por cada oxígeno: por eso la fórmula es H₂O.'},
    {id:'enlace',name:'Enlace covalente',icon:'🔗',type:'Enlace',color:0x90a4ae,description:'Unión donde el oxígeno y el hidrógeno comparten electrones.',role:'Compartir electrones',detail:'Ángulo H-O-H: 104.5°',example:'💡 El agua hierve a 100 °C porque sus moléculas se atraen entre sí.'}
  ];
  var MISSIONS = [
    {id:'oxigeno',title:'Encuentra el átomo central',hint:'Toca el átomo más grande de la molécula.'},
    {id:'hidrogeno',title:'Localiza el átomo más pequeño',hint:'Toca las esferas blancas unidas al oxígeno.'},
    {id:'enlace',title:'Busca el enlace covalente',hint:'Toca el puente gris que une el oxígeno con un hidrógeno.'},
    {id:'hidrogeno',title:'Encuentra los dos átomos iguales',hint:'Toca cualquiera de los dos átomos blancos.'},
    {id:'oxigeno',title:'Localiza el átomo rojo',hint:'Toca la esfera roja del centro.'},
    {id:'enlace',title:'Busca el puente de electrones compartidos',hint:'Toca uno de los dos cilindros grises.'}
  ];
  var QUESTIONS = [
    {q:'¿Cuántos átomos de hidrógeno tiene el agua?',options:['1','2','3','4'],answer:'2'},
    {q:'¿Qué átomo es el central de la molécula?',options:['Hidrógeno','Oxígeno','Carbono','Nitrógeno'],answer:'Oxígeno'},
    {q:'¿Cómo se llama el enlace entre oxígeno e hidrógeno?',options:['Iónico','Metálico','Covalente','Débil'],answer:'Covalente'},
    {q:'¿Cuál es la fórmula química del agua?',options:['CO₂','H₂O','O₂','NaCl'],answer:'H₂O'},
    {q:'¿Qué ángulo forman los dos enlaces del agua?',options:['90°','104.5°','120°','180°'],answer:'104.5°'},
    {q:'¿Qué color representa el oxígeno en este modelo?',options:['Blanco','Azul','Verde','Rojo'],answer:'Rojo'}
  ];
  var state=loadState(),dom={},scene,camera,renderer,modelRoot,raycaster,pointer,animationId=0;
  var objects=[],labels=[],selected='oxigeno',autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,moved=false,startX=0,startY=0,pinch=0,rotationX=-.15,rotationY=.4,distance=5.5;

  function $(id){return document.getElementById(id);}
  function part(id){return PARTS.find(function(x){return x.id===id;})||PARTS[0];}
  function loadState(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{mission:Math.min(Number(d.mission)||0,MISSIONS.length),quiz:Math.min(Number(d.quiz)||0,QUESTIONS.length),correct:Number(d.correct)||0,selected:d.selected||'oxigeno'};}catch(_){return{mission:0,quiz:0,correct:0,selected:'oxigeno'};}}
  function save(){state.selected=selected;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateProgress();}
  function updateProgress(){var done=state.mission+state.quiz,total=MISSIONS.length+QUESTIONS.length,pct=Math.round(done/total*100);dom.progressText.textContent=pct+'%';dom.progressBar.style.width=pct+'%';}
  function cache(){['progressText','progressBar','scene','labels','fallback','labelsToggle','atomButtons','atomType','atomName','atomDescription','atomRole','atomDetail','atomExample','missionTitle','missionHint','missionStatus','question','answers','feedback','rotateButton','resetButton'].forEach(function(id){dom[id]=$(id);});}
  function mat(color){return new THREE.MeshStandardMaterial({color:color,roughness:.45,metalness:.08});}
  function addLabel(id,x,y,z){var el=document.createElement('span');el.className='label';el.textContent=part(id).icon+' '+part(id).name;dom.labels.appendChild(el);labels.push({id:id,el:el,anchor:new THREE.Vector3(x,y,z)});}
  function addMesh(geo,material,pos){var m=new THREE.Mesh(geo,material);m.position.set(pos[0],pos[1],pos[2]);return m;}
  function cylinderBetween(group,id,a,b,radius,material){var start=new THREE.Vector3(a[0],a[1],a[2]),end=new THREE.Vector3(b[0],b[1],b[2]),mid=start.clone().add(end).multiplyScalar(.5),mesh=addMesh(new THREE.CylinderGeometry(radius,radius,start.distanceTo(end),10),material,[mid.x,mid.y,mid.z]);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());mesh.userData.partId=id;group.add(mesh);objects.push({id:id,mesh:mesh});return mesh;}
  function buildMolecule(){
    modelRoot=new THREE.Group();scene.add(modelRoot);
    var o=mat(0xff5252),h=mat(0xffffff),b=mat(0x90a4ae);
    var oMesh=addMesh(new THREE.SphereGeometry(.95,32,24),o,[0,0,0]);oMesh.userData.partId='oxigeno';modelRoot.add(oMesh);objects.push({id:'oxigeno',mesh:oMesh});
    [-1,1].forEach(function(side){
      var hm=addMesh(new THREE.SphereGeometry(.45,24,18),h,[HX*side,HY,0]);hm.userData.partId='hidrogeno';modelRoot.add(hm);objects.push({id:'hidrogeno',mesh:hm});
      cylinderBetween(modelRoot,'enlace',[0,0,0],[HX*side,HY,0],.12,b);
    });
    addLabel('oxigeno',0,1.55,0);addLabel('hidrogeno',HX,HY+.75,0);addLabel('hidrogeno',-HX,HY+.75,0);addLabel('enlace',0,-1.7,0);
  }
  function renderPartButtons(){dom.atomButtons.innerHTML='';PARTS.forEach(function(item){var b=document.createElement('button');b.type='button';b.dataset.part=item.id;b.textContent=item.icon+' '+item.name;b.addEventListener('click',function(){selectPart(item.id,true);});dom.atomButtons.appendChild(b);});}
  function selectPart(id,countMission){var item=part(id);selected=id;
    dom.atomType.textContent=item.type;dom.atomType.style.background=item.type==='Átomo'?'var(--blue)':'var(--gold)';
    dom.atomName.textContent=item.name;dom.atomDescription.textContent=item.description;
    dom.atomRole.textContent=item.role;dom.atomDetail.textContent=item.detail;dom.atomExample.textContent=item.example;
    Array.prototype.forEach.call(dom.atomButtons.children,function(b){b.classList.toggle('active',b.dataset.part===id);});
    objects.forEach(function(x){if(x.mesh.material&&x.mesh.material.emissive)x.mesh.material.emissive.setHex(x.id===id?0x222222:0);});
    if(countMission&&state.mission<MISSIONS.length&&MISSIONS[state.mission].id===id){state.mission++;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';save();setTimeout(renderMission,750);}
    save();
  }
  function renderMission(){if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Molécula explorada!';dom.missionHint.textContent='Identificaste los átomos y los enlaces del agua.';dom.missionStatus.textContent='6 de 6 misiones';dom.missionStatus.className='status success';return;}var m=MISSIONS[state.mission];dom.missionTitle.textContent=m.title;dom.missionHint.textContent=m.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';}
  function renderQuestion(){dom.answers.innerHTML='';dom.feedback.textContent='';if(state.quiz>=QUESTIONS.length){dom.question.textContent='¡Reto completado!';dom.feedback.textContent='Resultado: '+state.correct+' de '+QUESTIONS.length+' respuestas correctas.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state.quiz=0;state.correct=0;save();renderQuestion();});dom.answers.appendChild(reset);return;}var q=QUESTIONS[state.quiz];dom.question.textContent=q.q;q.options.forEach(function(option){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){var right=option===q.answer;b.classList.add(right?'correct':'wrong');dom.feedback.textContent=right?'✓ ¡Correcto!':'Respuesta correcta: '+q.answer+'.';Array.prototype.forEach.call(dom.answers.children,function(x){x.disabled=true;});state.quiz++;if(right)state.correct++;save();setTimeout(renderQuestion,850);});dom.answers.appendChild(b);});}
  function initThree(){if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,100);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');scene.add(new THREE.HemisphereLight(0xdffaff,0x0a2333,1.15));var light=new THREE.DirectionalLight(0xffffff,1.4);light.position.set(6,10,8);scene.add(light);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildMolecule();bindScene();resize();animate();}
  function bindScene(){var c=renderer.domElement;c.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;rotationY+=dx*.007;rotationX=Math.max(-.85,Math.min(.85,rotationX+dy*.006));startX=e.clientX;startY=e.clientY;});c.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});c.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(3.5,Math.min(9,distance+e.deltaY*.02));},{passive:false});c.addEventListener('touchstart',function(e){if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});c.addEventListener('touchmove',function(e){if(e.touches.length===2){var n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(3.5,Math.min(9,distance+(pinch-n)*.03));pinch=n;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hit=raycaster.intersectObjects(objects.map(function(x){return x.mesh;}),false)[0];if(hit&&hit.object.userData.partId)selectPart(hit.object.userData.partId,true);}
  function updateLabels(){if(!camera)return;var show=dom.labelsToggle.checked;labels.forEach(function(x){var world=x.anchor.clone().applyMatrix4(modelRoot.matrixWorld);world.project(camera);x.el.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';x.el.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';x.el.style.opacity=show&&world.z<1?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);if(autoRotate&&!dragging)rotationY+=.0022;modelRoot.rotation.y=rotationY;modelRoot.rotation.x=rotationX;camera.position.set(0,.3,distance);camera.lookAt(0,-.1,0);renderer.render(scene,camera);updateLabels();}
  function bind(){dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){rotationX=-.15;rotationY=.4;distance=5.5;});dom.labelsToggle.addEventListener('change',updateLabels);addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cache();bind();renderMission();renderQuestion();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}renderPartButtons();selectPart(state.selected,false);window.agua3dReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
