export interface Unicorn {
  x: number;
  y: number;
  width: number;
  height: number;
  targetX: number;
  bounce: number;
  wingFlap: number;
  catchAnimation: number;
  magnetPull: boolean;
  magnetTimer: number;
}

export interface Labubu {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  type: 'normal' | 'golden';
  rotation: number;
  wobble: number;
  scale: number;
}

export interface Rainbow {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export interface Heart {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  type: 'star' | 'circle';
}

export interface GameState {
  unicorn: Unicorn;
  labubus: Labubu[];
  rainbows: Rainbow[];
  hearts: Heart[];
  particles: Particle[];
  stars: unknown[];
  touchX: number | null;
  moveDirection: number;
  combo: number;
  powerUpActive: boolean;
  powerUpTimer: number;
  frameCount: number;
}