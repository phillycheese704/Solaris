/* Solaris touch and responsive panels. Runs after the core renderer. */
function initMobileUI(){
 const sidebar=$('sidebar'),inspector=document.querySelector('.inspector'),backdrop=$('panelBackdrop');
 const menu=$('menuBtn'),settingsBtn=$('settingsBtn'),handle=$('inspectorHandle'),peek=$('weaponPeek');
 const handleLabel=$('handleLabel');new MutationObserver(()=>handleLabel.textContent=$('inspName').textContent.toUpperCase()+' · SETTINGS').observe($('inspName'),{childList:true,characterData:true,subtree:true});
 const small=()=>window.matchMedia('(max-width:900px)').matches;
 const adaptive=()=>window.matchMedia('(max-width:1180px)').matches;
 function syncPanels(){
  const menuOpen=sidebar.classList.contains('open'),settingsOpen=inspector.classList.contains('open');
  document.body.classList.toggle('settings-open',settingsOpen);
  backdrop.classList.toggle('open',adaptive()&&(menuOpen||(!small()&&settingsOpen)));
  menu.setAttribute('aria-expanded',String(menuOpen));settingsBtn.setAttribute('aria-expanded',String(settingsOpen));
  handle.setAttribute('aria-expanded',String(settingsOpen));handle.querySelector('.handle-chevron').textContent=settingsOpen?'⌄':'⌃';
  if(settingsOpen&&smash.enabled){document.body.classList.add('smash-minimized');}
 }
 function closeMenu(){sidebar.classList.remove('open');syncPanels()}
 function closeSettings(){inspector.classList.remove('open');syncPanels()}
 function openSettings(){closeMenu();inspector.classList.add('open');syncPanels()}
 menu.setAttribute('aria-label','Choose a planet');menu.setAttribute('aria-controls','sidebar');
 settingsBtn.setAttribute('aria-controls','planetInspector');settingsBtn.setAttribute('aria-label','Open planet settings');
 handle.setAttribute('aria-controls','settings');
 menu.addEventListener('click',()=>{if(sidebar.classList.contains('open'))closeSettings();syncPanels()});
 settingsBtn.addEventListener('click',()=>{inspector.classList.contains('open')?closeSettings():openSettings()});
 handle.addEventListener('click',()=>{inspector.classList.contains('open')?closeSettings():openSettings()});
 backdrop.addEventListener('click',()=>{closeMenu();closeSettings()});
 $('bodyList').addEventListener('click',e=>{if(e.target.closest('[data-id]')){closeMenu();if(small())openSettings()}});
 $('homeBtn').addEventListener('click',()=>{closeMenu();closeSettings()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeSettings()}});
 $('smashBtn').addEventListener('click',()=>{closeMenu();closeSettings();document.body.classList.remove('smash-minimized');updatePeek()});
 $('smashClose').addEventListener('click',()=>{document.body.classList.remove('smash-minimized');updatePeek()});
 const aimButton=document.createElement('button');aimButton.type='button';aimButton.className='smash-aim-btn';aimButton.textContent='🎯 Aim at the planet';
 $('smashDock').appendChild(aimButton);
 aimButton.addEventListener('click',()=>{document.body.classList.add('smash-minimized');updatePeek()});
 function updatePeek(){const weapon=SMASH_WEAPONS.find(w=>w.id===smash.weapon);peek.textContent='☄ Weapons · '+(weapon?weapon.label:'Tools');peek.setAttribute('aria-label','Open weapons and impact controls')}
 peek.addEventListener('click',()=>{closeSettings();document.body.classList.remove('smash-minimized');updatePeek()});
 $('weaponGrid').addEventListener('click',e=>{if(e.target.closest('[data-weapon]')&&small()){
  document.body.classList.add('smash-minimized');updatePeek();showToast('Tap a planet to fire · Weapons to change tool');
 }});
 updatePeek();
 // Swipe the planet settings handle up/down, without interfering with range sliders or scrolling.
 let handleY=null;
 handle.addEventListener('touchstart',e=>{if(e.touches.length===1)handleY=e.touches[0].clientY},{passive:true});
 handle.addEventListener('touchend',e=>{if(handleY===null||!e.changedTouches.length)return;const dy=e.changedTouches[0].clientY-handleY;handleY=null;if(Math.abs(dy)<45)return;e.preventDefault();if(dy<0)openSettings();else closeSettings();},{passive:false});
 window.addEventListener('resize',()=>{if(!adaptive()){closeMenu();closeSettings()}else syncPanels()},{passive:true});
 document.querySelector('.hint').innerHTML='<b>Drag</b> to orbit · <b>Scroll</b> to zoom · <b>Tap</b> a planet to explore';
 const help=$('help');help.querySelector('ul').insertAdjacentHTML('afterbegin','<li><b>On iPad or mobile:</b> drag with one finger to orbit, pinch with two fingers to zoom, and tap a planet to select it. Use ☰ for worlds, ⚙ for planet settings, and ☄ for Smash Mode. Tap a weapon, then tap the planet to fire; use the Weapons button to switch tools.</li>');
 syncPanels();
}
// Capture touch gestures before the desktop pointer listeners; two-finger zoom must never count as a weapon tap.
const touchNav={points:new Map(),start:null,last:null,moved:false,multitouch:false,pinch:0};
function touchZoomBounds(){return {min:state.physicalScale?.002:1.3,max:2400}}
function touchTap(x,y){
 const cam=cameraData();
 if(smash.enabled){const hit=smashPick(x,y,cam);if(hit){if(hit.p.id!==state.selected)selectBody(hit.p.id,false);fireSmash(hit.p,hit.normal,hit.point,x,y)}else showToast('Tap a visible planet, or pinch to zoom closer.');return;}
 let best=null,bestDistance=Infinity;
 for(const p of planets){if(p.integrity<=0)continue;const sc=worldScreen(p.pos,cam);if(!sc)continue;const distance=Math.hypot(x-sc.x,y-sc.y);const projected=p.r/sc.depth*canvas.clientHeight/(2*Math.tan(24*d2r));if(distance<Math.max(23,projected+16)&&distance<bestDistance){best=p;bestDistance=distance}}
 if(best)selectBody(best.id);
}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch')return;e.stopImmediatePropagation();e.preventDefault();
 try{canvas.setPointerCapture(e.pointerId)}catch(_err){}
 touchNav.points.set(e.pointerId,[e.clientX,e.clientY]);
 if(touchNav.points.size===1){touchNav.start=[e.clientX,e.clientY];touchNav.last=[e.clientX,e.clientY];touchNav.moved=false;touchNav.multitouch=false;touchNav.pinch=0;}
 else{touchNav.multitouch=true;touchNav.moved=true;touchNav.pinch=0;}
},{capture:true,passive:false});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerType!=='touch')return;e.stopImmediatePropagation();if(!touchNav.points.has(e.pointerId))return;e.preventDefault();
 touchNav.points.set(e.pointerId,[e.clientX,e.clientY]);
 if(touchNav.points.size>1){const [a,b]=[...touchNav.points.values()];const distance=Math.hypot(a[0]-b[0],a[1]-b[1]);if(touchNav.pinch&&distance>1){const bounds=touchZoomBounds();state.camera.dist=Math.max(bounds.min,Math.min(bounds.max,state.camera.dist*touchNav.pinch/distance));}touchNav.pinch=distance;touchNav.multitouch=true;touchNav.moved=true;return;}
 if(touchNav.multitouch){touchNav.last=[e.clientX,e.clientY];return}
 if(!touchNav.last)return;
 const dx=e.clientX-touchNav.last[0],dy=e.clientY-touchNav.last[1];if(touchNav.start&&Math.hypot(e.clientX-touchNav.start[0],e.clientY-touchNav.start[1])>12)touchNav.moved=true;
 if(touchNav.moved){state.camera.az-=dx*.0045;state.camera.el=Math.max(-1.5,Math.min(1.5,state.camera.el+dy*.0045));}
 touchNav.last=[e.clientX,e.clientY];
},{capture:true,passive:false});
function endTouch(e,cancelled){if(e.pointerType!=='touch')return;e.stopImmediatePropagation();e.preventDefault();if(!touchNav.points.has(e.pointerId))return;
 const shouldTap=!cancelled&&!touchNav.moved&&!touchNav.multitouch&&touchNav.points.size===1;
 touchNav.points.delete(e.pointerId);touchNav.pinch=0;
 if(shouldTap)touchTap(e.clientX,e.clientY);
 if(touchNav.points.size===0){touchNav.start=null;touchNav.last=null;touchNav.moved=false;touchNav.multitouch=false}
}
canvas.addEventListener('pointerup',e=>endTouch(e,false),{capture:true,passive:false});
canvas.addEventListener('pointercancel',e=>endTouch(e,true),{capture:true,passive:false});
initMobileUI();
