export class GameSounds {
  private audioContext: AudioContext | null = null;
  private isMuted: boolean = false;
  
  constructor() {
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    }
  }
  
  private createOscillator(frequency: number, duration: number, type: OscillatorType = 'sine') {
    if (!this.audioContext || this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }
  
  playCollectSound(isGolden: boolean = false) {
    if (isGolden) {
      this.createOscillator(523.25, 0.1); // C5
      setTimeout(() => this.createOscillator(659.25, 0.1), 50); // E5
      setTimeout(() => this.createOscillator(783.99, 0.15), 100); // G5
    } else {
      this.createOscillator(440, 0.1); // A4
      setTimeout(() => this.createOscillator(554.37, 0.1), 50); // C#5
    }
  }
  
  playPowerUpSound() {
    const notes = [261.63, 329.63, 392, 523.25]; // C4, E4, G4, C5
    notes.forEach((note, index) => {
      setTimeout(() => this.createOscillator(note, 0.2, 'square'), index * 100);
    });
  }
  
  playHeartSound() {
    this.createOscillator(440, 0.15, 'triangle'); // A4
    setTimeout(() => this.createOscillator(554.37, 0.15, 'triangle'), 100); // C#5
    setTimeout(() => this.createOscillator(659.25, 0.2, 'triangle'), 200); // E5
  }
  
  playMissSound() {
    this.createOscillator(130.81, 0.3, 'sawtooth'); // C3
  }
  
  playGameOverSound() {
    const notes = [392, 349.23, 329.63, 293.66]; // G4, F4, E4, D4
    notes.forEach((note, index) => {
      setTimeout(() => this.createOscillator(note, 0.3, 'square'), index * 200);
    });
  }
  
  playBackgroundMusic() {
    if (!this.audioContext || this.isMuted) return;
    
    const playNote = (frequency: number, startTime: number, duration: number) => {
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'triangle';
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
      gainNode.gain.setValueAtTime(0.1, startTime + duration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const melody = [
      { note: 523.25, time: 0, duration: 0.25 },     // C5
      { note: 523.25, time: 0.25, duration: 0.25 },  // C5
      { note: 783.99, time: 0.5, duration: 0.25 },   // G5
      { note: 783.99, time: 0.75, duration: 0.25 },  // G5
      { note: 880, time: 1, duration: 0.25 },        // A5
      { note: 880, time: 1.25, duration: 0.25 },     // A5
      { note: 783.99, time: 1.5, duration: 0.5 },    // G5
      { note: 698.46, time: 2, duration: 0.25 },     // F5
      { note: 698.46, time: 2.25, duration: 0.25 },  // F5
      { note: 659.25, time: 2.5, duration: 0.25 },   // E5
      { note: 659.25, time: 2.75, duration: 0.25 },  // E5
      { note: 587.33, time: 3, duration: 0.25 },     // D5
      { note: 587.33, time: 3.25, duration: 0.25 },  // D5
      { note: 523.25, time: 3.5, duration: 0.5 },    // C5
    ];
    
    const startTime = this.audioContext.currentTime;
    const loopDuration = 4;
    
    const scheduleLoop = () => {
      melody.forEach(({ note, time, duration }) => {
        playNote(note, startTime + time, duration);
      });
      
      if (!this.isMuted) {
        setTimeout(() => scheduleLoop(), loopDuration * 1000);
      }
    };
    
    scheduleLoop();
  }
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
  
  init() {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}