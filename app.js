'use strict';
const VERSION = '2.9.1';
const $ = s => document.querySelector(s);
const app = $('#app');

/* ================= せってい ================= */
const S = { mode: 'wait', speed: 1, volume: 0.85, labels: true, guide: true,
  lang: (l => l.startsWith('ja') ? 'ja' : l.startsWith('zh') ? 'zh' : 'en')(navigator.language || 'ja') };
try { Object.assign(S, JSON.parse(localStorage.getItem('piano2.settings') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('piano2.settings', JSON.stringify(S)); } catch (e) {} };

/* ================= ことば（日本語・英語） ================= */
const TEXT = {
  ja: {
    songs: 'うた', stop: 'やめる', wait: 'まってね', along: 'いっしょに',
    slow: 'ゆっくり', normal: 'ふつう', fast: 'はやい',
    pick: '🎵 どの うたに する？', great: 'やったね！じょうず！', again: 'もういちど', other: 'ほかの うた', free: 'じゆうに ひく', stamps: 'スタンプ',
    settings: 'せってい（おとなよう）', volume: '音量', labels: '鍵盤に ドレミ を表示',
    guide: '「いっしょに」でお手本の音を鳴らす', close: 'とじる', soundby: 'ピアノの音',
    help: '⭐ まってね：光った鍵盤を押すと次へ進みます。<br>🎶 いっしょに：曲に合わせて鍵盤が光ります。🐢🚶🐇 で速さを変えられます。<br>右上のマークで、ことば（英語・日本語・中国語）を切り替えられます。',
    loading: 'じゅんび ちゅう…', loadErr: 'よみこめませんでした。ネットにつないで ひらきなおしてね',
    longpress: 'おとなの人は ながおし してね',
    lockHold: 'ながおしで ロック', unlockHold: 'ながおしで かいじょ', lockOn: '🔒 ロックしました', lockOff: '🔓 ロックを かいじょしました', locked: '🔒 ロック中（ながおしで かいじょ）',
    notes: ['ド', 'ド', 'レ', 'レ', 'ミ', 'ファ', 'ファ', 'ソ', 'ソ', 'ラ', 'ラ', 'シ'],
  },
  en: {
    songs: 'Songs', stop: 'Stop', wait: 'Wait for me', along: 'Play along',
    slow: 'Slow', normal: 'Normal', fast: 'Fast',
    pick: '🎵 Pick a song!', great: 'Great job!', again: 'Again', other: 'Other songs', free: 'Free play', stamps: 'Stamps',
    settings: 'Settings (for grown-ups)', volume: 'Volume', labels: 'Show note names on keys',
    guide: 'Play the melody in “Play along”', close: 'Close', soundby: 'Piano sound',
    help: '⭐ Wait for me: the song moves on when the glowing key is pressed.<br>🎶 Play along: keys light up with the music. Change the speed with 🐢🚶🐇.<br>Tap a mark (top right) to change the language (English / Japanese / Chinese).',
    loading: 'Getting ready…', loadErr: 'Could not load. Please connect to the internet and reopen.',
    longpress: 'Grown-ups: press and hold',
    lockHold: 'Press and hold to lock', unlockHold: 'Press and hold to unlock', lockOn: '🔒 Locked', lockOff: '🔓 Unlocked', locked: '🔒 Locked (press and hold to unlock)',
    notes: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'],
  },
};
TEXT.zh = {
  songs: '歌曲', stop: '停止', wait: '等等我', along: '一起彈',
  slow: '慢慢', normal: '普通', fast: '快快',
  pick: '🎵 要彈哪首歌？', great: '太棒了！好厲害！', again: '再一次', other: '其他歌曲', free: '自由彈奏', stamps: '印章',
  settings: '設定（給大人）', volume: '音量', labels: '在琴鍵上顯示音名',
  guide: '「一起彈」時播放示範旋律', close: '關閉', soundby: '鋼琴音色',
  help: '⭐ 等等我：按下發光的琴鍵，歌曲才會繼續。<br>🎶 一起彈：琴鍵會跟著音樂發光，可用 🐢🚶🐇 調整速度。<br>右上角的圖示可以切換語言（英文・日文・中文）。',
  loading: '準備中…', loadErr: '無法載入。請連上網路後重新開啟。',
  longpress: '大人請長按',
  lockHold: '長按即可鎖定', unlockHold: '長按即可解除', lockOn: '🔒 已鎖定', lockOff: '🔓 已解除鎖定', locked: '🔒 鎖定中（長按解除）',
  notes: ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'Si♭', 'Si'],
};
if (!TEXT[S.lang]) S.lang = 'ja';
const T = k => TEXT[S.lang][k];
function applyLang() {
  document.documentElement.lang = S.lang === 'zh' ? 'zh-Hant' : S.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = T(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-html]').forEach(el => el.innerHTML = T(el.dataset.i18nHtml));
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', T(el.dataset.i18nAria)));
  document.querySelectorAll('.flag').forEach(f => f.classList.toggle('sel', f.dataset.lang === S.lang));
  document.title = { ja: 'ピアノ', en: 'Piano', zh: '鋼琴' }[S.lang];
}
applyLang();

/* ================= 横画面にする ================= */
// 縦向きで開いても、画面全体を90度回して横画面のレイアウトで表示する
function layout() {
  const iw = innerWidth, ih = innerHeight, portrait = ih > iw;
  const W = portrait ? ih : iw, H = portrait ? iw : ih;
  app.style.width = W + 'px'; app.style.height = H + 'px';
  app.style.transform = portrait ? `translate(${iw}px,0) rotate(90deg)` : 'none';
  app.classList.toggle('compact', H <= 440);
  app.classList.toggle('narrow', W <= 900);
}
addEventListener('resize', layout);
layout();
function tryLockLandscape() {
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
}

/* ================= 音名・色 ================= */
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
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
  // パチパチ（拍手の音を作る）
  applause(sec) {
    const c = this.ctx, t0 = c.currentTime;
    if (!this.clapBuf) {
      const n = Math.floor(c.sampleRate * 0.03); this.clapBuf = c.createBuffer(1, n, c.sampleRate);
      const d = this.clapBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
    }
    const count = Math.floor(sec * 38);
    for (let i = 0; i < count; i++) {
      const t = t0 + Math.random() * sec;
      const fade = 1 - (t - t0) / sec;
      const src = c.createBufferSource(); src.buffer = this.clapBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 1600; bp.Q.value = 1.2;
      const g = c.createGain(); g.gain.value = (0.25 + Math.random() * 0.35) * fade;
      src.connect(bp).connect(g).connect(this.bus); src.start(t);
    }
  }
}
const piano = new Piano();
piano.load().then(() => $('#loading').classList.add('gone'))
  .catch(() => { $('#loading p').textContent = T('loadErr'); });
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
    el.innerHTML = `<div class="tab">${T('notes')[m % 12]}</div>`;
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
function hop() { if (buddy.classList.contains('dance') || bearBusy) return; buddy.classList.remove('hop'); void buddy.offsetWidth; buddy.classList.add('hop'); }

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
  { id: 'kira', e: '⭐', ja: 'きらきらぼし', en: 'Twinkle Twinkle', zh: '小星星', b: '#fff3b8', bpm: 100,
    n: 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2' },
  { id: 'birthday', e: '🎂', ja: 'ハッピーバースデー', en: 'Happy Birthday', zh: '生日快樂', b: '#ffe8c2', bpm: 100,
    n: 'C4:.75 C4:.25 D4 C4 F4 E4:2 C4:.75 C4:.25 D4 C4 G4 F4:2 C4:.75 C4:.25 C5 A4 F4 E4 D4 Bb4:.75 Bb4:.25 A4 F4 G4 F4:3' },
  { id: 'kaeru', e: '🐸', ja: 'かえるのうた', en: 'Frog Song', zh: '青蛙之歌', b: '#d6f5c9', bpm: 110,
    n: 'C4 D4 E4 F4 E4 D4 C4:2 E4 F4 G4 A4 G4 F4 E4:2 C4:2 C4:2 C4:2 C4:2 C4:.5 C4:.5 D4:.5 D4:.5 E4:.5 E4:.5 F4:.5 F4:.5 E4 D4 C4:2' },
  { id: 'chou', e: '🦋', ja: 'ちょうちょう', en: 'Lightly Row', zh: '小蜜蜂', b: '#ffe0ef', bpm: 110,
    n: 'G4 E4 E4:2 F4 D4 D4:2 C4 D4 E4 F4 G4 G4 G4:2 G4 E4 E4 E4 F4 D4 D4 D4 C4 E4 G4 G4 E4 E4 E4:2 D4 D4 D4 D4 D4 E4 F4:2 E4 E4 E4 E4 E4 F4 G4:2 G4 E4 E4:2 F4 D4 D4:2 C4 E4 G4 G4 C4:4' },
  { id: 'mary', e: '🐑', ja: 'メリーさんのひつじ', en: 'Mary Had a Little Lamb', zh: '瑪莉有隻小綿羊', b: '#f3ecff', bpm: 110,
    n: 'E4:1.5 D4:.5 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4:1.5 D4:.5 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4' },
  { id: 'farm', e: '🐮', ja: 'ゆかいな まきば', en: 'Old MacDonald', zh: '王老先生有塊地', b: '#e9f7d4', bpm: 120,
    n: 'F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:3 C4 F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:3 C4 C4:.5 C4:.5 F4 F4 F4:2 C4:.5 C4:.5 F4 F4 F4:2 F4:.5 F4:.5 F4 F4:.5 F4:.5 F4 F4:.5 F4:.5 F4:.5 F4:.5 F4 F4 F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:4 F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:3 C4 F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:3 C4 C4:.5 C4:.5 F4 F4 F4:2 C4:.5 C4:.5 F4 F4 F4:2 F4:.5 F4:.5 F4 F4:.5 F4:.5 F4 F4:.5 F4:.5 F4:.5 F4:.5 F4 F4 F4 F4 F4 C4 D4 D4 C4:2 A4 A4 G4 G4 F4:4' },
  { id: 'alps', e: '🏔️', ja: 'アルプスいちまんじゃく', en: 'Yankee Doodle', zh: '洋基歌', b: '#e3f0ff', bpm: 150,
    n: 'F4 F4 G4 A4 F4 A4 G4 C4 F4 F4 G4 A4 F4:2 E4:2 F4 F4 G4 A4 Bb4 A4 G4 F4 E4 C4 D4 E4 F4:2 F4:2' },
  { id: 'jingle', e: '🔔', ja: 'ジングルベル', en: 'Jingle Bells', zh: '鈴兒響叮噹', b: '#ffdcdc', bpm: 130,
    n: 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4:1.5 F4:.5 F4 E4 E4 E4:.5 E4:.5 E4 D4 D4 E4 D4:2 G4:2 E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4 F4 F4 F4 F4 F4 E4 E4 E4:.5 E4:.5 G4 G4 F4 D4 C4:4' },
  { id: 'london', e: '🌉', ja: 'ロンドンばし', en: 'London Bridge', zh: '倫敦鐵橋', b: '#e0f1ff', bpm: 110,
    n: 'G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4:2 G4:2 E4 C4:3' },
  { id: 'spider', e: '🕷️', ja: 'ちいさなクモさん', en: 'Itsy Bitsy Spider', zh: '小蜘蛛', b: '#eaf4ff', bpm: 110,
    n: 'C4:.5 F4 F4:.5 F4 G4:.5 A4:1.5 A4 A4:.5 G4 F4:.5 G4 A4:.5 F4:3 A4:1.5 A4 Bb4:.5 C5:3 C5 Bb4:.5 A4 Bb4:.5 C5:1.5 A4:3 F4:1.5 F4 G4:.5 A4:3 A4 G4:.5 F4 G4:.5 A4:1.5 F4:3 C4:.5 C4:.5 F4 F4:.5 F4 G4:.5 A4:1.5 A4 A4:.5 G4 F4:.5 G4 A4:.5 F4:3' },
  { id: 'frere', e: '😴', ja: 'フレール・ジャック', en: 'Frère Jacques', zh: '兩隻老虎', b: '#fff0f6', bpm: 110,
    n: 'F4 G4 A4 F4 F4 G4 A4 F4 A4 Bb4 C5:2 A4 Bb4 C5:2 C5:.5 D5:.5 C5:.5 Bb4:.5 A4 F4 C5:.5 D5:.5 C5:.5 Bb4:.5 A4 F4 F4 C4 F4:2 F4 C4 F4:2' },
  { id: 'row', e: '⛵', ja: 'こげこげボート', en: 'Row Your Boat', zh: '划船歌', b: '#d9f4ff', bpm: 110,
    n: 'C4:1.5 C4:1.5 C4 D4:.5 E4:1.5 E4 D4:.5 E4 F4:.5 G4:3 C5:.5 C5:.5 C5:.5 G4:.5 G4:.5 G4:.5 E4:.5 E4:.5 E4:.5 C4:.5 C4:.5 C4:.5 G4 F4:.5 E4 D4:.5 C4:3' },
  { id: 'susanna', e: '🪕', ja: 'おお スザンナ', en: 'Oh! Susanna', zh: '噢！蘇珊娜', b: '#fdebd3', bpm: 130,
    n: 'C4:.5 D4:.5 E4 G4 G4:.75 A4:.25 G4 E4 C4:.75 D4:.25 E4 E4 D4 C4 D4:3 C4:.5 D4:.5 E4 G4 G4:.75 A4:.25 G4 E4 C4:.75 D4:.25 E4 E4 D4 D4 C4:3 F4:2 F4:2 A4:2 A4:1.5 A4:.5 G4 G4 E4 C4 D4:3 C4:.5 D4:.5 E4 G4 G4:.75 A4:.25 G4 E4 C4:.75 D4:.25 E4 E4 D4 D4 C4:3' },
  { id: 'camptown', e: '🐎', ja: 'くさけいば', en: 'Camptown Races', zh: '康城賽馬', b: '#e8f6dc', bpm: 120,
    n: 'G4:.5 G4:.5 E4:.5 G4:.5 A4:.5 G4:.5 E4 E4:.5 D4:1.5 E4:.5 D4:1.5 G4:.5 G4:.5 E4:.5 G4:.5 A4:.5 G4:.5 E4 D4:.5 D4:.5 E4:.5 D4:.5 C4:2' },
  { id: 'hotcross', e: '🥐', ja: 'ホットクロスバン', en: 'Hot Cross Buns', zh: '熱十字麵包', b: '#fff1dc', bpm: 110,
    n: 'E4 D4 C4:2 E4 D4 C4:2 C4:.5 C4:.5 C4:.5 C4:.5 D4:.5 D4:.5 D4:.5 D4:.5 E4 D4 C4:2' },
  { id: 'joy', e: '🎵', ja: 'よろこびのうた', en: 'Ode to Joy', zh: '歡樂頌', b: '#fff0d6', bpm: 110,
    n: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:.5 C4:2' },
  { id: 'lullaby', e: '🌙', ja: 'ブラームスのこもりうた', en: "Brahms' Lullaby", zh: '布拉姆斯搖籃曲', b: '#e6e6ff', bpm: 90,
    n: 'E4:.5 E4:.5 G4:2 E4:.5 E4:.5 G4:2 E4:.5 G4:.5 C5 B4:1.5 A4:.5 A4 G4 D4:.5 E4:.5 F4 D4 D4:.5 E4:.5 F4:2 D4:.5 F4:.5 B4:.5 A4:.5 G4 B4 C5:2 C4:.5 C4:.5 C5:2 A4:.5 F4:.5 G4:2 E4:.5 C4:.5 F4 G4 A4 G4:2 C4:.5 C4:.5 C5:2 A4:.5 F4:.5 G4:2 E4:.5 C4:.5 F4 E4:.5 D4:.5 C4:3' },
  { id: 'elise', e: '🎹', ja: 'エリーゼのために', en: 'Für Elise', zh: '給愛麗絲', b: '#f6eaff', bpm: 100,
    n: 'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 C4:.5 E4:.5 A4:.5 B4:1.5 E4:.5 G#4:.5 B4:.5 C5:1.5 E4:.5 E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 C4:.5 E4:.5 A4:.5 B4:1.5 E4:.5 C5:.5 B4:.5 A4:3' },
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
// 子どもが喜びそうな順に並べる
const ORDER = ['kira', 'birthday', 'kaeru', 'chou', 'mary', 'farm', 'camptown', 'alps', 'jingle', 'london',
  'spider', 'frere', 'row', 'susanna', 'hotcross', 'joy', 'lullaby', 'elise'];
SONGS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

/* ================= うたの進め方 ================= */
const star = document.createElement('div'); star.className = 'star hidden'; star.textContent = '⭐'; fx.appendChild(star);
const hand = document.createElement('div'); hand.className = 'hand hidden'; hand.textContent = '👇'; fx.appendChild(hand);
const ripple = document.createElement('div'); ripple.className = 'ripple hidden'; fx.appendChild(ripple);

// 「完了したうた」のスタンプ
let stamps = {};
try { stamps = JSON.parse(localStorage.getItem('piano2.stamps') || '{}'); } catch (e) {}
const saveStamps = () => { try { localStorage.setItem('piano2.stamps', JSON.stringify(stamps)); } catch (e) {} };

const song = {
  cur: null, idx: 0, timers: [], hintTimers: [], guideNotes: new Set(), lit: null,
  start(s) {
    this.stop(true);
    this.cur = s; this.idx = 0;
    $('#now').classList.remove('hidden');
    $('#nowEmoji').textContent = s.e; $('#nowTitle').textContent = s[S.lang];
    $('#songBtn').classList.add('hidden'); $('#stopBtn').classList.remove('hidden');
    this.progress();
    if (S.mode === 'wait') this.showTarget();
    else this.playAlong();
  },
  stop() {
    this.timers.forEach(clearTimeout); this.timers = [];
    this.clearHint();
    for (const m of this.guideNotes) piano.noteOff(m);
    this.guideNotes.clear();
    this.light(null);
    this.cur = null;
    $('#now').classList.add('hidden');
    $('#songBtn').classList.remove('hidden'); $('#stopBtn').classList.add('hidden');
  },
  light(m, count = 0, total = count) {
    if (this.lit != null && this.lit !== m) keyEls.get(this.lit)?.classList.remove('target', 't0', 't1', 't2', 't3', 'flash');
    this.lit = m;
    if (m == null) { star.classList.add('hidden'); return; }
    keyEls.get(m)?.classList.add('target');
    const p = keyPos(m);
    star.style.left = p.x + 'px'; star.style.top = p.top + 'px';
    star.classList.remove('hidden');
    // 同じ鍵盤を続けて押すときは、2回目・3回目…で鍵盤の色を変えて知らせる
    const el = keyEls.get(m);
    if (el) {
      const n = Math.max(0, total - count) % 4;      // もう押した回数
      el.classList.remove('t0', 't1', 't2', 't3', 'flash');
      el.classList.add('t' + n);
      if (n > 0) { void el.offsetWidth; el.classList.add('flash'); }
    }
  },
  // まってねモード：次に押す鍵盤を光らせる
  showTarget() {
    const ns = this.cur.notes, m = ns[this.idx].m;
    let run = 1; while (this.idx + run < ns.length && ns[this.idx + run].m === m) run++;
    const again = this.lit === m && this.runTotal > 1;
    if (!again) this.runTotal = run;
    this.light(m, run, this.runTotal);
    this.startHint();
  },
  // しばらく押せないときの案内
  startHint() {
    this.clearHint();
    const m = this.lit;
    this.hintTimers.push(setTimeout(() => {
      const p = keyPos(m); if (!p) return;
      kb.classList.add('hinting');
      hand.style.left = p.x + 'px'; hand.style.top = (p.top + p.h * 0.62) + 'px';
      ripple.style.left = p.x + 'px'; ripple.style.top = (p.top + p.h * 0.62) + 'px';
      hand.classList.remove('hidden'); ripple.classList.remove('hidden');
    }, 3500));
    const tone = () => { if (this.lit === m && !downCount.has(m)) { piano.noteOn(m, 0.35); setTimeout(() => { if (!downCount.has(m)) piano.noteOff(m); }, 500); } };
    this.hintTimers.push(setTimeout(tone, 6000));
    this.hintTimers.push(setTimeout(tone, 11000));
  },
  clearHint() {
    this.hintTimers.forEach(clearTimeout); this.hintTimers = [];
    kb.classList.remove('hinting');
    hand.classList.add('hidden'); ripple.classList.add('hidden');
  },
  progress() {
    const pct = this.cur ? this.idx / this.cur.notes.length * 100 : 0;
    $('#barFill').style.width = pct + '%';
    const r = $('#barRunner'); r.style.left = pct + '%'; r.textContent = this.cur ? this.cur.e : '';
    const bar = $('#bar');
    if (pct > 0) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); }
    bar.classList.toggle('near', pct >= 75);
  },
  onPress(m) {
    if (!this.cur || S.mode !== 'wait') return;
    if (m !== this.cur.notes[this.idx].m) return;
    sparkFx(m);
    this.idx++; this.progress();
    if (this.idx >= this.cur.notes.length) { this.clearHint(); this.light(null); this.timers.push(setTimeout(() => this.finish(), 500)); }
    else this.showTarget();
  },
  playAlong() {
    const s = this.cur, beat = 60 / (s.bpm * S.speed) * 1000;
    let t = 500;
    s.notes.forEach((n, i) => {
      const dur = n.d * beat;
      this.timers.push(setTimeout(() => {
        this.light(null); this.light(n.m); this.idx = i + 1; this.progress();
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
    this.stop();
    this.last = s;
    stamps[s.id] = (stamps[s.id] || 0) + 1; saveStamps(); buildGrid();
    celebrate(s);
  },
};

/* ================= できたね（お祝い） ================= */
function fanfare() {
  const at = (ms, ms2, notes, v = 0.7) => setTimeout(() => notes.forEach(m => piano.noteOn(m, v)), ms);
  // パッパッパ パーン！
  at(0, 0, [60, 67]); at(150, 0, [60, 67]); at(300, 0, [60, 67]);
  at(450, 0, [64, 72], 0.8);
  at(800, 0, [62, 69]); at(950, 0, [65, 71]);
  at(1100, 0, [60, 64, 67, 72, 76], 0.95);
  // キラキラ〜（高い音がかけあがる）
  [84, 86, 88, 91, 93, 96, 98, 100].forEach((m, i) => setTimeout(() => piano.noteOn(m, 0.35), 1500 + i * 70));
  setTimeout(() => piano.applause(2.6), 1100);
}
function burst(box, x, y, n, items, dist) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span');
    c.className = 'burst'; c.textContent = items[Math.floor(Math.random() * items.length)];
    const ang = Math.random() * Math.PI * 2, d = dist * (0.5 + Math.random() * 0.6);
    c.style.left = x + '%'; c.style.top = y + '%';
    c.style.setProperty('--dx', Math.cos(ang) * d + 'px'); c.style.setProperty('--dy', Math.sin(ang) * d + 'px');
    c.style.fontSize = (20 + Math.random() * 22) + 'px';
    box.appendChild(c); setTimeout(() => c.remove(), 1500);
  }
}
function celebrate(s) {
  show('#done');
  const done = $('#done');
  done.classList.remove('play'); void done.offsetWidth; done.classList.add('play');
  buddy.classList.add('dance');
  $('#doneSong').textContent = `${s.e} ${s[S.lang]}`;
  $('#stampCount').textContent = Object.keys(stamps).length;
  // 文字を1つずつはねさせる
  const h = $('#doneTitle'); const word = T('great');
  h.innerHTML = [...word].map((ch, i) => `<span style="animation-delay:${0.5 + i * 0.08}s">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  const box = $('#confetti'); box.innerHTML = '';
  const items = ['🎉', '⭐', '🎈', '🌸', '🍬', '✨', '🎵', '💖', '🌟', '🍭'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('span');
    c.className = 'conf'; c.textContent = items[i % items.length];
    c.style.left = Math.random() * 100 + '%';
    c.style.animationDuration = (2.4 + Math.random() * 2.4) + 's';
    c.style.animationDelay = Math.random() * 2 + 's';
    box.appendChild(c);
  }
  // 花火
  const fw = $('#fireworks'); fw.innerHTML = '';
  [[50, 45, 0], [20, 30, 500], [80, 30, 800], [30, 60, 1200], [70, 60, 1500], [50, 25, 1900]].forEach(([x, y, d]) =>
    setTimeout(() => burst(fw, x, y, 14, ['✨', '⭐', '🌟', '💫', '💖'], 150), d));
  // ボタンは少し遅れて出す（すぐに押して閉じてしまわないように）
  const row = $('#done .row'); row.classList.add('wait');
  setTimeout(() => row.classList.remove('wait'), 1800);
  fanfare();
}

/* ================= たいよう（さわると いろいろ反応） ================= */
const sun = $('#sun'), sunFx = $('#sunFx');
// メロディ：[音, 始まり(ms), 長さ(ms), 強さ]。ド(60)〜ミ(76)は鍵盤も光る
const SUN_REACTIONS = [
  // わらう：ころころ はずむメロディ
  { cls: 'r-laugh', ms: 1700, fx: ['😆', '♪', '♫', '💛'], n: 8,
    notes: [[67, 0, 300], [64, 150, 300], [67, 300, 300], [64, 450, 300], [69, 600, 300], [67, 750, 300], [72, 900, 900, .6], [48, 900, 1200, .35], [55, 900, 1200, .3]] },
  // ひかる：ハープのようにキラキラ上がって、やさしい和音
  { cls: 'r-shine', ms: 2000, fx: ['✨', '🌟', '⭐', '💫'], n: 16,
    notes: [[60, 0, 1400], [64, 90, 1300], [67, 180, 1200], [72, 270, 1100], [76, 360, 1000], [79, 450, 900, .4], [84, 540, 900, .35], [88, 630, 900, .3], [65, 900, 1100, .35], [69, 900, 1100, .35], [72, 900, 1100, .35]] },
  // ウインク：ピンポーン♪
  { cls: 'r-wink',  ms: 1500, fx: ['💖', '💕', '💗'], n: 6,
    notes: [[76, 0, 500, .6], [72, 260, 900, .55], [64, 260, 900, .3], [67, 260, 900, .3]] },
  // びっくり：ジャジャーン！
  { cls: 'r-wow',   ms: 1400, fx: ['❗', '❓', '✨'], n: 6,
    notes: [[60, 0, 200], [67, 80, 200], [72, 160, 900, .7], [76, 160, 900, .6], [64, 160, 900, .45], [48, 160, 1000, .4]] },
  // くるくる：上から下へ、ゆらゆら下りる
  { cls: 'r-spin',  ms: 2600, fx: ['💫', '🌀', '⭐'], n: 8,
    notes: [[76, 0, 350], [74, 140, 350], [72, 280, 350], [69, 420, 350], [67, 560, 350], [64, 700, 350], [62, 840, 350], [60, 980, 1200, .6], [67, 1120, 1000, .4], [72, 1260, 1000, .45]] },
  // サングラス：ちょっとおしゃれなフレーズ
  { cls: 'r-cool',  ms: 2000, fx: ['😎', '✌️', '🎵'], n: 6,
    notes: [[60, 0, 250], [63, 180, 200], [64, 300, 250], [67, 480, 250], [69, 660, 250], [67, 840, 900, .55], [48, 840, 1000, .35], [57, 840, 1000, .3], [64, 840, 1000, .3]] },
];
// メロディを鳴らして、鍵盤もいっしょに光らせる
const STRETCH = 1.5;   // たいよう・くもの伴奏の長さ（1.5倍）
function playPhrase(notes) {
  notes.forEach(([m, d0, len0, v = .5]) => { const d = d0 * STRETCH, len = len0 * STRETCH; setTimeout(() => {
    piano.noteOn(m, v);
    sparkleKey(m, Math.min(len, 700));
    setTimeout(() => { if (!downCount.has(m)) piano.noteOff(m); }, len);
  }, d); });
}
function sparkleKey(m, ms) {
  const el = keyEls.get(m); if (!el || song.cur) return;
  el.classList.remove('sparkle'); void el.offsetWidth; el.classList.add('sparkle');
  noteFx(m);
  clearTimeout(el._sp); el._sp = setTimeout(() => el.classList.remove('sparkle'), ms);
}
let sunBusy = false, sunLast = -1;
sun.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation();
  piano.unlock();
  if (sunBusy) return;
  // 前と同じ反応にならないように選ぶ
  let i; do { i = Math.floor(Math.random() * SUN_REACTIONS.length); } while (i === sunLast);
  sunLast = i;
  const r = SUN_REACTIONS[i];
  sunBusy = true;
  sun.className = ''; void sun.offsetWidth; sun.classList.add(r.cls);
  playPhrase(r.notes);
  // まわりにキラキラなどを飛ばす
  const W = app.clientWidth, H = app.clientHeight;
  const x = (sun.offsetLeft + sun.offsetWidth / 2) / W * 100, y = (sun.offsetTop + sun.offsetHeight / 2) / H * 100;
  burst(sunFx, x, y, r.n, r.fx, sun.offsetWidth * 1.2);
  hop();
  setTimeout(() => { sun.className = ''; sunBusy = false; }, r.ms * STRETCH);
});

/* ================= くまさん（さわると反応） ================= */
let bearBusy = false, bearLast = -1;
const BEAR_REACTIONS = [
  // おどる：たのしいリズム
  { cls: 'b-dance', ms: 2200, fx: ['🎵', '🎶', '💃', '✨'],
    notes: [[60, 0, 200], [64, 150, 200], [67, 300, 200], [64, 450, 200], [65, 600, 200], [69, 750, 200], [72, 900, 700, .55], [48, 900, 900, .35], [55, 900, 900, .3]] },
  // てをふる：こんにちは♪
  { cls: 'b-wave', ms: 1900, fx: ['👋', '💛', '✨'],
    notes: [[67, 0, 350], [72, 250, 350], [76, 500, 900, .55], [64, 500, 900, .35], [60, 500, 900, .3]] },
  // ぴょーん：大ジャンプ
  { cls: 'b-jump', ms: 2000, fx: ['⭐', '💫', '🌟'],
    notes: [[60, 0, 250], [62, 90, 250], [64, 180, 250], [67, 270, 250], [72, 360, 400], [76, 450, 900, .6], [67, 1000, 300, .45], [72, 1100, 900, .5]] },
  // にっこり：ハートいっぱい
  { cls: 'b-happy', ms: 1800, fx: ['💖', '💕', '🍯', '💗'],
    notes: [[72, 0, 400], [71, 220, 300], [72, 400, 300], [76, 600, 900, .55], [65, 600, 900, .35], [69, 600, 900, .35]] },
];
buddy.addEventListener('pointerdown', e => {
  e.preventDefault(); e.stopPropagation(); piano.unlock();
  if (bearBusy || buddy.classList.contains('dance')) return;
  let i; do { i = Math.floor(Math.random() * BEAR_REACTIONS.length); } while (i === bearLast);
  bearLast = i;
  const r = BEAR_REACTIONS[i];
  bearBusy = true;
  buddy.classList.remove('hop', 'b-dance', 'b-wave', 'b-jump', 'b-happy'); void buddy.offsetWidth; buddy.classList.add(r.cls);
  playPhrase(r.notes);
  const W = app.clientWidth, H = app.clientHeight, top = $('#top');
  const x = (buddy.offsetLeft + top.offsetLeft + buddy.offsetWidth / 2) / W * 100;
  const y = (buddy.offsetTop + top.offsetTop + buddy.offsetHeight / 2) / H * 100;
  burst(sunFx, x, y, 8, r.fx, buddy.offsetWidth * 1.3);
  setTimeout(() => { buddy.classList.remove(r.cls); bearBusy = false; }, r.ms * STRETCH);
});

/* ================= くも（さわると反応） ================= */
// 画面の位置（指の位置）を #app の中の位置に直す（縦向きで回しているときも）
function toApp(e) {
  if (app.style.transform.includes('rotate')) return { x: e.clientY, y: innerWidth - e.clientX };
  return { x: e.clientX, y: e.clientY };
}
const CLOUD_REACTIONS = [
  // あめ：ぽつぽつ雨がふって、しずくの音
  { cls: 'k-rain', ms: 2200, run(p) {
      const pent = [76, 74, 72, 69, 67, 64, 62, 60];
      for (let i = 0; i < 10; i++) setTimeout(() => {
        const d = document.createElement('span'); d.className = 'drop'; d.textContent = '💧';
        d.style.left = (p.x + (Math.random() - .5) * 90) + 'px'; d.style.top = (p.y + 10) + 'px';
        sunFx.appendChild(d); setTimeout(() => d.remove(), 1100);
        const m = pent[Math.floor(Math.random() * pent.length)];
        piano.noteOn(m, 0.38); sparkleKey(m, 500); setTimeout(() => piano.noteOff(m), 750);
      }, (150 + i * 160) * STRETCH);
  } },
  // ぽよん：ふわふわはずむ
  { cls: 'k-boing', ms: 1200, run(p) {
      playPhrase([[60, 0, 300, .5], [67, 120, 300, .45], [72, 240, 700, .5], [64, 240, 700, .3]]);
      burst(sunFx, p.x / app.clientWidth * 100, p.y / app.clientHeight * 100, 6, ['☁️', '💨', '✨'], 70);
  } },
  // にじ：虹がかかって、鍵盤が左から右へ順番に光る
  { cls: 'k-rainbow', ms: 2000, run(p) {
      const r = document.createElement('span'); r.className = 'mini-rainbow'; r.textContent = '🌈';
      r.style.left = p.x + 'px'; r.style.top = p.y + 'px';
      sunFx.appendChild(r); setTimeout(() => r.remove(), 1900);
      playPhrase([60, 62, 64, 65, 67, 69, 71, 72, 74, 76].map((m, i) => [m, i * 90, 600, .42]).concat([[72, 950, 900, .4], [76, 950, 900, .35], [67, 950, 900, .3]]));
  } },
];
let cloudLast = -1;
document.querySelectorAll('#scene .cloud').forEach(cl => {
  cl.addEventListener('pointerdown', e => {
    e.preventDefault(); piano.unlock();
    if (cl._busy) return;
    let i; do { i = Math.floor(Math.random() * CLOUD_REACTIONS.length); } while (i === cloudLast);
    cloudLast = i;
    const r = CLOUD_REACTIONS[i], cin = cl.querySelector('.cin');
    cl._busy = true;
    cin.classList.remove('k-rain', 'k-boing', 'k-rainbow'); void cin.getBoundingClientRect(); cin.classList.add(r.cls);
    r.run(toApp(e));
    setTimeout(() => { cin.classList.remove(r.cls); cl._busy = false; }, r.ms * STRETCH);
  });
});

/* ================= 子どもロック ================= */
// ながおしで ON/OFF。全画面にして上下のバーをかくし、戻るボタンをきかなくする。
// （ホームボタンと上からの引き下げは、Androidの「画面の固定」と組み合わせて防ぐ）
const lockBtn = $('#lockBtn');
let locked = false, lockTimer = null;
function enterFull() {
  const el = document.documentElement;
  try { if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(tryLockLandscape).catch(() => {}); } catch (e) {}
}
function exitFull() { try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} }
function setLock(on) {
  locked = on;
  lockBtn.classList.toggle('locked', on);
  lockBtn.querySelector('.ic').textContent = on ? '🔒' : '🔓';
  if (on) {
    enterFull();
    keepAwake();
  } else exitFull();
  toast(T(on ? 'lockOn' : 'lockOff'));
}
lockBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  lockBtn.classList.remove('pressing'); void lockBtn.offsetWidth; lockBtn.classList.add('pressing');
  lockTimer = setTimeout(() => { lockTimer = null; lockBtn.classList.remove('pressing'); setLock(!locked); }, 1200);
});
lockBtn.addEventListener('pointerup', () => {
  lockBtn.classList.remove('pressing');
  if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; toast(T(locked ? 'unlockHold' : 'lockHold')); }
});
lockBtn.addEventListener('pointercancel', () => { lockBtn.classList.remove('pressing'); if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; } });
lockBtn.addEventListener('contextmenu', e => e.preventDefault());
// 戻るボタンでアプリが閉じないようにする（ロックしていなくても）
// さわるたびに「戻る用の段」を2段つみなおしておき、戻るボタンはその段を1つ使うだけにする
function guardBack() {
  const st = history.state && history.state.g;
  if (st === 2) return;
  if (st !== 1) history.pushState({ g: 1 }, '');
  history.pushState({ g: 2 }, '');
}
document.addEventListener('pointerdown', guardBack, true);
addEventListener('popstate', () => {
  hideAll();                                   // 開いている画面（うた選びなど）は閉じる
  if (history.state && history.state.g === 1) history.pushState({ g: 2 }, '');
  if (locked) toast(T('locked'));
}, true);
// 全画面がとけてしまったら、次にさわったときに全画面にもどす
document.addEventListener('pointerdown', () => { if (locked && !document.fullscreenElement) enterFull(); }, true);

/* ================= 画面の切り替え ================= */
let shownAt = 0;
function show(id) { document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); $(id).classList.remove('hidden'); shownAt = performance.now(); }
function hideAll() { document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden')); buddy.classList.remove('dance'); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = hideAll);
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o && performance.now() - shownAt > 500) hideAll(); }));

const grid = $('#songGrid');
function buildGrid() {
  grid.innerHTML = '';
  SONGS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'song'; b.style.setProperty('--b', s.b);
    b.innerHTML = `<span class="e">${s.e}</span><span class="t"></span>${stamps[s.id] ? '<span class="stamp">🌟</span>' : ''}`;
    b.querySelector('.t').textContent = s[S.lang];
    b.onclick = () => { piano.unlock(); hideAll(); song.start(s); };
    grid.appendChild(b);
  });
}
buildGrid();

// 国旗でことばを切り替える
document.querySelectorAll('.flag').forEach(f => f.onclick = () => {
  if (S.lang === f.dataset.lang) return;
  S.lang = f.dataset.lang; save();
  applyLang(); buildGrid(); buildKeys();
  if (song.lit != null) { const m = song.lit; song.lit = null; song.light(m); }
  if (song.cur) $('#nowTitle').textContent = song.cur[S.lang];
  piano.unlock(); piano.noteOn({ en: 67, ja: 72, zh: 76 }[S.lang], 0.6);
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
// 「いっしょに」のボタン1つで切り替え（OFF のときは ⭐まってね）
const alongBtn = $('#alongBtn');
function markAlong() { const on = S.mode === 'along'; alongBtn.classList.toggle('on', on); alongBtn.setAttribute('aria-pressed', on); }
alongBtn.onclick = () => { S.mode = S.mode === 'along' ? 'wait' : 'along'; save(); markAlong(); modeChanged(); };
markAlong();
seg('#speedSeg', 'speed', v => +v, () => { if (song.cur && S.mode === 'along') song.start(song.cur); });
$('#speedSeg').classList.toggle('hidden', S.mode !== 'along');

/* おとな用せってい：⚙をながおし */
let lp = null;
const setBtn = $('#setBtn');
setBtn.addEventListener('pointerdown', () => { lp = setTimeout(() => { lp = null; show('#settings'); }, 800); });
const cancelLp = () => { if (lp) { clearTimeout(lp); lp = null; toast(T('longpress')); } };
setBtn.addEventListener('pointerup', cancelLp);
setBtn.addEventListener('pointerleave', () => { if (lp) { clearTimeout(lp); lp = null; } });
// 音量：指でつかんだまま左右に動かせる（縦向きで画面を回しているときも正しく動く）
const volSlider = $('#volSlider');
function drawVol() {
  const pct = (S.volume - 0.1) / 0.9 * 100;
  $('#volFill').style.width = pct + '%'; $('#volKnob').style.left = pct + '%';
  volSlider.setAttribute('aria-valuenow', Math.round(S.volume * 100));
}
let volTest = 0;
function setVolFrom(e) {
  const r = volSlider.getBoundingClientRect();
  const rotated = app.style.transform.includes('rotate');
  let f = rotated ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
  f = Math.max(0, Math.min(1, f));
  S.volume = Math.round((0.1 + f * 0.9) * 100) / 100;
  piano.setVolume(S.volume); drawVol();
  const now = performance.now();
  if (now - volTest > 350) { volTest = now; piano.unlock(); piano.noteOn(72, 0.5); setTimeout(() => piano.noteOff(72), 250); }
}
volSlider.addEventListener('pointerdown', e => {
  e.preventDefault(); volSlider.setPointerCapture(e.pointerId); volSlider.classList.add('drag'); setVolFrom(e);
});
volSlider.addEventListener('pointermove', e => { if (volSlider.hasPointerCapture(e.pointerId)) setVolFrom(e); });
const volEnd = () => { volSlider.classList.remove('drag'); save(); };
volSlider.addEventListener('pointerup', volEnd); volSlider.addEventListener('pointercancel', volEnd);
volSlider.addEventListener('keydown', e => {
  const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
  if (d) { S.volume = Math.max(0.1, Math.min(1, S.volume + d)); piano.setVolume(S.volume); drawVol(); save(); }
});
drawVol();
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
