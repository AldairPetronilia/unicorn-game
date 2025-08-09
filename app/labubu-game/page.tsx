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
      magnetTimer: 0
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
      if (saved) setHighScore(parseInt(saved));
      soundsRef.current = new GameSounds();
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !gameStarted || isPaused) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const gameState = gameStateRef.current;
    gameState.unicorn.x = canvas.width / 2 - 45;
    gameState.unicorn.y = canvas.height - 140;
    gameState.unicorn.targetX = canvas.width / 2 - 45;

    let lastSpawn = 0;
    let rainbowSpawn = 0;
    let heartSpawn = 0;

    const gameLoop = (timestamp: number) => {
      if (!ctx || !canvas) return;
      
      // Clear canvas
      ctx.fillStyle = '#FFE5F1';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw clouds
      drawClouds(ctx, canvas);
      
      // Update frame count for animations
      gameState.frameCount++;
      gameState.unicorn.wingFlap = Math.sin(gameState.frameCount * 0.15) * 5;
      gameState.unicorn.bounce = Math.sin(gameState.frameCount * 0.1) * 3;
      
      // Update unicorn position with magnet effect
      if (gameState.unicorn.magnetPull && gameState.unicorn.magnetTimer > 0) {
        gameState.unicorn.magnetTimer--;
        const centerX = canvas.width / 2 - gameState.unicorn.width / 2;
        gameState.unicorn.targetX += (centerX - gameState.unicorn.targetX) * 0.08;
        
        if (gameState.unicorn.magnetTimer <= 0) {
          gameState.unicorn.magnetPull = false;
        }
      } else if (gameState.touchX !== null) {
        gameState.unicorn.targetX = gameState.touchX - gameState.unicorn.width / 2;
      } else if (gameState.moveDirection !== 0) {
        gameState.unicorn.targetX += gameState.moveDirection * 10;
      }
      
      // Smooth movement with increased responsiveness for mobile
      gameState.unicorn.targetX = Math.max(0, Math.min(canvas.width - gameState.unicorn.width, gameState.unicorn.targetX));
      gameState.unicorn.x += (gameState.unicorn.targetX - gameState.unicorn.x) * 0.25;
      
      // Update catch animation
      if (gameState.unicorn.catchAnimation > 0) {
        gameState.unicorn.catchAnimation--;
      }
      
      // Spawn Labubus
      if (timestamp - lastSpawn > (1500 - Math.min(score * 5, 1000))) {
        gameState.labubus.push({
          x: Math.random() * (canvas.width - 60),
          y: -60,
          width: 60,
          height: 60,
          speed: 2 + Math.min(score / 50, 3),
          type: Math.random() > 0.9 ? 'golden' : 'normal',
          rotation: 0,
          wobble: Math.random() * Math.PI * 2,
          scale: 1,
        });
        lastSpawn = timestamp;
      }
      
      // Spawn Rainbows (power-ups)
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
      
      // Spawn Hearts (extra lives)
      if (timestamp - heartSpawn > 30000 && lives < 3) {
        gameState.hearts.push({
          x: Math.random() * (canvas.width - 40),
          y: -40,
          width: 40,
          height: 40,
          speed: 2,
        });
        heartSpawn = timestamp;
      }
      
      // Update and draw Labubus
      gameState.labubus = gameState.labubus.filter(labubu => {
        labubu.y += labubu.speed;
        labubu.rotation += 0.05;
        labubu.wobble += 0.1;
        labubu.x += Math.sin(labubu.wobble) * 1.5;
        
        // Check collision with unicorn
        if (checkCollision(gameState.unicorn, labubu)) {
          const points = labubu.type === 'golden' ? 50 : 10;
          setScore(prev => {
            const newScore = prev + points * (gameState.powerUpActive ? 2 : 1);
            if (newScore > highScore) {
              setHighScore(newScore);
              localStorage.setItem('labubuHighScore', newScore.toString());
            }
            return newScore;
          });
          
          soundsRef.current?.playCollectSound(labubu.type === 'golden');
          gameState.combo++;
          
          // Trigger catch animation and magnet pull
          gameState.unicorn.catchAnimation = 20;
          gameState.unicorn.magnetPull = true;
          gameState.unicorn.magnetTimer = 15;
          
          // Create sparkle particles
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
        
        // Check if missed
        if (labubu.y > canvas.height) {
          gameState.combo = 0;
          soundsRef.current?.playMissSound();
          setLives(prev => {
            const newLives = prev - 1;
            if (newLives <= 0) {
              soundsRef.current?.playGameOverSound();
              endGame();
            }
            return newLives;
          });
          return false;
        }
        
        drawLabubu(ctx, labubu);
        return true;
      });
      
      // Update and draw Rainbows
      gameState.rainbows = gameState.rainbows.filter(rainbow => {
        rainbow.y += rainbow.speed;
        
        if (checkCollision(gameState.unicorn, rainbow)) {
          soundsRef.current?.playPowerUpSound();
          gameState.powerUpActive = true;
          gameState.powerUpTimer = 300; // 5 seconds at 60fps
          return false;
        }
        
        if (rainbow.y > canvas.height) return false;
        
        drawRainbow(ctx, rainbow);
        return true;
      });
      
      // Update and draw Hearts
      gameState.hearts = gameState.hearts.filter(heart => {
        heart.y += heart.speed;
        
        if (checkCollision(gameState.unicorn, heart)) {
          soundsRef.current?.playHeartSound();
          setLives(prev => Math.min(prev + 1, 5));
          return false;
        }
        
        if (heart.y > canvas.height) return false;
        
        drawHeart(ctx, heart);
        return true;
      });
      
      // Update particles
      gameState.particles = gameState.particles.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.3;
        particle.life--;
        
        if (particle.life > 0) {
          ctx.globalAlpha = particle.life / 40;
          ctx.fillStyle = particle.color;
          
          if (particle.type === 'star') {
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.life * 0.1);
            
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
              const r = i % 2 === 0 ? particle.size : particle.size * 0.5;
              ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.globalAlpha = 1;
          return true;
        }
        return false;
      });
      
      // Update power-up timer
      if (gameState.powerUpActive) {
        gameState.powerUpTimer--;
        if (gameState.powerUpTimer <= 0) {
          gameState.powerUpActive = false;
        }
      }
      
      // Draw unicorn with rainbow trail if powered up
      if (gameState.powerUpActive) {
        drawRainbowTrail(ctx, gameState.unicorn);
      }
      drawUnicorn(ctx, gameState.unicorn);
      
      // Draw UI
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
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(0, labubu.height / 2 - 5, labubu.width / 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Body with gradient
      const gradient = ctx.createRadialGradient(0, -5, 0, 0, 5, labubu.width / 2);
      if (labubu.type === 'golden') {
        gradient.addColorStop(0, '#FFEB3B');
        gradient.addColorStop(0.5, '#FFD700');
        gradient.addColorStop(1, '#FFA000');
      } else {
        gradient.addColorStop(0, '#D4A574');
        gradient.addColorStop(0.5, '#8B7355');
        gradient.addColorStop(1, '#6B5D54');
      }
      ctx.fillStyle = gradient;
      
      // Fluffy body shape
      ctx.beginPath();
      ctx.ellipse(0, 0, labubu.width / 2 - 2, labubu.height / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Fluffy texture
      ctx.strokeStyle = labubu.type === 'golden' ? '#FFE082' : '#A89585';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 18, Math.sin(angle) * 18, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Ears with inner detail
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
      
      // Big cute eyes with sparkle
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-12, -5, 5, 6, 0, 0, Math.PI * 2);
      ctx.ellipse(12, -5, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye sparkles
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(-10, -7, 2, 0, Math.PI * 2);
      ctx.arc(14, -7, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Cute nose
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 2, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Happy smile with teeth
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, 10, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      
      // Signature teeth
      ctx.fillStyle = '#FFF';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      // Left tooth
      ctx.fillRect(-6, 6, 4, 5);
      ctx.strokeRect(-6, 6, 4, 5);
      // Right tooth
      ctx.fillRect(2, 6, 4, 5);
      ctx.strokeRect(2, 6, 4, 5);
      
      // Blush marks
      ctx.fillStyle = 'rgba(255, 192, 203, 0.6)';
      ctx.beginPath();
      ctx.arc(-20, 2, 5, 0, Math.PI * 2);
      ctx.arc(20, 2, 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Star decoration for golden
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
      
      // Apply bounce animation
      const bounceY = unicorn.bounce || 0;
      const catchScale = unicorn.catchAnimation > 0 ? 1.1 - (unicorn.catchAnimation * 0.005) : 1;
      
      ctx.translate(unicorn.x + 45, unicorn.y + 45 + bounceY);
      ctx.scale(catchScale, catchScale);
      ctx.translate(-45, -45);
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.ellipse(45, 85, 35, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Wings (animated)
      const wingFlap = unicorn.wingFlap || 0;
      
      // Left wing
      ctx.save();
      ctx.translate(20, 40);
      ctx.rotate(-0.3 + Math.sin(wingFlap * 0.1) * 0.2);
      
      const wingGradientL = ctx.createLinearGradient(-20, 0, 0, 30);
      wingGradientL.addColorStop(0, 'rgba(255, 182, 193, 0.9)');
      wingGradientL.addColorStop(0.5, 'rgba(255, 192, 203, 0.7)');
      wingGradientL.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
      ctx.fillStyle = wingGradientL;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-25, 10, -20, 30);
      ctx.quadraticCurveTo(-15, 35, -5, 35);
      ctx.quadraticCurveTo(-10, 20, 0, 0);
      ctx.fill();
      
      // Wing details
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
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
      wingGradientR.addColorStop(0, 'rgba(255, 182, 193, 0.9)');
      wingGradientR.addColorStop(0.5, 'rgba(255, 192, 203, 0.7)');
      wingGradientR.addColorStop(1, 'rgba(255, 255, 255, 0.5)');
      ctx.fillStyle = wingGradientR;
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(25, 10, 20, 30);
      ctx.quadraticCurveTo(15, 35, 5, 35);
      ctx.quadraticCurveTo(10, 20, 0, 0);
      ctx.fill();
      
      // Wing details
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(5, 10);
      ctx.quadraticCurveTo(15, 15, 15, 25);
      ctx.stroke();
      
      ctx.restore();
      
      // Body with gradient
      const bodyGradient = ctx.createRadialGradient(45, 50, 10, 45, 50, 35);
      bodyGradient.addColorStop(0, '#FFFFFF');
      bodyGradient.addColorStop(0.7, '#FFF5F5');
      bodyGradient.addColorStop(1, '#FFE5F1');
      ctx.fillStyle = bodyGradient;
      
      ctx.beginPath();
      ctx.ellipse(45, 50, 35, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Body highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(35, 40, 12, 15, -0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Legs with hooves
      const legPositions = [
        { x: 25, move: Math.sin(gameStateRef.current.frameCount * 0.1) * 2 },
        { x: 35, move: Math.sin(gameStateRef.current.frameCount * 0.1 + 1) * 2 },
        { x: 50, move: Math.sin(gameStateRef.current.frameCount * 0.1 + 2) * 2 },
        { x: 60, move: Math.sin(gameStateRef.current.frameCount * 0.1 + 3) * 2 }
      ];
      
      legPositions.forEach(leg => {
        // Leg
        ctx.fillStyle = '#FFF5F5';
        ctx.fillRect(leg.x, 70 + leg.move, 10, 18);
        
        // Hoof
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
      
      // Horn with spiral and sparkle
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
      
      // Horn spiral
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(43, 12);
      ctx.quadraticCurveTo(45, 5, 47, 0);
      ctx.quadraticCurveTo(45, -3, 45, -5);
      ctx.stroke();
      
      // Horn sparkle
      ctx.fillStyle = '#FFF';
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
      
      // Mane with flowing animation
      const maneColors = ['#FF69B4', '#FFB6C1', '#DDA0DD', '#BA55D3', '#9370DB'];
      const maneFlow = Math.sin(gameStateRef.current.frameCount * 0.05) * 2;
      
      for (let i = 0; i < 5; i++) {
        const gradient = ctx.createRadialGradient(
          25 + i * 4, 
          10 + i * 3 + maneFlow, 
          0,
          25 + i * 4, 
          10 + i * 3 + maneFlow, 
          15
        );
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
      
      // Eye with lashes
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
    
    const drawRainbow = (ctx: CanvasRenderingContext2D, rainbow: Rainbow) => {
      const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
      const stripeHeight = rainbow.height / colors.length;
      
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(rainbow.x, rainbow.y + i * stripeHeight, rainbow.width, stripeHeight);
      });
    };
    
    const drawRainbowTrail = (ctx: CanvasRenderingContext2D, unicorn: Unicorn) => {
      const colors = ['#FF000030', '#FF7F0030', '#FFFF0030', '#00FF0030', '#0000FF30', '#4B008230', '#9400D330'];
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(unicorn.x - i * 5, unicorn.y + 70 + i * 2, unicorn.width + i * 10, 5);
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
      // Score
      ctx.fillStyle = '#FF69B4';
      ctx.font = 'bold 24px Comic Sans MS, cursive';
      ctx.fillText(`Score: ${score}`, 20, 40);
      
      // High Score
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`Best: ${highScore}`, 20, 70);
      
      // Lives
      for (let i = 0; i < lives; i++) {
        drawHeart(ctx, { x: canvas.width - 60 - i * 50, y: 20, width: 40, height: 40, speed: 0 });
      }
      
      // Combo
      if (gameStateRef.current.combo > 1) {
        ctx.fillStyle = '#FF1493';
        ctx.font = 'bold 32px Comic Sans MS, cursive';
        ctx.fillText(`${gameStateRef.current.combo}x Combo!`, canvas.width / 2 - 80, 100);
      }
      
      // Power-up indicator
      if (gameStateRef.current.powerUpActive) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px Comic Sans MS, cursive';
        ctx.fillText('RAINBOW POWER!', canvas.width / 2 - 100, 150);
      }
    };
    
    const checkCollision = (rect1: { x: number; y: number; width: number; height: number }, rect2: { x: number; y: number; width: number; height: number }) => {
      return rect1.x < rect2.x + rect2.width &&
             rect1.x + rect1.width > rect2.x &&
             rect1.y < rect2.y + rect2.height &&
             rect1.y + rect1.height > rect2.y;
    };
    
    const endGame = () => {
      setGameStarted(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    
    // Touch controls
    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        gameState.touchX = e.touches[0].clientX;
      }
    };
    
    const handleTouchEnd = () => {
      gameState.touchX = null;
    };
    
    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') gameState.moveDirection = -1;
      if (e.key === 'ArrowRight') gameState.moveDirection = 1;
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        gameState.moveDirection = 0;
      }
    };
    
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    animationRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, isPaused, score, highScore, lives]);

  const startGame = () => {
    setScore(0);
    setLives(3);
    setGameStarted(true);
    setIsPaused(false);
    soundsRef.current?.init();
    soundsRef.current?.playBackgroundMusic();
    
    const canvas = canvasRef.current;
    const centerX = canvas ? canvas.width / 2 - 45 : window.innerWidth / 2 - 45;
    
    gameStateRef.current = {
      unicorn: { 
        x: centerX, 
        y: 0, 
        width: 90, 
        height: 90,
        targetX: centerX,
        bounce: 0,
        wingFlap: 0,
        catchAnimation: 0,
        magnetPull: false,
        magnetTimer: 0
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
              <p>Help the unicorn catch falling Labubus!</p>
              <p>🎮 Touch or use arrow keys to move</p>
              <p>✨ Golden Labubus = 50 points!</p>
              <p>🌈 Rainbows = Double points!</p>
              <p>💖 Hearts = Extra lives!</p>
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
          aria-label={isMuted ? "Unmute" : "Mute"}
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