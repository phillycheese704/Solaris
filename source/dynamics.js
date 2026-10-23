
/* Three-dimensional tetrahedral fragments for shattered celestial bodies. */
const debrisVS=`#version 300 es
precision highp float;
in vec3 aPos,aShade;
uniform mat4 uView,uProj;
out vec3 vShade;
void main(){vShade=aShade;gl_Position=uProj*uView*vec4(aPos,1.);}`;
const debrisFS=`#version 300 es
precision highp float;
in vec3 vShade;out vec4 color;
void main(){color=vec4(vShade,1.);}`;
const debrisProgram=program(debrisVS,debrisFS),debrisBuffer=gl.createBuffer(),debrisVAO=gl.createVertexArray();
gl.bindVertexArray(debrisVAO);gl.bindBuffer(gl.ARRAY_BUFFER,debrisBuffer);
for(const [name,size,offset] of [['Pos',3,0],['Shade',3,12]]){const loc=gl.getAttribLocation(debrisProgram,'a'+name);if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,24,offset);}}
gl.bindVertexArray(null);
function renderDebris(cam){const now=performance.now(),verts=[];
 for(const p of planets){if(p.integrity>0||!p.fragments?.length)continue;
 const t=Math.max(0,Math.min(6,(now-p.destroyedAt)/1600));
 for(const f of p.fragments.slice(0,115)){
 const n=V.norm(f.d),base=V.add(p.pos,V.mul(n,p.r*(.6+t*f.s*.85)));
 const ref=Math.abs(n[1])>.85?[1,0,0]:[0,1,0],u=V.norm(V.cross(n,ref)),v=V.norm(V.cross(n,u));
 const r=p.r*(.02+f.r*.013)*(1+Math.min(.5,t*.08));
 const a=V.add(base,V.mul(n,r*1.8)),b=V.add(base,V.mul(u,r)),c=V.add(base,V.mul(v,r)),d=V.sub(base,V.mul(V.add(u,v),r*.8));
 const pts=[a,b,c,a,c,d,a,d,b,b,d,c];
 const tint=f.k>.55?[.75,.4,.2]:f.k>.2?[.45,.46,.52]:[.24,.26,.30];
 for(let i=0;i<12;i++){let shade=.65+(i%3)*.16;verts.push(...pts[i],...tint.map(z=>z*shade));}
 }
 }
 if(!verts.length)return;
 gl.useProgram(debrisProgram);common(debrisProgram,cam);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
 gl.bindVertexArray(debrisVAO);gl.bindBuffer(gl.ARRAY_BUFFER,debrisBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,verts.length/6);gl.bindVertexArray(null);
}

/* Solaris Dynamics — environmental response, orbit editing, free-flight, collisions and 3D debris.
   This is an interactive sandbox, not a calibrated climate / population / N-body forecast. */
'use strict';
const sandbox={free:false,move:false,drag:null,keys:new Set(),held:new Set(),events:[],population:8321000000,populationStart:8321000000,popFlux:0,collisionCount:0,autoTick:0,justDestroyed:new Set(),sunMass:1,flightSpeed:20,lastEnvUpdate:0};
const climateDefaults={sun:[5500,0,0,1,0],mercury:[167,0,0,7,0],venus:[464,92,0,2,0],earth:[15,1,71,1,0],mars:[-63,.006,0,3,0],jupiter:[-110,100,0,4,0],saturn:[-140,100,0,3,0],uranus:[-195,100,0,2,0],neptune:[-200,100,0,3,0],moon:[-20,0,0,5,0]};
for(const p of planets){const d=climateDefaults[p.id];p.env={temp:d[0],atm:d[1],water:d[2],radiation:d[3],gravity:1,baseline:d[0],manualTemp:d[0],eventDamage:0};p.surfaceGravity=(p.mass/planets.find(e=>e.id==='earth').mass)*Math.pow(6371/p.radius,2);p.collisionCount=0;p.lastDisaster='None';}
const $sb=id=>document.getElementById(id);
function logSandbox(text){sandbox.events.unshift({time:formatDate(state.date),text});sandbox.events.length=Math.min(7,sandbox.events.length);const e=$sb('sandboxEvents');if(e)e.innerHTML=sandbox.events.map(v=>`<div><span>${v.time}</span> ${escapeText(v.text)}</div>`).join('');}
function escapeText(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function healthOf(p){if(p.integrity<=0)return 0;let e=p.env;const t=Math.exp(-Math.pow((e.temp-e.baseline)/Math.max(45,Math.abs(e.baseline)*.55),2));let a=e.atm,ref=climateDefaults[p.id][1];let pressure=ref===0?Math.exp(-a/6):Math.exp(-Math.abs(Math.log((a+.1)/(ref+.1)))*.65);let rad=Math.exp(-Math.max(0,e.radiation-4)*.15);return Math.min(100,Math.max(0,100*t*pressure*rad*(p.integrity/100)));}
function habitability(){const p=planets.find(p=>p.id==='earth'),e=p.env;if(p.integrity<=0||planets[0].integrity<=0)return 0;const t=Math.exp(-Math.pow((e.temp-16)/31,2));const atm=Math.exp(-Math.pow(Math.log(Math.max(.02,e.atm))/1.3,2));const water=Math.pow(Math.min(1,e.water/65),.5)*Math.exp(-Math.pow(Math.max(0,e.water-92)/18,2));const gravity=Math.exp(-Math.pow(Math.log(Math.max(.01,e.gravity))/.92,2));const radiation=Math.exp(-Math.max(0,e.radiation-1)*.28);return Math.max(0,Math.min(1,t*atm*water*gravity*radiation*Math.pow(p.integrity/100,2)));}
function worldToAU(v){let r=V.len(v);if(!r)return [0,0,0];let a=state.physicalScale?r/PHYS_FACTOR:Math.pow(Math.max(0,(r-4.7)/12.3),1/.57);return V.mul(v,a/r);}
function activateDynamics(){if(!state.gravity){initGravity();state.gravity=true;showToast('Orbital dynamics enabled · collisions active');}if(!state.sim)initGravity();}
function setWorldPosition(p,coords,retainVelocity=true){if(!p.orb){showToast('The Sun is the fixed reference point');return;}activateDynamics();const b=state.sim.bodies[p.id];if(!b)return;b.x=coords.slice();if(!retainVelocity)b.v=[0,0,0];p.physical=coords.slice();p.pos=posWorld(coords);updatePhysical();}
function shiftWorld(p,x,y,z){setWorldPosition(p,[x,y,z]);rebuildPaths();logSandbox(`${p.name} moved to (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) AU`);}
function gravityValue(p){return p.surfaceGravity*p.env.gravity;}
function destroyWorld(p,reason='Catastrophic disruption'){
 if(p.integrity<=0)return;
 const sc=worldScreen(p.pos,cameraData());p.integrity=0;p.hits=[];p.lastDisaster=reason;
 shatterWorld(p,sc?.x??canvas.clientWidth*.5,sc?.y??canvas.clientHeight*.5);sandbox.justDestroyed.add(p.id);
 if(p.id==='sun'){sandbox.sunMass=0;sandbox.population=0;for(const other of planets){if(other!==p&&other.integrity>0)other.env.temp=-240;}activateDynamics();logSandbox('Solar destruction: planetary bodies lose their central gravitational anchor, freeze, and Earth becomes uninhabitable');}
 else if(p.id==='earth'){sandbox.population=0;logSandbox('Earth destroyed: modeled human population has collapsed to zero');}
 else if(p.id==='moon'){sandbox.population*=.95;logSandbox('Moon disrupted: Earth loses its lunar companion; tidal stability declines in this simplified model');}
 else if(p.id==='jupiter'){logSandbox('Jupiter destroyed: gravitational perturbations from Jupiter cease in dynamics mode');}
 else if(p.id==='saturn'){logSandbox('Saturn disrupted: ring system disappears with the planet');}
 else logSandbox(`${p.name} destroyed: its gravitational contribution is removed from orbital dynamics`);
 if(p.orb){activateDynamics();}updateSmashDock();renderSandboxReadout();updateSidebar();
}
function repairPlanet(p){restoreSmashWorld(p,true);p.env={temp:climateDefaults[p.id][0],atm:climateDefaults[p.id][1],water:climateDefaults[p.id][2],radiation:climateDefaults[p.id][3],gravity:1,baseline:climateDefaults[p.id][0],eventDamage:0};p.opts.mass=1;p.lastDisaster='None';if(p.id==='sun'){sandbox.sunMass=1;for(const other of planets){if(other!==p&&other.integrity>0)other.env.temp=other.env.manualTemp;}}if(p.id==='earth')sandbox.population=sandbox.populationStart; if(state.gravity)initGravity();updatePhysical();updateSidebar();updateInspector();logSandbox(`${p.name} reconstructed`);showToast(p.name+' rebuilt');}
function collision(a,b){if(a.integrity<=0||b.integrity<=0)return;
 const mass=p=>(p.id==='sun'?1:p.mass*p.opts.mass)*(p.integrity>0?1:0);
 const big=mass(a)>=mass(b)?a:b,small=big===a?b:a,mi=mass(small),ma=mass(big);
 const vb=state.sim?.bodies[big.id],vs=state.sim?.bodies[small.id];
 if(vb&&vs&&mi+ma>0){vb.v=V.mul(V.add(V.mul(vb.v,ma),V.mul(vs.v,mi)),1/(mi+ma));vb.x=V.mul(V.add(V.mul(vb.x,ma),V.mul(vs.x,mi)),1/(mi+ma));}
 if(big.id==='sun'){sandbox.sunMass=Math.min(2,sandbox.sunMass+mi);}
 else {big.opts.mass=Math.min(100,(ma+mi)/big.mass);}
 const severity=Math.min(95,7+65*Math.sqrt(mi/Math.max(ma,1e-8)));
 big.integrity=Math.max(1,big.integrity-severity);big.hits.push({n:[0,1,0],radius:.9,power:4,type:3});if(big.hits.length>20)big.hits.shift();
 if(big.id==='earth'){sandbox.population*=Math.max(.02,1-severity/110);big.env.temp+=Math.min(400,20+severity*3);}
 small.integrity=0;destroyWorldWithAlreadyZero(small,`Collision with ${big.name}`);
 sandbox.collisionCount++;logSandbox(`${a.name} + ${b.name} collided · ${big.name} absorbed mass and suffered ${Math.round(severity)}% damage`);
 const sc=worldScreen(big.pos,cameraData());burst(sc?.x??canvas.clientWidth*.5,sc?.y??canvas.clientHeight*.5,'#ffb270',3.7);
 updateSidebar();renderSandboxReadout();
}
function destroyWorldWithAlreadyZero(p,reason){p.integrity=1;destroyWorld(p,reason)}
function checkCollisions(){if(!state.gravity||!state.sim)return;const active=planets.filter(p=>p.integrity>0&&p.id!=='moon');
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j],sep=V.len(V.sub(a.physical,b.physical));
  const contact=(a.radius+b.radius)/AU_KM*Math.max(1,a.opts.size,b.opts.size);
  const pa=sandbox.prevPositions?.[a.id],pb=sandbox.prevPositions?.[b.id];
  let swept=sep;if(pa&&pb){const start=V.sub(pa,pb),finish=V.sub(a.physical,b.physical),motion=V.sub(finish,start),den=V.dot(motion,motion);
   if(den>1e-15){const t=Math.max(0,Math.min(1,-V.dot(start,motion)/den));swept=Math.min(swept,V.len(V.add(start,V.mul(motion,t))));}}
  if(swept<=contact){collision(a,b);sandbox.prevPositions=null;return;}
 }
 sandbox.prevPositions=Object.fromEntries(active.map(p=>[p.id,p.physical.slice()]));
}
function collideWith(p,q){if(!p.orb||p===q||p.integrity<=0||q.integrity<=0){showToast('Choose an intact moving planet and another intact target');return;}
 activateDynamics();const dir=V.norm(V.sub(p.physical,q.physical));const n=V.len(dir)>.2?dir:[1,0,0];const contact=(p.radius+q.radius)/AU_KM;
 setWorldPosition(p,V.add(q.physical,V.mul(n,contact*.72)),false);
 updatePhysical();checkCollisions();if(state.selected===p.id)updateInspector();}
function tempChange(p,v){if(p.integrity<=0)return;const prev=p.env.temp;p.env.temp=v;p.env.manualTemp=v;
 if(Math.abs(v-prev)>30){const typ=v>prev?1:2;const norm=V.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]);p.hits.push({n:norm,radius:.25+Math.min(.8,Math.abs(v-prev)/800),power:Math.min(4,Math.abs(v-prev)/140),type:typ});if(p.hits.length>20)p.hits.shift();}
 if(p.id==='earth'&&(v>120||v< -75)){p.lastDisaster='Extreme planetary climate';}
}
function orbitalClimate(){
 if(planets[0].integrity<=0)return;
 for(const p of planets){if(!p.orb||p.integrity<=0)continue;
  const dist=Math.max(.05,V.len(p.physical)),reference=p.orb[0][0],refTemp=p.env.manualTemp??p.env.baseline;
  // Approximate inverse-square stellar irradiation and fourth-root equilibrium heating: T ∝ r^-1/2.
  const solarHeat=Math.max(.1,(planets[0].env.temp+273.15)/(planets[0].env.baseline+273.15));
  const orbitalDelta=(p.env.baseline+273.15)*(Math.sqrt(reference/dist)*solarHeat-1);
  p.env.temp=Math.max(-250,Math.min(2500,refTemp+orbitalDelta));
 }
}
function timeStepEnvironment(days){if(!Number.isFinite(days)||days<=0)return;
 const earth=planets.find(p=>p.id==='earth');let hab=habitability();
 // Model population in accelerated simulation time. It is NOT a real-time census or population forecast.
 const yr=Math.min(days/365.25,12);if(earth.integrity<=0||planets[0].integrity<=0)sandbox.population=0;
 else if(sandbox.population>0){
  const growth=hab*.009 - (1-hab)*.30;
  sandbox.population=Math.min(1.7e10,Math.max(0,sandbox.population*Math.exp(Math.max(-45,Math.min(.15,growth*yr)))));
  if(sandbox.population<1)sandbox.population=0;
 }
 for(const p of planets){if(p.integrity<=0||p.id==='sun')continue;let e=p.env,stress=Math.max(0,Math.abs(e.temp-e.baseline)-130)/1600+Math.max(0,e.radiation-12)/30+Math.max(0,e.atm-100)/900;
  if(e.temp>1800||e.gravity>15||e.atm>240)stress+=.4;
  if(stress>0){p.integrity=Math.max(0,p.integrity-stress*days*.02);if(p.integrity===0){p.integrity=1;destroyWorld(p,'Environmental structural collapse');}}
 }
}
function renderEnvironmentStats(){const p=planets.find(q=>q.id===state.selected);if(!p)return;
 const container=$sb('planetPulse');if(!container)return;
 const c=p.env,earth=p.id==='earth';
 container.innerHTML=`<div class="pulse-top"><span>${earth?'HUMAN POPULATION · SIMULATED':'PLANETARY CONDITIONS · SIMULATED'}</span><b>${p.integrity>0?Math.round(p.integrity)+'% integrity':'DESTROYED'}</b></div><div class="pulse-number">${earth?Math.floor(sandbox.population).toLocaleString('en-GB'):Math.round(c.temp).toLocaleString('en-GB')+' °C'}</div><div class="pulse-sub">${earth?'Model changes as simulated time runs · not live census data':'Environment stability '+Math.round(healthOf(p))+'% · gravity '+gravityValue(p).toFixed(2)+' g'}</div><div class="pulse-track"><span style="width:${earth?habitability()*100:healthOf(p)}%"></span></div>${earth?'<div class="pulse-foot">Habitability '+Math.round(habitability()*100)+'% · '+(habitability()>.65?'sustainable':habitability()>.2?'population declining':'mass extinction risk')+'</div>':''}`;
}
function renderSandboxReadout(){renderEnvironmentStats();const c=$sb('physicsBadge');if(c)c.textContent=`${state.gravity?'● DYNAMICS + COLLISIONS':'◌ KEPLER ORBITS'} · ${sandbox.collisionCount} COLLISIONS`;
 if($sb('freeCamBtn')){$sb('freeCamBtn').classList.toggle('active',sandbox.free);$sb('freeCamBtn').textContent=sandbox.free?'✦ Free Cam ON':'✦ Free Cam'}
 if($sb('movePlanetBtn'))$sb('movePlanetBtn').classList.toggle('active',sandbox.move);
}
function sandboxFrame(now,delta,days){
 if(sandbox.free){let c=cameraData(),f=V.norm([c.fw[0],c.fw[1],c.fw[2]]),right=c.right,up=[0,1,0],direction=[0,0,0],has=k=>sandbox.keys.has(k)||sandbox.held.has(k);
  if(has('w')||has('arrowup'))direction=V.add(direction,f);
  if(has('s')||has('arrowdown'))direction=V.sub(direction,f);
  if(has('d')||has('arrowright'))direction=V.add(direction,right);
  if(has('a')||has('arrowleft'))direction=V.sub(direction,right);
  if(has('e'))direction=V.add(direction,up);if(has('q'))direction=V.sub(direction,up);
  const multiplier=has('shift')?5:1;
  if(V.len(direction)>.01){let vel=delta*sandbox.flightSpeed*multiplier*Math.max(.08,Math.min(5,state.camera.dist/25));state.camera.wanted=V.add(state.camera.wanted,V.mul(V.norm(direction),vel));}
 }
 orbitalClimate();timeStepEnvironment(days);
 for(const p of planets){if(p.integrity<=0&&!sandbox.justDestroyed.has(p.id)){
   p.integrity=1;destroyWorld(p,'Impact-driven planetary disruption');
 }}
 if(state.gravity){checkCollisions();}
 if(state.frame%13===0){renderSandboxReadout();if($sb('positionEditor')&&document.activeElement?.closest('#positionEditor')==null){const p=planets.find(p=>p.id===state.selected);const coords=p.physical;for(let i=0;i<3;i++){const el=$sb(['positionX','positionY','positionZ'][i]);if(el)el.value=coords[i].toFixed(3);}}}
}
function flyCamera(on){sandbox.free=on; sandbox.move=false;state.follow=!on;
 if(on){const cam=cameraData();const dist=18;state.camera.dist=dist;state.camera.wanted=V.add(cam.pos,V.mul(cam.fw,dist));state.camera.target=state.camera.wanted.slice();state.focus='free';$sb('viewTitle').textContent='Free-flight camera';showToast('WASD fly · Q/E vertical · Shift boost · drag to look');}
 else{overview();showToast('Orbit camera restored');}
 renderSandboxReadout();}
function toggleMove(){const p=planets.find(q=>q.id===state.selected);if(!p.orb){showToast('Select a planet to move');return;}sandbox.move=!sandbox.move;if(sandbox.move){flyCamera(false);sandbox.move=true;activateDynamics();showToast('MOVE MODE: drag across space to move '+p.name+' · select Collide to merge worlds');}renderSandboxReadout();}
function pointerRay(x,y){let cam=cameraData(),nx=x/canvas.clientWidth*2-1,ny=1-y/canvas.clientHeight*2,tan=Math.tan(24*d2r);return {cam,d:V.norm(V.add(cam.fw,V.add(V.mul(cam.right,nx*tan*canvas.clientWidth/canvas.clientHeight),V.mul(cam.up,ny*tan))))};}
function dragPlanetAt(x,y){let p=sandbox.drag?.p;if(!p||p.integrity<=0)return;let {cam,d}=pointerRay(x,y);let denom=V.dot(d,cam.fw);if(denom<.001)return;let t=V.dot(V.sub(sandbox.drag.anchor,cam.pos),cam.fw)/denom;if(t<0)return;let world=V.add(V.add(cam.pos,V.mul(d,t)),sandbox.drag.offset);let physical=worldToAU(world);if(!physical.every(Number.isFinite))return;setWorldPosition(p,physical);renderSandboxReadout();}
function sandboxPointer(e,phase){if(!sandbox.move)return;if(phase==='down'){
 const cam=cameraData(),hit=smashPick(e.clientX,e.clientY,cam),p=planets.find(q=>q.id===state.selected);if(!p?.orb||p.integrity<=0)return;
 // Selecting a target via planet list avoids ambiguity when worlds overlap.
 let origin=hit?.p===p?p.pos.slice():p.pos.slice();let ray=pointerRay(e.clientX,e.clientY),denom=V.dot(ray.d,ray.cam.fw),t=V.dot(V.sub(origin,ray.cam.pos),ray.cam.fw)/denom;let cursor=t>0?V.add(ray.cam.pos,V.mul(ray.d,t)):origin;
 sandbox.drag={id:e.pointerId,p,anchor:origin,offset:V.sub(origin,cursor),wasPaused:state.paused};state.paused=true;
 try{canvas.setPointerCapture(e.pointerId)}catch(_e){} e.preventDefault();e.stopImmediatePropagation();}
 else if(sandbox.drag&&sandbox.drag.id===e.pointerId){if(phase==='move')dragPlanetAt(e.clientX,e.clientY);
 else{dragPlanetAt(e.clientX,e.clientY);state.paused=sandbox.drag.wasPaused;sandbox.drag=null;checkCollisions();logSandbox('Orbital placement updated · '+planets.find(q=>q.id===state.selected).name);}
 e.preventDefault();e.stopImmediatePropagation();}}
for(const phase of ['pointerdown','pointermove','pointerup','pointercancel'])canvas.addEventListener(phase,e=>sandboxPointer(e,phase.replace('pointer','').replace('cancel','up')),{capture:true,passive:false});
function sandboxEnvironmentUI(p){const e=p.env,earth=p.id==='earth';const set=(id,label,min,max,step,v,unit)=>`<div class="setting"><div class="setting-title"><label for="${id}">${label}</label><span class="setting-value" id="v_${id}">${Number(v).toFixed(step<1?2:0)}${unit}</span></div><input type="range" class="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"/></div>`;
 let h=`<div class="field-caption">Live-response sandbox controls. Temperature, atmospheric pressure, radiation and gravity influence planetary stability; Earth population responds as simulation time runs.</div>`;
 h+=`<div class="fieldset"><div class="field-title">${p.id==='sun'?'STELLAR ACTIVITY':'WORLD ENVIRONMENT'}</div>`;
 h+=set('envTemp',p.id==='sun'?'Photosphere temperature':'Average temperature',p.id==='sun'?2000:-245,p.id==='sun'?12500:2200,1,e.temp,'°C');
 if(p.id!=='sun'){h+=set('envAtm','Atmosphere / pressure',0,260,.05,e.atm,' bar');h+=set('envWater','Surface water coverage',0,100,1,e.water,'%');h+=set('envRadiation','Radiation multiplier',0,30,.1,e.radiation,'×');}h+=set('envGravity',p.id==='sun'?'Stellar mass / gravity':'Mass / gravity multiplier',.01,20,.01,e.gravity,'×');
 h+='</div>';
 h+=`<div class="sandbox-readout"><b>${earth?'Earth habitability':'Environment stability'}</b><strong id="envScore">${Math.round((earth?habitability()*100:healthOf(p)))}%</strong><div class="tip">${earth?'Earth’s population is a responsive simulation, not a live world census or scientific forecast.':'Extreme settings can scar a planet and gradually reduce its integrity as time advances.'}</div></div>`;
 h+=`<div class="control-row"><button class="action" id="resetClimate">Reset environment</button><button class="action secondary" id="envPause">${state.paused?'Resume':'Pause'} time</button></div>`;
 $sb('settings').innerHTML=h;
 for(const [id,k,unit] of [['envTemp','temp','°C'],['envAtm','atm',' bar'],['envWater','water','%'],['envRadiation','radiation','×'],['envGravity','gravity','×']]){let el=$sb(id);if(!el)continue;el.addEventListener('input',()=>{const v=+el.value;if(k==='temp')tempChange(p,v);else p.env[k]=v;
 if(k==='gravity'){p.opts.mass=v; if(p.id==='sun')sandbox.sunMass=v;activateDynamics();}
 $sb('v_'+id).textContent=v.toFixed(+el.step<1?2:0)+unit;
 $sb('envScore').textContent=Math.round(p.id==='earth'?habitability()*100:healthOf(p))+'%';renderSandboxReadout();});}
 $sb('resetClimate').onclick=()=>{const d=climateDefaults[p.id];p.env={temp:d[0],atm:d[1],water:d[2],radiation:d[3],gravity:1,baseline:d[0],manualTemp:d[0],eventDamage:0};p.opts.mass=1;if(p.id==='sun')sandbox.sunMass=1;renderSettings();renderSandboxReadout();};
 $sb('envPause').onclick=()=>{togglePlay();$sb('envPause').textContent=state.paused?'Resume':'Pause';};
}
function sandboxActionsUI(p){let h=`<div class="field-caption">Alter ${p.name}'s orbit, move it through space, trigger physical collisions, or destroy it. Changes persist until you rebuild.</div>`;
 h+=`<div class="fieldset"><div class="field-title">ORBIT & POSITION</div>`;
 h+=`<div class="sandbox-coordinates" id="positionEditor"><label>X (AU)<input type="number" id="positionX" step=".01" value="${p.physical[0].toFixed(3)}" ${!p.orb?'disabled':''}></label><label>Y (AU)<input type="number" id="positionY" step=".01" value="${p.physical[1].toFixed(3)}" ${!p.orb?'disabled':''}></label><label>Z (AU)<input type="number" id="positionZ" step=".01" value="${p.physical[2].toFixed(3)}" ${!p.orb?'disabled':''}></label></div>`;
 h+=`<div class="control-row"><button class="action" id="applyPosition" ${!p.orb?'disabled':''}>Set position</button><button class="action secondary" id="movePlanetBtn" ${!p.orb?'disabled':''}>✥ Drag to move</button></div>`;
 h+=`<div class="setting"><div class="setting-title"><label for="orbitVelocity">Orbital velocity</label><span class="setting-value" id="v_orbitVelocity">${p.opts.speed||1}×</span></div><input type="range" class="range" id="orbitVelocity" min="0" max="3" step=".05" value="${p.opts.speed||1}" ${!p.orb?'disabled':''}></div>`;
 h+=`<div class="field-title">COLLIDE WITH ANOTHER WORLD</div><div class="control-row"><select id="collisionTarget" class="sb-select">${planets.filter(q=>q!==p&&q.integrity>0).map(q=>`<option value="${q.id}">${q.name}</option>`).join('')}</select><button class="action danger" id="collisionBtn" ${!p.orb||p.integrity<=0?'disabled':''}>Collide</button></div><div class="tip">Colliding worlds merge mass and momentum. The smaller world shatters; the survivor suffers damage. Changes persist in N-body dynamics mode.</div></div>`;
 h+=`<div class="fieldset"><div class="field-title">SURFACE & DESTRUCTION</div><div class="action-grid"><button class="action" data-sandboxweapon="asteroid">☄ Asteroid</button><button class="action" data-sandboxweapon="laser">⚡ Laser</button><button class="action" data-sandboxweapon="nuke">💥 Nuclear blast</button><button class="action" data-sandboxweapon="freeze">❄ Freeze</button><button class="action" data-sandboxweapon="worldbreaker">🌋 Worldbreaker</button><button class="action danger" id="destroyPlanet">✹ SHATTER ${p.name.toUpperCase()}</button></div><div class="control-row"><button class="action secondary" id="restoreSelected">↺ Rebuild ${p.name}</button></div><div class="tip">Surface impacts create 3D craters, damage and erupting debris. Destruction removes the world's gravity contribution and can disrupt Earth's population.</div></div>`;
 h+=`<div class="fieldset"><div class="field-title">EVENT HISTORY</div><div id="sandboxEvents" class="sandbox-events">${sandbox.events.map(v=>`<div><span>${v.time}</span> ${escapeText(v.text)}</div>`).join('')}</div></div>`;
 $sb('settings').innerHTML=h;
 if(p.orb){$sb('applyPosition').onclick=()=>{let xyz=['positionX','positionY','positionZ'].map(id=>+$sb(id).value);if(xyz.every(Number.isFinite)){shiftWorld(p,...xyz);renderSandboxReadout();}else showToast('Enter valid coordinates');};
 $sb('movePlanetBtn').onclick=toggleMove;
 $sb('orbitVelocity').oninput=e=>{let v=+e.target.value;p.opts.speed=v;activateDynamics();state.sim.bodies[p.id].v=V.mul(V.norm(state.sim.bodies[p.id].v),V.len(state.sim.bodies[p.id].v)*v/Math.max(.001,p._priorVelocityScale??1));p._priorVelocityScale=v;$sb('v_orbitVelocity').textContent=v.toFixed(2)+'×';};
 $sb('collisionBtn').onclick=()=>{const q=planets.find(q=>q.id===$sb('collisionTarget').value);if(q)collideWith(p,q);renderSettings();};}
 $sb('settings').querySelectorAll('[data-sandboxweapon]').forEach(btn=>btn.onclick=()=>{if(p.integrity<=0){showToast('Rebuild the world first');return;}smash.weapon=btn.dataset.sandboxweapon;let normal=V.norm(V.sub(cameraData().pos,p.pos));let sc=worldScreen(p.pos,cameraData());fireSmash(p,normal,p.pos,sc?.x??innerWidth/2,sc?.y??innerHeight/2);logSandbox(`${p.name}: ${smash.weapon} launched`);});
 $sb('destroyPlanet').onclick=()=>{destroyWorld(p,'Deliberate planetary shattering');renderSettings();};
 $sb('restoreSelected').onclick=()=>repairPlanet(p);
 renderSandboxReadout();
}
const originalRenderSettings=renderSettings;
renderSettings=function(){if(state.tab==='environment'||state.tab==='actions'){
 const p=planets.find(p=>p.id===state.selected);for(const el of document.querySelectorAll('.tab'))el.classList.toggle('active',el.dataset.tab===state.tab);
 if(state.tab==='environment')sandboxEnvironmentUI(p);else sandboxActionsUI(p);renderSandboxReadout();return;}
 originalRenderSettings();};
const originalInspector=updateInspector;
updateInspector=function(){originalInspector();renderSandboxReadout();};
const originalLimited=updateInspectorLimited;
updateInspectorLimited=function(){originalLimited();renderSandboxReadout();};
const originalSelect=selectBody;
selectBody=function(id,focus=true){if(sandbox.free){sandbox.free=false;state.follow=true;}sandbox.move=false;originalSelect(id,focus);renderSandboxReadout();};
const originalOverview=overview;
overview=function(){sandbox.free=false;sandbox.move=false;state.follow=true;originalOverview();renderSandboxReadout();};
function initDynamicsUI(){
 // Legacy weapons lab remains available internally to generate impact effects but never appears as a panel.
 setSmashMode(false);
 $sb('smashBtn').style.display='none';$sb('smashDock').style.display='none';$sb('weaponPeek').style.display='none';
 document.querySelector('.brand-sub').textContent='3D PLANETARY PHYSICS SANDBOX';
 const tabs=$sb('tabs');tabs.insertAdjacentHTML('beforeend','<button class="tab" data-tab="environment">Environment</button><button class="tab" data-tab="actions">Actions</button>');
 $sb('statGrid').insertAdjacentHTML('beforebegin','<div id="planetPulse" class="planet-pulse" aria-live="off"></div>');
 const controls=document.querySelector('.top-controls');const free=document.createElement('button');free.className='pill freecam-pill';free.id='freeCamBtn';free.type='button';free.textContent='✦ Free Cam';controls.insertBefore(free,$sb('homeBtn'));free.onclick=()=>flyCamera(!sandbox.free);
 const read=document.createElement('div');read.className='physics-badge';read.id='physicsBadge';read.textContent='◌ KEPLER ORBITS';document.querySelector('.hud-center').appendChild(read);
 const pad=document.createElement('div');pad.id='freeCamPad';pad.className='flight-pad';pad.innerHTML='<div class="flight-label">FREE CAM · MOVE</div><div class="flight-controls"><button data-fly="q">↓</button><button data-fly="w">↑</button><button data-fly="e">↑ Z</button><button data-fly="a">←</button><button data-fly="s">↓</button><button data-fly="d">→</button></div>';document.body.appendChild(pad);
 for(const b of pad.querySelectorAll('button')){const key=b.dataset.fly;b.addEventListener('pointerdown',e=>{sandbox.held.add(key);b.setPointerCapture(e.pointerId);e.preventDefault();});for(const phase of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(phase,()=>sandbox.held.delete(key));}
 document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){sandbox.keys.add(key);if(sandbox.free)e.preventDefault();}if(key==='f'&&!e.repeat){flyCamera(!sandbox.free);e.preventDefault();}});
 document.addEventListener('keyup',e=>sandbox.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{sandbox.keys.clear();sandbox.held.clear();});
 const oldDoc=document.querySelector('.citation');oldDoc.innerHTML='<strong>PHYSICS & DATA</strong><br/>JPL approximate orbital elements, experimental point-mass N-body motion and simplified collision merging. Environmental responses, planetary damage and Earth population are artistic sandbox models, not climate science, live census data or verified future predictions. <a target="_blank" rel="noopener noreferrer" href="https://ssd.jpl.nasa.gov/planets/approx_pos.html">Orbital reference ↗</a>';
 document.querySelector('.hint').innerHTML='<b>Drag</b> to orbit · <b>F</b> free camera · <b>Tap</b> planet to customize · <b>Actions</b> to collide';
 const manual=$sb('help');manual.querySelector('ul').insertAdjacentHTML('afterbegin','<li><b>Solaris Dynamics:</b> select a planet and open Environment to control temperature, atmosphere, radiation, water and gravity; open Actions for position, orbit velocity, collisions and destruction. Earth has a <b>simulated</b> population that reacts over simulated time (not a real-time census).</li><li><b>Free Cam:</b> press F or ✦ Free Cam. Fly with W/A/S/D, move vertically Q/E, hold Shift to boost; drag to look. Use the on-screen flight buttons on touchscreens.</li>');
 for(const el of manual.querySelectorAll('li'))if(el.textContent.includes('SMASH MODE'))el.remove();
 document.querySelector('.sidebar-bottom .tip').innerHTML='10 celestial bodies · responsive environmental simulation<br/>Newtonian collision dynamics when physics is enabled';
 renderSandboxReadout();logSandbox('Solaris Dynamics initialized');
}
initDynamicsUI();

