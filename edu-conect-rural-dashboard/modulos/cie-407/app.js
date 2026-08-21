(function () {
  'use strict';
  var STORAGE_KEY = 'educonect:module:cie-407';
  var V0=12,G=9.8,ANG=Math.PI/4,X0=-7.35,Y0=.35;
  var FLIGHT=2*V0*Math.sin(ANG)/G,ALCANCE=V0*V0*Math.sin(2*ANG)/G,HMAX=Y0+V0*V0*Math.sin(ANG)*Math.sin(ANG)/(2*G);
  var PARTS = [
    {id:'proyectil',name:'Proyectil',icon:'🔶',type:'Elemento',color:0xffd54f,description:'Esfera que describe la trayectoria parabólica: avanza en x con rapidez constante mientras la gravedad lo baja.',speed:'12 m/s',angle:'45°',gravity:'9.8 m/s²',height:'≈ '+HMAX.toFixed(1)+' m',example:'💡 En el punto más alto la velocidad vertical es cero: solo queda la horizontal.'},
    {id:'suelo',name:'Suelo',icon:'🟩',type:'Elemento',color:0x2e7d5b,description:'Plano donde aterriza el proyectil: la gravedad lo atrae constantemente hacia abajo.',speed:'—',angle:'—',gravity:'9.8 m/s²',height:'0 m',example:'💡 Sin gravedad el proyectil seguiría en línea recta: la parábola existe gracias a ella.'},
    {id:'canon',name:'Cañón',icon:'🎯',type:'Elemento',color:0x795548,description:'Lanza el proyectil con rapidez inicial de 12 m/s y un ángulo de 45° respecto al suelo.',speed:'12 m/s',angle:'45°',gravity:'—',height:'—',example:'💡 A 45° (sin rozamiento) se logra el mayor alcance posible.'}
  ];
  var MISSIONS = [
    {id:'proyectil',title:'Encuentra el objeto que sigue la parábola',hint:'Toca la esfera amarilla que se lanza.'},
    {id:'suelo',title:'Localiza qué atrae al proyectil hacia abajo',hint:'Toca el plano verde donde cae.'},
    {id:'canon',title:'Busca el lanzador',hint:'Toca el cañón que dispara a 45°.'},
    {id:'suelo',title:'Encuentra el plano del aterrizaje',hint:'Toca la superficie verde del piso.'},
    {id:'canon',title:'Localiza el ángulo de 45°',hint:'Toca el cañón inclinado.'},
    {id:'proyectil',title:'Busca el punto más alto del recorrido',hint:'Dispara y toca la esfera amarilla en su altura máxima.'}
  ];
  var QUESTIONS = [
    {q:'¿Qué forma tiene la trayectoria del proyectil?',options:['Línea recta','Parábola','Círculo','Onda'],answer:'Parábola'},
    {q:'¿Qué magnitud atrae el proyectil hacia el suelo?',options:['Velocidad','Gravedad','Fricción','Empuje'],answer:'Gravedad'},
    {q:'¿Cuánto vale la gravedad en la Tierra?',options:['9.8 m/s²','3.7 m/s²','1.6 m/s²','25 m/s²'],answer:'9.8 m/s²'},
    {q:'¿A qué ángulo (sin aire) se logra el mayor alcance?',options:['30°','45°','60°','90°'],answer:'45°'},
    {q:'En el punto más alto, ¿qué componente de la velocidad es cero?',options:['Horizontal','Vertical','Ambas','Ninguna'],answer:'Vertical'},
    {q:'¿Qué se mantiene constante en x si no hay rozamiento?',options:['La rapidez horizontal','La rapidez vertical','La altura','La gravedad'],answer:'La rapidez horizontal'}
  ];
  var state=loadState(),dom={},scene,camera,renderer,raycaster,pointer,animationId=0;
  var objects=[],labels=[],projMesh,trajectory,selected='proyectil',t=0,landed=false,landTimer=0,paused=false,autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,moved=false,startX=0,startY=0,pinch=0,orbitY=0,orbitX=.32,distance=11.5,target=new THREE.Vector3(0,2,0);

  function $(id){return document.getElementById(id);}
  function part(id){return PARTS.find(function(x){return x.id===id;})||PARTS[0];}
  function loadState(){try{var d=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return{mission:Math.min(Number(d.mission)||0,MISSIONS.length),quiz:Math.min(Number(d.quiz)||0,QUESTIONS.length),correct:Number(d.correct)||0,selected:d.selected||'proyectil'};}catch(_){return{mission:0,quiz:0,correct:0,selected:'proyectil'};}}
  function save(){state.selected=selected;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));updateProgress();}
  function updateProgress(){var done=state.mission+state.quiz,total=MISSIONS.length+QUESTIONS.length,pct=Math.round(done/total*100);dom.progressText.textContent=pct+'%';dom.progressBar.style.width=pct+'%';}
  function cache(){['progressText','progressBar','scene','labels','fallback','labelsToggle','launchButton','pauseButton','heightReadout','partButtons','bodyType','bodyName','bodyDescription','bodySpeed','bodyAngle','bodyGravity','bodyHeight','bodyExample','missionTitle','missionHint','missionStatus','question','answers','feedback','rotateButton','resetButton'].forEach(function(id){dom[id]=$(id);});}
  function mat(color){return new THREE.MeshStandardMaterial({color:color,roughness:.55,metalness:.05});}
  function addLabel(id,x,y,z){var el=document.createElement('span');el.className='label';el.textContent=part(id).icon+' '+part(id).name;dom.labels.appendChild(el);labels.push({id:id,el:el,anchor:new THREE.Vector3(x,y,z)});}
  function addMesh(geo,material,pos){var m=new THREE.Mesh(geo,material);m.position.set(pos[0],pos[1],pos[2]);return m;}
  function register(id,mesh){mesh.userData.partId=id;objects.push({id:id,mesh:mesh});}
  function posT(tt){return {x:X0+V0*Math.cos(ANG)*tt,y:Y0+V0*Math.sin(ANG)*tt-.5*G*tt*tt};}
  function buildScene(){
    var ground=new THREE.Mesh(new THREE.PlaneGeometry(26,12),mat(0x2e7d5b));ground.rotation.x=-Math.PI/2;register('suelo',ground);scene.add(ground);
    var grid=new THREE.GridHelper(24,12,0x4d8f6f,0x3c6f56);grid.position.y=.01;scene.add(grid);
    var canon=new THREE.Group();
    var base=addMesh(new THREE.BoxGeometry(1.3,.5,1.3),mat(0x795548),[X0,.25,0]);register('canon',base);canon.add(base);
    var barrel=addMesh(new THREE.CylinderGeometry(.18,.28,1.5,12),mat(0x5d4037),[X0,.55,0]);barrel.rotation.z=-ANG;register('canon',barrel);canon.add(barrel);
    scene.add(canon);
    projMesh=addMesh(new THREE.SphereGeometry(.28,20,16),mat(0xffd54f),[X0+.2,Y0,0]);register('proyectil',projMesh);scene.add(projMesh);
    var pts=[];for(var i=0;i<=80;i++){var p=posT(i/80*FLIGHT);pts.push(new THREE.Vector3(p.x,p.y,0));}
    trajectory=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x7ae0ff,transparent:true,opacity:.85}));scene.add(trajectory);
    addLabel('proyectil',X0+.2,Y0+.75,0);addLabel('canon',X0,1.3,0);addLabel('suelo',X0+9,.5,0);
  }
  function renderPartButtons(){dom.partButtons.innerHTML='';PARTS.forEach(function(item){var b=document.createElement('button');b.type='button';b.dataset.part=item.id;b.textContent=item.icon+' '+item.name;b.addEventListener('click',function(){selectPart(item.id,true);});dom.partButtons.appendChild(b);});}
  function selectPart(id,countMission){var item=part(id);selected=id;
    dom.bodyType.textContent=item.type;dom.bodyType.style.background=item.type==='Elemento'?'var(--blue)':'var(--gold)';
    dom.bodyName.textContent=item.name;dom.bodyDescription.textContent=item.description;
    dom.bodySpeed.textContent=item.speed;dom.bodyAngle.textContent=item.angle;dom.bodyGravity.textContent=item.gravity;dom.bodyHeight.textContent=item.height;dom.bodyExample.textContent=item.example;
    Array.prototype.forEach.call(dom.partButtons.children,function(b){b.classList.toggle('active',b.dataset.part===id);});
    objects.forEach(function(x){if(x.mesh.material&&x.mesh.material.emissive)x.mesh.material.emissive.setHex(x.id===id?0x222222:0);});
    if(countMission&&state.mission<MISSIONS.length&&MISSIONS[state.mission].id===id){state.mission++;dom.missionStatus.textContent='✓ ¡Misión cumplida!';dom.missionStatus.className='status success';save();setTimeout(renderMission,750);}
    save();
  }
  function renderMission(){if(state.mission>=MISSIONS.length){dom.missionTitle.textContent='¡Parábola dominada!';dom.missionHint.textContent='Entendiste la trayectoria, la gravedad y el lanzamiento.';dom.missionStatus.textContent='6 de 6 misiones';dom.missionStatus.className='status success';return;}var m=MISSIONS[state.mission];dom.missionTitle.textContent=m.title;dom.missionHint.textContent=m.hint;dom.missionStatus.textContent='Misión '+(state.mission+1)+' de '+MISSIONS.length;dom.missionStatus.className='status';}
  function renderQuestion(){dom.answers.innerHTML='';dom.feedback.textContent='';if(state.quiz>=QUESTIONS.length){dom.question.textContent='¡Reto completado!';dom.feedback.textContent='Resultado: '+state.correct+' de '+QUESTIONS.length+' respuestas correctas.';var reset=document.createElement('button');reset.type='button';reset.textContent='Repetir';reset.addEventListener('click',function(){state.quiz=0;state.correct=0;save();renderQuestion();});dom.answers.appendChild(reset);return;}var q=QUESTIONS[state.quiz];dom.question.textContent=q.q;q.options.forEach(function(option){var b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',function(){var right=option===q.answer;b.classList.add(right?'correct':'wrong');dom.feedback.textContent=right?'✓ ¡Correcto!':'Respuesta correcta: '+q.answer+'.';Array.prototype.forEach.call(dom.answers.children,function(x){x.disabled=true;});state.quiz++;if(right)state.correct++;save();setTimeout(renderQuestion,850);});dom.answers.appendChild(b);});}
  function initThree(){if(!window.THREE)throw new Error('Three.js no disponible');scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(50,1,.1,200);renderer=new THREE.WebGLRenderer({antialias:!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4),alpha:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0,0);dom.scene.insertBefore(renderer.domElement,dom.labels);renderer.domElement.setAttribute('aria-hidden','true');scene.add(new THREE.HemisphereLight(0xcfe8ff,0x161b2e,1.1));var light=new THREE.DirectionalLight(0xffffff,1.4);light.position.set(8,14,10);scene.add(light);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();buildScene();bindScene();resize();animate();}
  function bindScene(){var c=renderer.domElement;c.addEventListener('pointerdown',function(e){dragging=true;moved=false;startX=e.clientX;startY=e.clientY;c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dragging)return;var dx=e.clientX-startX,dy=e.clientY-startY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;orbitY+=dx*.007;orbitX=Math.max(.05,Math.min(1.2,orbitX+dy*.006));startX=e.clientX;startY=e.clientY;});c.addEventListener('pointerup',function(e){dragging=false;if(!moved)pick(e);});c.addEventListener('wheel',function(e){e.preventDefault();distance=Math.max(6,Math.min(20,distance+e.deltaY*.02));},{passive:false});c.addEventListener('touchstart',function(e){if(e.touches.length===2)pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:true});c.addEventListener('touchmove',function(e){if(e.touches.length===2){var n=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);distance=Math.max(6,Math.min(20,distance+(pinch-n)*.03));pinch=n;}},{passive:true});}
  function pick(e){var rect=renderer.domElement.getBoundingClientRect();pointer.x=(e.clientX-rect.left)/rect.width*2-1;pointer.y=-(e.clientY-rect.top)/rect.height*2+1;raycaster.setFromCamera(pointer,camera);var hit=raycaster.intersectObjects(objects.map(function(x){return x.mesh;}),false)[0];if(hit&&hit.object.userData.partId)selectPart(hit.object.userData.partId,true);}
  function updateLabels(){if(!camera)return;var show=dom.labelsToggle.checked;labels.forEach(function(x){var world=x.anchor.clone();world.project(camera);x.el.style.left=((world.x+1)/2*dom.scene.clientWidth)+'px';x.el.style.top=((-world.y+1)/2*dom.scene.clientHeight)+'px';x.el.style.opacity=show&&world.z<1?'1':'0';});}
  function resize(){if(!renderer)return;var w=dom.scene.clientWidth,h=dom.scene.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function animate(){animationId=requestAnimationFrame(animate);
    if(!paused){
      if(!landed&&t<FLIGHT){t+=.016;var p=posT(Math.min(t,FLIGHT));projMesh.position.set(p.x,p.y,0);if(t>=FLIGHT){landed=true;landTimer=0;dom.heightReadout.textContent='¡Aterrizó! Alcance: '+ALCANCE.toFixed(1)+' m';}}
      else if(landed){landTimer+=.016;if(landTimer>2.5){resetLaunch();}}
      if(!landed)dom.heightReadout.textContent='Altura: '+Math.max(0,posT(Math.min(t,FLIGHT)).y).toFixed(1)+' m';
    }
    labels[0].anchor.copy(projMesh.position).add(new THREE.Vector3(0,.75,0));
    if(autoRotate&&!dragging)orbitY+=.0022;
    camera.position.set(target.x+distance*Math.sin(orbitY)*Math.cos(orbitX),target.y+distance*Math.sin(orbitX),target.z+distance*Math.cos(orbitY)*Math.cos(orbitX));camera.lookAt(target);
    renderer.render(scene,camera);updateLabels();
  }
  function resetLaunch(){t=0;landed=false;projMesh.position.set(X0+.2,Y0,0);dom.heightReadout.textContent='Altura: 0.0 m';}
  function bind(){dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';dom.rotateButton.addEventListener('click',function(){autoRotate=!autoRotate;dom.rotateButton.textContent=autoRotate?'⏸ Detener giro':'▶ Girar';});dom.resetButton.addEventListener('click',function(){orbitX=.32;orbitY=0;distance=11.5;resetLaunch();});dom.launchButton.addEventListener('click',resetLaunch);dom.pauseButton.addEventListener('click',function(){paused=!paused;dom.pauseButton.textContent=paused?'▶ Continuar':'⏸ Pausa';});dom.labelsToggle.addEventListener('change',updateLabels);addEventListener('resize',resize);addEventListener('pagehide',function(){if(animationId)cancelAnimationFrame(animationId);});}
  function start(){cache();bind();renderMission();renderQuestion();updateProgress();try{initThree();}catch(error){dom.fallback.hidden=false;console.warn('EduConect 3D fallback:',error.message);}renderPartButtons();selectPart(state.selected,false);window.parabola3dReady=true;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
}());
