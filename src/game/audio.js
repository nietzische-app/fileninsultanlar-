/**
 * 8-bit / chiptune ses motoru.
 *
 * Katmanlar: master → sfxBus / crowdBus / musicBus
 * Efektler osilatör + filtrelenmiş gürültü ile anlık üretilir; tek bir
 * efekt dosyası yoktur. Tek istisna giriş ekranı müziği: o bir MP3
 * dosyasıdır ve `musicBus` üzerinden aynı master'a bağlanır, böylece
 * sessize alma düğmesi müziği de kapsar.
 *
 * Tarayıcı politikası: `Sfx.unlock()` ilk kullanıcı hareketinde.
 */

const MASTER_GAIN = 0.24;
const SFX_GAIN = 1;
const CROWD_GAIN = 0.85;
/** Müzik master'a girmeden önceki tavan — slider bunun üstünden çarpar. */
const MUSIC_GAIN = 1.35;
/** Döngü penceresi aranırken sessizlik sayılan genlik. */
const SILENCE = 0.004;

class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.crowdBus = null;
    this.muted = false;

    // --- Giriş müziği ---
    this.musicBus = null;
    this.musicVolume = 0.55;
    /** @type {null | ArrayBuffer} indirilen ham dosya */
    this.musicRaw = null;
    /** @type {null | AudioBuffer} çözülmüş ses */
    this.musicBuffer = null;
    /** @type {null | { source: AudioBufferSourceNode, fade: GainNode }} */
    this.musicVoice = null;
    /** Ekran müziği istiyor mu — indirme/çözme sırasında ekrandan
     *  çıkılırsa çalmaya başlamasın diye. */
    this.musicWanted = false;
    this.musicLoading = false;

    /** @type {null | { sources: AudioBufferSourceNode[], gain: GainNode }} */
    this.bed = null;
    this.bedLevel = 0;
  }

  /** İlk kullanıcı hareketinde çağrılır. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.ensureBed();
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SFX_GAIN;
    this.sfxBus.connect(this.master);

    this.crowdBus = this.ctx.createGain();
    this.crowdBus.gain.value = CROWD_GAIN;
    this.crowdBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = MUSIC_GAIN * this.musicVolume;
    this.musicBus.connect(this.master);

    this.ensureBed();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.value = muted ? 0 : MASTER_GAIN;
    }
    this.applyBedLevel(this.bedLevel);
  }

  // ===================================================================
  // Giriş müziği
  // ===================================================================

  /**
   * Müzik ses seviyesi (0–1). Kullanıcı ayarı; tercihte saklanır.
   *
   * Bağlam henüz açılmamışsa değer yalnızca saklanır ve `unlock()`
   * sırasında uygulanır — slider'ı ilk hareketten önce oynatan oyuncu
   * ayarını kaybetmesin.
   *
   * @param {number} value
   */
  setMusicVolume(value) {
    const v = Math.max(0, Math.min(1, Number(value) || 0));
    this.musicVolume = v;
    if (!this.musicBus || !this.ctx) return;
    // Ani sıçrama slider sürüklenirken tıklama sesi çıkarıyor
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(MUSIC_GAIN * v, t, 0.02);
  }

  /**
   * Dosyayı indirir. Bağlam gerektirmez, o yüzden ilk kullanıcı
   * hareketini beklemeden başlayabilir.
   * @param {string} url
   */
  async fetchMusic(url) {
    if (this.musicRaw || this.musicBuffer || this.musicLoading) return;
    this.musicLoading = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      this.musicRaw = await res.arrayBuffer();
    } catch {
      // Müzik indirilemezse oyun sessizce devam eder
      this.musicRaw = null;
    } finally {
      this.musicLoading = false;
    }
  }

  /**
   * Müziği başlatır (döngülü).
   *
   * Tarayıcı otomatik oynatmayı engellediği için bağlam yoksa sessizce
   * vazgeçer; çağıran ilk kullanıcı hareketinde tekrar dener.
   *
   * @param {string} url
   * @returns {Promise<boolean>} çalmaya başladı mı
   */
  async startMusic(url) {
    this.musicWanted = true;
    if (!this.ctx || !this.musicBus) return false;
    if (this.musicVoice) return true;

    if (!this.musicBuffer) {
      if (!this.musicRaw) await this.fetchMusic(url);
      if (!this.musicRaw) return false;
      try {
        // decodeAudioData ArrayBuffer'ı tüketiyor; kopyasını ver ki
        // ikinci deneme (ör. otomatik oynatma engeli) boşa düşmesin.
        this.musicBuffer = await this.ctx.decodeAudioData(this.musicRaw.slice(0));
      } catch {
        return false;
      }
    }

    // İndirme/çözme sürerken ekrandan çıkılmış olabilir
    if (!this.musicWanted || this.musicVoice) return false;

    const { start, end } = musicLoopWindow(this.musicBuffer);
    const now = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.loopStart = start;
    source.loopEnd = end;

    // Açılış sertliğini almak için kısa bir yükselme
    const fade = this.ctx.createGain();
    fade.gain.setValueAtTime(0.0001, now);
    fade.gain.exponentialRampToValueAtTime(1, now + 0.9);

    source.connect(fade);
    fade.connect(this.musicBus);
    source.start(now, start);

    this.musicVoice = { source, fade };
    return true;
  }

  /**
   * Müziği söndürerek durdurur.
   * @param {{ fade?: number }} [opts]
   */
  stopMusic({ fade = 0.45 } = {}) {
    this.musicWanted = false;
    const voice = this.musicVoice;
    if (!voice || !this.ctx) return;
    this.musicVoice = null;

    const now = this.ctx.currentTime;
    try {
      voice.fade.gain.cancelScheduledValues(now);
      voice.fade.gain.setValueAtTime(Math.max(0.0001, voice.fade.gain.value), now);
      voice.fade.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      voice.source.stop(now + fade + 0.05);
    } catch {
      // Zaten durmuş olabilir
    }
  }

  /** @returns {AudioNode} */
  bus(kind = 'sfx') {
    if (!this.ctx) return null;
    return kind === 'crowd' ? this.crowdBus : this.sfxBus;
  }

  /**
   * Rastgele pitch sapması — aynı sesin mekanik tekrarını kırar.
   * @param {number} amount 0–1
   */
  jitter(amount = 0.03) {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  /**
   * Tek (veya detune'lu çift) osilatör notası.
   * @param {object} opts
   */
  tone({
    freq = 440,
    endFreq,
    duration = 0.12,
    type = 'square',
    gain = 0.6,
    delay = 0,
    detune = 0,
    bus = 'sfx',
  } = {}) {
    if (!this.ctx || this.muted) return;
    const dest = this.bus(bus);
    if (!dest) return;

    const start = this.ctx.currentTime + delay;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    env.connect(dest);

    const voices = detune ? 2 : 1;
    for (let i = 0; i < voices; i += 1) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      const f = freq * (i === 1 ? 1 + detune : 1);
      osc.frequency.setValueAtTime(f, start);
      if (endFreq) {
        const end = endFreq * (i === 1 ? 1 + detune : 1);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
      }
      osc.connect(env);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    }
  }

  /**
   * Filtrelenmiş gürültü patlaması.
   * @param {object} opts
   */
  noise({
    duration = 0.14,
    gain = 0.35,
    delay = 0,
    filterFreq = 1400,
    filterType = 'bandpass',
    q = 0.8,
    bus = 'sfx',
  } = {}) {
    if (!this.ctx || this.muted) return;
    const dest = this.bus(bus);
    if (!dest) return;

    const start = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Hafif "pembe" eğilim — düşük frekans biraz daha güçlü
    let brown = 0;
    for (let i = 0; i < frames; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.02) * 0.98;
      const mix = white * 0.7 + brown * 0.3;
      data[i] = mix * (1 - i / frames);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(Math.max(0.0002, gain), start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(start);
  }

  /**
   * Tribün / alkış katmanı.
   * @param {{ intensity?: number, duration?: number, delay?: number }} [opts]
   */
  crowd({ intensity = 1, duration = 0.7, delay = 0 } = {}) {
    const g = Math.min(1.8, intensity);
    this.noise({
      duration,
      gain: 0.12 * g,
      filterFreq: 2200,
      filterType: 'bandpass',
      q: 0.6,
      delay,
      bus: 'crowd',
    });
    this.noise({
      duration: duration * 0.8,
      gain: 0.1 * g,
      filterFreq: 900,
      filterType: 'lowpass',
      delay: delay + 0.03,
      bus: 'crowd',
    });
    this.noise({
      duration: duration * 0.5,
      gain: 0.08 * g,
      filterFreq: 4200,
      filterType: 'highpass',
      delay: delay + 0.08,
      bus: 'crowd',
    });
  }

  /** Kısa arpej — zafer / hazır motifleri. */
  arp(notes, { step = 0.07, duration = 0.1, gain = 0.45, type = 'square', delay = 0 } = {}) {
    notes.forEach((freq, i) => {
      this.tone({
        freq,
        duration,
        gain,
        type,
        delay: delay + i * step,
        detune: 0.004,
      });
    });
  }

  // --- Atmosphere (sürekli tribün yatağı) ------------------------------

  ensureBed() {
    if (!this.ctx || this.bed) return;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.crowdBus);

    const sources = [900, 1800, 3200].map((freq, i) => {
      const duration = 1.4 + i * 0.2;
      const frames = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let n = 0; n < frames; n += 1) {
        data[n] = (Math.random() * 2 - 1) * 0.55;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 0.5;

      const voice = this.ctx.createGain();
      voice.gain.value = 0.045 - i * 0.008;

      src.connect(filter);
      filter.connect(voice);
      voice.connect(gain);
      src.start();
      return src;
    });

    this.bed = { sources, gain };
    this.applyBedLevel(this.bedLevel);
  }

  /**
   * Maç atmosfer seviyesi (0–1). Rally + hype ile yükselir.
   * @param {number} level
   */
  setAtmosphere(level = 0) {
    this.bedLevel = Math.max(0, Math.min(1, level));
    if (!this.ctx) return;
    this.ensureBed();
    this.applyBedLevel(this.bedLevel);
  }

  applyBedLevel(level) {
    if (!this.bed || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0.0001 : 0.0001 + level * 0.22;
    this.bed.gain.gain.cancelScheduledValues(now);
    this.bed.gain.gain.setTargetAtTime(target, now, 0.18);
  }

  /** Maç bitince / ekran değişince yatağı söndür. */
  hushAtmosphere() {
    this.setAtmosphere(0);
  }

  // --- Oyun efektleri -------------------------------------------------

  /** Manşet / normal temas. */
  bump() {
    const j = this.jitter(0.04);
    this.tone({ freq: 300 * j, endFreq: 210 * j, duration: 0.055, gain: 0.42, type: 'triangle' });
    this.noise({ duration: 0.04, gain: 0.12, filterFreq: 1600, filterType: 'highpass' });
  }

  /** Kuvvetli yer vuruşu. */
  hit() {
    const j = this.jitter(0.05);
    this.tone({ freq: 480 * j, endFreq: 260 * j, duration: 0.08, gain: 0.55, type: 'square' });
    this.tone({
      freq: 180 * j,
      endFreq: 90 * j,
      duration: 0.1,
      gain: 0.28,
      type: 'sine',
      delay: 0.01,
    });
    this.noise({ duration: 0.06, gain: 0.18, filterFreq: 1400 });
  }

  /** Smaç — thump + whoosh + tiz kırılma. */
  spike() {
    const j = this.jitter(0.04);
    this.noise({ duration: 0.1, gain: 0.38, filterFreq: 2000, filterType: 'bandpass' });
    this.noise({
      duration: 0.14,
      gain: 0.22,
      filterFreq: 500,
      filterType: 'lowpass',
      delay: 0.01,
    });
    this.tone({
      freq: 760 * j,
      endFreq: 140 * j,
      duration: 0.18,
      type: 'sawtooth',
      gain: 0.48,
      detune: 0.012,
    });
    this.tone({
      freq: 110 * j,
      endFreq: 55 * j,
      duration: 0.16,
      type: 'sine',
      gain: 0.35,
      delay: 0.015,
    });
  }

  /** Dalış — kayma / sürtünme. */
  dive() {
    const j = this.jitter(0.03);
    this.noise({ duration: 0.28, gain: 0.3, filterFreq: 650, filterType: 'lowpass', q: 0.4 });
    this.tone({
      freq: 280 * j,
      endFreq: 120 * j,
      duration: 0.22,
      type: 'sine',
      gain: 0.28,
    });
  }

  /** Dalış kurtarışı. */
  save() {
    const j = this.jitter(0.03);
    this.arp([392 * j, 523 * j, 659 * j], { step: 0.055, duration: 0.09, gain: 0.48 });
    this.noise({ duration: 0.14, gain: 0.22, filterFreq: 1500, delay: 0.02 });
    this.crowd({ intensity: 0.6, duration: 0.38, delay: 0.04 });
  }

  /** Blok — metalik tok. */
  block() {
    const j = this.jitter(0.04);
    this.tone({
      freq: 220 * j,
      endFreq: 90 * j,
      duration: 0.12,
      type: 'square',
      gain: 0.62,
      detune: 0.01,
    });
    this.tone({
      freq: 880 * j,
      endFreq: 440 * j,
      duration: 0.06,
      type: 'triangle',
      gain: 0.28,
      delay: 0.01,
    });
    this.noise({ duration: 0.08, gain: 0.25, filterFreq: 2400, filterType: 'highpass' });
    this.crowd({ intensity: 0.5, duration: 0.3, delay: 0.02 });
  }

  /** File teması — lastik/tel titreşimi. */
  net() {
    const j = this.jitter(0.05);
    this.tone({
      freq: 190 * j,
      endFreq: 130 * j,
      duration: 0.09,
      type: 'triangle',
      gain: 0.38,
    });
    this.tone({
      freq: 520 * j,
      endFreq: 360 * j,
      duration: 0.07,
      type: 'sine',
      gain: 0.2,
      delay: 0.02,
    });
    this.noise({ duration: 0.05, gain: 0.1, filterFreq: 3000, filterType: 'highpass' });
  }

  /** Top yere düştü. */
  ground() {
    const j = this.jitter(0.03);
    this.tone({
      freq: 140 * j,
      endFreq: 48 * j,
      duration: 0.22,
      type: 'sine',
      gain: 0.72,
    });
    this.noise({ duration: 0.12, gain: 0.28, filterFreq: 400, filterType: 'lowpass' });
    this.tone({
      freq: 70 * j,
      endFreq: 35 * j,
      duration: 0.18,
      type: 'triangle',
      gain: 0.3,
      delay: 0.02,
    });
  }

  /** Sayı — yükselen arpej + tribün. */
  point() {
    this.arp([523, 659, 784, 1047], {
      step: 0.075,
      duration: 0.1,
      gain: 0.5,
      type: 'square',
    });
    this.tone({
      freq: 1319,
      duration: 0.14,
      gain: 0.32,
      type: 'triangle',
      delay: 0.3,
      detune: 0.006,
    });
    this.crowd({ intensity: 0.95, duration: 0.6, delay: 0.04 });
  }

  /**
   * Üst üste sayı.
   * @param {number} [count]
   */
  streak(count = 3) {
    const steps = Math.min(7, Math.max(3, count));
    const base = [523, 659, 784, 988, 1175, 1319, 1568];
    this.arp(base.slice(0, steps), { step: 0.065, duration: 0.1, gain: 0.5 });
    this.crowd({ intensity: 1.0 + steps * 0.1, duration: 0.75, delay: 0.04 });
    if (steps >= 5) {
      this.tone({
        freq: 1760,
        duration: 0.16,
        gain: 0.28,
        type: 'triangle',
        delay: steps * 0.065,
      });
    }
  }

  /**
   * Ralli kombosu — her adımda tizleşen motif.
   * @param {number} [count]
   */
  combo(count = 2) {
    const step = Math.min(10, Math.max(1, count));
    const root = 392 + step * 55;
    this.tone({
      freq: root,
      endFreq: root + 160,
      duration: 0.08,
      type: 'square',
      gain: 0.42,
      detune: 0.008,
    });
    this.tone({
      freq: root * 1.5,
      duration: 0.07,
      gain: 0.28,
      type: 'triangle',
      delay: 0.04,
    });
    if (step >= 3) {
      this.noise({ duration: 0.05, gain: 0.12, filterFreq: 2800, delay: 0.02 });
    }
    if (step >= 5) {
      this.arp([root, root * 1.25, root * 1.5], {
        step: 0.04,
        duration: 0.07,
        gain: 0.35,
        delay: 0.05,
      });
      this.crowd({ intensity: 0.5 + step * 0.06, duration: 0.32, delay: 0.02 });
    }
    if (step >= 8) {
      this.tone({
        freq: root * 2,
        duration: 0.12,
        gain: 0.3,
        type: 'sawtooth',
        delay: 0.1,
      });
    }
  }

  /**
   * Plase — yumuşak, kısa "tık".
   * Smaçtan belirgin biçimde farklı duyulmalı: oyuncu sesten hangi
   * hamlenin yapıldığını anlayabilmeli.
   */
  tip() {
    this.tone({
      freq: 880 * this.jitter(0.02),
      endFreq: 760,
      duration: 0.06,
      type: 'sine',
      gain: 0.4,
    });
    this.tone({
      freq: 1320,
      duration: 0.04,
      type: 'triangle',
      gain: 0.22,
      delay: 0.03,
    });
  }

  /** Tam vuruş — zamanlamayı ödüllendiren parlak çınlama. */
  perfect() {
    this.tone({
      freq: 1046 * this.jitter(0.015),
      duration: 0.05,
      type: 'square',
      gain: 0.35,
      detune: 0.006,
    });
    this.tone({
      freq: 1568,
      duration: 0.09,
      type: 'square',
      gain: 0.3,
      delay: 0.04,
    });
    this.noise({ duration: 0.05, gain: 0.1, filterFreq: 5200, delay: 0.02 });
  }

  /** Rakip sayı. */
  pointLost() {
    this.tone({ freq: 349, duration: 0.1, gain: 0.42, type: 'triangle' });
    this.tone({ freq: 262, duration: 0.14, gain: 0.4, type: 'triangle', delay: 0.09 });
    this.tone({ freq: 196, duration: 0.18, gain: 0.32, type: 'sine', delay: 0.18 });
    this.crowd({ intensity: 0.25, duration: 0.35, delay: 0.05 });
  }

  /** Sultan Gücü hazır — parlak fanfar. */
  sultanReady() {
    this.arp([523, 659, 784, 1047, 1319], {
      step: 0.055,
      duration: 0.09,
      gain: 0.44,
    });
    this.tone({
      freq: 1568,
      duration: 0.18,
      gain: 0.3,
      type: 'triangle',
      delay: 0.28,
      detune: 0.01,
    });
    this.noise({ duration: 0.12, gain: 0.12, filterFreq: 3500, delay: 0.2 });
  }

  /** Sultan Gücü ateşi — yükselen whoosh + bass. */
  sultanFire() {
    this.tone({
      freq: 140,
      endFreq: 1400,
      duration: 0.32,
      type: 'sawtooth',
      gain: 0.5,
      detune: 0.015,
    });
    this.tone({
      freq: 80,
      endFreq: 40,
      duration: 0.28,
      type: 'sine',
      gain: 0.4,
      delay: 0.02,
    });
    this.noise({ duration: 0.35, gain: 0.38, filterFreq: 800, filterType: 'lowpass' });
    this.noise({
      duration: 0.2,
      gain: 0.2,
      filterFreq: 3000,
      filterType: 'highpass',
      delay: 0.05,
    });
    this.crowd({ intensity: 0.85, duration: 0.5, delay: 0.04 });
  }

  /** Hakem düdüğü. */
  whistle() {
    this.tone({
      freq: 2050,
      endFreq: 2450,
      duration: 0.11,
      type: 'sine',
      gain: 0.32,
    });
    this.tone({
      freq: 2450,
      endFreq: 1950,
      duration: 0.14,
      type: 'sine',
      gain: 0.3,
      delay: 0.1,
    });
    this.noise({
      duration: 0.08,
      gain: 0.06,
      filterFreq: 5000,
      filterType: 'highpass',
      delay: 0.02,
    });
  }

  /** Set kazanıldı. */
  setWon() {
    this.arp([659, 784, 988, 1175, 1319], {
      step: 0.08,
      duration: 0.12,
      gain: 0.5,
    });
    this.tone({
      freq: 1568,
      duration: 0.24,
      gain: 0.4,
      type: 'triangle',
      delay: 0.4,
      detune: 0.008,
    });
    this.crowd({ intensity: 1.25, duration: 0.95, delay: 0.06 });
  }

  /** Set kaybedildi. */
  setLost() {
    this.arp([523, 466, 392], { step: 0.12, duration: 0.16, gain: 0.4, type: 'triangle' });
    this.crowd({ intensity: 0.35, duration: 0.5, delay: 0.05 });
  }

  /** Maç zaferi. */
  victory() {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    this.arp(melody, { step: 0.11, duration: 0.16, gain: 0.5 });
    [784, 988, 1175, 1568].forEach((freq, i) => {
      this.tone({
        freq,
        duration: 0.2,
        gain: 0.28,
        type: 'triangle',
        delay: 0.35 + i * 0.13,
        detune: 0.006,
      });
    });
    this.crowd({ intensity: 1.55, duration: 1.6, delay: 0.08 });
    this.crowd({ intensity: 1.15, duration: 1.1, delay: 0.55 });
    this.setAtmosphere(0.85);
  }

  /** Maç yenilgisi. */
  defeat() {
    this.arp([523, 466, 415, 349, 294], {
      step: 0.16,
      duration: 0.22,
      gain: 0.42,
      type: 'triangle',
    });
    this.crowd({ intensity: 0.3, duration: 0.7, delay: 0.1 });
    this.hushAtmosphere();
  }

  /** Menü seçimi. */
  select() {
    const j = this.jitter(0.02);
    this.tone({ freq: 920 * j, duration: 0.05, gain: 0.36, type: 'square' });
  }

  /** Menü onay. */
  confirm() {
    this.tone({ freq: 660, duration: 0.07, gain: 0.42, type: 'square' });
    this.tone({
      freq: 990,
      duration: 0.11,
      gain: 0.42,
      type: 'square',
      delay: 0.06,
      detune: 0.005,
    });
  }

  /** Duraklat / devam tıklaması. */
  pause() {
    this.tone({ freq: 440, duration: 0.05, gain: 0.3, type: 'triangle' });
    this.tone({ freq: 330, duration: 0.07, gain: 0.28, type: 'triangle', delay: 0.05 });
  }
}

/** Uygulama genelinde tek örnek. */
export const Sfx = new SfxEngine();

export default Sfx;

/**
 * Döngü penceresi — baştaki ve sondaki sessizliği atar.
 *
 * MP3 kodlayıcısı dosyanın başına ve sonuna sessizlik ekliyor. Ham
 * tamponu olduğu gibi döngüye aldığımızda her turda duyulur bir boşluk
 * oluşuyordu; `loopStart`/`loopEnd` bu pencereye çekilince döngü
 * dikişsiz hale geliyor.
 *
 * @param {AudioBuffer} buffer
 * @returns {{ start: number, end: number }} saniye
 */
export function musicLoopWindow(buffer) {
  const data = buffer.getChannelData(0);
  const n = data.length;
  const rate = buffer.sampleRate;

  let start = 0;
  while (start < n && Math.abs(data[start]) < SILENCE) start += 1;

  let end = n - 1;
  while (end > start && Math.abs(data[end]) < SILENCE) end -= 1;

  // Tamamen sessiz dosyada pencere çökmesin
  if (start >= end) return { start: 0, end: n / rate };

  // Sıfır geçişini tam ortadan kesmek tık sesi veriyor; küçük pay bırak
  const pad = Math.round(rate * 0.005);
  return {
    start: Math.max(0, start - pad) / rate,
    end: Math.min(n - 1, end + pad) / rate,
  };
}
