/**
 * Remotion varyasyonları için 15 sn'lik müzik döngüleri üretir.
 *
 * Neden kodla sentez: harici müzik dosyası lisans sorunu getiriyor ve
 * Reels/Shorts'ta telifli sesin sessize alınması riski var. Burada her
 * şey kare dalga / üçgen / gürültüden üretilir; seed sabit, çıktı
 * deterministik (git'te gereksiz fark çıkmaz).
 *
 *   v1  112 BPM  orta tempolu heyecan (arpej + bas + hafif davul)
 *   v2  150 BPM  yüksek tempolu vurmalı retro (tom/kick/snare ağırlıklı)
 *   v3  120 BPM  nostaljik 8-bit chiptune (darbe dalgası melodi)
 *
 * Kullanım:  npm run muzik-uret
 * Çıktı:     public/remotion/music-v{1,2,3}.wav  (22.05 kHz mono 16-bit)
 */

import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..');
const CIKTI = join(KOK, 'public', 'remotion');
const SR = 22050;
const SURE = 15;
const N = SR * SURE;

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function tohumluRast(tohum) {
  let t = tohum >>> 0;
  return () => {
    t = (t * 1664525 + 1013904223) >>> 0;
    return t / 0x100000000;
  };
}

const kare = (faz, duty = 0.5) => ((faz % 1) < duty ? 1 : -1);
const ucgen = (faz) => 4 * Math.abs((faz % 1) - 0.5) - 1;

function yeniTampon() {
  return new Float32Array(N);
}

/** [t0, t0+dur) aralığına örnek yazan yardımcı */
function yaz(buf, t0, dur, fn) {
  const i0 = Math.max(0, Math.floor(t0 * SR));
  const i1 = Math.min(N, Math.floor((t0 + dur) * SR));
  for (let i = i0; i < i1; i += 1) {
    buf[i] += fn((i - i0) / SR, (i - i0) / (i1 - i0));
  }
}

function nota(buf, t0, dur, hz, {tur = 'kare', duty = 0.5, vol = 0.2, a = 0.004, r = 0.04} = {}) {
  yaz(buf, t0, dur, (t) => {
    const zarf = Math.min(1, t / a) * Math.min(1, Math.max(0, (dur - t) / r));
    const faz = hz * t;
    const dalga = tur === 'ucgen' ? ucgen(faz) : kare(faz, duty);
    return dalga * vol * zarf;
  });
}

function kick(buf, t0, vol = 0.7) {
  yaz(buf, t0, 0.18, (t) => {
    const f = 120 * Math.exp(-t * 22) + 42;
    return Math.sin(2 * Math.PI * f * t) * vol * Math.exp(-t * 14);
  });
}

function snare(buf, t0, rast, vol = 0.35) {
  yaz(buf, t0, 0.16, (t) => {
    const g = (rast() * 2 - 1) * Math.exp(-t * 26);
    const ton = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30) * 0.5;
    return (g + ton) * vol;
  });
}

function hat(buf, t0, rast, vol = 0.1, uzun = false) {
  const d = uzun ? 0.12 : 0.04;
  yaz(buf, t0, d, (t) => (rast() * 2 - 1) * Math.exp(-t * (uzun ? 24 : 70)) * vol);
}

function tom(buf, t0, hz, vol = 0.5) {
  yaz(buf, t0, 0.22, (t) => {
    const f = hz * (1 + 0.6 * Math.exp(-t * 18));
    return Math.sin(2 * Math.PI * f * t) * vol * Math.exp(-t * 11);
  });
}

function bitir(buf, {kazanc = 0.9, girisSn = 0.05, cikisSn = 1.2} = {}) {
  let zirve = 0;
  for (let i = 0; i < N; i += 1) zirve = Math.max(zirve, Math.abs(buf[i]));
  const k = zirve > 0 ? kazanc / zirve : 1;
  const out = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i += 1) {
    const t = i / SR;
    const zarf =
      Math.min(1, t / girisSn) * Math.min(1, Math.max(0, (SURE - t) / cikisSn));
    const v = Math.max(-1, Math.min(1, buf[i] * k * zarf));
    out.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return out;
}

function wavYaz(ad, pcm) {
  const baslik = Buffer.alloc(44);
  baslik.write('RIFF', 0);
  baslik.writeUInt32LE(36 + pcm.length, 4);
  baslik.write('WAVE', 8);
  baslik.write('fmt ', 12);
  baslik.writeUInt32LE(16, 16);
  baslik.writeUInt16LE(1, 20);
  baslik.writeUInt16LE(1, 22);
  baslik.writeUInt32LE(SR, 24);
  baslik.writeUInt32LE(SR * 2, 28);
  baslik.writeUInt16LE(2, 32);
  baslik.writeUInt16LE(16, 34);
  baslik.write('data', 36);
  baslik.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(CIKTI, ad), Buffer.concat([baslik, pcm]));
  console.log(`✓ ${ad} (${(pcm.length / 1024).toFixed(0)} KB)`);
}

/* ------------------------------------------------------------------ */
/* v1 — 112 BPM, a-minör arpej, dört vuruş kick, geri vuruşta hat      */
/* ------------------------------------------------------------------ */
function v1() {
  const bpm = 112;
  const adim = 60 / bpm / 2; // 8'lik
  const rast = tohumluRast(11);
  const buf = yeniTampon();
  const akor = [
    [57, 60, 64], // Am
    [53, 57, 60], // F
    [48, 52, 55], // C
    [55, 59, 62], // G
  ];
  const bas = [45, 41, 36, 43];
  const toplamAdim = Math.floor(SURE / adim);
  for (let s = 0; s < toplamAdim; s += 1) {
    const t = s * adim;
    const bar = Math.floor(s / 8) % 4;
    const a = akor[bar];
    nota(buf, t, adim * 0.9, midi(a[s % 3] + 12), {duty: 0.25, vol: 0.13});
    if (s % 2 === 0) nota(buf, t, adim * 1.8, midi(bas[bar]), {tur: 'ucgen', vol: 0.3});
    if (s % 2 === 0) kick(buf, t, 0.55);
    if (s % 4 === 2) snare(buf, t, rast, 0.22);
    hat(buf, t + adim * 0.5, rast, 0.07);
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/* v2 — 150 BPM, vurmalı: çifte kick, snare backbeat, tom fill'leri    */
/* ------------------------------------------------------------------ */
function v2() {
  const bpm = 150;
  const adim = 60 / bpm / 4; // 16'lık
  const rast = tohumluRast(22);
  const buf = yeniTampon();
  const kickDeseni = [0, 3, 6, 8, 10, 14];
  const toplamAdim = Math.floor(SURE / adim);
  const bas = [38, 38, 41, 36];
  for (let s = 0; s < toplamAdim; s += 1) {
    const t = s * adim;
    const bar = Math.floor(s / 16);
    const k = s % 16;
    if (kickDeseni.includes(k)) kick(buf, t, 0.8);
    if (k === 4 || k === 12) snare(buf, t, rast, 0.4);
    if (k % 2 === 0) hat(buf, t, rast, 0.1, k % 4 === 2);
    // Tom fill — her 4. barın son çeyreğinde
    if (bar % 4 === 3 && k >= 12) tom(buf, t, [210, 170, 140, 110][k - 12], 0.5);
    // Keskin kare dalga vuruşları (stab)
    if (k === 0 || k === 6 || k === 10) {
      nota(buf, t, adim * 2.2, midi(bas[bar % 4] + 24), {duty: 0.125, vol: 0.16, r: 0.02});
      nota(buf, t, adim * 2.2, midi(bas[bar % 4] + 12), {tur: 'ucgen', vol: 0.3});
    }
  }
  return buf;
}

/* ------------------------------------------------------------------ */
/* v3 — 120 BPM, majör chiptune: darbe melodi + üçgen bas + atari hat  */
/* ------------------------------------------------------------------ */
function v3() {
  const bpm = 120;
  const adim = 60 / bpm / 2;
  const rast = tohumluRast(33);
  const buf = yeniTampon();
  // C majör — 4 barlık nostaljik melodi (8'likler)
  const melodi = [
    72, 76, 79, 76, 72, 76, 79, 84,
    74, 77, 81, 77, 74, 77, 81, 86,
    71, 74, 79, 74, 71, 74, 79, 83,
    72, 76, 79, 84, 79, 76, 72, 67,
  ];
  const bas = [48, 50, 43, 48];
  const toplamAdim = Math.floor(SURE / adim);
  for (let s = 0; s < toplamAdim; s += 1) {
    const t = s * adim;
    const m = melodi[s % melodi.length];
    nota(buf, t, adim * 0.92, midi(m), {duty: 0.5, vol: 0.17, r: 0.02});
    nota(buf, t + adim * 0.0, adim * 0.92, midi(m - 12), {duty: 0.125, vol: 0.07});
    if (s % 2 === 0) nota(buf, t, adim * 1.9, midi(bas[Math.floor(s / 8) % 4]), {tur: 'ucgen', vol: 0.32});
    if (s % 4 === 0) kick(buf, t, 0.4);
    if (s % 4 === 2) snare(buf, t, rast, 0.16);
    if (s % 2 === 1) hat(buf, t, rast, 0.05);
  }
  return buf;
}

mkdirSync(CIKTI, {recursive: true});
wavYaz('music-v1.wav', bitir(v1()));
wavYaz('music-v2.wav', bitir(v2()));
wavYaz('music-v3.wav', bitir(v3()));
