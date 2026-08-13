import { useRef, useState, useEffect, useCallback } from 'react';
import type { ClickResult, FlickResultData } from '../types/calibration';
import { playHeadshotSound, playBodyHitSound, playMissSound, playCompleteSound } from '../utils/soundEngine';
import CountdownOverlay from './CountdownOverlay';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import AnimatedBackground from './AnimatedBackground';

type GameType = 'valorant' | 'csgo' | 'apex' | 'overwatch' | 'other';
type HitResult = 'headshot' | 'hit' | 'miss' | 'none';

interface FlickTestProps {
  onComplete: (results: FlickResultData) => void;
  targetCount?: number;
  gameType: GameType;
}

interface Target {
  x: number;
  y: number;
  radius: number;
  appearedAt: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const FLICK_MARGIN = 90;

function generateTarget(gameType: GameType, w: number, h: number): Target {
  const precise = gameType === 'valorant' || gameType === 'csgo';
  const radius = precise ? 8 + Math.random() * 5 : 10 + Math.random() * 6;
  const x = FLICK_MARGIN + Math.random() * (w - FLICK_MARGIN * 2);
  const y = FLICK_MARGIN + Math.random() * (h - FLICK_MARGIN * 2);
  return { x, y, radius, appearedAt: performance.now() };
}

function drawTarget(
  ctx: CanvasRenderingContext2D,
  t: Target,
  radius: number,
  ring: boolean,
) {
  ctx.save();
  if (ring) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#dd5555';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(t.x - radius * 0.25, t.y - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
  ctx.restore();
}

// ── HUD 叠加层 ──────────────────────────────────────────

function Overlay({
  remaining,
  total,
  accuracy,
  headshotRate,
  avgReaction,
}: {
  remaining: number;
  total: number;
  accuracy: number;
  headshotRate: number;
  avgReaction: number;
}) {
  const done = total - remaining;
  const progress = total > 0 ? (done / total) * 100 : 0;
  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none z-10"
      style={{ background: 'linear-gradient(to bottom, rgba(6,7,12,0.92) 0%, rgba(6,7,12,0.65) 60%, transparent 100%)' }}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>目标</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {done}<span className="text-[#8b93a7]">/{total}</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>精度</span>
            <span className="ml-2 text-sm font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{accuracy}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>爆头率</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ff4d4d' }}>{headshotRate}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>平均反应</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#22d3ee' }}>{avgReaction}ms</span>
          </div>
        </div>
        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full progress-shimmer" style={{ width: `${progress}%` }} />
        </div>
        <span className="hud-label">甩枪测试</span>
      </div>
    </div>
  );
}

// ── 组件 ────────────────────────────────────────────────

export default function FlickTest({ onComplete, targetCount = 12, gameType }: FlickTestProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [countingDown, setCountingDown] = useState(true);
  const [remaining, setRemaining] = useState(targetCount);
  const [accuracy, setAccuracy] = useState(0);
  const [headshotRate, setHeadshotRate] = useState(0);
  const [avgReaction, setAvgReaction] = useState(0);

  const crosshair = useCrosshair();
  const resultsRef = useRef<ClickResult[]>([]);
  const targetRef = useRef<Target | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef({ start: 0, target: null as Target | null, phase: 'idle' as 'idle' | 'spawning' | 'playing' | 'feedback' });
  const hitResultRef = useRef<HitResult>('none');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const mouseRef = useRef({ x: canvasSize.w / 2, y: canvasSize.h / 2, active: false });
  const totalTargets = useRef(targetCount);

  useEffect(() => {
    const onResize = () => setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const spawnParticles = useCallback((x: number, y: number) => {
    const p: Particle[] = [];
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 240;
      p.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.45,
        maxLife: 0.3 + Math.random() * 0.45,
        color: i % 2 === 0 ? '#ffd700' : '#ff8844',
        size: 1.5 + Math.random() * 3,
      });
    }
    particlesRef.current = [...particlesRef.current, ...p];
  }, []);

  // ── 渲染循环 ─────────────────────────────────────────

  const frame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvasSize.w;
    const h = canvasSize.h;
    const now = performance.now();
    const dt = Math.min(0.05, 0.016);

    ctx.fillStyle = 'rgba(15, 15, 35, 0.88)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 80; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 80; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    drawCrosshairStyled(
      ctx,
      mouseRef.current.active ? mouseRef.current.x : w / 2,
      mouseRef.current.active ? mouseRef.current.y : h / 2,
      crosshair.settings,
    );

    const target = targetRef.current;
    const anim = animRef.current;
    if (target && anim.phase === 'spawning') {
      const progress = Math.min(1, (now - anim.start) / 120);
      const eased = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
      drawTarget(ctx, target, target.radius * (0.4 + eased * 0.6), false);
      if (progress >= 1) anim.phase = 'playing';
    } else if (target && anim.phase === 'feedback') {
      const elapsed = now - anim.start;
      const fade = Math.min(1, elapsed / 220);
      drawTarget(ctx, target, target.radius * (1 - fade * 0.6), hitResultRef.current === 'headshot');
      if (elapsed > 220) {
        anim.phase = 'idle';
        targetRef.current = null;
      }
    } else if (target) {
      drawTarget(ctx, target, target.radius, false);
    }

    for (const p of particlesRef.current) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
    for (const p of particlesRef.current) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [canvasSize, crosshair.settings]);

  // ── 交互 ─────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
  }, []);

  const showNext = useCallback(() => {
    if (completedRef.current) return;
    const target = generateTarget(gameType, canvasSize.w, canvasSize.h);
    targetRef.current = target;
    animRef.current = { start: performance.now(), target, phase: 'spawning' };
    hitResultRef.current = 'none';
  }, [gameType, canvasSize]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const target = targetRef.current;
      if (!target || completedRef.current) return;
      if (animRef.current.phase === 'spawning') {
        animRef.current.phase = 'playing';
      }
      if (animRef.current.phase === 'feedback') return;

      const now = performance.now();
      const clickX = e.clientX;
      const clickY = e.clientY;
      const distance = Math.sqrt((clickX - target.x) ** 2 + (clickY - target.y) ** 2);
      const reactionTime = now - target.appearedAt;

      let hitType: HitResult;
      if (distance < target.radius) {
        hitType = 'headshot';
      } else if (distance < target.radius + 20) {
        hitType = 'hit';
      } else {
        hitType = 'miss';
      }
      hitResultRef.current = hitType;
      animRef.current = { start: now, target, phase: 'feedback' };

      resultsRef.current = [
        ...resultsRef.current,
        {
          x: Math.round(clickX * 100) / 100,
          y: Math.round(clickY * 100) / 100,
          targetX: target.x,
          targetY: target.y,
          distance: Math.round(distance * 100) / 100,
          reactionTime: Math.round(reactionTime * 100) / 100,
          isHeadshot: hitType === 'headshot',
          isBodyHit: hitType === 'hit',
        },
      ];

      if (hitType === 'headshot') {
        spawnParticles(target.x, target.y);
        playHeadshotSound();
      } else if (hitType === 'hit') {
        playBodyHitSound();
      } else {
        playMissSound();
      }

      const results = resultsRef.current;
      const headshots = results.filter((r) => r.isHeadshot).length;
      const bodyHits = results.filter((r) => r.isBodyHit).length;
      const overallHits = headshots + bodyHits;
      setRemaining(totalTargets.current - results.length);
      setAccuracy(Math.round((overallHits / results.length) * 100));
      setHeadshotRate(Math.round((headshots / results.length) * 100));
      setAvgReaction(Math.round(results.reduce((s, r) => s + r.reactionTime, 0) / results.length));

      if (results.length >= totalTargets.current) {
        completedRef.current = true;
        playCompleteSound();
        const flickData: FlickResultData = {
          clicks: resultsRef.current,
          accuracy: Math.round((overallHits / results.length) * 100),
          headshotRate: Math.round((headshots / results.length) * 100),
          avgDistance: Math.round((results.reduce((s, r) => s + r.distance, 0) / results.length) * 100) / 100,
          avgReactionTime: Math.round(results.reduce((s, r) => s + r.reactionTime, 0) / results.length),
        };
        timeoutRef.current = setTimeout(() => onComplete(flickData), 600);
      } else {
        timeoutRef.current = setTimeout(() => showNext(), 350);
      }
    },
    [onComplete, showNext, spawnParticles],
  );

  const handleCountdownFinish = useCallback(() => setCountingDown(false), []);

  useEffect(() => {
    if (countingDown) return;
    timeoutRef.current = setTimeout(() => {
      if (!completedRef.current) showNext();
    }, 250);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [countingDown, showNext]);

  useEffect(() => {
    if (countingDown) return;
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [countingDown, frame]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none scanlines">
      <AnimatedBackground />
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        className="absolute inset-0 cursor-none"
        style={{ touchAction: 'none' }}
      />

      {countingDown && <CountdownOverlay title="甩枪测试" onFinish={handleCountdownFinish} />}

      <Overlay
        remaining={remaining}
        total={totalTargets.current}
        accuracy={accuracy}
        headshotRate={headshotRate}
        avgReaction={avgReaction}
      />
    </div>
  );
}
