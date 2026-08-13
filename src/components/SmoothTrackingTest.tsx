import { useRef, useState, useEffect, useCallback } from 'react';
import { playCompleteSound } from '../utils/soundEngine';
import CountdownOverlay from './CountdownOverlay';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import AnimatedBackground from './AnimatedBackground';
import type { SmoothResultData } from '../types/calibration';

type GameType = 'valorant' | 'csgo' | 'apex' | 'overwatch' | 'other';

interface SmoothTrackingTestProps {
  onComplete: (results: SmoothResultData) => void;
  gameType: GameType;
}

const TEST_DURATION = 12000;
const HEADSHOT_THRESHOLD = 15;

// ── HUD 叠加层 ──────────────────────────────────────────

function Overlay({
  timeLeft,
  avgDistance,
  stability,
  headshotRatio,
}: {
  timeLeft: number;
  avgDistance: number;
  stability: number;
  headshotRatio: number;
}) {
  const progress = Math.max(0, (timeLeft / (TEST_DURATION / 1000)) * 100);
  const stabColor = stability >= 80 ? '#00ff88' : stability >= 60 ? '#ffd700' : '#ff6b35';
  return (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none z-10"
      style={{ background: 'linear-gradient(to bottom, rgba(6,7,12,0.92) 0%, rgba(6,7,12,0.65) 60%, transparent 100%)' }}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>时间</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{timeLeft.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>稳定度</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: stabColor }}>{stability}%</span>
          </div>
        </div>
        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full progress-shimmer" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>平均偏差</span>
            <span className="ml-2 text-sm font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{avgDistance}px</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>完美跟枪</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ff4d4d' }}>{headshotRatio}%</span>
          </div>
          <span className="hud-label">平滑跟枪</span>
        </div>
      </div>
    </div>
  );
}

// ── 组件 ────────────────────────────────────────────────

export default function SmoothTrackingTest({ onComplete, gameType }: SmoothTrackingTestProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [countingDown, setCountingDown] = useState(true);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION / 1000);
  const [avgDistance, setAvgDistance] = useState(0);
  const [stability, setStability] = useState(100);
  const [headshotRatio, setHeadshotRatio] = useState(0);

  const crosshair = useCrosshair();
  const mouseRef = useRef({ x: -999, y: -999, active: false });
  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const frameCounterRef = useRef(0);
  const totalFramesRef = useRef(0);
  const headshotFramesRef = useRef(0);
  const distancesRef = useRef<number[]>([]);
  const prevDistRef = useRef<number | null>(null);
  const jitterRef = useRef(0);

  useEffect(() => {
    const onResize = () => setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 倒计时期间先画一帧背景
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !countingDown) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(15, 15, 35, 0.9)';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
  }, [canvasSize, countingDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
  }, []);

  // ── 动画主循环 ─────────────────────────────────────

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || completedRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    if (!startTimeRef.current) startTimeRef.current = now;
    const elapsed = now - startTimeRef.current;
    const remaining = Math.max(0, TEST_DURATION - elapsed);
    const w = canvasSize.w;
    const h = canvasSize.h;

    if (remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      const totalFrames = totalFramesRef.current || 1;
      const avg = distancesRef.current.length > 0
        ? Math.round((distancesRef.current.reduce((s, d) => s + d, 0) / distancesRef.current.length) * 100) / 100
        : 0;
      let jitter = 0;
      let jc = 0;
      for (let i = 1; i < distancesRef.current.length; i++) {
        const delta = Math.abs(distancesRef.current[i] - distancesRef.current[i - 1]);
        if (delta < 300) { jitter += delta; jc++; }
      }
      const avgJitter = jc > 0 ? jitter / jc : 0;
      const stab = Math.max(0, Math.min(100, 100 - avgJitter * 4));
      onComplete({
        avgDistance: avg,
        stability: Math.round(stab * 100) / 100,
        headshotRatio: Math.round((headshotFramesRef.current / totalFrames) * 1000) / 10,
        distances: [...distancesRef.current],
        totalFrames,
      });
      playCompleteSound();
      return;
    }

    // 目标：匀速圆周运动
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.26;
    const speed = 0.8 + (gameType === 'apex' ? 0.35 : 0);
    const angle = (elapsed / 1000) * speed;
    const tx = cx + Math.cos(angle) * radius;
    const ty = cy + Math.sin(angle) * radius;

    const mouse = mouseRef.current;
    let dist = Infinity;
    if (mouse.active) {
      dist = Math.sqrt((mouse.x - tx) ** 2 + (mouse.y - ty) ** 2);
      distancesRef.current.push(dist);
      totalFramesRef.current++;
      if (dist < HEADSHOT_THRESHOLD) headshotFramesRef.current++;
      if (prevDistRef.current !== null) {
        jitterRef.current += Math.abs(dist - prevDistRef.current);
      }
      prevDistRef.current = dist;
    }

    // ── 绘制 ──────────────────────────────────────
    ctx.fillStyle = 'rgba(15, 15, 35, 0.9)';
    ctx.fillRect(0, 0, w, h);

    // 轨道
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 目标
    ctx.save();
    ctx.beginPath();
    ctx.arc(tx, ty, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(221,85,85,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx - 4, ty - 4, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.restore();

    // 准星 + 距离环
    if (mouse.active) {
      drawCrosshairStyled(ctx, mouse.x, mouse.y, crosshair.settings);
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, HEADSHOT_THRESHOLD, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,77,77,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── 更新 React state（每10帧） ────────────────
    frameCounterRef.current++;
    if (frameCounterRef.current % 10 === 0) {
      setTimeLeft(remaining / 1000);
      const avg = distancesRef.current.length > 0
        ? Math.round((distancesRef.current.reduce((s, d) => s + d, 0) / distancesRef.current.length) * 10) / 10
        : 0;
      setAvgDistance(avg);
      const tf = totalFramesRef.current || 1;
      setHeadshotRatio(Math.round((headshotFramesRef.current / tf) * 100));
      const aj = totalFramesRef.current > 1 ? jitterRef.current / (totalFramesRef.current - 1) : 0;
      setStability(Math.round(Math.max(0, Math.min(100, 100 - aj * 4))));
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [canvasSize, gameType, onComplete, crosshair.settings]);

  const handleCountdownFinish = useCallback(() => setCountingDown(false), []);

  useEffect(() => {
    if (countingDown) return;
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 300);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [countingDown, animate]);

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none scanlines">
      <AnimatedBackground />
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onMouseMove={handleMouseMove}
        className="absolute inset-0 cursor-none"
        style={{ touchAction: 'none' }}
      />

      {countingDown && <CountdownOverlay title="平滑跟枪测试" onFinish={handleCountdownFinish} />}

      <Overlay
        timeLeft={timeLeft}
        avgDistance={avgDistance}
        stability={stability}
        headshotRatio={headshotRatio}
      />
    </div>
  );
}
