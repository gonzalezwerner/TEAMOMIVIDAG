'use strict';
/* ==========================================================
   CANDY CRUSH ROMÁNTICO  –  Mobile + Animaciones Premium
   ========================================================== */

// ── CONFIG ────────────────────────────────────────────────
const G        = 10;          // grid size (larger)
const MOVES    = 25;          // fewer moves
const TARGET   = 3000;         // much higher target
const MIN_RUN  = 3;

const TYPES = [
  { emoji:'💖', cls:'c0' },
  { emoji:'🌹', cls:'c1' },
  { emoji:'⭐', cls:'c2' },
  { emoji:'💜', cls:'c3' },
  { emoji:'💙', cls:'c4' },
  { emoji:'💚', cls:'c5' },
  { emoji:'🍑', cls:'c6' },
];

const COMBOS = ['¡Amor!','¡Dulce!','¡Corazón!','¡Mágico!','¡Divino!','¡Perfecto!','¡Increíble!'];
const SPARKS = ['💕','✨','🌟','💖','⭐','🌸','💗','🎀'];
const SAD_FX = ['💔', '🥀', '🖤', '🍂'];

// ── STATE ─────────────────────────────────────────────────
let grid = [], sel = null, pts = 0, mv = MOVES;
let combo = 0, busy = false, dead = false;
let hintCells = [], hintTO = null;

// ── DOM ───────────────────────────────────────────────────
const boardEl  = document.getElementById('board');
const scoreEl  = document.getElementById('score-val');
const movesEl  = document.getElementById('moves-val');
const progEl   = document.getElementById('prog-fill');
const fxEl     = document.getElementById('fx');
const comboEl  = document.getElementById('combo-msg');
const winEl    = document.getElementById('win');
const goEl     = document.getElementById('gameover');
const winNumEl = document.getElementById('win-score-num');
const goPtsEl  = document.getElementById('go-pts');

// ── BOOT ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  makeBgHearts();
  newGame();
  document.getElementById('btn-new').onclick   = newGame;
  document.getElementById('btn-hint').onclick  = doHint;
  document.getElementById('btn-again').onclick = () => { stopWin3D(); winEl.classList.add('hidden'); newGame(); };
  document.getElementById('btn-retry').onclick = () => { goEl.classList.add('hidden'); newGame(); };
});

// ── FLOATING BG ──────────────────────────────────────────
function makeBgHearts() {
  const el = document.getElementById('bg-hearts');
  const ico = ['💕','💖','🌹','💗','💓','✨','🌸','💝'];
  for (let i = 0; i < 22; i++) {
    const d = document.createElement('div');
    d.className = 'bh';
    d.textContent = ico[i % ico.length];
    const dur   = 9 + Math.random() * 14;
    const delay = -Math.random() * dur;
    d.style.cssText = `left:${Math.random()*100}%; font-size:${0.7+Math.random()*1.1}rem;
      animation-duration:${dur}s; animation-delay:${delay}s;`;
    el.appendChild(d);
  }
}

// ── GAME INIT ─────────────────────────────────────────────
function newGame() {
  grid = []; sel = null; pts = 0; mv = MOVES; combo = 0; busy = false; dead = false;
  clearHints(); resetUI();
  for (let r = 0; r < G; r++) { grid[r] = []; for (let c = 0; c < G; c++) grid[r][c] = safeRand(r,c); }
  render(true);
  scheduleHint();
}

function resetUI() {
  scoreEl.textContent = 0; movesEl.textContent = MOVES;
  progEl.style.width = '0%'; comboEl.textContent = '';
}

// ── RANDOM ────────────────────────────────────────────────
const rnd = () => (Math.random() * TYPES.length) | 0;
function safeRand(r, c) {
  let t; do { t = rnd(); } while (
    (c >= 2 && grid[r][c-1] === t && grid[r][c-2] === t) ||
    (r >= 2 && grid[r-1][c] === t && grid[r-2][c] === t)
  ); return t;
}

// ── CELL SIZE ─────────────────────────────────────────────
function cellSize() {
  const h   = document.documentElement.clientHeight;
  const w   = document.documentElement.clientWidth;
  const hdr = document.getElementById('hdr').offsetHeight;
  const ftr = document.getElementById('ftr').offsetHeight;
  const pad = 6*4 + 20;   // app padding + board-wrap padding
  const gap = 3 * (G - 1);   // G-1 gaps of 3px
  const avH = h - hdr - ftr - pad - gap - 10;
  const avW = Math.min(w, 540) - 28 - gap;
  const cs  = Math.floor(Math.min(avH, avW) / G);
  // gap scales with cell
  const g = Math.max(2, Math.floor(cs * 0.07));
  document.documentElement.style.setProperty('--cs', cs + 'px');
  document.documentElement.style.setProperty('--gap', g + 'px');
  document.documentElement.style.setProperty('--g', G); // Added for CSS grid
  return cs;
}

// ── RENDER ────────────────────────────────────────────────
function render(entrance = false) {
  cellSize();
  boardEl.innerHTML = '';
  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const el = makeCell(r, c, grid[r][c]);
      if (entrance) {
        el.classList.add('appear');
        el.style.animationDelay = `${(r*G+c)*0.016}s`;
      } else {
        el.classList.add('fall');
        el.style.animationDelay = `${c*0.02}s`;
      }
      boardEl.appendChild(el);
    }
  }
}

function makeCell(r, c, t) {
  const el = document.createElement('div');
  el.className   = `candy ${TYPES[t].cls}`;
  el.dataset.r   = r; el.dataset.c = c;
  // No textContent, using background-image now

  // Swipe / Pointer logic
  el.addEventListener('pointerdown', e => onPointerDown(e, r, c));
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup',   onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);

  return el;
}

let dragStart = null;
let neighbor = null;

function onPointerDown(e, r, c) {
  if (busy || dead) return;
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  clearHints();
  dragStart = { 
    el, r, c, 
    startX: e.clientX, 
    startY: e.clientY, 
    curX: e.clientX, 
    curY: e.clientY,
    dir: null,
    dist: 0,
    cs: cellSize(),
    active: true 
  };
  el.classList.add('dragging');
}

function onPointerMove(e) {
  if (!dragStart || !dragStart.active || busy || dead) return;

  const dx = e.clientX - dragStart.startX;
  const dy = e.clientY - dragStart.startY;
  const cs = dragStart.cs;
  
  // Decide direction
  if (!dragStart.dir && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
    if (Math.abs(dx) > Math.abs(dy)) {
      dragStart.dir = dx > 0 ? 'r' : 'l';
    } else {
      dragStart.dir = dy > 0 ? 'd' : 'u';
    }
    
    // Find neighbor
    const dr = dragStart.dir === 'd' ? 1 : (dragStart.dir === 'u' ? -1 : 0);
    const dc = dragStart.dir === 'r' ? 1 : (dragStart.dir === 'l' ? -1 : 0);
    const nr = dragStart.r + dr, nc = dragStart.c + dc;
    
    if (nr >= 0 && nr < G && nc >= 0 && nc < G) {
      neighbor = { r: nr, c: nc, el: $(nr, nc) };
      if (neighbor.el) neighbor.el.classList.add('neighbor');
    } else {
      neighbor = null;
    }
  }

  if (dragStart.dir) {
    let tx = 0, ty = 0;
    if (dragStart.dir === 'r' || dragStart.dir === 'l') {
      tx = Math.max(-cs, Math.min(cs, dx));
    } else {
      ty = Math.max(-cs, Math.min(cs, dy));
    }
    
    dragStart.dist = Math.max(Math.abs(tx), Math.abs(ty));
    dragStart.el.style.transform = `translate(${tx}px, ${ty}px)`;
    
    if (neighbor && neighbor.el) {
      neighbor.el.style.transform = `translate(${-tx}px, ${-ty}px)`;
    }
  }
}

async function onPointerUp(e) {
  if (!dragStart) return;
  const ds = dragStart;
  dragStart = null;

  ds.el.classList.remove('dragging');
  if (neighbor && neighbor.el) neighbor.el.classList.remove('neighbor');

  const commitThreshold = ds.cs * 0.45;
  
  if (neighbor && ds.dist > commitThreshold) {
    // Commit swap
    ds.el.style.transform = '';
    neighbor.el.style.transform = '';
    const n = neighbor;
    neighbor = null;
    await swap(ds.r, ds.c, n.r, n.c);
  } else {
    // Snap back
    ds.el.classList.add('snap');
    if (neighbor && neighbor.el) neighbor.el.classList.add('snap');
    
    ds.el.style.transform = 'translate(0,0)';
    if (neighbor && neighbor.el) neighbor.el.style.transform = 'translate(0,0)';
    
    await wait(300);
    ds.el.classList.remove('snap');
    if (neighbor && neighbor.el) neighbor.el.classList.remove('snap');
    neighbor = null;
  }
}

const $ = (r,c) => boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);

// ── INPUT ─────────────────────────────────────────────────
function onTap(r, c) {
  // Disabled per request: "no se pueda seleccionar solo deslizar"
  return;
}

const adj = (r1,c1,r2,c2) => Math.abs(r1-r2)+Math.abs(c1-c2) === 1;

// ── SWAP ─────────────────────────────────────────────────
async function swap(r1,c1,r2,c2) {
  busy = true; combo = 0;
  
  const el1 = $(r1, c1), el2 = $(r2, c2);
  
  // Try swap in data
  [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];

  if (!matches().length) {
    // EXTRAORDINARY ROMANTIC REJECTION
    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]]; // undo data
    
    if (el1) el1.classList.add('wrong-romance');
    if (el2) el2.classList.add('wrong-romance');
    
    spawnSadHearts(el1);
    spawnSadHearts(el2);
    
    await wait(500);
    
    if (el1) el1.classList.remove('wrong-romance');
    if (el2) el2.classList.remove('wrong-romance');
    
    busy = false; 
    scheduleHint(); 
    return;
  }

  // Valid swap: reflect in UI
  swapDataVisuals(r1, c1, r2, c2);
  spendMove();
  await cascade();
  busy = false;
  checkEnd();
  if (!dead) scheduleHint();
}

function swapDataVisuals(r1,c1,r2,c2) {
  [ [r1,c1], [r2,c2] ].forEach(([r,c]) => {
    const el = $(r,c); if(!el) return;
    const t = TYPES[grid[r][c]];
    el.className = `candy ${t.cls}`;
  });
}

function spawnSadHearts(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'sad-ptcl';
    p.textContent = SAD_FX[i % SAD_FX.length];
    const dx = (Math.random() - 0.5) * 60;
    const rot = (Math.random() - 0.5) * 360;
    p.style.cssText = `left:${cx}px; top:${cy}px; --dx:${dx}px; --rot:${rot}deg;`;
    fxEl.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

// ── MATCH ────────────────────────────────────────────────
function matches() {
  const hit = new Set();
  // horizontal
  for (let r=0; r<G; r++) {
    let s=0;
    for (let c=1; c<=G; c++) {
      if (c<G && grid[r][c]===grid[r][c-1]) continue;
      if (c-s>=MIN_RUN) for(let k=s;k<c;k++) hit.add(`${r},${k}`);
      s=c;
    }
  }
  // vertical
  for (let c=0; c<G; c++) {
    let s=0;
    for (let r=1; r<=G; r++) {
      if (r<G && grid[r][c]===grid[r-1][c]) continue;
      if (r-s>=MIN_RUN) for(let k=s;k<r;k++) hit.add(`${k},${c}`);
      s=r;
    }
  }
  return [...hit].map(k=>{ const[r,c]=k.split(',').map(Number); return{r,c}; });
}

// ── CASCADE ──────────────────────────────────────────────
async function cascade() {
  let ms = matches();
  while (ms.length) {
    combo++;
    burst(ms);
    const score = ms.length * 10 * combo;
    addPts(score, ms);
    if (combo > 1) showCombo(combo);
    await wait(400);
    gravity();
    render(false);
    await wait(440);
    ms = matches();
  }
  if (combo > 0) { comboEl.textContent = ''; combo = 0; }
}

function burst(ms) {
  ms.forEach(({r,c}) => {
    const el = $(r,c);
    if (el) { el.classList.add('boom'); sparkleAt(el); }
    grid[r][c] = -1;
  });
}

function gravity() {
  for (let c=0; c<G; c++) {
    let fill = G-1;
    for (let r=G-1; r>=0; r--) { if(grid[r][c]!==-1){ grid[fill][c]=grid[r][c]; if(fill!==r)grid[r][c]=-1; fill--; } }
    for (let r=fill; r>=0; r--) grid[r][c]=rnd();
  }
}

// ── SCORE ─────────────────────────────────────────────────
function addPts(p, ms) {
  pts += p;
  scoreEl.textContent = pts;
  scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop');
  progEl.style.width = Math.min(pts/TARGET*100,100)+'%';
  if (ms.length) {
    const m = ms[ms.length>>1];
    const el = $(m.r, m.c);
    if (el) { const rect=el.getBoundingClientRect(); floatPts(rect.left+rect.width/2, rect.top, `+${p}`); }
  }
}

function spendMove() {
  mv--;
  movesEl.textContent = mv;
  movesEl.classList.remove('pop'); void movesEl.offsetWidth; movesEl.classList.add('pop');
  if (mv <= 5) movesEl.style.color = '#ff4444';
  else         movesEl.style.color = '';
}

function showCombo(n) {
  const m = COMBOS[Math.min(n-2, COMBOS.length-1)];
  comboEl.textContent = `${m} ×${n}`;
  comboEl.style.transform = 'scale(1.5)';
  setTimeout(() => { comboEl.style.transform='scale(1)'; }, 300);
}

// ── PARTICLES ─────────────────────────────────────────────
function sparkleAt(el) {
  const rect = el.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  for (let i=0; i<8; i++) {
    const p = document.createElement('div');
    p.className = 'ptcl';
    p.textContent = SPARKS[i%SPARKS.length];
    const ang  = (Math.PI*2*i/8)+Math.random()*0.4;
    const dist = 38+Math.random()*48;
    p.style.cssText = `left:${cx}px;top:${cy}px;
      --dx:${Math.cos(ang)*dist}px;--dy:${Math.sin(ang)*dist}px;
      --rot:${Math.random()*500}deg;
      font-size:${0.8+Math.random()*0.6}rem;
      animation-duration:${0.7+Math.random()*0.4}s;`;
    fxEl.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  }
}

function floatPts(x,y,txt) {
  const el = document.createElement('div');
  el.className='score-pop'; el.textContent=txt;
  el.style.cssText=`left:${x}px;top:${y}px;transform:translateX(-50%)`;
  fxEl.appendChild(el);
  setTimeout(()=>el.remove(), 1400);
}

// ── HINT ─────────────────────────────────────────────────
function scheduleHint() { clearHints(); hintTO=setTimeout(doHint, 5500); }
function clearHints() {
  clearTimeout(hintTO); hintTO=null;
  hintCells.forEach(el=>el?.classList.remove('hint')); hintCells=[];
}
function doHint() {
  clearHints();
  const mv = findMove();
  if (!mv) return;
  const e1=$(mv.r1,mv.c1), e2=$(mv.r2,mv.c2);
  hintCells=[e1,e2]; hintCells.forEach(el=>el?.classList.add('hint'));
  hintTO=setTimeout(()=>{ clearHints(); scheduleHint(); }, 2500);
}
function findMove() {
  const dirs=[[0,1],[0,-1],[1,0],[-1,0]];
  for(let r=0;r<G;r++) for(let c=0;c<G;c++) {
    for(const[dr,dc] of dirs) {
      const nr=r+dr, nc=c+dc;
      if(nr<0||nr>=G||nc<0||nc>=G) continue;
      [grid[r][c],grid[nr][nc]]=[grid[nr][nc],grid[r][c]];
      const ok=matches().length>0;
      [grid[r][c],grid[nr][nc]]=[grid[nr][nc],grid[r][c]];
      if(ok) return{r1:r,c1:c,r2:nr,c2:nc};
    }
  }
  return null;
}

// ── GAME END ─────────────────────────────────────────────
function checkEnd() {
  if (dead) return;
  if (pts >= TARGET) { dead=true; setTimeout(openWin, 350); return; }
  if (mv  <= 0)      { dead=true; setTimeout(openGameOver, 350); return; }
  if (!findMove())   { reshuffle(); }
}

function reshuffle() {
  for(let r=0;r<G;r++) for(let c=0;c<G;c++) grid[r][c]=safeRand(r,c);
  render(true);
}

function openGameOver() { goPtsEl.textContent=pts; goEl.classList.remove('hidden'); }

// ── UTILS ─────────────────────────────────────────────────
const wait = ms => new Promise(r=>setTimeout(r,ms));

window.addEventListener('resize', () => { if(!dead) render(false); });

/* ===========================================================
   ██╗    ██╗██╗███╗   ██╗    ███████╗ ██████╗███████╗███╗   ██╗███████╗
   ██║    ██║██║████╗  ██║    ██╔════╝██╔════╝██╔════╝████╗  ██║██╔════╝
   ██║ █╗ ██║██║██╔██╗ ██║    ███████╗██║     █████╗  ██╔██╗ ██║█████╗
   ██║███╗██║██║██║╚██╗██║    ╚════██║██║     ██╔══╝  ██║╚██╗██║██╔══╝
   ╚███╔███╔╝██║██║ ╚████║    ███████║╚██████╗███████╗██║ ╚████║███████╗
    ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝    ╚══════╝ ╚═════╝╚══════╝╚═╝  ╚═══╝╚══════╝
   ULTRA-ROMANTIC 3D FINALE
   =========================================================== */

let W3 = null; // Three.js world object

function openWin() {
  winNumEl.textContent = pts;
  buildOrbit();
  winEl.classList.remove('hidden');
  initWin3D();
}

function buildOrbit() {
  const ring = document.getElementById('win-orbit');
  ring.innerHTML = '';
  const ico = ['💖','🌹','💕','✨','💗','🌸','💝','⭐'];
  ico.forEach((ic, i) => {
    const el = document.createElement('div');
    el.className = 'orb-heart'; el.textContent = ic;
    const angle = (360/ico.length)*i;
    el.style.setProperty('--a', `${angle}deg`);
    el.style.animationDuration = `${3.5+Math.random()*1.5}s`;
    ring.appendChild(el);
  });
}

function stopWin3D() {
  if (!W3) return;
  cancelAnimationFrame(W3.raf);
  W3.renderer?.dispose();
  window.removeEventListener('resize', W3.onResize);
  W3 = null;
}

// ── Three.js Init ──────────────────────────────────────────
function initWin3D() {
  stopWin3D();
  const canvas = document.getElementById('win-canvas');
  const W = window.innerWidth, H = window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, W/H, 0.1, 800);
  camera.position.set(0, 0, 28);

  // ── LIGHTS ──
  scene.add(new THREE.AmbientLight(0xffbbcc, 0.6));

  const pinkL = new THREE.PointLight(0xff2266, 5, 80);
  pinkL.position.set(0, 0, 15);
  scene.add(pinkL);

  const goldL = new THREE.PointLight(0xffcc00, 3, 80);
  goldL.position.set(-8, -6, 12);
  scene.add(goldL);

  const violetL = new THREE.PointLight(0xaa00ff, 2.5, 70);
  violetL.position.set(8, 8, 10);
  scene.add(violetL);

  const whiteL = new THREE.PointLight(0xffffff, 1.5, 60);
  whiteL.position.set(0, -10, 14);
  scene.add(whiteL);

  // ── OBJECTS ──
  const hearts  = buildBigHeart(scene);
  const helix   = buildDNAHelix(scene);
  const petals  = buildPetals(scene);
  const rings   = buildRings(scene);
  const stars   = buildStars(scene);
  const firefly = buildFireflies(scene);
  const ribbons = buildRibbons(scene);
  const tunnel  = buildLoveTunnel(scene);

  // Messages overlay
  const msgs = buildWinMessages();

  // Camera intro animation state
  let camPhase = 0;   // 0=zoom-in 1=orbit

  const onResize = () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);

  W3 = { renderer, scene, camera, raf:null, t:0, onResize,
         hearts, helix, petals, rings, firefly, ribbons, pinkL, goldL, violetL,
         tunnel, msgs,
         camPhase, camStartZ:55, camTargetZ:28 };

  W3.camera.position.z = 55; // start far → zoom in
  W3.raf = requestAnimationFrame(tickWin3D);
}

// ── ANIMATION LOOP ────────────────────────────────────────
function tickWin3D(ts) {
  if (!W3) return;
  W3.raf = requestAnimationFrame(tickWin3D);
  const dt = 0.016;
  W3.t += dt;
  const t = W3.t;

  // Camera: zoom-in then orbit
  if (W3.camera.position.z > W3.camTargetZ + 0.1) {
    W3.camera.position.z -= (W3.camera.position.z - W3.camTargetZ) * 0.04;
  } else {
    // orbit
    W3.camera.position.x = Math.sin(t * 0.14) * 4;
    W3.camera.position.y = Math.cos(t * 0.10) * 2.5 + Math.sin(t*0.07)*1.5;
    W3.camera.position.z = W3.camTargetZ + Math.sin(t*0.08)*2;
  }
  W3.camera.lookAt(0, 0, 0);

  // ── Big central heart ──
  W3.hearts.forEach(mesh => {
    mesh.rotation.y += 0.012;
    mesh.rotation.z  = Math.sin(t*1.8+mesh.userData.phase)*0.12;
    const pulse = mesh.userData.baseScale * (1 + Math.sin(t*2.5+mesh.userData.phase)*0.1);
    mesh.scale.setScalar(pulse);
  });

  // ── DNA Helix ──
  W3.helix.forEach(m => {
    m.position.x = Math.cos(t*0.7 + m.userData.angle)*m.userData.r;
    m.position.z = Math.sin(t*0.7 + m.userData.angle)*m.userData.r;
    m.position.y += m.userData.vy * dt * 0.5;
    if (m.position.y > 12)  m.position.y = -12;
    if (m.position.y < -12) m.position.y =  12;
    m.rotation.x += 0.03;
    m.rotation.y += 0.02;
    const pulse2 = 1 + Math.sin(t*3+m.userData.angle)*0.15;
    m.scale.setScalar(m.userData.bs*pulse2);
  });

  // ── Petals rain ──
  W3.petals.forEach(p => {
    p.position.x += p.userData.vx + Math.sin(t*1.4+p.userData.phase)*0.008;
    p.position.y += p.userData.vy;
    p.position.z += p.userData.vz;
    p.rotation.x += p.userData.rx;
    p.rotation.y += p.userData.ry;
    p.rotation.z += p.userData.rz;
    if (p.position.y < -18) { p.position.y=20; p.position.x=(Math.random()-.5)*38; }
  });

  // ── Rings ──
  W3.rings.forEach((ring, i) => {
    ring.rotation.x += ring.userData.rx;
    ring.rotation.y += ring.userData.ry;
    ring.rotation.z += ring.userData.rz;
    const rs = 1+Math.sin(t*ring.userData.sf+i)*ring.userData.sa;
    ring.scale.setScalar(rs);
  });

  // ── Fireflies (heart formation) ──
  W3.firefly.forEach((f,i) => {
    const progress = (t*0.4+f.userData.offset)%1;
    const angle    = progress*Math.PI*2;
    // parametric heart
    const hx = 16*Math.pow(Math.sin(angle),3);
    const hy = 13*Math.cos(angle)-5*Math.cos(2*angle)-2*Math.cos(3*angle)-Math.cos(4*angle);
    f.position.x += (hx*0.6 - f.position.x)*0.04;
    f.position.y += (hy*0.6 - f.position.y)*0.04;
    f.userData.glow += (Math.random()-0.5)*0.15;
    f.userData.glow  = Math.max(0.3, Math.min(1, f.userData.glow));
    f.material.opacity = f.userData.glow;
  });

  // ── Ribbons ──
  W3.ribbons.forEach(r => {
    r.rotation.x += r.userData.rx;
    r.rotation.y += r.userData.ry;
    r.rotation.z += r.userData.rz;
  });

  // ── Tunnel fly-through ──
  W3.tunnel.rotation.z += 0.005;
  W3.tunnel.position.z += 0.1;
  if(W3.tunnel.position.z > 20) W3.tunnel.position.z = -50;

  // ── Pulsating Messages ──
  W3.msgs.forEach((m, i) => {
    const show = (t % (W3.msgs.length * 2)) > (i * 2) && (t % (W3.msgs.length * 2)) < (i * 2 + 1.8);
    m.style.opacity = show ? '1' : '0';
    m.style.transform = `translate(-50%, -50%) scale(${1 + Math.sin(t*3)*0.1})`;
  });

  W3.renderer.render(W3.scene, W3.camera);
}

function buildLoveTunnel(scene) {
  const pts = [];
  for(let i=0; i<10; i++) pts.push(new THREE.Vector3(0, 0, i * 10 - 50));
  const curve = new THREE.CatmullRomCurve3(pts);
  const geom  = new THREE.TubeGeometry(curve, 20, 4, 8, false);
  const mat   = new THREE.MeshPhongMaterial({
    color: 0xff3366, wireframe: true, transparent: true, opacity: 0.15
  });
  const mesh = new THREE.Mesh(geom, mat);
  scene.add(mesh);
  return mesh;
}

function buildWinMessages() {
  const container = document.getElementById('win-ui');
  const texts = ["Eres mi Todo", "Amor Eterno", "Dulce Corazón", "Para Siempre"];
  return texts.map(txt => {
    const div = document.createElement('div');
    div.textContent = txt;
    div.style.cssText = `
      position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%);
      font-family: 'Dancing Script', cursive; font-size: 2.5rem; color: #ffd700;
      text-shadow: 0 0 15px rgba(255, 215, 0, 0.8); pointer-events: none;
      transition: opacity 0.5s ease, transform 0.5s ease; opacity: 0; z-index: 5;
      white-space: nowrap;
    `;
    container.appendChild(div);
    return div;
  });
}

// ── HEART SHAPE ───────────────────────────────────────────
function heartShape3D(scale=1) {
  const s = new THREE.Shape();
  const k = scale;
  s.moveTo(0,  0.55*k);
  s.bezierCurveTo(0, 0.9*k,  0.95*k, 0.9*k,  0.95*k, 0.35*k);
  s.bezierCurveTo(0.95*k,-0.1*k, 0.5*k,-0.52*k,  0, -0.95*k);
  s.bezierCurveTo(-0.5*k,-0.52*k,-0.95*k,-0.1*k,-0.95*k, 0.35*k);
  s.bezierCurveTo(-0.95*k, 0.9*k, 0, 0.9*k, 0, 0.55*k);
  return s;
}

// ── BIG CENTRAL HEARTS ────────────────────────────────────
function buildBigHeart(scene) {
  const meshes = [];
  // Main heart
  const mainGeom = new THREE.ExtrudeGeometry(heartShape3D(2.8), {
    depth:0.9, bevelEnabled:true, bevelSegments:8, bevelSize:0.12, bevelThickness:0.12, steps:2
  });
  mainGeom.center();
  const mainMat = new THREE.MeshPhongMaterial({
    color: 0xff1155,
    shininess: 160,
    specular: new THREE.Color(0xffddee),
    emissive: new THREE.Color(0x550011),
  });
  const mainHeart = new THREE.Mesh(mainGeom, mainMat);
  mainHeart.position.set(0, 0, 0);
  mainHeart.userData = { phase:0, baseScale:1 };
  scene.add(mainHeart);
  meshes.push(mainHeart);

  // 3 orbiting smaller hearts
  const sColors = [0xff4488, 0xff88aa, 0xcc0044];
  const sGeom = new THREE.ExtrudeGeometry(heartShape3D(0.9), {
    depth:0.35, bevelEnabled:true, bevelSegments:5, bevelSize:0.05, bevelThickness:0.05, steps:2
  });
  sGeom.center();
  for (let i=0; i<3; i++) {
    const m = new THREE.Mesh(sGeom, new THREE.MeshPhongMaterial({
      color:sColors[i], shininess:130, specular:new THREE.Color(0xffd0e0), emissive:new THREE.Color(0x440011)
    }));
    const ang = (Math.PI*2/3)*i;
    m.position.set(Math.cos(ang)*6, Math.sin(ang)*4.5, 0);
    m.userData = { phase: (Math.PI*2/3)*i, baseScale:1 };
    scene.add(m);
    meshes.push(m);
  }
  return meshes;
}

// ── DNA DOUBLE HELIX OF HEARTS ────────────────────────────
function buildDNAHelix(scene) {
  const meshes = [];
  const geom = new THREE.SphereGeometry(0.28, 10, 8);
  const cols  = [0xff3366, 0xffcc00, 0xaa44ff, 0xff88aa];
  const N = 40;
  for (let i=0; i<N; i++) {
    const t = (i/N)*Math.PI*4;
    for (let s=0; s<2; s++) {
      const mat = new THREE.MeshPhongMaterial({
        color:cols[(i+s*2)%cols.length],
        shininess:90,
        emissive:new THREE.Color(cols[(i+s*2)%cols.length]).multiplyScalar(0.2)
      });
      const m = new THREE.Mesh(geom, mat);
      const base = s===0 ? t : t+Math.PI;
      const r=5+Math.sin(t*0.5)*1.5;
      m.position.set(Math.cos(base)*r, (i/N)*24-12, Math.sin(base)*r);
      m.userData  = { angle:base, r, vy:(s===0?0.06:-0.06), bs:0.6+Math.random()*0.6 };
      m.scale.setScalar(m.userData.bs);
      scene.add(m);
      meshes.push(m);
    }
  }
  return meshes;
}

// ── PETAL RAIN ────────────────────────────────────────────
function buildPetals(scene) {
  const meshes = [];
  const geom   = new THREE.SphereGeometry(0.22, 8, 6);
  geom.scale(1, 0.45, 0.28);
  const cols   = [0xff88aa, 0xffc0d0, 0xffeef4, 0xff5588, 0xffaacc];
  for (let i=0; i<90; i++) {
    const mat = new THREE.MeshPhongMaterial({ color:cols[i%cols.length], transparent:true, opacity:0.85+Math.random()*0.15, shininess:70 });
    const m   = new THREE.Mesh(geom, mat);
    m.position.set((Math.random()-.5)*40, 20+Math.random()*12, (Math.random()-.5)*18);
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    m.userData = {
      vx:(Math.random()-.5)*0.04, vy:-(0.022+Math.random()*0.05), vz:(Math.random()-.5)*0.025,
      rx:(Math.random()-.5)*0.03, ry:(Math.random()-.5)*0.03,     rz:(Math.random()-.5)*0.02,
      phase:Math.random()*Math.PI*2
    };
    scene.add(m); meshes.push(m);
  }
  return meshes;
}

// ── GLOWING RINGS ─────────────────────────────────────────
function buildRings(scene) {
  const meshes = [];
  const cols   = [0xff2266, 0xffcc00, 0xaa44ff, 0xff88bb, 0x00ddff];
  for (let i=0; i<7; i++) {
    const geom = new THREE.TorusGeometry(3.5+i*1.6, 0.07, 14, 100);
    const mat  = new THREE.MeshPhongMaterial({
      color:cols[i%cols.length], transparent:true, opacity:0.55, shininess:180,
      emissive:new THREE.Color(cols[i%cols.length]).multiplyScalar(0.28)
    });
    const m = new THREE.Mesh(geom, mat);
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    m.userData = {
      rx:(Math.random()-.5)*0.007, ry:(Math.random()-.5)*0.011, rz:(Math.random()-.5)*0.005,
      sa:0.07, sf:0.65+Math.random()*0.45
    };
    scene.add(m); meshes.push(m);
  }
  return meshes;
}

// ── STAR FIELD ────────────────────────────────────────────
function buildStars(scene) {
  const geom = new THREE.BufferGeometry();
  const N    = 800;
  const pos  = new Float32Array(N*3);
  const col  = new Float32Array(N*3);
  for (let i=0; i<N; i++) {
    pos[i*3]   = (Math.random()-.5)*110;
    pos[i*3+1] = (Math.random()-.5)*110;
    pos[i*3+2] = (Math.random()-.5)*110;
    // random warm colours
    const h = Math.random();
    col[i*3]   = 1; col[i*3+1] = 0.6+h*0.4; col[i*3+2] = 0.7+h*0.3;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geom.setAttribute('color',    new THREE.BufferAttribute(col,3));
  const mat   = new THREE.PointsMaterial({ size:0.14, vertexColors:true, transparent:true, opacity:0.9, sizeAttenuation:true });
  const stars = new THREE.Points(geom, mat);
  scene.add(stars);
  return stars;
}

// ── FIREFLIES (heart path) ────────────────────────────────
function buildFireflies(scene) {
  const meshes = [];
  const geom   = new THREE.SphereGeometry(0.12, 6, 6);
  const cols   = [0xffaacc, 0xffddaa, 0xaaddff, 0xffaaff];
  for (let i=0; i<50; i++) {
    const mat = new THREE.MeshBasicMaterial({ color:cols[i%cols.length], transparent:true, opacity:0.8 });
    const m   = new THREE.Mesh(geom, mat);
    m.userData = { offset:Math.random(), glow:Math.random() };
    const a   = m.userData.offset*Math.PI*2;
    const hx  = 16*Math.pow(Math.sin(a),3)*0.6;
    const hy  = (13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*0.6;
    m.position.set(hx, hy, (Math.random()-.5)*3);
    scene.add(m); meshes.push(m);
  }
  return meshes;
}

// ── RIBBON CURVES ─────────────────────────────────────────
function buildRibbons(scene) {
  const meshes = [];
  const cols   = [0xff4488, 0xffcc00, 0xcc44ff, 0xff88bb, 0x44ffcc];
  for (let i=0; i<10; i++) {
    const pts = [];
    for (let j=0; j<24; j++)
      pts.push(new THREE.Vector3((Math.random()-.5)*28,(Math.random()-.5)*28,(Math.random()-.5)*12));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, 0.035, 8, false);
    const mat  = new THREE.MeshPhongMaterial({ color:cols[i%cols.length], transparent:true, opacity:0.4, shininess:100 });
    const m    = new THREE.Mesh(tube, mat);
    m.userData = { rx:(Math.random()-.5)*0.005, ry:(Math.random()-.5)*0.006, rz:(Math.random()-.5)*0.004 };
    scene.add(m); meshes.push(m);
  }
  return meshes;
}
