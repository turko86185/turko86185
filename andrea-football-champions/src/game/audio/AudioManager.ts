/**
 * Audio completamente sintetizzato con Web Audio (nessun file esterno → funziona offline)
 * + voce italiana tramite la sintesi vocale del dispositivo (Safari iOS: voce "it-IT").
 */
type Sfx = 'whistle' | 'longWhistle' | 'kick' | 'pass' | 'bounce' | 'post' | 'goal' | 'save' | 'cheer' | 'ooh' | 'click' | 'star' | 'net' | 'applause';

class AudioManagerImpl {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private jingleGain!: GainNode;
  private crowdGain!: GainNode;
  private noiseBuf!: AudioBuffer;
  private crowdSrc: AudioBufferSourceNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNext = 0;
  sfxOn = true;
  musicOn = true;
  voiceOn = true;
  private voice: SpeechSynthesisVoice | null = null;

  /** Va chiamato da un gesto dell'utente (requisito di iOS) */
  unlock() {
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.22; this.musicGain.connect(this.master);
      this.jingleGain = this.ctx.createGain(); this.jingleGain.gain.value = 0.55; this.jingleGain.connect(this.master);
      this.crowdGain = this.ctx.createGain(); this.crowdGain.gain.value = 0; this.crowdGain.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    // sblocca la sintesi vocale su iOS con un'enunciazione vuota
    try {
      if ('speechSynthesis' in window && !this.voice) {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
        this.pickVoice();
        speechSynthesis.onvoiceschanged = () => this.pickVoice();
      }
    } catch { /* nessuna voce disponibile */ }
  }

  private pickVoice() {
    const vs = speechSynthesis.getVoices();
    this.voice = vs.find((v) => v.lang === 'it-IT' && /Alice|Federica|Luca|Paola/i.test(v.name)) ?? vs.find((v) => v.lang?.startsWith('it')) ?? null;
  }

  setSettings(s: { sfx: boolean; music: boolean; voice: boolean }) {
    this.sfxOn = s.sfx; this.musicOn = s.music; this.voiceOn = s.voice;
    this.applySettings();
  }

  private applySettings() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.sfxOn ? 1 : 0;
    this.crowdGain.gain.value = this.sfxOn ? this.crowdGain.gain.value : 0;
    this.musicGain.gain.value = this.musicOn ? 0.22 : 0;
    this.jingleGain.gain.value = this.musicOn ? 0.55 : 0;
    if (!this.voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  /** Voce italiana */
  say(text: string, opts?: { rate?: number; pitch?: number }) {
    if (!this.voiceOn || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT';
      if (this.voice) u.voice = this.voice;
      u.rate = opts?.rate ?? 1.0;
      u.pitch = opts?.pitch ?? 1.25;
      speechSynthesis.speak(u);
    } catch { /* ignora */ }
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private noise(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack = 0.005, dest?: AudioNode) {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    src.connect(f).connect(g).connect(dest ?? this.sfxGain);
    this.env(g, t, attack, peak, dur);
    src.start(t, Math.random()); src.stop(t + attack + dur + 0.05);
    return { f, g };
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, peak: number, dest?: AudioNode, attack = 0.01) {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    o.connect(g).connect(dest ?? this.sfxGain);
    this.env(g, t, attack, peak, dur);
    o.start(t); o.stop(t + attack + dur + 0.05);
    return o;
  }

  play(s: Sfx, intensity = 1) {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.005;
    switch (s) {
      case 'whistle':
      case 'longWhistle': {
        const dur = s === 'whistle' ? 0.35 : 0.9;
        const o = this.tone(t, 2900, dur, 'sine', 0.25);
        const lfo = this.ctx.createOscillator(); lfo.frequency.value = 28;
        const lg = this.ctx.createGain(); lg.gain.value = 120;
        lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1);
        this.noise(t, dur, 'bandpass', 3000, 8, 0.05);
        if (s === 'longWhistle') { const o2 = this.tone(t + 1.0, 2900, 0.4, 'sine', 0.22); void o2; }
        break;
      }
      case 'kick': {
        const o = this.tone(t, 160, 0.12, 'sine', 0.9 * intensity);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
        this.noise(t, 0.06, 'lowpass', 1800, 1, 0.6 * intensity);
        break;
      }
      case 'pass': {
        const o = this.tone(t, 220, 0.08, 'sine', 0.5);
        o.frequency.exponentialRampToValueAtTime(80, t + 0.08);
        this.noise(t, 0.04, 'lowpass', 1500, 1, 0.3);
        break;
      }
      case 'bounce': {
        const o = this.tone(t, 120, 0.08, 'sine', Math.min(0.5, 0.1 * intensity));
        o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
        break;
      }
      case 'post': {
        [523, 1046, 1568, 2093].forEach((f, i) => this.tone(t, f * 1.02, 0.6 - i * 0.1, 'triangle', 0.25 / (i + 1)));
        this.play('ooh');
        break;
      }
      case 'net': this.noise(t, 0.25, 'highpass', 2500, 0.7, 0.25); break;
      case 'save': this.noise(t, 0.12, 'lowpass', 900, 1, 0.6); this.play('ooh'); break;
      case 'goal': {
        // tromba da stadio + boato
        // (la fanfara musicale è in jingle('goal'); qui solo boato e applausi)
        this.noise(t, 3.2, 'bandpass', 900, 0.5, 0.7, 0.15);
        this.noise(t + 0.2, 3.0, 'bandpass', 2200, 0.8, 0.3, 0.2);
        this.play('applause');
        break;
      }
      case 'cheer': this.noise(t, 1.6, 'bandpass', 1000, 0.6, 0.35, 0.1); break;
      case 'ooh': {
        const { f } = this.noise(t, 1.0, 'bandpass', 500, 3, 0.35, 0.1);
        f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(350, t + 1.0);
        break;
      }
      case 'applause': {
        for (let i = 0; i < 40; i++) this.noise(t + Math.random() * 2.2, 0.03, 'bandpass', 1500 + Math.random() * 2500, 1.5, 0.15 + Math.random() * 0.15, 0.002);
        break;
      }
      case 'click': this.tone(t, 880, 0.06, 'square', 0.08); break;
      case 'star': [988, 1319, 1760].forEach((f, i) => this.tone(t + i * 0.09, f, 0.25, 'triangle', 0.2)); break;
    }
  }

  // ---------------------------------------------------------------- MUSICHE DI GOL E PARATA
  /** Strumento "ottoni": dente di sega filtrato con attacco morbido */
  private brass(t: number, midi: number, dur: number, vol: number) {
    const c = this.ctx!;
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1;
    f.frequency.setValueAtTime(hz * 1.5, t);
    f.frequency.linearRampToValueAtTime(hz * 5, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(hz * 2.2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol * 0.8, t + Math.max(0.04, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    f.connect(g).connect(this.jingleGain);
    for (const det of [-6, 6]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.1);
    }
  }
  private drum(t: number, kind: 'kick' | 'snare' | 'crash' | 'tom', vol = 1) {
    const c = this.ctx!;
    if (kind === 'kick' || kind === 'tom') {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(kind === 'kick' ? 150 : 220, t); o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 45 : 90, t + 0.15);
      g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(this.jingleGain); o.start(t); o.stop(t + 0.25);
    } else {
      const src = c.createBufferSource(); src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = kind === 'snare' ? 'bandpass' : 'highpass';
      f.frequency.value = kind === 'snare' ? 1800 : 5000;
      const g = c.createGain(); const d = kind === 'snare' ? 0.18 : 1.6;
      g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f).connect(g).connect(this.jingleGain); src.start(t, Math.random()); src.stop(t + d + 0.05);
    }
  }

  /**
   * Musiche brevi per i momenti importanti:
   *  goal = fanfara da stadio, save = parata eroica, win = vittoria, cup = coppa, ohno = "peccato" simpatico
   */
  jingle(name: 'goal' | 'save' | 'win' | 'cup' | 'ohno') {
    if (!this.ctx || !this.musicOn) return;
    const t0 = this.ctx.currentTime + 0.05;
    const b = 60 / 150; // battito
    // [nota midi, inizio in battiti, durata in battiti]
    const N = (seq: [number, number, number][], vol = 0.16) => seq.forEach(([m, st, d]) => this.brass(t0 + st * b, m, d * b, vol));
    const chord = (notes: number[], st: number, d: number, vol = 0.07) => notes.forEach((m) => this.brass(t0 + st * b, m, d * b, vol));
    switch (name) {
      case 'goal': {
        // rullo di tamburi + fanfara ascendente + accordo finale
        for (let i = 0; i < 8; i++) this.drum(t0 + i * b * 0.25, 'snare', 0.4 + i * 0.08);
        N([[67, 2, 0.5], [72, 2.5, 0.5], [76, 3, 0.5], [79, 3.5, 1.5], [76, 5, 0.5], [79, 5.5, 2.5]]);
        N([[84, 8, 0.5], [83, 8.5, 0.5], [81, 9, 0.5], [79, 9.5, 0.5], [84, 10, 3]], 0.15);
        chord([48, 60, 64, 67], 2, 3.5); chord([53, 65, 69, 72], 5.5, 2.5); chord([55, 67, 71, 74], 8, 2); chord([48, 60, 64, 67, 72], 10, 3);
        [2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((x) => this.drum(t0 + x * b, 'kick'));
        [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5].forEach((x) => this.drum(t0 + x * b, 'snare', 0.6));
        this.drum(t0 + 2 * b, 'crash'); this.drum(t0 + 10 * b, 'crash');
        break;
      }
      case 'save': {
        N([[72, 0, 0.33], [76, 0.33, 0.33], [79, 0.66, 0.34], [84, 1, 2]], 0.16);
        chord([60, 64, 67], 1, 2); chord([48], 1, 2, 0.1);
        this.drum(t0, 'tom'); this.drum(t0 + 0.33 * b, 'tom'); this.drum(t0 + 0.66 * b, 'tom');
        this.drum(t0 + b, 'kick'); this.drum(t0 + b, 'crash');
        break;
      }
      case 'win': {
        N([[72, 0, 0.5], [72, 0.5, 0.5], [72, 1, 0.5], [72, 1.5, 1], [68, 2.5, 1], [70, 3.5, 1], [72, 4.5, 0.66], [70, 5.16, 0.34], [72, 5.5, 2.5]], 0.15);
        chord([48, 60, 64, 67], 0, 2.5); chord([44, 56, 60, 63], 2.5, 1); chord([46, 58, 62, 65], 3.5, 1); chord([48, 60, 64, 67, 72], 5.5, 2.5);
        [0, 1, 2, 3, 4, 5.5].forEach((x) => this.drum(t0 + x * b, 'kick')); this.drum(t0 + 5.5 * b, 'crash');
        break;
      }
      case 'cup': {
        N([[67, 0, 1], [72, 1, 1.5], [71, 2.5, 0.5], [72, 3, 1], [76, 4, 1], [74, 5, 1.5], [72, 6.5, 0.5], [74, 7, 1], [79, 8, 3]], 0.15);
        N([[79, 11, 0.5], [81, 11.5, 0.5], [83, 12, 0.5], [84, 12.5, 3.5]], 0.15);
        chord([48, 60, 64], 0, 4); chord([53, 65, 69], 4, 2.5); chord([55, 67, 71], 6.5, 4.5); chord([48, 60, 64, 67, 72], 12.5, 3.5);
        for (let x = 0; x < 16; x += 1) this.drum(t0 + x * b, x % 2 ? 'snare' : 'kick', 0.7);
        [0, 8, 12.5].forEach((x) => this.drum(t0 + x * b, 'crash'));
        break;
      }
      case 'ohno': {
        // "uà uà uà uààà" simpatico, senza drammi
        [[67, 0, 0.8], [66, 0.8, 0.8], [65, 1.6, 0.8], [64, 2.4, 2]].forEach(([m, st, d]) => {
          this.brass(t0 + st * b, m, d * b, 0.12);
        });
        break;
      }
    }
  }

  /** Brusio continuo del pubblico */
  startCrowd() {
    if (!this.ctx || this.crowdSrc) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.4;
    src.connect(f).connect(this.crowdGain);
    src.start();
    this.crowdSrc = src;
    this.crowdGain.gain.setTargetAtTime(this.sfxOn ? 0.12 : 0, this.ctx.currentTime, 0.5);
    this.chantLoop();
  }

  stopCrowd() {
    if (!this.ctx || !this.crowdSrc) return;
    this.crowdGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    const s = this.crowdSrc; this.crowdSrc = null;
    setTimeout(() => s.stop(), 1500);
  }

  private chantTimer: number | null = null;
  /** Coro ritmico del pubblico: "po-po-po" con battimani */
  private chantLoop() {
    if (this.chantTimer) clearInterval(this.chantTimer);
    this.chantTimer = window.setInterval(() => {
      if (!this.ctx || !this.crowdSrc || !this.sfxOn) return;
      if (Math.random() < 0.5) return;
      const t = this.ctx.currentTime + 0.05;
      const melody = [392, 392, 440, 392, 349, 330];
      melody.forEach((fr, i) => {
        const o = this.tone(t + i * 0.28, fr, 0.22, 'sawtooth', 0.025, this.crowdGain, 0.03);
        void o;
        this.noise(t + i * 0.28, 0.2, 'bandpass', fr * 2, 2, 0.08, 0.03, this.crowdGain);
      });
      for (let i = 0; i < 6; i++) this.noise(t + 1.8 + i * 0.28, 0.04, 'bandpass', 2000, 1, 0.15, 0.002, this.crowdGain);
    }, 6000);
  }

  crowdLevel(v: number) {
    if (!this.ctx) return;
    this.crowdGain.gain.setTargetAtTime(this.sfxOn ? v : 0, this.ctx.currentTime, 0.3);
  }

  /** Musica allegra in loop (sequencer semplice) */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    if (!this.ctx) return;
    const stepDur = 0.16;
    const lead = [72, 76, 79, 76, 77, 81, 79, 0, 76, 79, 84, 79, 81, 77, 79, 0, 72, 74, 76, 77, 79, 81, 83, 84, 83, 79, 76, 74, 72, 0, 72, 0];
    const bass = [48, 48, 55, 55, 53, 53, 55, 55];
    while (this.musicNext < this.ctx.currentTime + 0.4) {
      const i = this.musicStep % lead.length;
      const n = lead[i];
      const t = this.musicNext;
      const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
      if (n) this.tone(t, hz(n), stepDur * 0.8, 'square', 0.12, this.musicGain);
      if (i % 4 === 0) this.tone(t, hz(bass[(i / 4) % bass.length]), stepDur * 3, 'triangle', 0.35, this.musicGain);
      if (i % 2 === 0) this.noise(t, 0.03, 'highpass', 7000, 1, 0.08, 0.002, this.musicGain);
      if (i % 8 === 4) this.noise(t, 0.08, 'bandpass', 1800, 1, 0.18, 0.002, this.musicGain);
      this.musicNext += stepDur;
      this.musicStep++;
    }
  }
}

export const Audio = new AudioManagerImpl();
