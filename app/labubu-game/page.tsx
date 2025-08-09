'use client';

import React, { useEffect, useRef, useState } from 'react';
import './game.css';
import { GameSounds } from './sounds';
import type { GameState, Labubu, Rainbow, Heart, Unicorn } from './types';

export default function LabubuGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [lives, setLives] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Refs so the game loop can read current values without reinitialising the effect
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  const animationRef = useRef<number | undefined>(undefined);
  const soundsRef = useRef<GameSounds | undefined>(undefined);

  const gameStateRef = useRef<GameState>({
    unicorn: {
      x: 0,
      y: 0,
      width: 90,
      height: 90,
      targetX: 0,
      bounce: 0,
      wingFlap: 0,
      catchAnimation: 0,
      magnetPull: false,
      magnetTimer: 0,
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
    }
  }, []);

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

    // Initialise unicorn position once (no more snapping back later)
    const gameState = gameStateRef.current;
    if (gameState.frameCount === 0) {
      gameState.unicorn.x = canvas.width / 2 - gameState.unicorn.width / 2;
      gameState.unicorn.y = canvas.height - 140;
      gameState.unicorn.targetX = gameState.unicorn.x;
    }

    let lastSpawn = 0;
    let rainbowSpawn = 0;
    let heartSpawn = 0;

    const gameLoop = (timestamp: number) => {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = '#FFE5F1';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Background clouds
      drawClouds(ctx, canvas);

      // Animate
      gameState.frameCount++;
      gameState.unicorn.wingFlap = Math.sin(gameState.frameCount * 0.15) * 5;
      gameState.unicorn.bounce = Math.sin(gameState.frameCount * 0.1) * 3;

      // Input → targetX
      if (gameState.touchX !== null) {
        gameState.unicorn.targetX = gameState.touchX - gameState.unicorn.width / 2;
      } else if (gameState.moveDirection !== 0) {
        gameState.unicorn.targetX += gameState.moveDirection * 10;
      }

      // Clamp + ease
      gameState.unicorn.targetX = Math.max(0, Math.min(canvas.width - gameState.unicorn.width, gameState.unicorn.targetX));
      gameState.unicorn.x += (gameState.unicorn.targetX - gameState.unicorn.x) * 0.25;

      // Catch animation timer
      if (gameState.unicorn.catchAnimation > 0) {
        gameState.unicorn.catchAnimation--;
      }

      // Slightly reduced Labubu spawn rate (still ramps with score)
      const spawnInterval = 1500 - Math.min(scoreRef.current * 5, 1000); // min ~900ms
      if (timestamp - lastSpawn > spawnInterval) {
        gameState.labubus.push({
          x: Math.random() * (canvas.width - 60),
          y: -60,
          width: 60,
          height: 60,
          speed: 3.5 + Math.min(scoreRef.current / 35, 4.5),
          type: Math.random() > 0.9 ? 'golden' : 'normal',
          rotation: 0,
          wobble: Math.random() * Math.PI * 2,
          scale: 1,
        });
        lastSpawn = timestamp;
      }

      // Rainbows (power-ups)
      if (timestamp - rainbowSpawn > 15000) {
        gameState.rainbows.push({
          x: Math.random() * (canvas.width - 80),
          y: -80,
          width: 80,
          height: 40,
          speed: 3,
        });
        rainbowSpawn = timestamp;
      }

      // Hearts (extra lives, up to max 5)
      if (timestamp - heartSpawn > 30000 && livesRef.current < 5) {
        gameState.hearts.push({
          x: Math.random() * (canvas.width - 40),
          y: -40,
          width: 40,
          height: 40,
          speed: 2,
        });
        heartSpawn = timestamp;
      }

      // LABUBU UPDATE/DRAW
      gameState.labubus = gameState.labubus.filter((labubu) => {
        labubu.y += labubu.speed;
        labubu.rotation += 0.05;
        labubu.wobble += 0.1;
        labubu.x += Math.sin(labubu.wobble) * 1.5;

        // Collect
        if (checkCollision(gameState.unicorn, labubu)) {
          const base = labubu.type === 'golden' ? 50 : 10;
          const gained = base * (gameState.powerUpActive ? 2 : 1);

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

          soundsRef.current?.playCollectSound(labubu.type === 'golden');
          gameState.combo++;
          gameState.unicorn.catchAnimation = 20;

          // ✨ Removed magnet centering effect (no more snap-to-middle)

          // Sparkles
          for (let i = 0; i < 15; i++) {
            gameState.particles.push({
              x: labubu.x + labubu.width / 2,
              y: labubu.y + labubu.height / 2,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 40,
              size: Math.random() * 4 + 2,
              color: labubu.type === 'golden' ? '#FFD700' : '#FF69B4',
              type: Math.random() > 0.5 ? 'star' : 'circle',
            });
          }
          return false;
        }

        // Missed
        if (labubu.y > canvas.height) {
          gameState.combo = 0;
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
          return false;
        }

        drawLabubu(ctx, labubu);
        return true;
      });

      // RAINBOWS
      gameState.rainbows = gameState.rainbows.filter((rainbow) => {
        rainbow.y += rainbow.speed;

        if (checkCollision(gameState.unicorn, rainbow)) {
          soundsRef.current?.playPowerUpSound();
          gameState.powerUpActive = true;
          gameState.powerUpTimer = 300; // 5 seconds @60fps
          return false;
        }

        if (rainbow.y > canvas.height) return false;

        drawRainbow(ctx, rainbow);
        return true;
      });

      // HEARTS
      gameState.hearts = gameState.hearts.filter((heart) => {
        heart.y += heart.speed;

        if (checkCollision(gameState.unicorn, heart)) {
          soundsRef.current?.playHeartSound();
          setLives((prev) => {
            const next = Math.min(prev + 1, 5);
            livesRef.current = next;
            return next;
          });
          return false;
        }

        if (heart.y > canvas.height) return false;

        drawHeart(ctx, heart);
        return true;
      });

      // PARTICLES
      gameState.particles = gameState.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life--;

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

      // POWER-UP TIMER
      if (gameState.powerUpActive) {
        gameState.powerUpTimer--;
        if (gameState.powerUpTimer <= 0) {
          gameState.powerUpActive = false;
        }
      }

      // UNICORN
      if (gameState.powerUpActive) {
        drawRainbowTrail(ctx, gameState.unicorn);
      }
      drawUnicorn(ctx, gameState.unicorn);

      // HUD
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

      // Subtle glow for golden
      if (labubu.type === 'golden') {
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 25;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, labubu.height / 2 - 5, labubu.width / 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body gradient
      const gradient = ctx.createRadialGradient(0, -5, 0, 0, 5, labubu.width / 2);
      if (labubu.type === 'golden') {
        gradient.addColorStop(0, '#FFEB3B');
        gradient.addColorStop(0.5, '#FFD700');
        gradient.addColorStop(1, '#FFA000');
      } else {
        gradient.addColorStop(0, '#E7CBA6');
        gradient.addColorStop(0.5, '#A6886B');
        gradient.addColorStop(1, '#6B5D54');
      }
      ctx.fillStyle = gradient;

      // Fluffy body
      ctx.beginPath();
      ctx.ellipse(0, 0, labubu.width / 2 - 2, labubu.height / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = labubu.type === 'golden' ? '#B8860B' : '#4E4038';
      ctx.stroke();

      // Texture puffs
      ctx.strokeStyle = labubu.type === 'golden' ? '#FFE082' : '#A89585';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 18, Math.sin(angle) * 18, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ears
      ctx.fillStyle = labubu.type === 'golden' ? '#FFD700' : '#8B7355';
      ctx.beginPath();
      ctx.ellipse(-18, -22, 14, 18, -0.3, 0, Math.PI * 2);
      ctx.ellipse(18, -22, 14, 18, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Inner ears
      ctx.fillStyle = labubu.type === 'golden' ? '#FFE082' : '#D4A574';
      ctx.beginPath();
      ctx.ellipse(-16, -20, 8, 10, -0.3, 0, Math.PI * 2);
      ctx.ellipse(16, -20, 8, 10, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-12, -5, 5, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(12, -5, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye sparkle
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(-10, -7, 2, 0, Math.PI * 2);
      ctx.arc(14, -7, 2, 0, Math.PI * 2);
      ctx.fill();

      // Nose + smile
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 2, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, 10, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      // Teeth
      ctx.fillStyle = '#FFF';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.fillRect(-6, 6, 4, 5);
      ctx.strokeRect(-6, 6, 4, 5);
      ctx.fillRect(2, 6, 4, 5);
      ctx.strokeRect(2, 6, 4, 5);

      // Blush
      ctx.fillStyle = 'rgba(255, 192, 203, 0.6)';
      ctx.beginPath();
      ctx.arc(-20, 2, 5, 0, Math.PI * 2);
      ctx.arc(20, 2, 5, 0, Math.PI * 2);
      ctx.fill();

      // Twinkling star for golden
      if (labubu.type === 'golden') {
        ctx.fillStyle = '#FFF';
        ctx.save();
        ctx.translate(0, -35);
        ctx.rotate(gameStateRef.current.frameCount * 0.05);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? 8 : 4;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };

    const drawUnicorn = (ctx: CanvasRenderingContext2D, unicorn: Unicorn) => {
      ctx.save();

      const bounceY = unicorn.bounce || 0;
      const catchScale = unicorn.catchAnimation > 0 ? 1.1 - unicorn.catchAnimation * 0.005 : 1;

      ctx.translate(unicorn.x + 45, unicorn.y + 45 + bounceY);
      ctx.scale(catchScale, catchScale);
      ctx.translate(-45, -45);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(45, 85, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      const wingFlap = unicorn.wingFlap || 0;

      // Left wing
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
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-5, 10);
      ctx.quadraticCurveTo(-15, 15, -15, 25);
      ctx.stroke();
      ctx.restore();

      // Right wing
      ctx.save();
      ctx.translate(70, 40);
      ctx.rotate(0.3 - Math.sin(wingFlap * 0.1) * 0.2);
      const wingGradientR = ctx.createLinearGradient(20, 0, 0, 30);
      wingGradientR.addColorStop(0, 'rgba(255, 182, 193, 0.95)');
      wingGradientR.addColorStop(0.5, 'rgba(255, 192, 203, 0.75)');
      wingGradientR.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
      ctx.fillStyle = wingGradientR;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(25, 10, 20, 30);
      ctx.quadraticCurveTo(15, 35, 5, 35);
      ctx.quadraticCurveTo(10, 20, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(5, 10);
      ctx.quadraticCurveTo(15, 15, 15, 25);
      ctx.stroke();
      ctx.restore();

      // Body
      const bodyGradient = ctx.createRadialGradient(45, 50, 10, 45, 50, 35);
      bodyGradient.addColorStop(0, '#FFFFFF');
      bodyGradient.addColorStop(0.7, '#FFF5F5');
      bodyGradient.addColorStop(1, '#FFE5F1');
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(45, 50, 35, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      // Soft outline
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = '#E2B6C6';
      ctx.stroke();

      // Body highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(35, 40, 12, 15, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Legs + hooves
      const legPositions = [
        { x: 25, move: Math.sin(gameStateRef.current.frameCount * 0.1) * 2 },
        { x: 35, move: Math.sin(gameStateRef.current.frameCount * 0.1 + 1) * 2 },
        { x: 50, move: Math.sin(gameStateRef.current.frameCount * 0.1 + 2) * 2 },
        { x: 60, move: Math.sin(gameStateRef.current.frameCount * 0.1 + 3) * 2 }
      ];
      legPositions.forEach((leg) => {
        ctx.fillStyle = '#FFF5F5';
        ctx.fillRect(leg.x, 70 + leg.move, 10, 18);
        ctx.fillStyle = '#D4A574';
        ctx.beginPath();
        ctx.ellipse(leg.x + 5, 88 + leg.move, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Neck
      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(45, 30, 18, 25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      const headGradient = ctx.createRadialGradient(45, 20, 5, 45, 20, 25);
      headGradient.addColorStop(0, '#FFFFFF');
      headGradient.addColorStop(1, '#FFF5F5');
      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.ellipse(45, 20, 25, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = '#FFF5F5';
      ctx.beginPath();
      ctx.ellipse(28, 10, 7, 10, -0.2, 0, Math.PI * 2);
      ctx.ellipse(60, 10, 7, 10, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Muzzle
      ctx.fillStyle = '#FFE5F1';
      ctx.beginPath();
      ctx.ellipse(48, 25, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Nostrils
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath();
      ctx.ellipse(45, 27, 2, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(51, 27, 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horn
      const hornGradient = ctx.createLinearGradient(45, -5, 45, 15);
      hornGradient.addColorStop(0, '#FFE5B4');
      hornGradient.addColorStop(0.3, '#FFD700');
      hornGradient.addColorStop(0.6, '#FFA500');
      hornGradient.addColorStop(1, '#FFD700');
      ctx.fillStyle = hornGradient;
      ctx.beginPath();
      ctx.moveTo(45, -5);
      ctx.lineTo(40, 15);
      ctx.lineTo(50, 15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(43, 12);
      ctx.quadraticCurveTo(45, 5, 47, 0);
      ctx.quadraticCurveTo(45, -3, 45, -5);
      ctx.stroke();

      // Horn sparkle
      ctx.strokeStyle = '#FFF';
      ctx.save();
      ctx.translate(45, -8);
      ctx.rotate(gameStateRef.current.frameCount * 0.05);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * 6, Math.sin(angle) * 6);
      }
      ctx.stroke();
      ctx.restore();

      // Mane
      const maneColors = ['#FF69B4', '#FFB6C1', '#DDA0DD', '#BA55D3', '#9370DB'];
      const maneFlow = Math.sin(gameStateRef.current.frameCount * 0.05) * 2;
      for (let i = 0; i < 5; i++) {
        const gradient = ctx.createRadialGradient(25 + i * 4, 10 + i * 3 + maneFlow, 0, 25 + i * 4, 10 + i * 3 + maneFlow, 15);
        gradient.addColorStop(0, maneColors[i]);
        gradient.addColorStop(1, maneColors[(i + 1) % maneColors.length]);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
          25 + i * 4,
          10 + i * 3 + maneFlow + Math.sin(gameStateRef.current.frameCount * 0.1 + i) * 2,
          10 - i * 0.5,
          15 - i,
          0.3 + Math.sin(gameStateRef.current.frameCount * 0.05 + i) * 0.1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Tail
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = maneColors[i];
        ctx.beginPath();
        ctx.ellipse(
          15 + i * 3,
          45 + i * 4 + Math.sin(gameStateRef.current.frameCount * 0.1 + i) * 3,
          8,
          20,
          -0.5 + Math.sin(gameStateRef.current.frameCount * 0.05 + i) * 0.2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(55, 18, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye sparkle
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(56, 16, 2, 0, Math.PI * 2);
      ctx.arc(54, 19, 1, 0, Math.PI * 2);
      ctx.fill();

      // Eyelashes
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(58 + i * 2, 14 + i);
        ctx.lineTo(60 + i * 2, 12 + i);
        ctx.stroke();
      }

      // Blush
      ctx.fillStyle = 'rgba(255, 192, 203, 0.4)';
      ctx.beginPath();
      ctx.arc(65, 25, 6, 0, Math.PI * 2);
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
      // Background chips for readability
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

      // Score + High score
      chip(20, 40, `Score: ${scoreRef.current}`, '#B83280');
      chip(20, 80, `Best: ${highScore}`, '#C27803');

      // Lives (hearts, top-right)
      for (let i = 0; i < livesRef.current; i++) {
        drawHeart(ctx, { x: canvas.width - 60 - i * 50, y: 20, width: 40, height: 40, speed: 0 });
      }

      // Combo
      if (gameStateRef.current.combo > 1) {
        ctx.fillStyle = '#FF1493';
        ctx.font = 'bold 32px "Bubblegum Sans", cursive';
        ctx.fillText(`${gameStateRef.current.combo}x Combo!`, canvas.width / 2 - 80, 100);
      }

      // Power-up indicator
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
    ) => {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      );
    };

    const endGame = () => {
      setGameStarted(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

    // Input
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
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
  }, [gameStarted, isPaused]); // ← no score/lives here so unicorn won't re-center

  const startGame = () => {
    // Reset state & refs
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    livesRef.current = 3;

    setGameStarted(true);
    setIsPaused(false);
    soundsRef.current?.init();
    soundsRef.current?.playBackgroundMusic();

    const width = canvasRef.current?.width ?? window.innerWidth;
    const height = canvasRef.current?.height ?? window.innerHeight;
    const centerX = width / 2 - 45;

    gameStateRef.current = {
      unicorn: {
        x: centerX,
        y: height - 140,        // start near bottom; no later snapping
        width: 90,
        height: 90,
        targetX: centerX,
        bounce: 0,
        wingFlap: 0,
        catchAnimation: 0,
        magnetPull: false,
        magnetTimer: 0,
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

  return (
    <div className="game-container">
      {!gameStarted && (
        <div className="menu-overlay">
          <div className="menu-content">
            <h1 className="game-title">🦄 Labubu Rainbow Catch! 🌈</h1>

            <div className="game-description">
              <p>Catch the falling Labubus. Avoid missing them!</p>
              <p>🎮 Touch or use arrow keys to move • ⏸️ Space to pause</p>

              <div className="legend">
                <ul>
                  <li><span>🥨</span> <span>Regular Labubu: <span className="badge">+10</span> points</span></li>
                  <li><span>⭐</span> <span>Golden Labubu: <span className="badge">+50</span> points</span></li>
                  <li><span>🌈</span> <span>Rainbow: <strong>2× points</strong> for <strong>5s</strong></span></li>
                  <li><span>💖</span> <span>Heart: <strong>+1 life</strong> (max <strong>5</strong>)</span></li>
                </ul>
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

      {gameStarted && (
        <button
          className="mute-button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}

      {isPaused && gameStarted && (
        <div className="pause-overlay">
          <div className="pause-content">
            <h2>Game Paused</h2>
            <p>Press SPACE or tap to continue</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="game-canvas"
        onClick={() => isPaused && setIsPaused(false)}
      />
    </div>
  );
}
