'use client';

import React, { useEffect, useRef, useState } from 'react';
import './game.css';
import { GameSounds } from './sounds';
import type { GameState, Labubu, Rainbow, Heart, Unicorn, Difficulty } from './types';
import DifficultySelector from './DifficultySelector';

export default function LabubuGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [lives, setLives] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  // Refs for loop access
  const scoreRef = useRef(0);
  const livesRef = useRef(3);

  const animationRef = useRef<number | undefined>(undefined);
  const soundsRef = useRef<GameSounds | undefined>(undefined);
  
  // Image refs for sprites
  const imagesRef = useRef<{
    brownLabubu: HTMLImageElement | null;
    goldenLabubu: HTMLImageElement | null;
    blackLabubu: HTMLImageElement | null;
    pinkLabubu: HTMLImageElement | null;
    unicorn: HTMLImageElement | null;
  }>({
    brownLabubu: null,
    goldenLabubu: null,
    blackLabubu: null,
    pinkLabubu: null,
    unicorn: null,
  });

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
      facingDirection: 'right',
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
    difficulty: 'medium',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('labubuHighScore');
      if (saved) setHighScore(parseInt(saved, 10));
      
      const savedDifficulty = localStorage.getItem('labubuDifficulty') as Difficulty;
      if (savedDifficulty && ['easy', 'medium', 'hard'].includes(savedDifficulty)) {
        setDifficulty(savedDifficulty);
      }
      soundsRef.current = new GameSounds();
      
      // Preload images
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      const loadAllImages = async () => {
        try {
          const [brownLabubu, goldenLabubu, blackLabubu, pinkLabubu, unicorn] = await Promise.all([
            loadImage('/assets/brown_labubu.png'),
            loadImage('/assets/golden_labubu.png'),
            loadImage('/assets/black_labubu.png'),
            loadImage('/assets/pink_labubu.png'),
            loadImage('/assets/unicorn.png'),
          ]);
          
          imagesRef.current = {
            brownLabubu,
            goldenLabubu,
            blackLabubu,
            pinkLabubu,
            unicorn,
          };
        } catch (error) {
          console.warn('Failed to load some game images:', error);
        }
      };

      loadAllImages();
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

    // Initialise unicorn position once
    const gameState = gameStateRef.current;
    if (gameState.frameCount === 0) {
      gameState.unicorn.x = canvas.width / 2 - gameState.unicorn.width / 2;
      gameState.unicorn.y = canvas.height - 140;
      gameState.unicorn.targetX = gameState.unicorn.x;
    }

    let lastSpawn = 0;
    let rainbowSpawn = 0;
    let heartSpawn = 0;

    // ---- helpers for difficulty & spawning ----
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    
    // Get difficulty settings based on selected difficulty and score progression
    const getDifficultySettings = () => {
      const scoreDifficulty = clamp01(scoreRef.current / 200); // 0→1 progression with score
      const baseDifficulty = gameState.difficulty;
      
      let difficultyMultiplier = 1;
      let spawnIntervalBase = 1500;
      let speedBase = 3.5;
      let blackChanceBase = 0.05;
      let heartSpawnInterval = 12000;
      let rainbowSpawnInterval = 15000;
      
      switch (baseDifficulty) {
        case 'easy':
          difficultyMultiplier = 0.7;
          spawnIntervalBase = 2000; // Slower spawns
          speedBase = 2.5; // Slower movement
          blackChanceBase = 0.03; // Fewer black Labubus
          heartSpawnInterval = 8000; // More frequent hearts
          rainbowSpawnInterval = 12000; // More frequent rainbows
          break;
        case 'medium':
          difficultyMultiplier = 1.0;
          // Use default values
          break;
        case 'hard':
          difficultyMultiplier = 1.4;
          spawnIntervalBase = 1200; // Faster spawns
          speedBase = 4.5; // Faster movement
          blackChanceBase = 0.08; // More black Labubus
          heartSpawnInterval = 18000; // Less frequent hearts
          rainbowSpawnInterval = 20000; // Less frequent rainbows
          break;
      }
      
      return {
        scoreDifficulty,
        difficultyMultiplier,
        spawnIntervalBase,
        speedBase,
        blackChanceBase,
        heartSpawnInterval,
        rainbowSpawnInterval
      };
    };
    
    const difficulty = () => {
      const { scoreDifficulty, difficultyMultiplier } = getDifficultySettings();
      return clamp01(scoreDifficulty * difficultyMultiplier);
    };

    const chooseGroupSize = () => {
      const d = difficulty();
      const p3 = 0.05 + 0.20 * d; // up to 25%
      const p2 = 0.15 + 0.30 * d; // up to 45%
      const r = Math.random();
      return r < p3 ? 3 : r < p3 + p2 ? 2 : 1;
    };

    const pickLabubuType = (): Labubu['type'] => {
      const d = difficulty();
      const { blackChanceBase } = getDifficultySettings();
      
      const pinkChance = 0.04;             // 4% flat - special power-up
      const blackChance = blackChanceBase + 0.10 * d; // Adjustable base + progression
      const goldenChance = 0.10;          // ~10% flat
      const r = Math.random();
      if (r < pinkChance) return 'pink';
      if (r < pinkChance + blackChance) return 'black';
      if (r < pinkChance + blackChance + goldenChance) return 'golden';
      return 'normal';
    };

    const spawnLabubuGroup = (count: number, timestamp: number) => {
      const minGap = 80; // keep some horizontal spacing
      const xs: number[] = [];
      for (let i = 0; i < count; i++) {
        let attempts = 0;
        let x = Math.random() * (canvas.width - 60);
        while (xs.some((xx) => Math.abs(xx - x) < minGap) && attempts < 50) {
          x = Math.random() * (canvas.width - 60);
          attempts++;
        }
        xs.push(x);
      }

      xs.forEach((x) => {
        gameState.labubus.push({
          x,
          y: -60,
          width: 60,
          height: 60,
          speed: getDifficultySettings().speedBase + Math.min(scoreRef.current / 35, 4.5),
          type: pickLabubuType(),
          rotation: 0,
          wobble: Math.random() * Math.PI * 2,
          scale: 1,
        });
      });
      lastSpawn = timestamp;
    };
    // ------------------------------------------

    const gameLoop = (timestamp: number) => {
      if (!ctx || !canvas) return;

      // Clear
      ctx.fillStyle = '#FFE5F1';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Background
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
      
      // Track movement direction for sprite flipping
      const previousX = gameState.unicorn.x;
      gameState.unicorn.x += (gameState.unicorn.targetX - gameState.unicorn.x) * 0.25;
      
      // Update facing direction based on movement (with small threshold to avoid jitter)
      if (Math.abs(gameState.unicorn.x - previousX) > 0.5) {
        gameState.unicorn.facingDirection = gameState.unicorn.x > previousX ? 'right' : 'left';
      }

      // Catch animation timer
      if (gameState.unicorn.catchAnimation > 0) {
        gameState.unicorn.catchAnimation--;
      }

      // Spawn timing (scales with difficulty and score)
      const { spawnIntervalBase } = getDifficultySettings();
      const spawnInterval = spawnIntervalBase - Math.min(scoreRef.current * 5, 800); // Dynamic floor
      if (timestamp - lastSpawn > spawnInterval) {
        const n = chooseGroupSize();
        spawnLabubuGroup(n, timestamp);
      }

      // Rainbows
      const { rainbowSpawnInterval } = getDifficultySettings();
      if (timestamp - rainbowSpawn > rainbowSpawnInterval) {
        gameState.rainbows.push({
          x: Math.random() * (canvas.width - 80),
          y: -80,
          width: 80,
          height: 40,
          speed: 3,
        });
        rainbowSpawn = timestamp;
      }

      // Hearts
      const { heartSpawnInterval } = getDifficultySettings();
      if (timestamp - heartSpawn > heartSpawnInterval && livesRef.current < 5) {
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
      let pinkAbilityTriggered = false;
      let blackLabubusRemoved = 0;
      
      gameState.labubus = gameState.labubus.filter((labubu) => {
        labubu.y += labubu.speed;
        labubu.rotation += 0.05;
        labubu.wobble += 0.1;
        labubu.x += Math.sin(labubu.wobble) * 1.5;

        // Collect
        if (checkCollision(gameState.unicorn, labubu)) {
          if (labubu.type === 'black') {
            // Penalty: lose a life & reset combo
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

            // Dark particles
            for (let i = 0; i < 12; i++) {
              gameState.particles.push({
                x: labubu.x + labubu.width / 2,
                y: labubu.y + labubu.height / 2,
                vx: (Math.random() - 0.5) * 9,
                vy: (Math.random() - 0.5) * 9,
                life: 35,
                size: Math.random() * 3 + 2,
                color: '#222',
                type: Math.random() > 0.5 ? 'star' : 'circle',
              });
            }
            return false;
          }

          // Special ability for pink labubu
          if (labubu.type === 'pink') {
            // Award points for pink labubu
            setScore((prev) => {
              const gained = 30 * (gameState.powerUpActive ? 2 : 1);
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

            // Mark pink ability as triggered and count black labubus for removal
            pinkAbilityTriggered = true;
            blackLabubusRemoved = gameState.labubus.filter(l => l.type === 'black').length;

            // Pink sparkles around collected pink labubu
            for (let i = 0; i < 20; i++) {
              gameState.particles.push({
                x: labubu.x + labubu.width / 2,
                y: labubu.y + labubu.height / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                life: 45,
                size: Math.random() * 4 + 2,
                color: '#FF69B4',
                type: 'star',
              });
            }

            soundsRef.current?.playPinkLabubuSound();
            gameState.combo++; 
            gameState.unicorn.catchAnimation = 25; // Slightly longer animation
            return false;
          }

          // Scoring for normal/golden
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

        // Missed: only penalise missing non-black
        if (labubu.y > canvas.height) {
          if (labubu.type !== 'black') {
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
          }
          return false;
        }

        drawLabubu(ctx, labubu);
        return true;
      });

      // Handle pink labubu special ability after main loop
      if (pinkAbilityTriggered) {
        // Remove all black labubus
        gameState.labubus = gameState.labubus.filter(l => l.type !== 'black');
        
        // Create extra particles for removed black labubus
        for (let i = 0; i < blackLabubusRemoved * 8; i++) {
          gameState.particles.push({
            x: gameState.unicorn.x + gameState.unicorn.width / 2 + (Math.random() - 0.5) * 200,
            y: gameState.unicorn.y + gameState.unicorn.height / 2 + (Math.random() - 0.5) * 200,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 50,
            size: Math.random() * 5 + 3,
            color: '#FF1493',
            type: Math.random() > 0.5 ? 'star' : 'circle',
          });
        }
      }

      // RAINBOWS
      gameState.rainbows = gameState.rainbows.filter((rainbow) => {
        rainbow.y += rainbow.speed;

        if (checkCollision(gameState.unicorn, rainbow)) {
          soundsRef.current?.playPowerUpSound();
          gameState.powerUpActive = true;
          gameState.powerUpTimer = 300; // 5s @60fps
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

      // Get the appropriate image based on labubu type
      let labubuImage: HTMLImageElement | null = null;
      if (labubu.type === 'golden') {
        labubuImage = imagesRef.current.goldenLabubu;
        // Golden glow effect
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 25;
      } else if (labubu.type === 'black') {
        labubuImage = imagesRef.current.blackLabubu;
        // Black shadow effect
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 20;
      } else if (labubu.type === 'pink') {
        labubuImage = imagesRef.current.pinkLabubu;
        // Pink magical glow effect
        ctx.shadowColor = '#FF69B4';
        ctx.shadowBlur = 30;
        // Add extra sparkle effect
        ctx.shadowOffsetX = Math.sin(labubu.wobble * 2) * 2;
        ctx.shadowOffsetY = Math.cos(labubu.wobble * 2) * 2;
      } else {
        labubuImage = imagesRef.current.brownLabubu;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Shadow on ground
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, labubu.height / 2 - 5, labubu.width / 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw the labubu image if loaded, otherwise fallback to colored rectangle
      if (labubuImage && labubuImage.complete) {
        ctx.drawImage(
          labubuImage,
          -labubu.width / 2,
          -labubu.height / 2,
          labubu.width,
          labubu.height
        );
      } else {
        // Fallback rendering if image not loaded
        let fallbackColor: string;
        if (labubu.type === 'golden') {
          fallbackColor = '#FFD700';
        } else if (labubu.type === 'black') {
          fallbackColor = '#333333';
        } else if (labubu.type === 'pink') {
          fallbackColor = '#FF69B4';
        } else {
          fallbackColor = '#8B7355';
        }
        ctx.fillStyle = fallbackColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, labubu.width / 2 - 2, labubu.height / 2 - 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Reset shadow for additional effects
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Twinkling star for golden labubu
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
    };;

    const drawUnicorn = (ctx: CanvasRenderingContext2D, unicorn: Unicorn) => {
      ctx.save();

      const bounceY = unicorn.bounce || 0;
      const catchScale = unicorn.catchAnimation > 0 ? 1.1 - unicorn.catchAnimation * 0.005 : 1;

      ctx.translate(unicorn.x + unicorn.width / 2, unicorn.y + unicorn.height / 2 + bounceY);
      ctx.scale(catchScale, catchScale);

      // Add horizontal flipping when moving left (mirror the sprite)
      if (unicorn.facingDirection === 'left') {
        ctx.scale(-1, 1); // Flip horizontally (left-right mirroring)
      }

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(0, unicorn.height / 2 - 5, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw the unicorn image if loaded, otherwise fallback to original drawing
      const unicornImage = imagesRef.current.unicorn;
      if (unicornImage && unicornImage.complete) {
        // Add slight bounce animation to the image
        const wingFlap = unicorn.wingFlap || 0;
        ctx.save();
        ctx.translate(0, Math.sin(wingFlap * 0.1) * 2);
        
        ctx.drawImage(
          unicornImage,
          -unicorn.width / 2,
          -unicorn.height / 2,
          unicorn.width,
          unicorn.height
        );
        ctx.restore();
      } else {
        // Fallback to original procedural drawing if image not loaded
        ctx.translate(-45, -45);
        
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

        // Simple fallback body if full rendering fails
        ctx.fillStyle = '#FFE5F1';
        ctx.beginPath();
        ctx.ellipse(45, 45, 30, 25, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    };;;;

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
  }, [gameStarted, isPaused]); // keep unicorn position stable

  const startGame = async () => {
    // Reset state & refs
    setScore(0);
    scoreRef.current = 0;
    setLives(3);
    livesRef.current = 3;

    setGameStarted(true);
    setIsPaused(false);

    // Initialize audio with user interaction (critical for mobile)
    const audioInitialized = await soundsRef.current?.init();
    
    // Only play background music if audio was successfully initialized
    if (audioInitialized) {
      soundsRef.current?.playBackgroundMusic();
    }

    const width = canvasRef.current?.width ?? window.innerWidth;
    const height = canvasRef.current?.height ?? window.innerHeight;
    const centerX = width / 2 - 45;

    gameStateRef.current = {
      unicorn: {
        x: centerX,
        y: height - 140,
        width: 90,
        height: 90,
        targetX: centerX,
        bounce: 0,
        wingFlap: 0,
        catchAnimation: 0,
        magnetPull: false,
        magnetTimer: 0,
        facingDirection: 'right',
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
      difficulty: difficulty,
    };
  };

  const handleDifficultyChange = (newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
    if (typeof window !== 'undefined') {
      localStorage.setItem('labubuDifficulty', newDifficulty);
    }
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
              <p>Catch the falling Labubus. Avoid the black ones!</p>
              <p>🎮 Touch or use arrow keys to move • ⏸️ Space to pause</p>

              <div className="legend">
                <ul>
                  <li><span>🥨</span> <span>Regular Labubu: <span className="badge">+10</span> points</span></li>
                  <li><span>⭐</span> <span>Golden Labubu: <span className="badge">+50</span> points</span></li>
                  <li><span>🌈</span> <span>Rainbow: <strong>2× points</strong> for <strong>5s</strong></span></li>
                  <li><span>💖</span> <span>Heart: <strong>+1 life</strong> (max <strong>5</strong>)</span></li>
                  <li><span>⚫</span> <span><strong>Black Labubu:</strong> <span className="badge">-1 life</span> &amp; combo reset</span></li>
                </ul>
              </div>
            </div>

            <DifficultySelector 
              selectedDifficulty={difficulty}
              onSelectDifficulty={handleDifficultyChange}
            />

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
