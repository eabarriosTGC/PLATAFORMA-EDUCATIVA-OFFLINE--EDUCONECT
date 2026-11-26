(function () {
  'use strict';
  var STORAGE_KEY = 'educonect:module:cie-408';
  var PAIRS=20,R=1.5,STEP=.5,TURN=.4;
  var PARTS = [
    {id:'esqueleto',name:'Esqueleto',icon:'🩵',type:'Estructura',color:0x00bcd4,description:'Las dos cadenas laterales de azúcar (desoxirribosa) y fosfato que sostienen la escalera del ADN.',role:'Sostener la hélice',pair:'Azúcar + fosfato',example:'💡 Las dos cadenas corren en sentidos opuestos: son antiparalelas.'},
    {id:'base',name:'Bases nitrogenadas',icon:'🧬',type:'Estructura',color:0xffb74d,description:'Puentes entre las cadenas: adenina se une con timina y citosina con guanina.',role:'Guardar la información',pair:'Adenina-Timina · Citosina-Guanina',example:'💡 La secuencia de bases es el manual de instrucciones de cada ser vivo.'}
  ];
  var MISSIONS = [
    {id:'esqueleto',title:'Encuentra el esqueleto de la hélice',hint:'Toca las esferas cian de las cadenas laterales.'},
    {id:'base',title:'Localiza los puentes entre las cadenas',hint:'Toca un escalón naranja o verde de la escalera.'},
    {id:'esqueleto',title:'Busca las dos cadenas',hint:'Toca cualquiera de las esferas cian.'},
    {id:'base',title:'Encuentra el código genético',hint:'Toca un puente de bases nitrogenadas.'},
    {id:'esqueleto',title:'Localiza el azúcar y el fosfato',hint:'Toca la cadena lateral cian.'},
    {id:'base',title:'Busca el par Adenina-Timina',hint:'Toca un escalón naranja.'}
  ];
  var QUESTIONS = [
    {q:'¿Qué forma tiene el ADN?',options:['Hélice simple','Doble hélice','Círculo','Escalera recta'],answer:'Doble hélice'},
    {q:'¿Con qué base se une la adenina?',options:['Citosina','Guanina','Timina','Uracilo'],answer:'Timina'},
    {q:'¿Qué forma el esqueleto del ADN?',options:['Azúcar y fosfato','Proteínas','Grasas','Solo agua'],answer:'Azúcar y fosfato'},
    {q:'¿Cuántas cadenas tiene la doble hélice?',options:['1','2','3','4'],answer:'2'},
    {q:'¿Qué par de bases es correcto?',options:['A-T','A-C','T-G','C-C'],answer:'A-T'},
    {q:'¿Cómo se llama el azúcar del ADN?',options:['Glucosa','Desoxirribosa','Fructosa','Ribosa'],answer:'Desoxirribosa'}
  ];
  var state=loadState(),dom={},scene,camera,renderer,modelRoot,raycaster,pointer,animationId=0;
  var objects=[],labels=[],selected='esqueleto',autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,moved=false,startX=0,startY=0,pinch=0,rotationX=-.15,rotationY=.3,distance=14;

  function $(id){return document.getElementById(id);}
  function part(id){return PARTS.find(function(x){return x.id===id;})||PARTS[0];}
  function loadState(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{mission:Math.min(Number(d.mission)||0,MISSIONS.length),quiz:Math.min(Number(d.quiz)||0,QUESTIONS.length),correct:Number(d.correct)||0,selected:d.selected||'esqueleto'};}catch(_){return{mission:0,quiz:0,correct:0,selected:'esqueleto'};}}
  function save(){state.selected=selected;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateProgress();}
  function updateProgress(){var done=state.mission+state.quiz,total=MISSIONS.length+QUESTIONS.length,pct=Math.round(done/total*100);dom.progressText.textContent=pct+'%';dom.progressBar.style.width=pct+'%';}
  function cache(){['progressText','progressBar','scene','labels','fallback','labelsToggle','partButtons','partType','partName','partDescription','partRole','partPair','partExample','missionTitle','missionHint','missionStatus','question','answers','feedback','rotateButton','resetButton'].forEach(function(id){dom[id]=$(id);});}
  function mat(color){return new THREE.MeshStandardMaterial({color:color,roughness:.5,metalness:.05});}
  function addLabel(id,x,y,z){var el=document.createElement('span');el.className='label';el.textContent=part(id).icon+' '+part(id).name;dom.labels.appendChild(el);labels.push({id:id,el:el,anchor:new THREE.Vector3(x,y,z)});}
  function addMesh(geo,material,pos){var m=new THREE.Mesh(geo,material);m.position.set(pos[0],pos[1],pos[2]);return m;}
  function register(id,mesh){mesh.userData.partId=id;objects.push({id:id,mesh:mesh});}
  function cylinderBetween(group,id,a,b,radius,material){var start=new THREE.Vector3(a[0],a[1],a[2]),end=new THREE.Vector3(b[0],b[1],b[2]),mid=start.clone().add(end).multiplyScalar(.5),mesh=addMesh(new THREE.CylinderGeometry(radius,radius,start.distanceTo(end),10),material,[mid.x,mid.y,mid.z]);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());register(id,mesh);group.add(mesh);return mesh;}
  function buildDna(){
    modelRoot=new THREE.Group();scene.add(modelRoot);
    var back=mat(0x00bcd4),backLink=mat(0x00897b),baseA=mat(0xffb74d),baseB=mat(0x81c784);
    var ptsA=[],ptsB=[],i,y,ang,posA,posB;
    for(i=0;i<PAIRS;i++){
      y=(i-(PAIRS-1)/2)*STEP;ang=i*TURN;
      posA=[Math.cos(ang)*R,y,Math.sin(ang)*R];posB=[-Math.cos(ang)*R,y,-Math.sin(ang)*R];
      var sa=addMesh(new THREE.SphereGeometry(.28,16,14),back,posA);register('esqueleto',sa);modelRoot.add(sa);
      var sb=addMesh(new THREE.SphereGeometry(.28,16,14),back,posB);register('esqueleto',sb);modelRoot.add(sb);
      cylinderBetween(modelRoot,'base',posA,posB,.11,i%2?baseB:baseA);
      ptsA.push(posA);ptsB.push(posB);
    }
    for(i=0;i<PAIRS-1;i++){cylinderBetween(modelRoot,'esqueleto',ptsA[i],ptsA[i+1],.07,backLink);cylinderBetween(modelRoot,'esqueleto',ptsB[i],ptsB[i+1],.07,backLink);}
    addLabel('esqueleto',2.5,5.6,0);addLabel('base',0,-.4,-2.2);
  }
  function renderPartButtons(){dom.partButtons.innerHTML='';PARTS.forEach(function(item){var b=document.createElement('button');b.type='button';b.dataset.part=item.id;b.textContent=item.icon+' '+item.name;b.addEventListener('click',function(){selectPart(item.id,true);});dom.partButtons.appendChild(b);});}
  function selectPart(id,countMission){var item=part(id);selected=id;
    dom.partType.textContent=item.type;dom.partType.style.background=item.type==='Estructura'?'var(--blue)':'var(--gold)';
    dom.partName.textContent=item.name;dom.partDescription.textContent=item.description;
    dom.partRole.textContent=item.role;dom.partPair.textContent=item.pair;dom.partExample.textContent=item.example;
    Array.prototype.forEach.call(dom.partButtons.children,function(b){b.classList.toggle('active',b.dataset.part===id);});
    objects.forEach(function(x){if(x.mesh.material&&x.mesh.material.emissive)x.mesh.material.emissive.setHex(x.id===id?0x1a1a1a:0);});
    if(countMission&&state.mission<MISSIONS.length&&MISSIONS[state.mission].id===id){state.mission++;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';save();setTimeout(renderMission,750);}
    save();
  }
  function renderMission(){if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Hélice descifrada!';dom.missionHint.textContent='Identificaste el esqueleto y las bases del ADN.';dom.missionStatus.textContent='6 de 6 misiones';dom.missionStatus.className='status success';return;}var m=MISSIONS[state.mission];dom.missionTitle.textContent=m.title;dom.missionHint.textContent=m.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';}
  function renderQuestion(){dom.answers.innerHTML='';dom.feedback.textContent='';if(state.quiz>=QUESTIONS.length){dom.question.textContent='¡Reto completado!';dom.feedback.textContent='Resultado: '+state.correct+' de '+QUESTIONS.length+' respuestas correctas.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state.quiz=0;state.correct=0;save();renderQuestion();});dom.answers.appendChild(reset);return;}var q=QUESTIONS[state.quiz];dom.question.textContent=q.q;q.options.forEach(function(option){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){var right=option===q.answer;b.classList.add(right?'correct':'wrong');dom.feedback.textContent=right?'✓ ¡Correcto!':'Respuesta correcta: '+q.answer+'.';Array.prototype.forEach.call(dom.answers.children,function(x){x.disabled=true;});state.quiz++;if(right)state.correct++;save();setTimeout(renderQuestion,850);});dom.answers.appendChild(b);});}
  function initThree(){if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(45,1,.1,200);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');scene.add(new THREE.HemisphereLight(0xd8fff5,0x0a2622,1.15));var light=new THREE.DirectionalLight(0xffffff,1.4);light.position.set(6,10,8);scene.add(light);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildDna();bindScene();resize();animate();}
  function bindScene(){var c=renderer.domElement;c.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;rotationY+=dx*.007;rotationX=Math.max(-.85,Math.min(.85,rotationX+dy*.006));startX=e.clientX;startY=e.clientY;});c.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});c.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(10,Math.min(22,distance+e.deltaY*.02));},{passive:false});c.addEventListener('touchstart',function(e){if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});c.addEventListener('touchmove',function(e){if(e.touches.length===2){var n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(10,Math.min(22,distance+(pinch-n)*.03));pinch=n;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hit=raycaster.intersectObjects(objects.map(function(x){return x.mesh;}),false)[0];if(hit&&hit.object.userData.partId)selectPart(hit.object.userData.partId,true);}
  function updateLabels(){if(!camera)return;var show=dom.labelsToggle.checked;labels.forEach(function(x){var world=x.anchor.clone().applyMatrix4(modelRoot.matrixWorld);world.project(camera);x.el.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';x.el.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';x.el.style.opacity=show&&world.z<1?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);if(autoRotate&&!dragging)rotationY+=.0022;modelRoot.rotation.y=rotationY;modelRoot.rotation.x=rotationX;camera.position.set(0,0,distance);camera.lookAt(0,0,0);renderer.render(scene,camera);updateLabels();}
  function bind(){dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){rotationX=-.15;rotationY=.3;distance=14;});dom.labelsToggle.addEventListener('change',updateLabels);addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cache();bind();renderMission();renderQuestion();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}renderPartButtons();selectPart(state.selected,false);window.adn3dReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
