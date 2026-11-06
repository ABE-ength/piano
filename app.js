'use strict';
const VERSION = '2.0.0';
const $ = s => document.querySelector(s);
const app = $('#app');

/* ================= せってい ================= */
const S = { mode: 'wait', speed: 1, volume: 0.85, labels: true, guide: true };
try { Object.assign(S, JSON.parse(localStorage.getItem('piano2.settings') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('piano2.settings', JSON.stringify(S)); } catch (e) {} };

/* ================= 横画面にする ================= */
// 縦向きで開いても、画面全体を90度回して横画面のレイアウトで表示する
function layout() {
  const iw = innerWidth, ih = innerHeight, portrait = ih > iw;
  const W = portrait ? ih : iw, H = portrait ? iw : ih;
  app.style.width = W + 'px'; app.style.height = H + 'px';
  app.style.transform = portrait ? `translate(${iw}px,0) rotate(90deg)` : 'none';
  app.classList.toggle('compact', H <= 440);
  app.classList.toggle('narrow', W <= 760);
}
addEventListener('resize', layout);
layout();
function tryLockLandscape() {
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}

/* ================= 音名・色 ================= */
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
const JA = ['ド', 'ド', 'レ', 'レ', 'ミ', 'ファ', 'ファ', 'ソ', 'ソ', 'ラ', 'ラ', 'シ'];
const COLOR = ['#ff5a5a', '#ff7a45', '#ff9f1c', '#f4b400', '#f2c200', '#4cc94c', '#2fbf9a', '#29b6f6', '#3d8bff', '#5c6bff', '#8e6bff', '#c45cff'];
const LOW = 60, HIGH = 76;                       // ド(C4)〜ミ(E5)

/* ================= ピアノの音（本物のグランドピアノの録音） ================= */
const SAMPLES = [['C3', 48], ['Ds3', 51], ['Fs3', 54], ['A3', 57], ['C4', 60], ['Ds4', 63], ['Fs4', 66],
  ['A4', 69], ['C5', 72], ['Ds5', 75], ['Fs5', 78], ['A5', 81], ['C6', 84]];
class Piano {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.buf = new Map(); this.voices = new Map();
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.25;
    this.bus = c.createGain();
    const conv = c.createConvolver(); conv.buffer = this.impulse(1.8);
    const wet = c.createGain(); wet.gain.value = 0.12;
    this.bus.connect(this.master); this.bus.connect(conv).connect(wet).connect(this.master);
    this.master.connect(comp).connect(c.destination);
    this.setVolume(S.volume);
  }
  impulse(sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  setVolume(v) { this.master.gain.value = v; }
  async load() {
    await Promise.all(SAMPLES.map(async ([name, m]) => {
      const ab = await (await fetch(`samples/${name}.mp3`)).arrayBuffer();
      const b = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
      this.buf.set(m, b);
    }));
  }
  unlock() { if (this.ctx.state !== 'running') this.ctx.resume(); }
  noteOn(m, vel = 0.9) {
    if (!this.buf.size) return;
    const c = this.ctx, t = c.currentTime;
    let best = null, bd = 99;
    for (const s of this.buf.keys()) { const d = Math.abs(m - s); if (d < bd) { bd = d; best = s; } }
    const old = this.voices.get(m);
    if (old) this.release(old, 0.04);
    if (this.voices.size > 20) this.release(this.voices.values().next().value, 0.03);
    const src = c.createBufferSource();
    src.buffer = this.buf.get(best);
    src.playbackRate.value = Math.pow(2, (m - best) / 12);
    const g = c.createGain(); g.gain.value = 2.4 * vel;
    src.connect(g).connect(this.bus);
    src.start(t, 0.012);                          // 録音の頭の無音を少し飛ばす
    const v = { m, src, g, off: false };
    src.onended = () => { if (this.voices.get(m) === v) this.voices.delete(m); g.disconnect(); };
    this.voices.set(m, v);
  }
  noteOff(m) { const v = this.voices.get(m); if (v) this.release(v, 0.22); }
  release(v, tc) {
    if (v.off) return; v.off = true;
    const t = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.setTargetAtTime(0, t, tc);
    try { v.src.stop(t + tc * 8); } catch (e) {}
    if (this.voices.get(v.m) === v) this.voices.delete(v.m);
  }
  allOff() { for (const v of [...this.voices.values()]) this.release(v, 0.05); }
}
const piano = new Piano();
piano.load().then(() => $('#loading').classList.add('gone'))
  .catch(() => { $('#loading p').textContent = 'よみこめませんでした。ネットにつないで ひらきなおしてね'; });
setTimeout(() => $('#loading').classList.add('gone'), 8000);   // 念のため

/* ================= 鍵盤 ================= */
const kb = $('#kb'), fx = $('#fx');
const keyEls = new Map();
function buildKeys() {
  kb.innerHTML = ''; keyEls.clear();
  kb.classList.toggle('nolabels', !S.labels);
  const whites = []; for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) whites.push(m);
  const w = 100 / whites.length;
  whites.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'key white'; el.dataset.m = m;
    el.style.left = i * w + '%'; el.style.width = w + '%'; el.style.setProperty('--c', COLOR[m % 12]);
    el.innerHTML = `<div class="tab">${JA[m % 12]}</div>`;
    if (i === 0) el.style.borderLeft = '0';
    kb.appendChild(el); keyEls.set(m, el);
    if (i < whites.length - 1 && isBlack(m + 1)) {
      const b = document.createElement('div');
      const bw = w * 0.58;
      b.className = 'key black'; b.dataset.m = m + 1;
      b.style.left = ((i + 1) * w - bw / 2) + '%'; b.style.width = bw + '%';
      b.style.setProperty('--c', COLOR[(m + 1) % 12]);
      kb.appendChild(b); keyEls.set(m + 1, b);
    }
  });
}
buildKeys();

// 鍵盤の位置（#fx の中の座標）
function keyPos(m) {
  const el = keyEls.get(m); if (!el) return null;
  return { x: el.offsetLeft + el.offsetWidth / 2 + 6, top: el.offsetTop + 12, h: el.offsetHeight };
}

const NOTES = ['♪', '♫', '♬', '★', '♥'];
function noteFx(m) {
  const p = keyPos(m); if (!p || fx.childElementCount > 24) return;
  const s = document.createElement('span');
  s.className = 'note-fx'; s.textContent = NOTES[Math.floor(Math.random() * NOTES.length)];
  s.style.left = p.x + 'px'; s.style.top = (p.top + p.h * 0.25) + 'px'; s.style.color = COLOR[m % 12];
  fx.appendChild(s); setTimeout(() => s.remove(), 1100);
}
function sparkFx(m) {
  const p = keyPos(m); if (!p) return;
  const s = document.createElement('span');
  s.className = 'spark'; s.textContent = '✨';
  s.style.left = p.x + 'px'; s.style.top = (p.top + p.h * 0.35) + 'px';
  fx.appendChild(s); setTimeout(() => s.remove(), 700);
}

const buddy = $('#buddy');
function hop() { if (buddy.classList.contains('dance')) return; buddy.classList.remove('hop'); void buddy.offsetWidth; buddy.classList.add('hop'); }

/* ================= タッチで弾く ================= */
const downCount = new Map(), pointers = new Map();
function press(m) {
  downCount.set(m, (downCount.get(m) || 0) + 1);
  keyEls.get(m)?.classList.add('down');
  piano.noteOn(m, 0.9);
  noteFx(m); hop();
  song.onPress(m);
}
function release(m) {
  const n = (downCount.get(m) || 0) - 1;
  if (n > 0) { downCount.set(m, n); return; }
  downCount.delete(m);
  keyEls.get(m)?.classList.remove('down');
  if (!song.guideNotes.has(m)) piano.noteOff(m);
}
function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const k = el && el.closest && el.closest('.key');
  return k && kb.contains(k) ? +k.dataset.m : null;
}
function handle(e, isDown) {
  const m = keyAt(e.clientX, e.clientY);
  const prev = pointers.get(e.pointerId);
  if (!isDown && prev === m) return;
  if (prev != null) release(prev);
  if (m != null) press(m);
  pointers.set(e.pointerId, m);
}
kb.addEventListener('pointerdown', e => {
  e.preventDefault(); piano.unlock(); tryLockLandscape();
  try { kb.setPointerCapture(e.pointerId); } catch (err) {}
  handle(e, true);
});
kb.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) handle(e, false); });
const up = e => { const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (p != null) release(p); };
kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerdown', () => piano.unlock(), { capture: true });

/* ================= うた（10曲） ================= */
// 音名:拍（拍を省くと1拍）。著作権の切れた曲・昔からの歌のメロディです。
const SONGS = [
  { id: 'kira', e: '⭐', t: 'きらきらぼし', b: '#fff3b8', bpm: 100,
    n: 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2' },
  { id: 'kaeru', e: '🐸', t: 'かえるのうた', b: '#d6f5c9', bpm: 110,
    n: 'C4 D4 E4 F4 E4 D4 C4:2 E4 F4 G4 A4 G4 F4 E4:2 C4:2 C4:2 C4:2 C4:2 C4:.5 C4:.5 D4:.5 D4:.5 E4:.5 E4:.5 F4:.5 F4:.5 E4 D4 C4:2' },
  { id: 'mary', e: '🐑', t: 'メリーさんのひつじ', b: '#f3ecff', bpm: 110,
    n: 'E4:1.5 D4:.5 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4:1.5 D4:.5 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4' },
  { id: 'chou', e: '🦋', t: 'ちょうちょう', b: '#ffe0ef', bpm: 110,
    n: 'G4 E4 E4:2 F4 D4 D4:2 C4 D4 E4 F4 G4 G4 G4:2 G4 E4 E4 E4 F4 D4 D4 D4 C4 E4 G4 G4 E4 E4 E4:2 D4 D4 D4 D4 D4 E4 F4:2 E4 E4 E4 E4 E4 F4 G4:2 G4 E4 E4:2 F4 D4 D4:2 C4 E4 G4 G4 C4:4' },
  { id: 'london', e: '🌉', t: 'ロンドンばし', b: '#e0f1ff', bpm: 110,
    n: 'G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4:2 G4:2 E4 C4:3' },
  { id: 'joy', e: '🎵', t: 'よろこびのうた', b: '#fff0d6', bpm: 110,
    n: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2' },
  { id: 'jingle', e: '🔔', t: 'ジングルベル', b: '#ffdcdc', bpm: 130,
    n: 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 E4 D4 D4 E4 D4:2 G4:2 E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4 F4 F4 E4 E4 E4:.5 E4:.5 G4 G4 F4 D4 C4:4' },
  { id: 'birthday', e: '🎂', t: 'ハッピーバースデー', b: '#ffe8c2', bpm: 100,
    n: 'C4:.75 C4:.25 D4 C4 F4 E4:2 C4:.75 C4:.25 D4 C4 G4 F4:2 C4:.75 C4:.25 C5 A4 F4 E4 D4 Bb4:.75 Bb4:.25 A4 F4 G4 F4:3' },
  { id: 'farm', e: '🐮', t: 'ゆかいな まきば', b: '#e9f7d4', bpm: 120,
    n: 'F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:3 C4 F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:4' },
  { id: 'row', e: '⛵', t: 'こげこげボート', b: '#d9f4ff', bpm: 110,
    n: 'C4:1.5 C4:1.5 C4 D4:.5 E4:1.5 E4 D4:.5 E4 F4:.5 G4:3 C5:.5 C5:.5 C5:.5 G4:.5 G4:.5 G4:.5 E4:.5 E4:.5 E4:.5 C4:.5 C4:.5 C4:.5 G4 F4:.5 E4 D4:.5 C4:3' },
];
const NAME = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function parse(str) {
  return str.trim().split(/\s+/).map(tok => {
    const [n, d] = tok.split(':');
    const mm = /^([A-G])(b|#)?(\d)$/.exec(n);
    const m = 12 * (+mm[3] + 1) + NAME[mm[1]] + (mm[2] === 'b' ? -1 : mm[2] === '#' ? 1 : 0);
    return { m, d: d ? parseFloat(d) : 1 };
  });
}
SONGS.forEach(s => s.notes = parse(s.n));

/* ================= うたの進め方 ================= */
const star = document.createElement('div'); star.className = 'star hidden'; star.textContent = '⭐'; fx.appendChild(star);
const song = {
  cur: null, idx: 0, timers: [], guideNotes: new Set(), lit: null,
  start(s) {
    this.stop(true);
    this.cur = s; this.idx = 0;
    $('#now').classList.remove('hidden');
    $('#nowEmoji').textContent = s.e; $('#nowTitle').textContent = s.t;
    $('#songBtn').classList.add('hidden'); $('#stopBtn').classList.remove('hidden');
    this.progress();
    if (S.mode === 'wait') this.light(s.notes[0].m);
    else this.playAlong();
  },
  stop(silent) {
    this.timers.forEach(clearTimeout); this.timers = [];
    for (const m of this.guideNotes) piano.noteOff(m);
    this.guideNotes.clear();
    this.light(null);
    this.cur = null;
    $('#now').classList.add('hidden');
    $('#songBtn').classList.remove('hidden'); $('#stopBtn').classList.add('hidden');
  },
  light(m) {
    if (this.lit != null) keyEls.get(this.lit)?.classList.remove('target');
    this.lit = m;
    if (m == null) { star.classList.add('hidden'); return; }
    keyEls.get(m)?.classList.add('target');
    const p = keyPos(m);
    star.style.left = p.x + 'px'; star.style.top = p.top + 'px';
    star.classList.remove('hidden');
  },
  progress() { $('#barFill').style.width = (this.cur ? this.idx / this.cur.notes.length * 100 : 0) + '%'; },
  onPress(m) {
    if (!this.cur || S.mode !== 'wait') return;
    if (m !== this.cur.notes[this.idx].m) return;
    sparkFx(m);
    this.idx++; this.progress();
    if (this.idx >= this.cur.notes.length) { this.light(null); this.timers.push(setTimeout(() => this.finish(), 600)); }
    else this.light(this.cur.notes[this.idx].m);
  },
  playAlong() {
    const s = this.cur, beat = 60 / (s.bpm * S.speed) * 1000;
    let t = 500;
    s.notes.forEach((n, i) => {
      const dur = n.d * beat;
      this.timers.push(setTimeout(() => {
        this.light(n.m); this.idx = i + 1; this.progress();
        if (S.guide) { piano.noteOn(n.m, 0.55); this.guideNotes.add(n.m); }
      }, t));
      this.timers.push(setTimeout(() => {
        if (this.lit === n.m) this.light(null);
        if (S.guide) { this.guideNotes.delete(n.m); if (!downCount.has(n.m)) piano.noteOff(n.m); }
      }, t + dur * 0.88));
      t += dur;
    });
    this.timers.push(setTimeout(() => this.finish(), t + 500));
  },
  finish() {
    const s = this.cur;
    this.stop(true);
    this.last = s;
    celebrate();
  },
};

/* ================= できたね ================= */
function celebrate() {
  show('#done');
  buddy.classList.add('dance');
  const box = $('#confetti'); box.innerHTML = '';
  const items = ['🎉', '⭐', '🎈', '🌸', '🍬', '✨', '🎵', '💖'];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement('span');
    c.className = 'conf'; c.textContent = items[i % items.length];
    c.style.left = Math.random() * 100 + '%';
    c.style.animationDuration = (2.2 + Math.random() * 2) + 's';
    c.style.animationDelay = Math.random() * 1.2 + 's';
    box.appendChild(c);
  }
  // ジャーン♪（ドミソド）
  [[60, 0], [64, 90], [67, 180], [72, 270]].forEach(([m, d]) => setTimeout(() => piano.noteOn(m, 0.7), d));
}

/* ================= 画面の切り替え ================= */
let shownAt = 0;
function show(id) { document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); $(id).classList.remove('hidden'); shownAt = performance.now(); }
function hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); buddy.classList.remove('dance'); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = hideAll);
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o && performance.now() - shownAt > 500) hideAll(); }));

const grid = $('#songGrid');
SONGS.forEach(s => {
  const b = document.createElement('button');
  b.className = 'song'; b.style.setProperty('--b', s.b);
  b.innerHTML = `<span class="e">${s.e}</span><span>${s.t}</span>`;
  b.onclick = () => { piano.unlock(); hideAll(); song.start(s); };
  grid.appendChild(b);
});
$('#songBtn').onclick = () => { piano.unlock(); show('#picker'); };
$('#stopBtn').onclick = () => song.stop();
$('#againBtn').onclick = () => { hideAll(); if (song.last) song.start(song.last); };
$('#otherBtn').onclick = () => show('#picker');

function seg(id, key, conv, after) {
  const el = $(id);
  const mark = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('sel', conv(b.dataset.v) === S[key]));
  el.querySelectorAll('button').forEach(b => b.onclick = () => { S[key] = conv(b.dataset.v); save(); mark(); after && after(); });
  mark();
}
function modeChanged() {
  $('#speedSeg').classList.toggle('hidden', S.mode !== 'along');
  if (song.cur) song.start(song.cur);            // 曲の途中なら、はじめからやり直す
}
seg('#modeSeg', 'mode', v => v, modeChanged);
seg('#speedSeg', 'speed', v => +v, () => { if (song.cur && S.mode === 'along') song.start(song.cur); });
$('#speedSeg').classList.toggle('hidden', S.mode !== 'along');

/* おとな用せってい：⚙をながおし */
let lp = null;
const setBtn = $('#setBtn');
setBtn.addEventListener('pointerdown', () => { lp = setTimeout(() => { lp = null; show('#settings'); }, 800); });
const cancelLp = () => { if (lp) { clearTimeout(lp); lp = null; toast('おとなの人は ながおし してね'); } };
setBtn.addEventListener('pointerup', cancelLp);
setBtn.addEventListener('pointerleave', () => { if (lp) { clearTimeout(lp); lp = null; } });
const vol = $('#volume'); vol.value = S.volume;
vol.oninput = () => { S.volume = +vol.value; piano.setVolume(S.volume); save(); };
const lab = $('#labels'); lab.checked = S.labels;
lab.onchange = () => { S.labels = lab.checked; save(); buildKeys(); if (song.lit != null) { const m = song.lit; song.lit = null; song.light(m); } };
const gd = $('#guide'); gd.checked = S.guide;
gd.onchange = () => { S.guide = gd.checked; save(); };
$('#ver').textContent = VERSION;

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

// 星の位置を画面の大きさに合わせ直す
addEventListener('resize', () => { if (song.lit != null) { const m = song.lit; song.lit = null; song.light(m); } });

// アプリが裏に回ったら止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pointers.clear(); downCount.clear(); piano.allOff();
    document.querySelectorAll('.key.down').forEach(k => k.classList.remove('down'));
    if (song.cur && S.mode === 'along') song.stop();
  } else keepAwake();
});
async function keepAwake() { try { if ('wakeLock' in navigator && !document.hidden) await navigator.wakeLock.request('screen'); } catch (e) {} }
kb.addEventListener('pointerdown', keepAwake, { once: true });

// オフライン対応・自動更新
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  let reloaded = !navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || downCount.size || song.cur) return;
    reloaded = true; location.reload();
  });
}
