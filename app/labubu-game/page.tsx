'use client';

import React, { useEffect, useRef, useState } from 'react';
import './game.css';
import { GameSounds } from './sounds';
import type { GameState, Labubu, Rainbow, Heart, Unicorn, GameDifficulty } from './types';

type ModeSettings = {
  spawnBaseMs: number;           // starting interval
  spawnFloorMs: number;          // minimum interval cap
  spawnSlopeMsPerPoint: number;  // how fast interval shrinks with score
  speedBase: number;             // base falling speed
  speedMaxAdd: number;           // max added by score ramp
  blackOverall: number;          // overall per-labubu black probability for this mode
  eventTwoBlackProb?: number;    // cap probability to spawn 2 blacks (per event)
  eventThreeBlackProb?: number;  // cap probability to spawn 3 blacks (per event)
  easySingleBlackOnScreen?: boolean; // if true, never allow >1 black on screen
};

const MODE: Record<GameDifficulty, ModeSettings> = {
  easy: {
    spawnBaseMs: 1500,
    spawnFloorMs: 900,
    spawnSlopeMsPerPoint: 3, // hits floor at ~200
    speedBase: 3.2,
    speedMaxAdd: 3.8,
    blackOverall: 0.08,
    easySingleBlackOnScreen: true, // at most 1 black at a time on screen
  },
  medium: {
    spawnBaseMs: 1400,
    spawnFloorMs: 600,
    spawnSlopeMsPerPoint: 4,
    speedBase: 3.8,
    speedMaxAdd: 4.2,
    blackOverall: 0.10,       // 10% overall black chance
    eventTwoBlackProb: 0.10,  // ≤10% chance to get 2 blacks in a spawn
  },
  hard: {
    spawnBaseMs: 1300,
    spawnFloorMs: 450,
    spawnSlopeMsPerPoint: 4.25,
    speedBase: 4.2,
    speedMaxAdd: 5.0,
    blackOverall: 0.15,        // 15% overall black chance
    eventThreeBlackProb: 0.10, // ≤10% chance to get 3 blacks in a spawn
  },
};

// Unchanged “good” Labubu group logic (same across all difficulties)
const TUNING_GROUPS = {
  p2Base: 0.10, p2Max: 0.30,
  p3Base: 0.02, p3Max: 0.12,
};

export default function LabubuGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [lives, setLives] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('easy');

  // Refs to use inside RAF loop
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const diffRef = useRef<GameDifficulty>('easy');

  const animationRef = useRef<number | undefined>(undefined);
  const soundsRef = useRef<GameSounds | undefined>(undefined);

  const gameStateRef = useRef<GameState>({
    unicorn: {
      x: 0, y: 0, width: 90, height: 90,
      targetX: 0, bounce: 0, wingFlap: 0, catchAnimation: 0,
      magnetPull: false, magnetTimer: 0,
    },
    labubus: [],
    rainbows: [],
    hearts: [],
    particles: [],
    stars: [],
    touchX: null,
    moveDirection: 0,
    combo: 0,
    powerUpActive: false,
    powerUpTimer: 0,
    frameCount: 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('labubuHighScore');
      if (saved) setHighScore(parseInt(saved, 10));
      soundsRef.current = new GameSounds();
      soundsRef.current.init();
    }
  }, []);

  useEffect(() => { diffRef.current = difficulty; }, [difficulty]);

  useEffect(() => {
    if (!canvasRef.current || !gameStarted || isPaused) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const gameState = gameStateRef.current;
    if (gameState.frameCount === 0) {
      gameState.unicorn.x = canvas.width / 2 - gameState.unicorn.width / 2;
      gameState.unicorn.y = canvas.height - 140;
      gameState.unicorn.targetX = gameState.unicorn.x;
    }

    let lastSpawn = 0;
    let rainbowSpawn = 0;
    let heartSpawn = 0;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const groupDifficulty = () => clamp01(scoreRef.current / 200);

    const chooseGroupSize = () => {
      const d = groupDifficulty();
      const p2 = TUNING_GROUPS.p2Base + (TUNING_GROUPS.p2Max - TUNING_GROUPS.p2Base) * d;
      const p3 = TUNING_GROUPS.p3Base + (TUNING_GROUPS.p3Max - TUNING_GROUPS.p3Base) * d;
      const r = Math.random();
      return r < p3 ? 3 : r < p3 + p2 ? 2 : 1;
    };

    // Determine how many blacks to assign in this event, honoring mode rules
    const chooseBlackCountForEvent = (count: number): number => {
      const mode = MODE[diffRef.current];
      const blacksOnScreen = gameStateRef.current.labubus.filter(l => l.type === 'black').length;

      // Easy: only 1 black at a time on screen AND max 1 in a spawn event
      if (diffRef.current === 'easy') {
        if (mode.easySingleBlackOnScreen && blacksOnScreen >= 1) return 0;
        return Math.random() < mode.blackOverall ? 1 : 0;
      }

      // Medium: overall black 10%, up to 2 in a spawn, with ≤10% chance for 2
      if (diffRef.current === 'medium') {
        if (count >= 2 && mode.eventTwoBlackProb && Math.random() < mode.eventTwoBlackProb) {
          return 2;
        }
        // otherwise at most 1
        return Math.random() < mode.blackOverall ? 1 : 0;
      }

      // Hard: overall black 15%, up to 3 in a spawn, with ≤10% chance for 3
      if (diffRef.current === 'hard') {
        if (count >= 3 && mode.eventThreeBlackProb && Math.random() < mode.eventThreeBlackProb) {
          return 3;
        }
        // otherwise sample per labubu but cap at 2 so "3" only comes from the 10% branch
        let cnt = 0;
        for (let i = 0; i < count; i++) {
          if (Math.random() < mode.blackOverall) cnt++;
        }
        return Math.min(cnt, 2);
      }

      return 0;
    };

    const spawnLabubuGroup = (count: number, timestamp: number) => {
      const xs: number[] = [];
      const minGap = 80;

      for (let i = 0; i < count; i++) {
        let x = Math.random() * (canvas.width - 60);
        let tries = 0;
        while (xs.some(xx => Math.abs(xx - x) < minGap) && tries < 50) {
          x = Math.random() * (canvas.width - 60);
          tries++;
        }
        xs.push(x);
      }

      // Decide which indices (within this group) are black
      let blackToPlace = chooseBlackCountForEvent(count);
      const blackIndices: number[] = [];
      while (blackToPlace > 0) {
        const idx = Math.floor(Math.random() * count);
        if (!blackIndices.includes(idx)) {
          blackIndices.push(idx);
          blackToPlace--;
        }
      }

      xs.forEach((x, i) => {
        const isBlack = blackIndices.includes(i);
        const type: Labubu['type'] = isBlack
          ? 'black'
          : Math.random() < 0.10
            ? 'golden'
            : 'normal';

        const mode = MODE[diffRef.current];
        const speed = mode.speedBase + Math.min(scoreRef.current / 35, mode.speedMaxAdd);

        gameState.labubus.push({
          x,
          y: -60,
          width: 60,
          height: 60,
          speed,
          type,
          rotation: 0,
          wobble: Math.random() * Math.PI * 2,
          scale: 1,
        });
      });

      lastSpawn = timestamp;
    };

    const gameLoop = (timestamp: number) => {
      if (!ctx || !canvas) return;

      // Clear
      ctx.fillStyle = '#FFE5F1';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawClouds(ctx, canvas);

      const gs = gameStateRef.current;
      gs.frameCount++;
      gs.unicorn.wingFlap = Math.sin(gs.frameCount * 0.15) * 5;
      gs.unicorn.bounce = Math.sin(gs.frameCount * 0.1) * 3;

      // Input → targetX
      if (gs.touchX !== null) {
        gs.unicorn.targetX = gs.touchX - gs.unicorn.width / 2;
      } else if (gs.moveDirection !== 0) {
        gs.unicorn.targetX += gs.moveDirection * 10;
      }

      // Clamp + ease
      gs.unicorn.targetX = Math.max(0, Math.min(canvas.width - gs.unicorn.width, gs.unicorn.targetX));
      gs.unicorn.x += (gs.unicorn.targetX - gs.unicorn.x) * 0.25;

      if (gs.unicorn.catchAnimation > 0) gs.unicorn.catchAnimation--;

      // Spawn pacing by mode
      const mode = MODE[diffRef.current];
      const desired = Math.max(
        mode.spawnFloorMs,
        mode.spawnBaseMs - scoreRef.current * mode.spawnSlopeMsPerPoint
      );

      if (timestamp - lastSpawn > desired) {
        const n = chooseGroupSize();
        spawnLabubuGroup(n, timestamp);
      }

      // Rainbows
      if (timestamp - rainbowSpawn > 15000) {
        gs.rainbows.push({
          x: Math.random() * (canvas.width - 80),
          y: -80, width: 80, height: 40, speed: 3,
        });
        rainbowSpawn = timestamp;
      }

      // Hearts
      if (timestamp - heartSpawn > 30000 && livesRef.current < 5) {
        gs.hearts.push({
          x: Math.random() * (canvas.width - 40),
          y: -40, width: 40, height: 40, speed: 2,
        });
        heartSpawn = timestamp;
      }

      // LABUBUS
      gs.labubus = gs.labubus.filter((l) => {
        l.y += l.speed;
        l.rotation += 0.05;
        l.wobble += 0.1;
        l.x += Math.sin(l.wobble) * 1.5;

        if (checkCollision(gs.unicorn, l)) {
          if (l.type === 'black') {
            gs.combo = 0;
            soundsRef.current?.playMissSound();
            setLives((prev) => {
              const next = prev - 1;
              livesRef.current = next;
              if (next <= 0) {
                soundsRef.current?.playGameOverSound();
                endGame();
              }
              return next;
            });
            // dark particles
            for (let i = 0; i < 12; i++) {
              gs.particles.push({
                x: l.x + l.width / 2,
                y: l.y + l.height / 2,
                vx: (Math.random() - 0.5) * 9,
                vy: (Math.random() - 0.5) * 9,
                life: 35, size: Math.random() * 3 + 2,
                color: '#222', type: Math.random() > 0.5 ? 'star' : 'circle',
              });
            }
            return false;
          }

          const base = l.type === 'golden' ? 50 : 10;
          const gained = base * (gs.powerUpActive ? 2 : 1);

          setScore((prev) => {
            const next = prev + gained;
            scoreRef.current = next;
            if (next > highScore) {
              setHighScore(next);
              if (typeof window !== 'undefined') {
                localStorage.setItem('labubuHighScore', next.toString());
              }
            }
            return next;
          });

          soundsRef.current?.playCollectSound(l.type === 'golden');
          gs.combo++;
          gs.unicorn.catchAnimation = 20;

          for (let i = 0; i < 15; i++) {
            gs.particles.push({
              x: l.x + l.width / 2,
              y: l.y + l.height / 2,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 40, size: Math.random() * 4 + 2,
              color: l.type === 'golden' ? '#FFD700' : '#FF69B4',
              type: Math.random() > 0.5 ? 'star' : 'circle',
            });
          }
          return false;
        }

        if (l.y > canvas.height) {
          if (l.type !== 'black') {
            gs.combo = 0;
            soundsRef.current?.playMissSound();
            setLives((prev) => {
              const next = prev - 1;
              livesRef.current = next;
              if (next <= 0) {
                soundsRef.current?.playGameOverSound();
                endGame();
              }
              return next;
            });
          }
          return false;
        }

        drawLabubu(ctx, l);
        return true;
      });

      // RAINBOWS
      gs.rainbows = gs.rainbows.filter((r) => {
        r.y += r.speed;
        if (checkCollision(gs.unicorn, r)) {
          soundsRef.current?.playPowerUpSound();
          gs.powerUpActive = true;
          gs.powerUpTimer = 300;
          return false;
        }
        if (r.y > canvas.height) return false;
        drawRainbow(ctx, r);
        return true;
      });

      // HEARTS
      gs.hearts = gs.hearts.filter((h) => {
        h.y += h.speed;
        if (checkCollision(gs.unicorn, h)) {
          soundsRef.current?.playHeartSound();
          setLives((prev) => {
            const next = Math.min(prev + 1, 5);
            livesRef.current = next;
            return next;
          });
          return false;
        }
        if (h.y > canvas.height) return false;
        drawHeart(ctx, h);
        return true;
      });

      // PARTICLES
      gs.particles = gs.particles.filter((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life--;
        if (p.life > 0) {
          ctx.globalAlpha = p.life / 40;
          ctx.fillStyle = p.color;
          if (p.type === 'star') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 0.1);
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
              const r = i % 2 === 0 ? p.size : p.size * 0.5;
              ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          return true;
        }
        return false;
      });

      // POWER-UP
      if (gs.powerUpActive) {
        gs.powerUpTimer--;
        if (gs.powerUpTimer <= 0) gs.powerUpActive = false;
      }

      if (gs.powerUpActive) drawRainbowTrail(ctx, gs.unicorn);
      drawUnicorn(ctx, gs.unicorn);

      drawUI(ctx, canvas);

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    const drawClouds = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(100, 100, 40, 0, Math.PI * 2);
      ctx.arc(140, 100, 50, 0, Math.PI * 2);
      ctx.arc(180, 100, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(canvas.width - 150, 150, 35, 0, Math.PI * 2);
      ctx.arc(canvas.width - 110, 150, 45, 0, Math.PI * 2);
      ctx.arc(canvas.width - 70, 150, 35, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawLabubu = (ctx: CanvasRenderingContext2D, labubu: Labubu) => {
      ctx.save();
      ctx.translate(labubu.x + labubu.width / 2, labubu.y + labubu.height / 2);
      ctx.rotate(labubu.rotation);
      const scale = labubu.scale || 1;
      ctx.scale(scale, scale);

      if (labubu.type === 'golden') { ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 25; }
      else if (labubu.type === 'black') { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20; }
      else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

      // Body gradient
      let gradient: CanvasGradient;
      if (labubu.type === 'golden') {
        gradient = ctx.createRadialGradient(0, -5, 0, 0, 5, labubu.width / 2);
        gradient.addColorStop(0, '#FFEB3B'); gradient.addColorStop(0.5, '#FFD700'); gradient.addColorStop(1, '#FFA000');
      } else if (labubu.type === 'black') {
        gradient = ctx.createRadialGradient(0, -5, 0, 0, 5, labubu.width / 2);
        gradient.addColorStop(0, '#3a3a3a'); gradient.addColorStop(0.6, '#1d1d1d'); gradient.addColorStop(1, '#0c0c0c');
      } else {
        gradient = ctx.createRadialGradient(0, -5, 0, 0, 5, labubu.width / 2);
        gradient.addColorStop(0, '#E7CBA6'); gradient.addColorStop(0.5, '#A6886B'); gradient.addColorStop(1, '#6B5D54');
      }
      ctx.fillStyle = gradient;

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, labubu.width / 2 - 2, labubu.height / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = labubu.type === 'golden' ? '#B8860B' : labubu.type === 'black' ? '#000' : '#4E4038';
      ctx.stroke();

      // Ears
      ctx.fillStyle = labubu.type === 'golden' ? '#FFD700' : labubu.type === 'black' ? '#1a1a1a' : '#8B7355';
      ctx.beginPath();
      ctx.ellipse(-18, -22, 14, 18, -0.3, 0, Math.PI * 2);
      ctx.ellipse(18, -22, 14, 18, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      if (labubu.type === 'black') {
        ctx.fillStyle = '#a60b0b';
        ctx.beginPath();
        ctx.ellipse(-12, -5, 5, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(12, -5, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(-12, -5, 5, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(12, -5, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(-10, -7, 2, 0, Math.PI * 2);
        ctx.arc(14, -7, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth/teeth
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 2, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (labubu.type === 'black') ctx.arc(0, 7, 10, 0.9 * Math.PI, 0.1 * Math.PI, true);
      else ctx.arc(0, 6, 10, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.fillRect(-6, 6, 4, 5);
      ctx.strokeRect(-6, 6, 4, 5);
      ctx.fillRect(2, 6, 4, 5);
      ctx.strokeRect(2, 6, 4, 5);

      ctx.restore();
    };

    const drawUnicorn = (ctx: CanvasRenderingContext2D, unicorn: Unicorn) => {
      ctx.save();
      const bounceY = unicorn.bounce || 0;
      const catchScale = unicorn.catchAnimation > 0 ? 1.1 - unicorn.catchAnimation * 0.005 : 1;
      ctx.translate(unicorn.x + 45, unicorn.y + 45 + bounceY);
      ctx.scale(catchScale, catchScale);
      ctx.translate(-45, -45);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(45, 85, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      const wingFlap = unicorn.wingFlap || 0;

      // wings (trimmed for brevity)
      ctx.save();
      ctx.translate(20, 40);
      ctx.rotate(-0.3 + Math.sin(wingFlap * 0.1) * 0.2);
      const wingGradientL = ctx.createLinearGradient(-20, 0, 0, 30);
      wingGradientL.addColorStop(0, 'rgba(255, 182, 193, 0.95)');
      wingGradientL.addColorStop(0.5, 'rgba(255, 192, 203, 0.75)');
      wingGradientL.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
      ctx.fillStyle = wingGradientL;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-25, 10, -20, 30);
      ctx.quadraticCurveTo(-15, 35, -5, 35);
      ctx.quadraticCurveTo(-10, 20, 0, 0);
      ctx.fill();
      ctx.restore();

      // body
      const bodyGradient = ctx.createRadialGradient(45, 50, 10, 45, 50, 35);
      bodyGradient.addColorStop(0, '#FFFFFF');
      bodyGradient.addColorStop(0.7, '#FFF5F5');
      bodyGradient.addColorStop(1, '#FFE5F1');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(45, 50, 35, 32, 0, 0, Math.PI * 2);
      ctx.fill();

      // head
      const headGradient = ctx.createRadialGradient(45, 20, 5, 45, 20, 25);
      headGradient.addColorStop(0, '#FFFFFF');
      headGradient.addColorStop(1, '#FFF5F5');
      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.ellipse(45, 20, 25, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // eye
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(55, 18, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawRainbow = (ctx: CanvasRenderingContext2D, r: Rainbow) => {
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
      const stripe = r.height / colors.length;
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(r.x, r.y + i * stripe, r.width, stripe);
      });
    };

    const drawRainbowTrail = (ctx: CanvasRenderingContext2D, u: Unicorn) => {
      const colors = ['#FF000030', '#FF7F0030', '#FFFF0030', '#00FF0030', '#0000FF30', '#4B008230', '#9400D330'];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(u.x - i * 5, u.y + 70 + i * 2, u.width + i * 10, 5);
      });
    };

    const drawHeart = (ctx: CanvasRenderingContext2D, heart: Heart) => {
      ctx.fillStyle = '#FF1493';
      ctx.beginPath();
      ctx.moveTo(heart.x + 20, heart.y + 10);
      ctx.bezierCurveTo(heart.x + 20, heart.y, heart.x, heart.y, heart.x, heart.y + 15);
      ctx.bezierCurveTo(heart.x, heart.y + 25, heart.x + 20, heart.y + 35, heart.x + 20, heart.y + 40);
      ctx.bezierCurveTo(heart.x + 20, heart.y + 35, heart.x + 40, heart.y + 25, heart.x + 40, heart.y + 15);
      ctx.bezierCurveTo(heart.x + 40, heart.y, heart.x + 20, heart.y, heart.x + 20, heart.y + 10);
      ctx.fill();
    };

    const drawUI = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const chip = (x: number, y: number, text: string, color: string) => {
        ctx.font = 'bold 24px "Bubblegum Sans", cursive';
        const padX = 12, padY = 8;
        const w = ctx.measureText(text).width + padX * 2;
        const h = 34 + padY * 0.5;

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        roundRect(ctx, x, y - 26, w, h, 12);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillText(text, x + padX, y);
      };

      chip(20, 40, `Score: ${scoreRef.current}`, '#B83280');
      chip(20, 80, `Best: ${highScore}`, '#C27803');
      chip(20, 120, `Mode: ${diffRef.current.toUpperCase()}`, '#3f6');

      for (let i = 0; i < livesRef.current; i++) {
        drawHeart(ctx, { x: canvas.width - 60 - i * 50, y: 20, width: 40, height: 40, speed: 0 });
      }

      if (gameStateRef.current.combo > 1) {
        ctx.fillStyle = '#FF1493';
        ctx.font = 'bold 32px "Bubblegum Sans", cursive';
        ctx.fillText(`${gameStateRef.current.combo}x Combo!`, canvas.width / 2 - 80, 100);
      }

      if (gameStateRef.current.powerUpActive) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px "Bubblegum Sans", cursive';
        ctx.fillText('RAINBOW POWER!', canvas.width / 2 - 120, 150);
      }
    };

    const roundRect = (
      ctx: CanvasRenderingContext2D,
      x: number, y: number, w: number, h: number, r: number
    ) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const checkCollision = (
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number }
    ) => (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );

    const endGame = () => {
      setGameStarted(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    // Input
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      soundsRef.current?.unlock(); // mobile audio unlock
      if (e.touches.length > 0) {
        gameState.touchX = e.touches[0].clientX;
      }
    };
    const handleTouchEnd = () => { gameState.touchX = null; };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameState.moveDirection = -1;
      if (e.key === 'ArrowRight') gameState.moveDirection = 1;
      if (e.key === ' ') { e.preventDefault(); setIsPaused((p) => !p); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') gameState.moveDirection = 0;
    };

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', resize);

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', resize);
    };
  }, [gameStarted, isPaused]); // keep unicorn position stable

  const startGame = async () => {
    // Reset state & refs
    setScore(0); scoreRef.current = 0;
    setLives(3); livesRef.current = 3;

    // Set difficulty ref
    diffRef.current = difficulty;

    setGameStarted(true);
    setIsPaused(false);

    // Mobile audio unlock + start music
    await soundsRef.current?.unlock();
    soundsRef.current?.playBackgroundMusic();

    const width = canvasRef.current?.width ?? window.innerWidth;
    const height = canvasRef.current?.height ?? window.innerHeight;
    const centerX = width / 2 - 45;

    gameStateRef.current = {
      unicorn: {
        x: centerX, y: height - 140, width: 90, height: 90,
        targetX: centerX, bounce: 0, wingFlap: 0, catchAnimation: 0,
        magnetPull: false, magnetTimer: 0,
      },
      labubus: [],
      rainbows: [],
      hearts: [],
      particles: [],
      stars: [],
      touchX: null,
      moveDirection: 0,
      combo: 0,
      powerUpActive: false,
      powerUpTimer: 0,
      frameCount: 0,
    };
  };

  const toggleMute = () => {
    const muted = soundsRef.current?.toggleMute();
    setIsMuted(muted || false);
  };

  const togglePause = () => setIsPaused((p) => !p);

  const onDiffClick = (d: GameDifficulty) => setDifficulty(d);

  return (
    <div className="game-container">
      {!gameStarted && (
        <div className="menu-overlay">
          <div className="menu-content">
            <h1 className="game-title">🦄 Labubu Rainbow Catch! 🌈</h1>

            <div className="game-description">
              <p>Catch falling Labubus. Avoid the black ones!</p>
              <p>🎮 Touch / Arrow keys to move • ⏸️ Space or Pause to pause</p>

              <div className="difficulty">
                <button
                  className={`diff-btn ${difficulty === 'easy' ? 'active' : ''}`}
                  onClick={() => onDiffClick('easy')}
                >Easy</button>
                <button
                  className={`diff-btn ${difficulty === 'medium' ? 'active' : ''}`}
                  onClick={() => onDiffClick('medium')}
                >Medium</button>
                <button
                  className={`diff-btn ${difficulty === 'hard' ? 'active' : ''}`}
                  onClick={() => onDiffClick('hard')}
                >Hard</button>
              </div>

              <div className="legend">
                <ul>
                  <li><span>🥨</span> <span>Regular Labubu: <span className="badge">+10</span> points</span></li>
                  <li><span>⭐</span> <span>Golden Labubu: <span className="badge">+50</span> points</span></li>
                  <li><span>🌈</span> <span>Rainbow: <strong>2× points</strong> for <strong>5s</strong></span></li>
                  <li><span>💖</span> <span>Heart: <strong>+1 life</strong> (max <strong>5</strong>)</span></li>
                  <li><span>⚫</span> <span><strong>Black Labubu:</strong> <span className="badge">-1 life</span> &amp; combo reset</span></li>
                </ul>
                <p style={{marginTop:8}}>
                  <strong>Mode rules:</strong><br/>
                  Easy: at most 1 black on screen and per spawn.<br/>
                  Medium: 10% overall black; ≤10% events with 2 blacks.<br/>
                  Hard: 15% overall black; ≤10% events with 3 blacks.
                </p>
              </div>
            </div>

            {score > 0 && (
              <div className="game-over-stats">
                <p className="final-score">Final Score: {score}</p>
                <p className="high-score">Best Score: {highScore}</p>
              </div>
            )}
            <button className="play-button" onClick={startGame}>
              {score > 0 ? 'Play Again! 🎮' : 'Start Game! 🎮'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile-friendly control buttons */}
      {gameStarted && (
        <div className="controls">
          <button
            className="pause-button"
            onClick={togglePause}
            aria-label={isPaused ? 'Resume' : 'Pause'}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
          <button
            className="mute-button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      {isPaused && gameStarted && (
        <div className="pause-overlay">
          <div className="pause-content">
            <h2>Game Paused</h2>
            <p>Press SPACE, Pause, or tap to continue</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="game-canvas"
        onClick={() => {
          // allow unpausing on tap (handy on mobile)
          if (isPaused) setIsPaused(false);
        }}
      />
    </div>
  );
}
