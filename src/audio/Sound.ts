/**
 * Fully procedural WebAudio sound design — no audio files.
 *  - rolling rumble + motor tone that track speed
 *  - wind when airborne
 *  - ambient pad that darkens in bear markets
 *  - one-shot chimes for pickups, gates, landings and margin calls
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private rollGain!: GainNode;
  private rollFilter!: BiquadFilterNode;
  private motor!: OscillatorNode;
  private motorGain!: GainNode;
  private motorFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private padFilter!: BiquadFilterNode;
  private padGain!: GainNode;
  private padOsc: OscillatorNode[] = [];
  private noiseBuf!: AudioBuffer;
  muted = false;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // white noise buffer
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // rolling rumble
    const roll = this.noise();
    this.rollFilter = ctx.createBiquadFilter();
    this.rollFilter.type = 'bandpass';
    this.rollFilter.Q.value = 0.8;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    roll.connect(this.rollFilter).connect(this.rollGain).connect(this.master);

    // motor
    this.motor = ctx.createOscillator();
    this.motor.type = 'sawtooth';
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorFilter.frequency.value = 400;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorFilter).connect(this.motorGain).connect(this.master);
    this.motor.start();

    // wind
    const wind = this.noise();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'highpass';
    this.windFilter.frequency.value = 800;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);

    // ambient pad: A minor-ish stack, detuned saws through a slow filter
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 700;
    this.padFilter.Q.value = 2;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.0;
    this.padGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
    this.padFilter.connect(this.padGain).connect(this.master);
    for (const f of [110, 164.81, 220.5, 261.63, 329.0]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 14;
      o.connect(this.padFilter);
      o.start();
      this.padOsc.push(o);
    }
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(this.padFilter.frequency);
    lfo.start();
  }

  private noise(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.start();
    return s;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  /** Continuous layer update (call every frame). */
  update(speed: number, grounded: boolean, airborne: boolean, boosting: boolean, bear: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, speed / 100);
    this.rollGain.gain.setTargetAtTime(grounded ? 0.05 + s * 0.35 : 0, t, 0.05);
    this.rollFilter.frequency.setTargetAtTime(120 + s * 900, t, 0.1);
    this.motor.frequency.setTargetAtTime(48 + s * 140 + (boosting ? 40 : 0), t, 0.08);
    this.motorFilter.frequency.setTargetAtTime(250 + s * 1200 + (boosting ? 1500 : 0), t, 0.08);
    this.motorGain.gain.setTargetAtTime(0.025 + s * 0.05 + (boosting ? 0.05 : 0), t, 0.1);
    this.windGain.gain.setTargetAtTime(airborne ? 0.08 + s * 0.2 : s * 0.05, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(600 + s * 2400, t, 0.2);
    // pad detunes toward a darker chord in bear markets
    const shift = 1 - bear * 0.0595; // ~ down a semitone
    this.padOsc.forEach((o, i) => o.frequency.setTargetAtTime([110, 164.81, 220.5, 261.63, 329.0][i] * (i % 2 ? shift : 1), t, 1.5));
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, glideTo?: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private thump(gain: number, freq = 120) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 0.4);
    this.tone(freq, 0.3, 'sine', gain * 0.8, 0, freq * 0.5);
  }

  private coreStep = 0;
  core() {
    // rising pentatonic run so strings of cores "play a melody"
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const n = scale[this.coreStep++ % scale.length];
    this.tone(880 * Math.pow(2, n / 12), 0.18, 'triangle', 0.07);
  }

  resetCoreRun() {
    this.coreStep = 0;
  }

  product() {
    [0, 4, 7, 12, 16].forEach((n, i) => this.tone(523.25 * Math.pow(2, n / 12), 0.6, 'triangle', 0.09, i * 0.06));
    this.tone(130.8, 0.8, 'sine', 0.15);
  }

  gate(kind: string) {
    if (kind === 'crash') {
      [0, -3, -6].forEach((n, i) => this.tone(330 * Math.pow(2, n / 12), 0.7, 'sawtooth', 0.04, i * 0.12));
      this.thump(0.25, 70);
    } else {
      const base = kind === 'record' ? 659.25 : 523.25;
      [0, 7, 12, 19].forEach((n, i) => this.tone(base * Math.pow(2, n / 12), 1.1, 'sine', 0.08, i * 0.09));
    }
  }

  jump() {
    this.tone(260, 0.25, 'square', 0.04, 0, 620);
  }

  land(impact: number) {
    this.thump(Math.min(0.5, 0.08 + impact / 60));
  }

  marginCall() {
    this.tone(440, 1.2, 'sawtooth', 0.08, 0, 55);
    this.thump(0.4, 60);
  }

  ath() {
    [0, 4, 7, 11, 14].forEach((n, i) => this.tone(587.33 * Math.pow(2, n / 12), 0.9, 'triangle', 0.07, i * 0.07));
  }

  finish() {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 1.6, 'triangle', 0.09, i * 0.11));
    this.tone(98, 2.5, 'sine', 0.2);
  }
}
