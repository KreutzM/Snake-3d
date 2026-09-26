import * as THREE from 'three';
import { SnakeSimulation, LEVELS, COMBO_WINDOW, CLEAN_LEVEL_BONUS, wrapAngle, distance } from './simulation.js';
import { terrainHeight, surfaceHeight } from './terrain.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const game = new SnakeSimulation();
const SPEEDS = { chill: 2.4, flow: 4.8, rush: 9.6 };
let state = 'ready', view = 'ego', targetYaw = 0, pitch = -.07, baseSpeed = SPEEDS.flow;
let best = 0, sound = true, audioContext, lastTime = 0, accumulator = 0;
let directLevel3 = false;
const keys = new Set();
const voices = new Set();
let audioRevision = 0, audioFailed = false;
try { sound = localStorage.getItem('snake3d-sound') !== 'off'; } catch {}
try { directLevel3 = localStorage.getItem('snake3d-direct-level3') === 'on'; } catch {}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
try { best = Math.max(0, Number(localStorage.getItem('snake3d-lives-best')) || 0); } catch {}
const format = n => String(n).padStart(3, '0');

function overlay(tag, title, copy, button) {
  $('overlay-tag').textContent = tag; $('overlay-title').textContent = title;
  $('overlay-copy').textContent = copy; $('start').textContent = button + ' ↗';
  $('overlay').classList.remove('hidden');
}
function stats() {
  $('lives-hud').textContent = `${'♥'.repeat(game.lives)}${'♡'.repeat(3 - game.lives)}`;
  $('lives-hud').setAttribute('aria-label', `${game.lives} von 3 Leben`);
  $('lives-value').textContent = `${game.lives} / 3`;
  $('clean-bonus').textContent = game.levelDeaths === 0 ? `Ohne Unfall: +${CLEAN_LEVEL_BONUS} Punkte` : 'Unfallfrei-Bonus in diesem Level verloren';
  $('score').textContent = format(game.score); $('best').textContent = format(best);
  $('length').innerHTML = `${game.length} <span>Meter</span>`;
  $('eaten').innerHTML = `${game.eaten} <span>Energie</span>`;
  $('level-name').textContent = `${game.levelIndex + 1} / ${LEVELS.length} · ${game.level.name}`;
  $('level-progress').textContent = game.levelComplete ? (game.won ? 'ALLE DREI ARENEN GESCHAFFT' : 'AUSGANG ERREICHT · LEVEL GESCHAFFT') : game.portalOpen ? 'PORTAL OFFEN · ERREICHE DEN AUSGANG' : `${game.levelEaten} / ${game.level.target} KUGELN · PORTAL ÖFFNEN`;
  $('level-fill').style.width = `${game.levelEaten / game.level.target * 100}%`;
  $('level-hud').textContent = `L${game.levelIndex + 1} · ${game.level.name.toUpperCase()} · ${game.levelEaten}/${game.level.target}`;
  $('level-route').replaceChildren(...LEVELS.map((level, i) => {
    const item = document.createElement('li');
    item.textContent = `${i < game.levelIndex || (i === game.levelIndex && game.levelComplete) ? '✓' : i + 1} · ${level.name}`;
    if (i === game.levelIndex) item.setAttribute('aria-current', 'step');
    return item;
  }));
}
function soundButton() {
  $('sound').innerHTML = `♪ <span>${audioFailed ? '!' : sound ? 'AN' : 'AUS'}</span>`;
  const label = audioFailed ? 'Ton erneut aktivieren (M)' : sound ? 'Ton ausschalten (M)' : 'Ton einschalten (M)';
  $('sound').setAttribute('aria-label', label); $('sound').title = label;
  $('sound').setAttribute('aria-pressed', String(sound && !audioFailed));
}
async function tone(frequency, duration = .18) {
  if (!sound) return;
  const revision = audioRevision;
  try {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state !== 'running') await audioContext.resume();
    // Muting while resume is pending must not play a delayed effect.
    if (!sound || revision !== audioRevision) return;
    if (audioContext.state !== 'running') throw new Error('Audio is not running');
    audioFailed = false; soundButton();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'triangle'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(.14, now + .01);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    const voice = { oscillator, gain }; voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(voice); };
    oscillator.start(now); oscillator.stop(now + duration);
  } catch {
    if (sound && revision === audioRevision) { audioFailed = true; soundButton(); }
  }
}
function toggleSound() {
  sound = audioFailed || !sound; audioFailed = false; audioRevision++;
  try { localStorage.setItem('snake3d-sound', sound ? 'on' : 'off'); } catch {}
  if (!sound) {
    for (const { oscillator, gain } of voices) {
      gain.gain.cancelScheduledValues(audioContext.currentTime);
      gain.gain.setValueAtTime(0, audioContext.currentTime);
      oscillator.stop();
    }
  }
  soundButton();
  if (sound) tone(660, .25);
}
function releaseMouse() { if (document.pointerLockElement === canvas) document.exitPointerLock(); }
function captureMouse() {
  if (!matchMedia('(pointer: fine)').matches || !canvas.requestPointerLock) return;
  try {
    const pending = canvas.requestPointerLock();
    pending?.catch(() => { $('arena-note').textContent = 'MAUS NICHT VERFÜGBAR · MIT A/D LENKEN'; });
  } catch { $('arena-note').textContent = 'MIT A/D LENKEN · C FÜR KAMERA'; }
}
function start() {
  if (state === 'error') return;
  if (state === 'between') { game.nextLevel(); targetYaw = game.yaw; pitch = -.07; stats(); }
  else if (state === 'retry') { game.retryLevel(); targetYaw = game.yaw; pitch = -.07; stats(); }
  else if (state !== 'paused') {
    game.reset();
    if (directLevel3) game.loadLevel(2);
    targetYaw = game.yaw; pitch = -.07; stats();
  }
  $('pickup-feedback').textContent = ''; keys.clear(); state = 'playing'; accumulator = 0; lastTime = performance.now();
  $('overlay').classList.add('hidden'); $('pause').disabled = false;
  $('pause').innerHTML = 'Ⅱ <span>PAUSE</span>'; $('status').textContent = game.portalOpen ? 'ZUM PORTAL' : 'IM FLOW';
  $('arena-note').textContent = matchMedia('(pointer: coarse)').matches ? 'ZIEHEN · UMSEHEN   ↑ / ↓ · TEMPO' : 'MAUS / A D · LENKEN   W / S · TEMPO   C · KAMERA';
  document.querySelector('.arena').classList.add('playing');
  tone(440); captureMouse();
}
function pause() {
  if (state === 'paused') return start();
  if (state !== 'playing') return;
  state = 'paused'; keys.clear(); releaseMouse();
  $('status').textContent = 'KURZ DURCHATMEN'; $('pause').innerHTML = '▷ <span>WEITER</span>';
  document.querySelector('.arena').classList.remove('playing');
  overlay('TAKE A BREAK', 'Alles in deinem Tempo.', 'Dein Run wartet auf dich. Mit einem Klick geht’s weiter.', 'Weiterspielen');
}
function saveBest() {
  if (game.score > best) {
    best = game.score;
    try { localStorage.setItem('snake3d-lives-best', String(best)); } catch {}
  }
}
function bonusCopy() {
  return game.levelBonus ? `Unfallfrei: +${game.levelBonus} Bonuspunkte!` : 'Kein Unfallfrei-Bonus in diesem Level.';
}
function loseLife() {
  state = 'retry'; keys.clear(); releaseMouse(); $('pause').disabled = true;
  document.querySelector('.arena').classList.remove('playing');
  $('status').textContent = 'LEBEN VERLOREN'; stats();
  overlay(`${game.lives} LEBEN ÜBRIG`, 'Noch eine Chance.',
    `${game.reason} ${game.lostPoints} Versuchspunkte verworfen. Du startest ${game.level.name} mit ${game.score} gesicherten Punkten neu. Der Unfallfrei-Bonus ist für dieses Level verloren.`,
    `Level ${game.levelIndex + 1} wiederholen`);
  tone(180, .25);
}
function finish() {
  state = 'over'; keys.clear(); releaseMouse(); $('pause').disabled = true;
  $('status').textContent = game.won ? 'ALLE LEVEL GEMEISTERT' : 'RUN BEENDET';
  stats();
  document.querySelector('.arena').classList.remove('playing');
  overlay(game.won ? 'PERFEKTER RUN' : 'ONE MORE RUN?', game.won ? 'Drei Arenen. Ein Champion.' : 'Noch eine Runde?', `${game.reason} ${game.score} Punkte · ${game.eaten} Kugeln · Level ${game.levelIndex + 1}/${LEVELS.length}. ${game.won ? `Alle Portale erreicht! ${bonusCopy()}` : 'Keine Leben mehr. Der nächste Run beginnt in Level 1.'}`, 'Nochmal spielen');
  tone(game.won ? 880 : 110, .35);
}
function completeLevel() {
  state = 'between'; keys.clear(); releaseMouse(); $('pause').disabled = true;
  document.querySelector('.arena').classList.remove('playing');
  $('status').textContent = 'LEVEL GESCHAFFT'; stats();
  const next = LEVELS[game.levelIndex + 1];
  overlay(`LEVEL ${game.levelIndex + 1} / ${LEVELS.length} ABGESCHLOSSEN`, `${game.level.name} geschafft!`,
    `+${game.score - game.levelStartScore} Punkte · Gesamt ${game.score} · Beste Combo ×${game.levelBestCombo}. ${bonusCopy()} Als Nächstes: ${next.name}. ${next.description} Punkte bleiben erhalten; Combo und Länge starten neu.`,
    `Level ${game.levelIndex + 2} starten`);
  tone(880, .25);
}
function toggleView() {
  view = view === 'ego' ? 'chase' : 'ego';
  $('camera').textContent = view === 'ego' ? 'EGO ↗' : 'VERFOLGER ↗';
  $('camera').setAttribute('aria-label', view === 'ego' ? 'Zur Verfolgerkamera wechseln (C)' : 'Zur Egoperspektive wechseln (C)');
  document.querySelector('.arena').classList.toggle('chase', view === 'chase');
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  state = 'error';
  overlay('WEBGL NICHT VERFÜGBAR', 'Die 3D-Arena braucht WebGL.', 'Aktiviere die Grafikbeschleunigung im Browser und lade die Seite neu.', '3D nicht verfügbar');
  $('start').disabled = true; $('start-hint').textContent = 'Chrome, Edge, Firefox oder Safari mit WebGL 2 verwenden.';
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#101c1c');
  scene.fog = new THREE.FogExp2('#101c1c', .018);
  const camera = new THREE.PerspectiveCamera(78, 1, .08, 180);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight('#dcffe1', '#1c2320', 2.2));
  const sun = new THREE.DirectionalLight('#e9ffd5', 3.3);
  sun.position.set(-12, 24, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 75 });
  sun.shadow.normalBias = .025; scene.add(sun);
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .22, ...extra });
  const floorMat = mat('#263a35');
  const darkMat = mat('#1c2d29');
  const wallMat = mat('#38544a');
  const mintMat = mat('#b6f67d', { emissive: '#75cc45', emissiveIntensity: .35 });
  const neonMat = new THREE.MeshBasicMaterial({ color: '#bdf986' });
  const orangeMat = mat('#ff9b52', { emissive: '#ff702b', emissiveIntensity: 1.5, roughness: .2 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function terrainGeometry(level, segments = 36) {
    const size = level.halfSize * 2, vertices = [], indices = [];
    for (let iz = 0; iz <= segments; iz++) for (let ix = 0; ix <= segments; ix++) {
      const x = -level.halfSize + ix / segments * size;
      const z = -level.halfSize + iz / segments * size;
      vertices.push(x, terrainHeight(level, x, z), z);
    }
    for (let iz = 0; iz < segments; iz++) for (let ix = 0; ix < segments; ix++) {
      const a = iz * (segments + 1) + ix, b = a + 1, c = a + segments + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
  function box(x, y, z, sx, sy, sz, material, shadow = true) {
    const mesh = new THREE.Mesh(boxGeo, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = shadow; mesh.receiveShadow = true; scene.add(mesh); return mesh;
  }
  box(0, -.35, 0, 37, .7, 37, darkMat);
  const terrainMesh = new THREE.Mesh(terrainGeometry(LEVELS[0]), floorMat);
  terrainMesh.receiveShadow = true; scene.add(terrainMesh);
  const grid = new THREE.GridHelper(36, 24, '#759d73', '#426353'); grid.position.y = .03; grid.material.transparent = true; grid.material.opacity = .2; scene.add(grid);
  for (const side of [-1, 1]) {
    box(side * 18.5, 1.5, 0, 1, 3, 38, wallMat);
    box(0, 1.5, side * 18.5, 36, 3, 1, wallMat);
    box(side * 17.97, .2, 0, .06, .08, 36, neonMat, false);
    box(0, .2, side * 17.97, 36, .08, .06, neonMat, false);
    box(side * 18.5, 3.04, 0, 1.04, .08, 38, neonMat, false);
    box(0, 3.04, side * 18.5, 36, .08, 1.04, neonMat, false);
    for (let n = -15; n <= 15; n += 5) {
      box(side * 18, 1.5, n, .15, 2.9, .14, darkMat);
      box(n, 1.5, side * 18, .14, 2.9, .15, darkMat);
    }
  }
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  const columns = new THREE.Group(); scene.add(columns);
  const bridges = new THREE.Group(); scene.add(bridges);
  const bridgeMaterial = mat('#4b6070', { roughness: .48, metalness: .38 });
  const bridgeGlow = new THREE.MeshBasicMaterial({ color: '#8deaff' });
  let renderedLevel = -1;
  function syncLevel() {
    if (renderedLevel === game.levelIndex) return;
    renderedLevel = game.levelIndex; columns.clear(); bridges.clear();
    neonMat.color.set(game.level.color); floorMat.color.set(game.level.floor);
    terrainMesh.geometry.dispose(); terrainMesh.geometry = terrainGeometry(game.level);
    for (const obstacle of game.obstacles) {
      const column = new THREE.Mesh(cylinderGeo, darkMat);
      column.position.set(obstacle.x, terrainHeight(game.level, obstacle.x, obstacle.z) + 1.8, obstacle.z); column.scale.set(obstacle.radius, 3.6, obstacle.radius);
      column.castShadow = true; column.receiveShadow = true; columns.add(column);
      for (const y of [.14, 3.45]) {
        const band = new THREE.Mesh(cylinderGeo, orangeMat);
        band.position.set(obstacle.x, terrainHeight(game.level, obstacle.x, obstacle.z) + y, obstacle.z); band.scale.set(obstacle.radius * 1.015, .09, obstacle.radius * 1.015); columns.add(band);
      }
    }
    for (let i = 0; i < (game.level.structures || []).length; i++) {
      const structure = game.level.structures[i];
      if (structure.type !== 'bridge') continue;
      const bridgeBase = terrainHeight(game.level, structure.x, structure.z);
      const deckThickness = .28;
      const rampThickness = .28;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(structure.width, deckThickness, structure.length), bridgeMaterial);
      deck.position.set(structure.x, bridgeBase + structure.height - deckThickness / 2, structure.z); deck.castShadow = deck.receiveShadow = true; bridges.add(deck);
      const angle = Math.atan2(structure.height, structure.ramp);
      for (const side of [-1, 1]) {
        const slopeLength = Math.hypot(structure.ramp, structure.height) + .5;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(structure.width, rampThickness, slopeLength), bridgeMaterial);
        ramp.position.set(structure.x, bridgeBase + structure.height / 2 + rampThickness / 2 * Math.cos(angle), structure.z + side * (structure.length / 2 + structure.ramp / 2));
        ramp.rotation.x = side * angle; ramp.castShadow = ramp.receiveShadow = true; bridges.add(ramp);
      }
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(.14, .72, structure.length), bridgeGlow);
        rail.position.set(structure.x + side * structure.width / 2, bridgeBase + structure.height + .42, structure.z); bridges.add(rail);
        for (const supportZ of [structure.z - structure.length / 3, structure.z + structure.length / 3]) {
          const supportHeight = structure.height;
          const support = new THREE.Mesh(new THREE.BoxGeometry(.4, supportHeight, .4), bridgeMaterial);
          support.position.set(structure.x + side * (structure.width / 2 - .5), bridgeBase + supportHeight / 2, supportZ);
          support.castShadow = support.receiveShadow = true; bridges.add(support);
        }
      }
    }
  }
  syncLevel();
  const portal = new THREE.Group();
  const portalMat = new THREE.MeshBasicMaterial({ color: '#7deaff', transparent: true, opacity: .25 });
  const portalRing = new THREE.Mesh(new THREE.TorusGeometry(1.65, .14, 12, 64), portalMat);
  portalRing.position.y = 1.8; portal.add(portalRing);
  const portalBase = new THREE.Mesh(new THREE.TorusGeometry(1.65, .09, 8, 64), portalMat);
  portalBase.rotation.x = Math.PI / 2; portalBase.position.y = .08; portal.add(portalBase);
  scene.add(portal);
  // Architectural silhouettes give the arena a horizon and a sense of scale.
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, radius = 38 + (i % 3) * 5, h = 4 + (i * 7 % 15);
    box(Math.sin(a) * radius, h / 2 - 1, Math.cos(a) * radius, 3 + i % 4, h, 4, darkMat, false);
  }
  const body = new THREE.InstancedMesh(new THREE.SphereGeometry(.48, 12, 8), mintMat, 300);
  body.castShadow = true; body.receiveShadow = true; body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  body.frustumCulled = false; scene.add(body);
  const dummy = new THREE.Object3D();
  const head = new THREE.Group();
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(.54, 16, 12), mintMat); headMesh.scale.set(1, .83, 1.12); headMesh.castShadow = true; head.add(headMesh);
  const eyeGeo = new THREE.SphereGeometry(.095, 8, 8), eyeMat = new THREE.MeshBasicMaterial({ color: '#152519' });
  for (const side of [-1, 1]) { const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.set(side * .24, .27, -.4); head.add(eye); }
  scene.add(head);
  const goldMat = mat('#ffe66a', { emissive: '#ffc400', emissiveIntensity: 1.8, roughness: .2 });
  const pickups = Array.from({ length: 4 }, (_, i) => {
    const material = i === 3 ? goldMat : orangeMat;
    const group = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 3 ? .7 : .53, 1), material);
    orb.castShadow = true; group.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.83, .027, 8, 48), material);
    ring.rotation.x = Math.PI / 2; group.add(ring);
    if (i === 3) {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(1, .04, 8, 48), material);
      group.add(crown);
    }
    scene.add(group);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.025, .22, 5, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: i === 3 ? '#ffe66a' : '#ffb474', transparent: true, opacity: .16, depthWrite: false }));
    scene.add(beacon);
    return { group, orb, ring, beacon };
  });
  let feedbackRemaining = 0;
  const map = $('minimap'), mapCtx = map.getContext('2d');
  function drawMap(points) {
    const ctx = mapCtx, factor = 3.1, center = 64;
    ctx.clearRect(0, 0, 128, 128); ctx.fillStyle = '#101c19db'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#6c8f65'; ctx.lineWidth = 1; ctx.strokeRect(8, 8, 112, 112);
    for (const p of game.obstacles) { ctx.fillStyle = '#768374'; ctx.beginPath();ctx.arc(center+p.x*factor,center+p.z*factor,p.radius*factor,0,Math.PI*2);ctx.fill(); }
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(center+p.x*factor,center+p.z*factor) : ctx.moveTo(center+p.x*factor,center+p.z*factor));
    ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#bdf986'; ctx.stroke();
    for (const p of game.foods) {
      ctx.fillStyle = '#ffa265'; ctx.beginPath(); ctx.arc(center+p.x*factor,center+p.z*factor,3.5,0,Math.PI*2);ctx.fill();
    }
    if (game.gold) {
      ctx.fillStyle = '#ffe66a'; ctx.save(); ctx.translate(center+game.gold.x*factor,center+game.gold.z*factor);
      ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    ctx.strokeStyle = game.portalOpen ? '#7deaff' : '#526778'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(center+game.level.portal.x*factor,center+game.level.portal.z*factor,5,0,Math.PI*2); ctx.stroke();
    ctx.save();ctx.translate(center+game.head.x*factor,center+game.head.z*factor);ctx.rotate(game.yaw);
    ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(-3.5,4);ctx.lineTo(3.5,4);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.restore();
  }
  function render(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, .1); lastTime = time;
    if (state === 'playing') {
      accumulator += dt;
      while (accumulator >= 1 / 120 && state === 'playing') {
        const steering = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        targetYaw += steering * 1.85 / 120;
        const speed = baseSpeed * (keys.has('up') ? 1.4 : keys.has('down') ? .58 : 1);
        const event = game.update(1 / 120, targetYaw, speed);
        accumulator -= 1 / 120;
        if (event === 'food') {
          stats(); tone(game.lastPickup.golden ? 1100 : 550 + game.combo * 100);
          feedbackRemaining = 1.4;
          $('pickup-feedback').textContent = `+${game.lastPickup.points} · ${game.lastPickup.golden ? 'GOLD' : 'ENERGIE'}${game.combo > 1 ? ` · COMBO ×${game.combo}` : ''}`;
          $('pickup-feedback').classList.toggle('golden', game.lastPickup.golden);
          if (game.portalOpen) {
            feedbackRemaining = 3;
            $('pickup-feedback').textContent = `+${game.lastPickup.points} · PORTAL OFFEN!`;
            $('status').textContent = 'ZUM PORTAL'; tone(950, .3);
          }
        }
        if (event === 'level-complete' || event === 'victory') saveBest();
        if (event === 'level-complete') completeLevel();
        else if (event === 'collision' && game.lives > 0) loseLife();
        else if (!game.alive) finish();
      }
    }
    syncLevel();
    portal.position.set(game.level.portal.x, surfaceHeight(game.level, game.level.portal.x, game.level.portal.z, game.level.portal.surface || 'ground'), game.level.portal.z);
    portalMat.opacity = game.portalOpen ? .95 : .2;
    if (!reducedMotion) portalRing.rotation.y = time / 1800;
    const points = game.bodyPoints(.6);
    body.count = Math.max(0, points.length - 1);
    for (let i = 1; i < points.length; i++) {
      const p = points[i], previous = points[i - 1];
      dummy.position.set(p.x, (p.y || 0) + .49, p.z); dummy.rotation.set(0, Math.atan2(previous.x - p.x, previous.z - p.z), 0);
      const taper = Math.min(1, .4 + (points.length - i) / 4);
      dummy.scale.set(taper, .82 * taper, 1.03); dummy.updateMatrix(); body.setMatrixAt(i - 1, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    head.position.set(game.head.x, (game.head.y || 0) + .52, game.head.z); head.rotation.y = -game.yaw; head.visible = view === 'chase' || state === 'ready';
    const bob = reducedMotion ? 0 : Math.sin(time / 350) * .12;
    pickups.forEach(({ group, orb, ring, beacon }, i) => {
      const p = i === 3 ? game.gold : game.foods[i];
      group.visible = beacon.visible = Boolean(p);
      if (!p) return;
      group.position.set(p.x, (p.y || 0) + 1.05 + bob, p.z); beacon.position.set(p.x, (p.y || 0) + 2.5, p.z);
      if (!reducedMotion) { orb.rotation.y = time / 1000; ring.rotation.z = time / 1700; }
    });
    if (state === 'playing') feedbackRemaining = Math.max(0, feedbackRemaining - dt);
    $('pickup-feedback').style.opacity = feedbackRemaining > 0 ? '1' : '0';
    $('combo-value').textContent = `×${Math.max(1, game.combo)}`;
    $('combo-clock').textContent = game.portalOpen ? `Beste Level-Combo ×${game.levelBestCombo}` : game.comboRemaining > 0 ? `${game.comboRemaining.toFixed(1)} s · nächste Kugel!` : 'Sammle die nächste Kugel';
    $('combo-fill').style.width = `${game.comboRemaining / COMBO_WINDOW * 100}%`;
    $('combo-panel').classList.toggle('active', game.combo > 1);
    $('combo-hud-label').textContent = game.portalOpen ? 'ZIEL ERREICHT · FINDE DEN AUSGANG' : game.comboRemaining > 0 ? `COMBO ×${game.combo} · ${game.comboRemaining.toFixed(1)} s` : 'COMBO · SCHNELL WEITERSAMMELN';
    $('combo-hud-fill').style.width = `${game.comboRemaining / COMBO_WINDOW * 100}%`;
    $('gold-status').textContent = game.portalOpen ? '◎ PORTAL OFFEN' : game.gold ? `◆ GOLD · ${game.goldRemaining.toFixed(1)} s` : `◇ GOLD IN ${Math.ceil(game.goldCountdown)} s`;
    $('gold-status').classList.toggle('golden', Boolean(game.gold));
    if (state === 'ready' || state === 'between') {
      camera.position.set(24, 21, 29); camera.lookAt(0, 0, 0);
    } else if (view === 'ego') {
      const surface = game.surface || game.head.surface || 'ground';
      const lookDistance = 3;
      const lookX = game.head.x + Math.sin(game.yaw) * lookDistance;
      const lookZ = game.head.z - Math.cos(game.yaw) * lookDistance;
      camera.position.set(game.head.x, (game.head.y || 0) + 1.35, game.head.z);
      camera.lookAt(
        lookX,
        surfaceHeight(game.level, lookX, lookZ, surface) + 1.35 + Math.tan(pitch) * lookDistance,
        lookZ
      );
    } else {
      const surface = game.surface || game.head.surface || 'ground';
      const chaseX = THREE.MathUtils.clamp(game.head.x - Math.sin(game.yaw) * 5.5, -17, 17);
      const chaseZ = THREE.MathUtils.clamp(game.head.z + Math.cos(game.yaw) * 5.5, -17, 17);
      const chaseGroundY = terrainHeight(game.level, chaseX, chaseZ);
      const chaseSurfaceY = surfaceHeight(game.level, chaseX, chaseZ, surface);
      const cameraY = Math.max(chaseGroundY + 4.6, chaseSurfaceY + 3.8, (game.head.y || 0) + 3.8);
      camera.position.set(chaseX, cameraY, chaseZ);
      const lookX = game.head.x + Math.sin(game.yaw) * 2, lookZ = game.head.z - Math.cos(game.yaw) * 2;
      camera.lookAt(lookX, surfaceHeight(game.level, lookX, lookZ, surface) + .65, lookZ);
    }
    const nearest = game.foods.reduce((best, p) => !best || distance(game.head, p) < distance(game.head, best) ? p : best, null);
    function direction(p, label) {
      if (!p) return '';
      const angle = wrapAngle(Math.atan2(p.x - game.head.x, -(p.z - game.head.z)) - game.yaw);
      return `${Math.abs(angle) < .22 ? '↑' : angle < 0 ? '←' : '→'} ${label} · ${Math.round(distance(game.head, p))} M`;
    }
    $('food-direction').textContent = game.portalOpen ? direction(game.level.portal, 'PORTAL') : direction(nearest, 'ENERGIE');
    $('food-direction').classList.toggle('portal-target', game.portalOpen);
    $('gold-direction').textContent = game.portalOpen ? '◎ BLAUEN RING ERREICHEN' : game.gold ? `${direction(game.gold, 'GOLD')} · ${game.goldRemaining.toFixed(1)} s` : `◇ GOLD IN ${Math.ceil(game.goldCountdown)} s`;
    $('gold-direction').classList.toggle('waiting', !game.gold);
    drawMap(points); renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize(); requestAnimationFrame(render);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); if (state === 'playing') pause(); state = 'error';
    overlay('GRAFIKVERBINDUNG UNTERBROCHEN', 'Bitte lade die Seite neu.', 'Deine Bestleistung ist gespeichert.', 'Neu laden');
    $('start').disabled = false; $('start').onclick = () => location.reload();
  });
}

$('start').addEventListener('click', start); $('pause').addEventListener('click', pause);
$('camera').addEventListener('click', toggleView);
$('sound').addEventListener('click', toggleSound);
soundButton();
const directStart = $('direct-level3');
directStart.checked = directLevel3;
directStart.addEventListener('change', () => {
  directLevel3 = directStart.checked;
  try { localStorage.setItem('snake3d-direct-level3', directLevel3 ? 'on' : 'off'); } catch {}
});

document.querySelectorAll('[data-speed]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
  button.addEventListener('click', () => {
    baseSpeed = SPEEDS[button.dataset.speed];
    document.querySelectorAll('[data-speed]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    $('speed-copy').textContent = `${baseSpeed.toFixed(1).replace('.', ',')} m/s · ${button.dataset.speed === 'chill' ? 'Entspannt planen.' : button.dataset.speed === 'rush' ? 'Doppeltes Flow-Tempo!' : 'Doppelt so schnell wie Chill.'}`;
  });
});
const keymap = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
window.addEventListener('keydown', event => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (keymap[key]) { event.preventDefault(); if (state === 'playing') keys.add(keymap[key]); }
  if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) state === 'playing' || state === 'paused' ? pause() : start(); }
  if (key === 'c' && !event.repeat) toggleView();
  if (key === 'm' && !event.repeat) toggleSound();
  if (key === 'Escape' && state === 'playing') pause();
});
window.addEventListener('keyup', event => keys.delete(keymap[event.key.length === 1 ? event.key.toLowerCase() : event.key]));
document.addEventListener('mousemove', event => {
  if (document.pointerLockElement === canvas && state === 'playing') {
    targetYaw = game.yaw + THREE.MathUtils.clamp(wrapAngle(targetYaw - game.yaw) + event.movementX * .0025, -.9, .9);
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * .002, -.65, .65);
  }
});
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && state === 'playing') pause(); });
document.addEventListener('pointerlockerror', () => { $('arena-note').textContent = 'MIT A/D LENKEN · C FÜR KAMERA'; });
canvas.addEventListener('click', () => { if (state === 'playing') captureMouse(); });
window.addEventListener('blur', () => { keys.clear(); if (state === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
document.querySelectorAll('[data-dir]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (state === 'playing') keys.add(button.dataset.dir); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => keys.delete(button.dataset.dir));
});
let touch;
canvas.addEventListener('pointerdown', event => { if (event.pointerType !== 'mouse' && state === 'playing') { touch = { id: event.pointerId, x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); } });
canvas.addEventListener('pointermove', event => {
  if (touch?.id !== event.pointerId || state !== 'playing') return;
  targetYaw += (event.clientX - touch.x) * .007;
  pitch = THREE.MathUtils.clamp(pitch - (event.clientY - touch.y) * .005, -.65, .65);
  touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
for (const name of ['pointerup', 'pointercancel']) canvas.addEventListener(name, () => { touch = null; });
stats();
