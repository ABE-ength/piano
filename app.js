'use strict';
const VERSION = '1.0.2';
const $ = s => document.querySelector(s);

/* ================= 音域・音名 ================= */
const MIN = 21, MAX = 108;                       // A0〜C8（88鍵）
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
const WHITES = [];
for (let m = MIN; m <= MAX; m++) if (!isBlack(m)) WHITES.push(m);   // 52鍵
const JA = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];
const EN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const oct = m => Math.floor(m / 12) - 1;
const nameEn = m => EN[m % 12] + oct(m);
const whiteIdx = m => WHITES.indexOf(m);

/* ================= 設定 ================= */
const DEF = {
  start: whiteIdx(48),                           // C3
  countL: 15, countP: 8,                         // 横向き・縦向きの鍵盤の数
  labels: 'doremi', timbre: 'piano', volume: 0.8,
  reverb: true, velocity: true, gliss: true, rotateHint: true,
};
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem('piano.settings') || '{}')); } catch (e) {}
const portrait = () => innerHeight > innerWidth;
Object.defineProperty(S, 'count', {
  get() { return portrait() ? S.countP : S.countL; },
  set(v) { if (portrait()) S.countP = v; else S.countL = v; },
  enumerable: false,
});
const save = () => { try { localStorage.setItem('piano.settings', JSON.stringify(S)); } catch (e) {} };

/* ================= 音源（Web Audio） ================= */
class Synth {
  constructor() { this.ctx = null; this.voices = new Map(); this.sustain = false; this.pressed = new Set(); }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    this.bus = c.createGain();
    this.dry = c.createGain(); this.wet = c.createGain();
    const conv = c.createConvolver(); conv.buffer = this.impulse(2.4);
    this.bus.connect(this.dry).connect(this.master);
    this.bus.connect(conv).connect(this.wet).connect(this.master);
    this.master.connect(comp).connect(c.destination);
    this.applySettings();

    const wave = h => {
      const re = new Float32Array(h.length), im = new Float32Array(h);
      return c.createPeriodicWave(re, im);
    };
    this.waves = {
      piano: wave([0, 1, 0.55, 0.32, 0.22, 0.14, 0.1, 0.07, 0.05, 0.035, 0.025, 0.018, 0.012]),
      epiano: wave([0, 1, 0.12, 0.04, 0.02]),
      organ: wave([0, 1, 0.75, 0, 0.5, 0, 0.32, 0, 0.22, 0, 0, 0, 0.12]),
    };
    const len = Math.floor(c.sampleRate * 0.05);
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }

  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return b;
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(S.volume * 0.9, t, 0.02);
    this.wet.gain.setTargetAtTime(S.reverb ? 0.22 : 0, t, 0.05);
    this.dry.gain.setTargetAtTime(1, t, 0.05);
  }

  noteOn(m, vel = 0.8) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const old = this.voices.get(m);
    if (old) this.kill(old, 0.015);
    if (this.voices.size >= 32) this.kill(this.voices.values().next().value, 0.02);

    const f = 440 * Math.pow(2, (m - 69) / 12);
    const timbre = S.timbre;
    const lowness = (MAX - m) / (MAX - MIN);           // 1=最低音, 0=最高音
    const amp = g => g * (0.18 + 0.1 * lowness) * (0.35 + 0.65 * vel);
    const out = c.createGain(); out.gain.value = 0;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.6;
    filt.connect(out); out.connect(this.bus);

    const oscs = [];
    const osc = (type, freq, detune, gain) => {
      const o = c.createOscillator();
      if (type in this.waves) o.setPeriodicWave(this.waves[type]); else o.type = type;
      o.frequency.value = freq; o.detune.value = detune;
      const g = c.createGain(); g.gain.value = gain;
      o.connect(g).connect(filt); o.start(t); oscs.push(o);
      return g;
    };

    let life;
    if (timbre === 'organ') {
      osc('organ', f, 0, 0.7); osc('organ', f, 6, 0.3);
      filt.frequency.value = Math.min(9000, f * 10);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(amp(0.8), t + 0.012);
      life = 600;
    } else if (timbre === 'epiano') {
      osc('epiano', f, 0, 0.85);
      const bell = osc('sine', f * 7, 0, 0.18 * vel);
      bell.gain.setTargetAtTime(0, t, 0.05);
      filt.frequency.value = Math.min(12000, f * 8);
      const tc = 0.5 + 2.2 * Math.pow(lowness, 1.3);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(amp(1.1), t + 0.004);
      out.gain.setTargetAtTime(amp(0.5), t + 0.004, 0.2);
      out.gain.setTargetAtTime(0, t + 0.3, tc);
      life = 0.3 + tc * 6;
    } else {                                           // ピアノ
      osc('piano', f, -3, 0.55); osc('piano', f, 3.5, 0.45);
      const bright = Math.min(18000, f * (3 + 12 * vel));
      filt.frequency.setValueAtTime(bright, t);
      const tc = 0.35 + 3.3 * Math.pow(lowness, 1.4);
      filt.frequency.setTargetAtTime(Math.max(f * 2.2, 600), t + 0.01, tc * 0.5);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(amp(1), t + 0.003);
      out.gain.setTargetAtTime(amp(0.42), t + 0.003, 0.12 + 0.25 * lowness);
      out.gain.setTargetAtTime(0, t + 0.35, tc);
      life = 0.35 + tc * 6;
      // ハンマーの打鍵音
      const n = c.createBufferSource(); n.buffer = this.noise;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = Math.min(5000, f * 3); bp.Q.value = 0.8;
      const ng = c.createGain(); ng.gain.value = 0.12 * vel;
      n.connect(bp).connect(ng).connect(this.bus); n.start(t);
    }
    const v = { m, out, oscs, dead: false };
    oscs.forEach(o => o.stop(t + life));
    oscs[0].onended = () => { if (this.voices.get(m) === v) this.voices.delete(m); out.disconnect(); };
    this.voices.set(m, v);
  }

  noteOff(m) {
    this.pressed.delete(m);
    if (this.sustain) return;
    const v = this.voices.get(m);
    if (!v) return;
    // 高い音（E6より上）は本物のピアノと同じく止音が弱い
    const tc = S.timbre === 'organ' ? 0.03 : (m > 88 ? 0.5 : 0.07);
    this.kill(v, tc);
  }

  kill(v, tc) {
    if (v.dead) return;
    v.dead = true;
    const t = this.ctx.currentTime, g = v.out.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
    else { const cur = g.value; g.cancelScheduledValues(t); g.setValueAtTime(cur, t); }
    g.setTargetAtTime(0, t, tc);
    v.oscs.forEach(o => { try { o.stop(t + tc * 8); } catch (e) {} });
    if (this.voices.get(v.m) === v) this.voices.delete(v.m);
  }

  setSustain(on) {
    this.sustain = on;
    if (!on) for (const [m, v] of [...this.voices]) if (!this.pressed.has(m)) this.noteOff(m);
  }

  allOff() { for (const v of [...this.voices.values()]) this.kill(v, 0.05); this.pressed.clear(); }
}
const synth = new Synth();

/* ================= 鍵盤の描画 ================= */
const kb = $('#kb');
const keyEls = new Map();

function clampView() {
  S.count = Math.max(5, Math.min(36, S.count));
  S.start = Math.max(0, Math.min(WHITES.length - S.count, S.start));
}

function label(m) {
  if (S.labels === 'none' || isBlack(m)) return '';
  if (S.labels === 'doremi') {
    return m % 12 === 0 ? `${JA[0]}<span class="oct">${oct(m)}</span>` : JA[m % 12];
  }
  return m % 12 === 0 ? nameEn(m) : EN[m % 12];
}

function render() {
  clampView();
  kb.innerHTML = ''; keyEls.clear();
  const w = 100 / S.count;
  const px = kb.clientWidth / S.count;             // 鍵の幅に合わせて文字の大きさを変える
  kb.style.fontSize = Math.max(9, Math.min(15, px * 0.32)) + 'px';
  for (let i = 0; i < S.count; i++) {
    const m = WHITES[S.start + i];
    const el = document.createElement('div');
    el.className = 'key white' + (m % 12 === 0 ? ' c' : '');
    el.style.left = (i * w) + '%'; el.style.width = w + '%';
    el.dataset.m = m; el.innerHTML = label(m);
    kb.appendChild(el); keyEls.set(m, el);
    if (i < S.count - 1 && isBlack(m + 1)) {
      const b = document.createElement('div');
      b.className = 'key black';
      const bw = w * 0.6;
      b.style.left = ((i + 1) * w - bw / 2) + '%'; b.style.width = bw + '%';
      b.dataset.m = m + 1;
      kb.appendChild(b); keyEls.set(m + 1, b);
    }
  }
  // 押されている鍵の表示を復元
  for (const m of downCount.keys()) keyEls.get(m)?.classList.add('down');
  for (const m of playingNotes) keyEls.get(m)?.classList.add('playing');
  const lo = WHITES[S.start], hi = WHITES[S.start + S.count - 1];
  $('#range').textContent = `${nameEn(lo)}–${nameEn(hi)}`;
  drawMapWin();
  save();
}

/* ================= 音域マップ ================= */
const map = $('#map'), mapWin = $('#mapWin'), mapWrap = $('#mapWrap');
function drawMap() {
  const dpr = devicePixelRatio || 1, W = map.clientWidth, H = map.clientHeight;
  map.width = W * dpr; map.height = H * dpr;
  const g = map.getContext('2d'); g.scale(dpr, dpr);
  const w = W / WHITES.length;
  g.fillStyle = '#ddd'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#888'; g.lineWidth = 0.5;
  WHITES.forEach((m, i) => {
    g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, H); g.stroke();
    if (isBlack(m + 1) && m + 1 <= MAX) { g.fillStyle = '#222'; g.fillRect((i + 1) * w - w * 0.3, 0, w * 0.6, H * 0.6); }
    if (m === 60) { g.fillStyle = '#e85d4a'; g.beginPath(); g.arc(i * w + w / 2, H * 0.8, Math.min(2.5, w / 3), 0, 7); g.fill(); }
  });
}
function drawMapWin() {
  mapWin.style.left = (S.start / WHITES.length * 100) + '%';
  mapWin.style.width = (S.count / WHITES.length * 100) + '%';
}
function mapMove(e) {
  const r = mapWrap.getBoundingClientRect();
  const pos = (e.clientX - r.left) / r.width * WHITES.length;
  const ns = Math.round(pos - S.count / 2);
  if (ns !== S.start) { S.start = ns; render(); }
}
mapWrap.addEventListener('pointerdown', e => { mapWrap.setPointerCapture(e.pointerId); mapMove(e); });
mapWrap.addEventListener('pointermove', e => { if (mapWrap.hasPointerCapture(e.pointerId)) mapMove(e); });

/* ================= 演奏（タッチ） ================= */
const downCount = new Map();      // 鍵ごとに押している指の数
const pointers = new Map();       // 指ごとに押している鍵
const playingNotes = new Set();   // 再生中の鍵

function press(m, vel, fromPlayback = false) {
  if (fromPlayback) { playingNotes.add(m); keyEls.get(m)?.classList.add('playing'); synth.noteOn(m, vel); return; }
  const n = (downCount.get(m) || 0) + 1;
  downCount.set(m, n);
  keyEls.get(m)?.classList.add('down');
  synth.pressed.add(m);
  synth.noteOn(m, vel);
  rec.event(1, m, vel);
}
function release(m, fromPlayback = false) {
  if (fromPlayback) { playingNotes.delete(m); keyEls.get(m)?.classList.remove('playing'); if (!downCount.has(m)) synth.noteOff(m); return; }
  const n = (downCount.get(m) || 0) - 1;
  if (n > 0) { downCount.set(m, n); return; }
  downCount.delete(m);
  keyEls.get(m)?.classList.remove('down');
  if (!playingNotes.has(m)) synth.noteOff(m);
  rec.event(0, m);
}

function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const k = el && el.closest && el.closest('.key');
  if (!k || !kb.contains(k)) return null;
  const r = k.getBoundingClientRect();
  return { m: +k.dataset.m, depth: Math.max(0, Math.min(1, (y - r.top) / r.height)) };
}
function velFor(depth) { return S.velocity ? 0.45 + 0.55 * depth : 0.8; }

function handle(e, isDown) {
  const hit = keyAt(e.clientX, e.clientY);
  const prev = pointers.get(e.pointerId);
  const m = hit ? hit.m : null;
  if (!isDown && (prev === undefined || prev === m)) return;
  if (!isDown && !S.gliss) return;
  if (prev != null) release(prev);
  if (m != null) press(m, velFor(hit.depth));
  pointers.set(e.pointerId, m);
}
kb.addEventListener('pointerdown', e => {
  e.preventDefault();
  synth.unlock();
  try { kb.setPointerCapture(e.pointerId); } catch (err) {}
  handle(e, true);
});
kb.addEventListener('pointermove', e => { if (pointers.has(e.pointerId)) handle(e, false); });
const up = e => {
  const prev = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (prev != null) release(prev);
};
kb.addEventListener('pointerup', up);
kb.addEventListener('pointercancel', up);
kb.addEventListener('contextmenu', e => e.preventDefault());

// PCのキーボードでも弾ける（表示中の最初のドから）
const PCKEYS = 'awsedftgyhujkolp;';
const pcDown = new Set();
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') { e.preventDefault(); setPedal(!synth.sustain); return; }
  const i = PCKEYS.indexOf(e.key.toLowerCase());
  if (i < 0) return;
  synth.unlock();
  let base = WHITES[S.start]; while (base % 12) base++;
  const m = base + i;
  if (m > MAX || pcDown.has(m)) return;
  pcDown.add(m); press(m, 0.8);
});
addEventListener('keyup', e => {
  const i = PCKEYS.indexOf(e.key.toLowerCase());
  if (i < 0) return;
  let base = WHITES[S.start]; while (base % 12) base++;
  const m = base + i;
  if (pcDown.delete(m)) release(m);
});

/* ================= 録音・再生 ================= */
const rec = {
  on: false, t0: 0, ev: [],
  list() { try { return JSON.parse(localStorage.getItem('piano.recs') || '[]'); } catch (e) { return []; } },
  store(l) {
    try { localStorage.setItem('piano.recs', JSON.stringify(l)); return true; }
    catch (e) { toast('保存できませんでした（容量がいっぱいです）'); return false; }
  },
  event(type, m, v) {
    if (!this.on) return;
    if (!this.ev.length) this.t0 = performance.now();   // 最初の音から計る
    this.ev.push([Math.round(performance.now() - this.t0), type, m, v ? Math.round(v * 100) : 0]);
  },
  start() { this.on = true; this.ev = []; $('#rec').classList.add('on'); $('#rec').textContent = '■ 停止'; toast('録音中… 弾き始めると記録されます'); },
  stop() {
    this.on = false; $('#rec').classList.remove('on'); $('#rec').textContent = '● 録音';
    // 押したままの鍵・ペダルを閉じる
    const t = this.ev.length ? Math.round(performance.now() - this.t0) : 0;
    for (const m of downCount.keys()) this.ev.push([t, 0, m, 0]);
    if (synth.sustain) this.ev.push([t, 3, 0, 0]);
    if (!this.ev.some(e => e[1] === 1)) { toast('音が記録されなかったので保存しませんでした'); return; }
    const d = new Date();
    const name = `録音 ${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    const l = this.list();
    l.unshift({ id: Date.now(), name, dur: this.ev[this.ev.length - 1][0], ev: this.ev });
    if (this.store(l)) toast('録音を保存しました（☰ で一覧）');
  },
};

const player = {
  timers: [], id: null,
  play(r) {
    this.stop();
    synth.unlock();
    this.id = r.id;
    const startPedal = synth.sustain;
    for (const [t, type, m, v] of r.ev) {
      this.timers.push(setTimeout(() => {
        if (type === 1) press(m, v / 100, true);
        else if (type === 0) release(m, true);
        else if (type === 2) setPedal(true, true);
        else if (type === 3) setPedal(false, true);
      }, t + 60));
    }
    this.timers.push(setTimeout(() => { this.stop(); if (!startPedal) setPedal(false, true); }, r.dur + 300));
    $('#play').textContent = '■ 停止'; $('#play').classList.add('on');
    renderList();
  },
  stop() {
    this.timers.forEach(clearTimeout); this.timers = [];
    for (const m of [...playingNotes]) release(m, true);
    this.id = null;
    $('#play').textContent = '▶ 再生'; $('#play').classList.remove('on');
    renderList();
  },
};

$('#rec').onclick = () => { if (player.id) player.stop(); rec.on ? rec.stop() : rec.start(); };
$('#play').onclick = () => {
  if (player.id) return player.stop();
  if (rec.on) rec.stop();
  const l = rec.list();
  if (!l.length) return toast('まだ録音がありません。● 録音 で記録できます');
  player.play(l[0]);
};

function fmt(ms) { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function renderList() {
  const ul = $('#recList'); if (!ul) return;
  const l = rec.list();
  ul.innerHTML = l.length ? '' : '<li class="empty">まだ録音がありません</li>';
  for (const r of l) {
    const li = document.createElement('li');
    const playing = player.id === r.id;
    li.innerHTML = `<button class="btn p">${playing ? '■' : '▶'}</button><span class="name"></span><span class="dur">${fmt(r.dur)}</span><button class="btn rn" aria-label="名前を変える">✎</button><button class="btn del" aria-label="削除">🗑</button>`;
    li.querySelector('.name').textContent = r.name;
    li.querySelector('.p').onclick = () => playing ? player.stop() : player.play(r);
    li.querySelector('.rn').onclick = () => {
      const n = prompt('録音の名前', r.name);
      if (n && n.trim()) { const all = rec.list(); const x = all.find(a => a.id === r.id); if (x) { x.name = n.trim(); rec.store(all); renderList(); } }
    };
    li.querySelector('.del').onclick = () => {
      if (!confirm(`「${r.name}」を削除しますか？`)) return;
      if (playing) player.stop();
      rec.store(rec.list().filter(a => a.id !== r.id)); renderList();
    };
    ul.appendChild(li);
  }
}

/* ================= ペダル ================= */
function setPedal(on, fromPlayback = false) {
  synth.setSustain(on);
  $('#pedal').classList.toggle('on', on);
  $('#pedal').setAttribute('aria-pressed', on);
  if (!fromPlayback) rec.event(on ? 2 : 3, 0);
}
$('#pedal').onclick = () => { synth.unlock(); setPedal(!synth.sustain); };

/* ================= 上の帯のボタン ================= */
$('#octDown').onclick = () => { S.start -= 7; render(); };
$('#octUp').onclick = () => { S.start += 7; render(); };
$('#keysLess').onclick = () => { S.count -= 1; render(); };
$('#keysMore').onclick = () => { S.count += 1; render(); };

/* ================= シート（設定・一覧） ================= */
let openSheet = null;
function showSheet(id) {
  if (openSheet) hideSheet(true);
  openSheet = $(id);
  openSheet.classList.remove('hidden'); $('#sheetBg').classList.remove('hidden');
  history.pushState({ sheet: id }, '');
}
function hideSheet(fromPop) {
  if (!openSheet) return;
  openSheet.classList.add('hidden'); $('#sheetBg').classList.add('hidden');
  openSheet = null;
  if (!fromPop && history.state && history.state.sheet) history.back();
}
addEventListener('popstate', () => hideSheet(true));
$('#sheetBg').onclick = () => hideSheet();
$('#settings').onclick = () => showSheet('#setSheet');
$('#list').onclick = () => { renderList(); showSheet('#listSheet'); };

document.querySelectorAll('.seg').forEach(seg => {
  const key = seg.dataset.key;
  const mark = () => seg.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.v === S[key]));
  seg.querySelectorAll('button').forEach(b => b.onclick = () => { S[key] = b.dataset.v; mark(); render(); });
  mark();
});
const vol = $('#volume'); vol.value = S.volume;
vol.oninput = () => { S.volume = +vol.value; synth.applySettings(); save(); };
for (const k of ['reverb', 'velocity', 'gliss']) {
  const el = $('#' + k); el.checked = S[k];
  el.onchange = () => { S[k] = el.checked; synth.applySettings(); save(); };
}
$('#ver').textContent = VERSION;

/* ================= その他 ================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function checkRotate() {
  $('#rotate').classList.toggle('hidden', !(portrait() && S.rotateHint));
}
$('#rotateClose').onclick = () => { S.rotateHint = false; save(); checkRotate(); };

// アプリが裏に回ったら音を止める（音が鳴りっぱなしにならないように）
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pointers.clear(); downCount.clear(); synth.allOff(); player.stop();
    document.querySelectorAll('.key.down').forEach(k => k.classList.remove('down'));
  } else keepAwake();
});
kb.addEventListener('pointerdown', keepAwake, { once: true });

let lastPortrait = portrait();
addEventListener('resize', () => {
  drawMap(); checkRotate();
  if (portrait() !== lastPortrait) { lastPortrait = portrait(); render(); }
});
drawMap(); render(); checkRotate();

// オフライン対応・自動更新
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  let reloaded = !navigator.serviceWorker.controller;   // 初回インストール時は再読み込みしない
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || downCount.size || player.id || rec.on) return;
    reloaded = true; location.reload();
  });
}
