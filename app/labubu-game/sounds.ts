// Minimal, mobile-friendly sound engine using WebAudio.
// Unlocks on first user gesture (tap/click).

export class GameSounds {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private unlocked = false;

  init() {
    if (this.ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return; // No WebAudio (very old browser)
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
  }

  // Call this on the first user gesture (we do it in Start + on canvas touch)
  async unlock() {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.unlocked) return;

    try {
      if (this.ctx.state !== 'running') {
        await this.ctx.resume();
      }
      this.unlocked = true;
    } catch {
      // ignore
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 0.8;
    }
    return this.muted;
  }

  // ---- SFX helpers ----
  private blip(freq: number, time = 0.12) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.4, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + time);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + time + 0.02);
  }

  private noiseHit(time = 0.2) {
    if (!this.ctx || !this.master) return;
    const bufferSize = 2 * this.ctx.sampleRate * time;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  playCollectSound(golden = false) {
    // Golden: brighter blips
    this.blip(golden ? 880 : 660, 0.08);
    setTimeout(() => this.blip(golden ? 1320 : 990, 0.08), 60);
  }

  playMissSound() {
    this.noiseHit(0.15);
    setTimeout(() => this.blip(220, 0.1), 10);
  }

  playHeartSound() {
    this.blip(523.25, 0.08);
    setTimeout(() => this.blip(659.25, 0.08), 70);
  }

  playPowerUpSound() {
    this.blip(784, 0.1);
    setTimeout(() => this.blip(988, 0.1), 80);
  }

  playGameOverSound() {
    this.blip(196, 0.18);
    setTimeout(() => this.blip(147, 0.18), 120);
  }

  playBackgroundMusic() {
    if (!this.ctx || !this.master) return;
    if (this.musicOsc) return; // already playing

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.05; // subtle
    this.musicGain.connect(this.master);

    this.musicOsc = this.ctx.createOscillator();
    this.musicOsc.type = 'triangle';
    this.musicOsc.frequency.value = 220;
    this.musicOsc.connect(this.musicGain);
    this.musicOsc.start();

    // gentle pulse
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.25;
    lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(this.musicOsc.frequency as any);
    lfo.start();
  }
}