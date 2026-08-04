/**
 * Basit 8-bit ses motoru.
 *
 * Harici ses dosyası yok — tüm efektler Web Audio API osilatörleriyle
 * anlık üretilir. Böylece build boyutu artmaz ve retro tını korunur.
 *
 * Tarayıcı otomatik oynatma politikası gereği AudioContext ancak bir
 * kullanıcı hareketinden sonra başlatılabilir: `Sfx.unlock()` giriş
 * ekranındaki "BAŞLA" tıklamasında çağrılır.
 */

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  /** İlk kullanıcı hareketinde çağrılır. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : 0.22;
    }
  }

  /**
   * Tek bir osilatör notası çalar.
   * @param {object} opts
   */
  tone({ freq = 440, endFreq, duration = 0.12, type = 'square', gain = 0.6, delay = 0 }) {
    if (!this.ctx || this.muted) return;

    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    }

    // Kısa attack + exponential decay → klasik çip sesi
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Beyaz gürültü patlaması — smaç ve alkış için. */
  noise({ duration = 0.14, gain = 0.35, delay = 0, filterFreq = 1400 }) {
    if (!this.ctx || this.muted) return;

    const start = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(start);
  }

  // --- Oyun efektleri -------------------------------------------------

  /** Manşet / normal temas. */
  bump() {
    this.tone({ freq: 320, endFreq: 240, duration: 0.07, gain: 0.5 });
  }

  /** Kuvvetli vuruş. */
  hit() {
    this.tone({ freq: 520, endFreq: 300, duration: 0.09, gain: 0.6 });
  }

  /** Smaç — gürültü patlaması + alçalan ton. */
  spike() {
    this.noise({ duration: 0.12, gain: 0.4, filterFreq: 1800 });
    this.tone({ freq: 700, endFreq: 180, duration: 0.16, type: 'sawtooth', gain: 0.5 });
  }

  /** Dalış — kısa hava sesi. */
  dive() {
    this.noise({ duration: 0.22, gain: 0.28, filterFreq: 700 });
    this.tone({ freq: 260, endFreq: 140, duration: 0.18, type: 'sine', gain: 0.3 });
  }

  /** Dalış kurtarışı — yükselen kısa motif. */
  save() {
    this.tone({ freq: 392, duration: 0.08, gain: 0.5 });
    this.tone({ freq: 587, duration: 0.13, gain: 0.5, delay: 0.07 });
    this.noise({ duration: 0.16, gain: 0.25, filterFreq: 1200 });
  }

  /** Blok. */
  block() {
    this.tone({ freq: 240, endFreq: 120, duration: 0.14, type: 'square', gain: 0.65 });
  }

  /** File teması. */
  net() {
    this.tone({ freq: 180, endFreq: 140, duration: 0.1, type: 'triangle', gain: 0.4 });
  }

  /** Top yere düştü. */
  ground() {
    this.tone({ freq: 150, endFreq: 70, duration: 0.18, type: 'sine', gain: 0.7 });
  }

  /** Sayı — kısa yükselen arpej. */
  point() {
    this.tone({ freq: 523, duration: 0.09, gain: 0.5 });
    this.tone({ freq: 659, duration: 0.09, gain: 0.5, delay: 0.08 });
    this.tone({ freq: 784, duration: 0.14, gain: 0.5, delay: 0.16 });
  }

  /** Rakip sayı aldı — alçalan iki nota. */
  pointLost() {
    this.tone({ freq: 330, duration: 0.1, gain: 0.45, type: 'triangle' });
    this.tone({ freq: 220, duration: 0.16, gain: 0.45, type: 'triangle', delay: 0.09 });
  }

  /** Sultan Gücü hazır. */
  sultanReady() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      this.tone({ freq, duration: 0.1, gain: 0.42, delay: i * 0.06 });
    });
  }

  /** Sultan Gücü tetiklendi. */
  sultanFire() {
    this.tone({ freq: 180, endFreq: 1200, duration: 0.28, type: 'sawtooth', gain: 0.55 });
    this.noise({ duration: 0.3, gain: 0.35, filterFreq: 900 });
  }

  /** Hakem düdüğü — set/maç başı. */
  whistle() {
    this.tone({ freq: 2100, endFreq: 2400, duration: 0.1, type: 'sine', gain: 0.35 });
    this.tone({ freq: 2400, endFreq: 2000, duration: 0.12, type: 'sine', gain: 0.35, delay: 0.1 });
  }

  /** Set kazanıldı. */
  setWon() {
    [659, 784, 988].forEach((freq, i) => {
      this.tone({ freq, duration: 0.12, gain: 0.5, delay: i * 0.09 });
    });
  }

  /** Maç kazanıldı — kısa zafer marşı. */
  victory() {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((freq, i) => {
      this.tone({ freq, duration: 0.18, gain: 0.5, delay: i * 0.13 });
    });
    this.noise({ duration: 0.9, gain: 0.18, filterFreq: 2600, delay: 0.2 });
  }

  /** Maç kaybedildi. */
  defeat() {
    [523, 466, 415, 349].forEach((freq, i) => {
      this.tone({ freq, duration: 0.24, gain: 0.45, type: 'triangle', delay: i * 0.18 });
    });
  }

  /** Menü seçimi. */
  select() {
    this.tone({ freq: 880, duration: 0.06, gain: 0.4 });
  }

  /** Menüde onay. */
  confirm() {
    this.tone({ freq: 660, duration: 0.08, gain: 0.45 });
    this.tone({ freq: 990, duration: 0.12, gain: 0.45, delay: 0.07 });
  }
}

/** Uygulama genelinde tek örnek. */
export const Sfx = new SfxEngine();

export default Sfx;
