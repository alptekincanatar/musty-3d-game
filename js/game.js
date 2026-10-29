// game.js — "İndirim Yağmuru", a canvas 2D arcade game starring Musty.
// Renders everything inside the given root element and styles it via css/game.css.
// Game rules live in game-logic.js (DOM-free, node-testable); audio in audio.js.

import { audio } from './audio.js';
import * as G from './game-logic.js';

const FONT = '"Archivo Black","Arial Black",Arial,Helvetica,sans-serif';
const BEST_KEY = 'musty-best';

const SPRITE_KEYS = ['front', 'left', 'right'];

export function initGame(rootEl) {
  // ------------------------------------------------------------------ state
  const sprites = {};          // key -> { img, red, box:{x,y,w,h} }
  let W = 360, H = 640, dpr = 1;
  let pfX = 0, pfW = 360;      // portrait play field, centered horizontally on desktop
  let mode = 'start';          // start | playing | paused | dead | gameover
  let visible = true;
  let last = 0;
  let best = loadBest();
  let startBest = 0;          // best at the start of the current run (for "new record" detection)

  const state = G.createState({ best });

  const player = {
    x: 0, vx: 0, facing: 1, moving: false,
    bob: 0, hitFlash: 0, dead: false, deathT: 0,
  };

  const particles = [];   // sparks + confetti
  const floaters = [];    // floating "+%30" / "kaçırdın" text
  const clouds = [];      // background floating "%"

  let spawnTimer = 0.6;
  let shakeT = 0, shakeMag = 0;
  let speedLinesT = 0;
  let bannerT = 0;
  let bubble = null;      // { text, until }

  // ---------------------------------------------------------------- DOM build
  rootEl.classList.add('mg-wrap');

  const canvas = document.createElement('canvas');
  canvas.className = 'mg-canvas';
  const ctx = canvas.getContext('2d');

  const hud = el('div', 'mg-hud');
  const levelBadge = el('div', 'mg-level', 'SEVİYE 1');
  const hpBar = el('div', 'mg-hp-fill');
  const hpNum = el('span', 'mg-hp-num', '100');
  const hpWrap = el('div', 'mg-hp', [hpBar, hpNum]);
  const hudLeft = el('div', 'mg-hud-left', [levelBadge, hpWrap]);

  const scoreEl = el('div', 'mg-score', '0');
  const bestEl = el('div', 'mg-best', 'Rekor: 0');
  const hudRight = el('div', 'mg-hud-right', [scoreEl, bestEl]);

  const comboEl = el('div', 'mg-combo');

  const pauseBtn = btn('⏸', 'mg-btn', 'Duraklat');
  const muteBtn = btn(muteIcon(), 'mg-btn', 'Ses aç/kapat');
  const fsBtn = btn('⛶', 'mg-btn', 'Tam ekran');
  const btnBar = el('div', 'mg-btnbar', [pauseBtn, muteBtn, fsBtn]);

  const banner = el('div', 'mg-banner');

  hud.append(hudLeft, hudRight, comboEl, btnBar, banner);
  rootEl.append(canvas, hud);
  updateHud();

  // start screen
  const startScreen = el('div', 'mg-screen mg-start');
  startScreen.append(
    el('div', 'mg-start-title', 'İNDİRİM YAĞMURU'),
    el('div', 'mg-start-sub', 'Musty indirimleri kapıyor, tuzaklardan kaçıyor!'),
    el('div', 'mg-legend', [
      el('div', 'mg-legend-item', '🖤 SİYAH = gerçek indirim → TOPLA'),
      el('div', 'mg-legend-item mg-legend-red', '❤️ KIRMIZI = tuzak → KAÇ!'),
    ]),
    el('div', 'mg-start-best', `Rekor: ${best}`)
  );
  const startBtn = el('button', 'mg-btn mg-btn-big', 'BAŞLA');
  startBtn.type = 'button';
  startScreen.append(startBtn);
  startScreen.append(el('div', 'mg-hint', '← → / A D ile hareket · dokun & sürükle'));

  // game over screen
  const overScreen = el('div', 'mg-screen mg-over');
  overScreen.append(el('div', 'mg-over-title', 'ELENDİN!'));
  const overScore = el('div', 'mg-over-score');
  const overBest = el('div', 'mg-over-best');
  overScreen.append(overScore, overBest);
  const againBtn = el('button', 'mg-btn mg-btn-big', 'Tekrar Oyna');
  againBtn.type = 'button';
  const shareBtn = el('button', 'mg-btn mg-btn-ghost', 'Paylaş');
  shareBtn.type = 'button';
  overScreen.append(againBtn, shareBtn);

  // pause screen
  const pauseScreen = el('div', 'mg-screen mg-pause');
  pauseScreen.append(el('div', 'mg-over-title', 'DURAKLATILDI'));
  const resumeBtn = el('button', 'mg-btn mg-btn-big', 'Devam');
  resumeBtn.type = 'button';
  pauseScreen.append(resumeBtn);

  rootEl.append(startScreen, overScreen, pauseScreen);
  setScreen('start');

  // ---------------------------------------------------------------- sizing
  function resize() {
    const rect = rootEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = rect.width;
    H = rect.height;
    // keep the play field portrait (~9:14); center it in a wider desktop box
    pfW = Math.min(W, H * (9 / 14));
    pfX = (W - pfW) / 2;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = pfW;
    state.height = H;
    player.x = G.clamp(player.x, 20, pfW - 20);
    seedClouds();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(rootEl);
  resize();
  player.x = pfW / 2; // center Musty for the start screen

  // ------------------------------------------------------------- sprite load
  SPRITE_KEYS.forEach((key) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const box = tightBox(img);
      sprites[key] = { img, box, red: tinted(img, '#ff2b2b') };
    };
    img.src = `assets/sprites/${key}.png`;
  });

  // -------------------------------------------------------------- inputs
  let keys = { left: false, right: false };
  let steering = false;
  let targetX = 0;

  function onKeyDown(e) {
    if (!visible) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = true; e.preventDefault(); }
    else if (k === ' ' || k === 'Enter') { e.preventDefault(); primaryAction(); }
    else if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); togglePause(); }
    else if (k === 'm' || k === 'M') { audio.toggleMute(); }
  }
  function onKeyUp(e) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
  }

  function pointerX(e) {
    const r = rootEl.getBoundingClientRect();
    return (e.clientX - r.left) - pfX; // play-field-local x
  }
  function onPointerDown(e) {
    if (mode !== 'playing') return;
    if (e.target.closest && e.target.closest('button')) return;
    steering = true;
    targetX = pointerX(e);
  }
  function onPointerMove(e) {
    targetX = pointerX(e);
  }
  function onPointerUp() { steering = false; }

  function addKeyListeners() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }
  function removeKeyListeners() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  // visibility: pause when scrolled out of view or tab hidden
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) addKeyListeners();
    else { removeKeyListeners(); if (mode === 'playing') { mode = 'paused'; setScreen('paused'); } }
  }, { threshold: 0.05 });
  io.observe(rootEl);

  function onVisibility() {
    if (document.hidden && mode === 'playing') { mode = 'paused'; setScreen('paused'); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  // -------------------------------------------------------------- buttons
  startBtn.addEventListener('click', startGame);
  againBtn.addEventListener('click', startGame);
  resumeBtn.addEventListener('click', () => { if (mode === 'paused') { mode = 'playing'; last = performance.now(); setScreen(null); } });
  pauseBtn.addEventListener('click', togglePause);
  fsBtn.addEventListener('click', toggleFullscreen);
  muteBtn.addEventListener('click', () => audio.toggleMute());
  shareBtn.addEventListener('click', shareScore);

  audio.onMuteChange(() => { muteBtn.textContent = muteIcon(); });

  rootEl.addEventListener('pointerdown', onPointerDown);
  rootEl.addEventListener('pointermove', onPointerMove);
  rootEl.addEventListener('pointerup', onPointerUp);
  rootEl.addEventListener('pointercancel', onPointerUp);

  // -------------------------------------------------------------- flow
  function primaryAction() {
    if (mode === 'start' || mode === 'gameover') startGame();
    else if (mode === 'paused') { mode = 'playing'; last = performance.now(); setScreen(null); }
  }

  function togglePause() {
    if (mode === 'playing') { mode = 'paused'; setScreen('paused'); }
    else if (mode === 'paused') { mode = 'playing'; last = performance.now(); setScreen(null); }
  }

  function startGame() {
    audio.unlock();
    const startLine = audio.playVoice('start');
    if (startLine) showBubble(startLine);
    startBest = best;
    G.reset(state, best);
    resetFx();
    player.x = pfW / 2;
    player.vx = 0; player.facing = 1; player.moving = false;
    player.dead = false; player.deathT = 0; player.hitFlash = 0;
    spawnTimer = 0.6;
    mode = 'playing';
    last = performance.now();
    setScreen(null);
    updateHud();
  }

  function gameOverNow() {
    mode = 'dead';
    player.dead = true;
    player.deathT = 0;
    audio.playVoice('over');
    audio.playSfx('sad');
    if (state.score > best) {
      best = state.score;
      saveBest(best);
    }
  }

  function shareScore() {
    const text = `İndirim Yağmuru'nda ${state.score} puan topladım! 🛍️ Rekor: ${best}. Sen de dene!`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => flashShare(shareBtn)).catch(() => flashShare(shareBtn));
    } else {
      flashShare(shareBtn);
    }
  }

  // -------------------------------------------------------------- game update
  function update(dt) {
    // spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      G.spawnTag(state);
      spawnTimer = state.spawnInterval * (0.85 + Math.random() * 0.3);
    }

    // tags + collisions
    for (let i = state.tags.length - 1; i >= 0; i--) {
      const t = state.tags[i];
      const fell = G.stepTag(t, state, dt);
      if (fell) {
        state.tags.splice(i, 1);
        if (t.kind === 'good') addFloater(t.x, H - 30, 'kaçırdın', '#999');
        continue;
      }
      if (G.collides(player.x, playerY(), playerR(), t)) {
        state.tags.splice(i, 1);
        if (t.kind === 'good') handleCatch(t);
        else handleHit(t);
        if (state.gameOver) break;
      }
    }

    movePlayer(dt);

    const lvl = G.tick(state, dt);
    if (lvl) onLevelUp(lvl);

    // timers
    if (shakeT > 0) shakeT -= dt;
    if (speedLinesT > 0) speedLinesT -= dt;
    if (player.hitFlash > 0) player.hitFlash -= dt;
    if (bubble && performance.now() / 1000 > bubble.until) bubble = null;

    updateHud();
  }

  function handleCatch(t) {
    const r = G.onCatch(state, t);
    burst(t.x, t.y, '#ffd23f', 14);
    addFloater(t.x, t.y, `+%${t.percent}${r.mult > 1 ? ' x' + r.mult : ''}`, '#111');
    const force = r.combo === 1 || t.percent === 50;
    const v = audio.playVoice('good', { force });
    if (v) showBubble(v);
    audio.playSfx('ping');
    if (state.newBest) { state.newBest = false; confetti(); saveBest(state.best); best = state.best; }
  }

  function handleHit(t) {
    const r = G.onHit(state, t);
    player.hitFlash = 0.4;
    shake(0.5, 12);
    burst(player.x, player.y, '#ff2b2b', 16);
    const v = audio.playVoice('bad');
    if (v) showBubble(v);
    audio.playSfx('thud');
    if (r.dead) gameOverNow();
  }

  function movePlayer(dt) {
    const maxSpeed = H * 0.9;
    if (steering) {
      // pointer steers: lerp toward the pointer's x; keep vx as a smooth estimate
      const prevX = player.x;
      player.x += (targetX - player.x) * Math.min(1, 16 * dt);
      player.vx = (player.x - prevX) / Math.max(dt, 1e-4);
    } else {
      if (keys.left || keys.right) {
        const dir = keys.left ? -1 : 1;
        player.vx += dir * H * 9 * dt;
        player.vx = G.clamp(player.vx, -maxSpeed, maxSpeed);
      } else {
        player.vx *= Math.exp(-10 * dt);
      }
      player.x += player.vx * dt;
    }

    // facing + moving flag for animation
    if (Math.abs(player.vx) > 3) {
      player.facing = player.vx > 0 ? 1 : -1;
      player.moving = true;
    } else {
      player.moving = false;
    }

    player.x = G.clamp(player.x, playerR(), pfW - playerR());
    if (player.moving) player.bob += dt * (14 + Math.abs(player.vx) * 0.1);
  }

  function onLevelUp(lvl) {
    banner.textContent = `HIZLANDIK! · SEVİYE ${lvl.level}`;
    banner.classList.remove('show');
    void banner.offsetWidth; // restart CSS animation
    banner.classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => banner.classList.remove('show'), 1600);
    speedLinesT = 1.3;
    const v = audio.playVoice('speed');
    if (v) showBubble(v);
    audio.playSfx('whoosh');
  }

  // -------------------------------------------------------------- fx helpers
  function resetFx() {
    particles.length = 0;
    floaters.length = 0;
    shakeT = 0; speedLinesT = 0;
    bubble = null;
  }

  function shake(t, mag) { shakeT = t; shakeMag = mag; }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      particles.push({
        type: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.4, t: 0, color, size: 2 + Math.random() * 3,
      });
    }
  }

  function confetti() {
    for (let i = 0; i < 90; i++) {
      particles.push({
        type: 'confetti', x: Math.random() * pfW, y: -20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160,
        life: 2.4 + Math.random() * 1.2, t: 0,
        color: ['#ff2b2b', '#111', '#ffd23f', '#fff'][i % 4],
        size: 5 + Math.random() * 5, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 8,
      });
    }
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 1.1, t: 0 });
  }

  function showBubble(v) {
    bubble = { text: v.short, until: performance.now() / 1000 + v.duration };
  }

  // -------------------------------------------------------------- rendering
  function playerH() { return H * 0.27; }
  function groundY() { return H * 0.93; }
  function playerY() { return groundY() - playerH() * 0.5; }
  function playerR() { return playerH() * 0.26; }

  function render(time, dt) {
    ctx.clearRect(0, 0, W, H);

    // camera shake
    ctx.save();
    if (shakeT > 0) {
      const m = shakeMag * (shakeT / 0.5);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    drawBackground(time, dt); // full box (stripes / floating "%")

    // world (play field) is centered on desktop
    ctx.save();
    ctx.translate(pfX, 0);

    drawGround();
    drawTags();

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.type === 'confetti' ? 30 : 240) * dt;
      if (p.type === 'confetti') p.rot += p.vr * dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      drawParticle(p);
    }

    drawFloaters(dt);
    drawSpeedLines();
    drawMusty();
    drawBubble();

    ctx.restore(); // play field
    ctx.restore(); // shake
  }

  function drawBackground(time, dt) {
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Çarşı diagonal stripes (parallax scroll)
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.45);
    const diag = Math.hypot(W, H);
    const s = 58;
    const off = (time * 8) % s;
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#1a1a1a';
    for (let x = -diag / 2 + off - s; x < diag / 2; x += s) {
      ctx.fillRect(x, -diag / 2, s * 0.55, diag);
    }
    // a single red accent stripe
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#d92626';
    const off2 = (time * 8 + s * 0.5) % s;
    ctx.fillRect(-diag / 2 + off2 - s, -diag / 2, s * 0.14, diag);
    ctx.restore();

    // floating "%" clouds
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(26,26,26,0.10)';
    ctx.font = `800 ${16}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of clouds) {
      c.y -= c.v * dt;
      if (c.y < -30) { c.y = H + 30; c.x = Math.random() * W; }
      ctx.globalAlpha = c.a;
      ctx.font = `800 ${c.size}px ${FONT}`;
      ctx.fillText('%', c.x, c.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    const gy = groundY();
    ctx.fillStyle = '#e8e0d2';
    ctx.fillRect(-20, gy, pfW + 40, H - gy + 20);
    ctx.strokeStyle = 'rgba(26,26,26,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, gy);
    ctx.lineTo(pfW + 20, gy);
    ctx.stroke();

    // soft shadow under Musty
    const p = player;
    const bobK = p.moving ? Math.abs(Math.sin(p.bob)) : 0;
    const sx = G.clamp(player.x, 20, pfW - 20);
    const sw = Math.max(1, playerH() * 0.42 * (1 - bobK * 0.12));
    ctx.fillStyle = 'rgba(26,26,26,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx, gy + 6, sw, sw * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTags() {
    for (const t of state.tags) drawTag(t);
  }

  function drawTag(t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);

    const { w, h } = t;
    const body = t.kind === 'good' ? '#161616' : '#d92626';

    // string
    ctx.strokeStyle = 'rgba(26,26,26,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.95);
    ctx.lineTo(0, -h * 0.5);
    ctx.stroke();

    // body
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.18);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();

    // punched hole
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(0, -h * 0.32, w * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // text
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(h * 0.38)}px ${FONT}`;
    ctx.fillText(`%${t.percent}`, 0, h * 0.06);

    // "!" mark for traps
    if (t.kind === 'bad') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(w * 0.32, h * 0.3, h * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d92626';
      ctx.font = `800 ${Math.round(h * 0.24)}px ${FONT}`;
      ctx.fillText('!', w * 0.32, h * 0.3);
    }

    ctx.restore();
  }

  function drawParticle(p) {
    const a = 1 - p.t / p.life;
    if (p.type === 'spark') {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt;
      f.y -= 40 * dt;
      if (f.t >= f.life) { floaters.splice(i, 1); continue; }
      const a = 1 - f.t / f.life;
      ctx.globalAlpha = a;
      ctx.font = `800 ${20}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(244,239,230,0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawSpeedLines() {
    if (speedLinesT <= 0) return;
    const a = Math.min(1, speedLinesT);
    ctx.strokeStyle = 'rgba(26,26,26,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const y = (i / 10) * H;
      const x = Math.random() * pfW;
      ctx.globalAlpha = a * (0.3 + Math.random() * 0.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 60 - Math.random() * 40, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMusty() {
    const key = player.dead
      ? (player.facing >= 0 ? 'right' : 'left')
      : (player.moving ? (player.facing >= 0 ? 'right' : 'left') : 'front');
    const ph = playerH();
    const bob = player.moving ? Math.sin(player.bob) * ph * 0.03 : 0;
    const gy = groundY();

    if (player.dead) {
      const t = Math.min(player.deathT / 1.2, 1);
      const angle = -Math.PI / 2 * easeOut(t);
      const alpha = 1 - t * t;
      ctx.save();
      ctx.globalAlpha = Math.max(alpha, 0);
      ctx.translate(player.x, gy);
      ctx.rotate(angle);
      drawSprite(ctx, key, 0, 0, ph, 0, false, 1, 1);
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }

    const squash = player.moving ? 0.06 : 0;
    const sx = 1 - squash;
    const sy = 1 + squash;
    const hit = player.hitFlash > 0 && Math.floor(player.hitFlash * 24) % 2 === 0;
    drawSprite(ctx, key, player.x, gy + 6 + bob, ph, bob, hit, sx, sy);
  }

  function drawSprite(ctx, key, cx, feetY, ph, bob, hit, sx, sy) {
    const spr = sprites[key];
    if (!spr) {
      // placeholder before the sprite loads
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#c7bfae';
      ctx.beginPath();
      ctx.arc(cx, feetY - ph / 2, ph * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const scale = ph / spr.box.h;
    const dw = spr.box.w * scale;
    const dh = ph;
    ctx.save();
    ctx.translate(cx, feetY - bob * 0.2);
    ctx.scale(sx, sy);
    const src = hit && spr.red ? spr.red : spr.img;
    ctx.drawImage(src, spr.box.x, spr.box.y, spr.box.w, spr.box.h, -dw / 2, -dh, dw, dh);
    ctx.restore();
  }

  function drawBubble() {
    if (!bubble) return;
    const ph = playerH();
    const bx = G.clamp(player.x, 70, pfW - 70);
    const by = groundY() - ph - 26;
    const txt = bubble.text;
    ctx.font = `800 ${15}px ${FONT}`;
    const tw = ctx.measureText(txt).width;
    const bw = tw + 26;
    const bh = 34;

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 2.5;
    roundRect(ctx, bx - bw / 2, by - bh, bw, bh, 12);
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.beginPath();
    ctx.moveTo(bx - 8, by);
    ctx.lineTo(bx + 2, by + 12);
    ctx.lineTo(bx + 12, by);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#161616';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${15}px ${FONT}`;
    ctx.fillText(txt, bx, by - bh / 2);
    ctx.restore();
  }

  // -------------------------------------------------------------- HUD / DOM
  function updateHud() {
    scoreEl.textContent = String(state.score);
    bestEl.textContent = `Rekor: ${best}`;
    levelBadge.textContent = `SEVİYE ${state.level}`;
    hpNum.textContent = String(state.hp);
    hpBar.style.width = (state.hp / G.HP_MAX) * 100 + '%';
    hpBar.classList.toggle('mg-low', state.hp <= 30);
    if (state.combo > 1) {
      comboEl.textContent = `KOMBO x${G.comboMultiplier(state.combo)}`;
      comboEl.classList.add('show');
    } else {
      comboEl.classList.remove('show');
    }
  }

  function setScreen(name) {
    startScreen.classList.toggle('on', name === 'start');
    overScreen.classList.toggle('on', name === 'gameover');
    pauseScreen.classList.toggle('on', name === 'paused');
  }

  function toggleFullscreen() {
    const el = rootEl;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  // -------------------------------------------------------------- misc
  function seedClouds() {
    clouds.length = 0;
    const n = Math.max(4, Math.floor(W / 60));
    for (let i = 0; i < n; i++) {
      clouds.push({
        x: Math.random() * W,
        y: Math.random() * H,
        v: 8 + Math.random() * 16,
        size: 14 + Math.random() * 18,
        a: 0.05 + Math.random() * 0.1,
      });
    }
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  // -------------------------------------------------------------- main loop
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min((ts - last) / 1000, 1 / 20);
    last = ts;
    const time = ts / 1000;

    if (mode === 'playing' && visible) update(dt);
    if (mode === 'dead') {
      player.deathT += dt;
      if (player.deathT >= 1.25) {
        mode = 'gameover';
        overScore.textContent = `${state.score} PUAN`;
        const isNew = state.score > startBest && state.score > 0;
        overBest.textContent = isNew ? `🎉 YENİ REKOR: ${best}` : `Rekor: ${best}`;
        setScreen('gameover');
      }
    }

    render(time, dt);
  }

  requestAnimationFrame((ts) => { last = ts; frame(ts); });

  // -------------------------------------------------------------- utils
  function el(tag, cls, content) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (content == null) return e;
    if (Array.isArray(content)) { for (const c of content) e.append(c); }
    else if (typeof content === 'string') e.textContent = content;
    else e.append(content);
    return e;
  }

  function btn(text, cls, aria) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.setAttribute('aria-label', aria);
    return b;
  }

  function muteIcon() { return audio.muted ? '🔇' : '🔊'; }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // compute tight alpha bounding box of a transparent-PNG sprite
  function tightBox(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        if (data[(y * c.width + x) * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return { x: 0, y: 0, w: c.width, h: c.height };
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  // red-tinted copy of a sprite (for the hit flash)
  function tinted(img, color) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function loadBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; }
    catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) {}
  }

  function flashShare(btnEl) {
    const old = btnEl.textContent;
    btnEl.textContent = 'Kopyalandı! ✅';
    setTimeout(() => { btnEl.textContent = old; }, 1200);
  }

  // expose a tiny handle for debugging/tests (non-DOM, harmless)
  return { get state() { return state; } };
}
