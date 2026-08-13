import { useRef, useState, useEffect, useCallback } from 'react';
import type { ClickResult } from '../types/calibration';
import { playMissSound, playCompleteSound, playHeadshotSoundPitched, playBodyHitSoundPitched, playAceSound } from '../utils/soundEngine';
import CountdownOverlay from './CountdownOverlay';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import AnimatedBackground from './AnimatedBackground';
import FpsHudFrame from './FpsHudFrame';

type GameType = 'valorant' | 'csgo' | 'apex' | 'overwatch' | 'other';
type HitResult = 'headshot' | 'hit' | 'miss' | 'none';

interface StaticClickTestProps {
  onComplete: (results: ClickResult[]) => void;
  targetCount?: number;
  gameType: GameType;
}

interface Target {
  x: number;
  y: number;
  radius: number;
  appearedAt: number;
  color: string;
  // 人物比例缩放（半径8→小人物，15→大人物）
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

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

// ── 3x3 宫格权重 ──────────────────────────────────────────────

type GridWeights = [number, number, number][];

function getGridWeights(gameType: GameType): GridWeights {
  switch (gameType) {
    case 'valorant':
    case 'csgo':
      return [
        [1, 3, 1],
        [4, 8, 4],
        [0, 1, 0],
      ];
    case 'apex':
      return [
        [1, 1, 1],
        [2, 2, 2],
        [2, 2, 2],
      ];
    case 'overwatch':
      return [
        [2, 2, 1],
        [3, 3, 2],
        [2, 2, 1],
      ];
    default:
      return [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ];
  }
}

function pickWeightedCell(weights: GridWeights) {
  const flat: { row: number; col: number; w: number }[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      if (weights[r][c] > 0) flat.push({ row: r, col: c, w: weights[r][c] });
  const total = flat.reduce((s, e) => s + e.w, 0);
  let rand = Math.random() * total;
  for (const e of flat) {
    rand -= e.w;
    if (rand <= 0) return { row: e.row, col: e.col };
  }
  return flat[flat.length - 1];
}

function generateTarget(
  gameType: GameType,
  canvasW: number,
  canvasH: number,
): Target {
  const weights = getGridWeights(gameType);
  const cell = pickWeightedCell(weights);
  const cellW = canvasW / 3;
  const cellH = canvasH / 3;
  const margin = 60;
  const x = cell.col * cellW + margin + Math.random() * (cellW - margin * 2);
  const y = cell.row * cellH + margin + Math.random() * (cellH - margin * 2);
  const radius = 8 + Math.random() * 7;
  const redness = Math.round(180 + (radius - 8) * (75 / 7));
  const color = `rgb(${redness},60,60)`;
  return { x, y, radius, appearedAt: performance.now(), color };
}

// ── 绘制辅助 ──────────────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 80; x < w; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 80; y < h; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

// Crosshair drawn via drawCrosshairStyled from useCrosshair hook

// 人物轮廓
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  t: Target,
  scale: number,
  bodyAlpha: number,
) {
  const s = scale;
  const headR = t.radius * s;
  const bodyW = headR * 2.2;
  const bodyH = headR * 3.5;
  const neckGap = headR * 0.15;

  ctx.save();

  // 身体
  const bodyX = t.x - bodyW / 2;
  const bodyY = t.y + headR + neckGap;
  ctx.globalAlpha = bodyAlpha * 0.6;
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 3);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 头部
  ctx.beginPath();
  ctx.arc(t.x, t.y, headR, 0, Math.PI * 2);
  ctx.fillStyle = t.color;
  ctx.fill();

  // 头部高光
  ctx.beginPath();
  ctx.arc(t.x - headR * 0.25, t.y - headR * 0.25, headR * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();

  ctx.restore();
}

// ── HUD 叠加层 ──────────────────────────────────────────────

function Overlay({
  remaining,
  total,
  accuracy,
  headshotRate,
}: {
  remaining: number;
  total: number;
  accuracy: number;
  headshotRate: number;
}) {
  const done = total - remaining;
  const progress = total > 0 ? (done / total) * 100 : 0;
  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none z-10"
      style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.7) 60%, transparent 100%)' }}>
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: info */}
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              目标
            </span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {done}<span className="text-[#8892b0]">/{total}</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              精度
            </span>
            <span className="ml-2 text-sm font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {accuracy}%
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              爆头率
            </span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ff4d4d' }}>
              {headshotRate}%
            </span>
          </div>
        </div>
        {/* Center: progress bar */}
        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full progress-shimmer" style={{ width: `${progress}%` }} />
        </div>
        {/* Right: label */}
        <span className="text-[10px] uppercase tracking-[0.3em] text-[#00ff8860]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          静态精度
        </span>
      </div>
    </div>
  );
}

// ── 组件 ──────────────────────────────────────────────────────

function StaticClickTest({
  onComplete,
  targetCount = 15,
  gameType,
}: StaticClickTestProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [canvasSize, setCanvasSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [remaining, setRemaining] = useState(targetCount);
  const [accuracy, setAccuracy] = useState(0);
  const [headshotRate, setHeadshotRate] = useState(0);
  const crosshair = useCrosshair();
  const [countingDown, setCountingDown] = useState(true);

  const resultsRef = useRef<ClickResult[]>([]);
  const targetRef = useRef<Target | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const animRef = useRef({ start: 0, target: null as Target | null, phase: 'idle' as 'idle' | 'spawning' | 'playing' | 'feedback' });
  const hitResultRef = useRef<HitResult>('none');
  const hitToneRef = useRef(0); // 命中音调循环 0-4
  const headshotStreakRef = useRef(0); // 连续爆头计数
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalTargets = useRef(targetCount);
  const completedRef = useRef(false);
  const scaleRef = useRef(1);
  const mouseRef = useRef({ x: canvasSize.w / 2, y: canvasSize.h / 2, active: false });
  const drawStaticRef = useRef<() => void>(() => {});

  // ── resize ─────────────────────────────────────────────

  useEffect(() => {
    const onResize = () =>
      setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── 粒子效果 ───────────────────────────────────────────

  const spawnParticles = useCallback((x: number, y: number, count: number) => {
    const p: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      p.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.4 + Math.random() * 0.5,
        color: i % 3 === 0 ? '#ff6666' : i % 3 === 1 ? '#ff3333' : '#ff8888',
        size: 2 + Math.random() * 4,
      });
    }
    particlesRef.current = [...particlesRef.current, ...p];
  }, []);

  const spawnFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      x, y,
      text,
      color,
      life: 0.8,
      maxLife: 0.8,
    });
  }, []);

  // ── 动画帧 ─────────────────────────────────────────────

  const frameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvasSize.w;
    const h = canvasSize.h;
    const now = performance.now();
    const dt = Math.min(0.05, 0.016);

    // ── 清屏 ──
    ctx.fillStyle = 'rgba(15, 15, 35, 0.88)';
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h);
    drawCrosshairStyled(
      ctx,
      mouseRef.current.active ? mouseRef.current.x : w / 2,
      mouseRef.current.active ? mouseRef.current.y : h / 2,
      crosshair.settings,
    );

    // ── 人物渲染 ──
    const target = targetRef.current;
    const anim = animRef.current;
    if (target && anim.phase === 'spawning') {
      const elapsed = now - anim.start;
      const progress = Math.min(1, elapsed / 200);
      const eased = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
      scaleRef.current = 0.3 + eased * 0.7;
      drawCharacter(ctx, target, scaleRef.current, 1);
      if (progress >= 1) anim.phase = 'playing';
    } else if (target && anim.phase === 'feedback') {
      const elapsed = now - anim.start;
      const hr = hitResultRef.current;
      if (hr === 'headshot') {
        // 身体快速消失
        const fadeProgress = Math.min(1, elapsed / 300);
        drawCharacter(ctx, target, scaleRef.current, 1 - fadeProgress * 0.8);
      } else if (hr === 'hit') {
        // 白色闪烁
        const flashPhase = elapsed < 100;
        if (flashPhase) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(target.x, target.y, target.radius + 10, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fill();
          ctx.restore();
        }
        drawCharacter(ctx, target, scaleRef.current, 1);
      }
      if (elapsed > 400) {
        anim.phase = 'idle';
        targetRef.current = null;
      }
    } else if (target) {
      drawCharacter(ctx, target, scaleRef.current, 1);
    }

    // ── 粒子更新 ──
    for (const p of particlesRef.current) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt; // 重力
      p.life -= dt;
    }
    particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

    // 绘制粒子
    for (const p of particlesRef.current) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 浮动文字 ──
    for (const ft of floatingTextsRef.current) {
      ft.y -= 60 * dt;
      ft.life -= dt;
    }
    floatingTextsRef.current = floatingTextsRef.current.filter((ft) => ft.life > 0);

    for (const ft of floatingTextsRef.current) {
      const alpha = ft.life / ft.maxLife;
      const size = 18 + (1 - alpha) * 8;
      ctx.font = `bold ${size}px sans-serif`;
      ctx.textAlign = 'center';
      // Glow layer
      if (ft.text === 'HEADSHOT') {
        ctx.shadowColor = '#7c3aed';
        ctx.shadowBlur = 16;
      }
      ctx.fillStyle = ft.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }

    // ── 持续渲染 ──
    const hasAnim = particlesRef.current.length > 0 || floatingTextsRef.current.length > 0 || anim.phase === 'spawning' || anim.phase === 'feedback';
    if (hasAnim) {
      requestAnimationFrame(frameLoop);
    }
  }, [canvasSize]);

  const startFrameLoop = useCallback(() => {
    requestAnimationFrame(frameLoop);
  }, [frameLoop]);

  // ── 绘制静态帧 ─────────────────────────────────────────

  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(15, 15, 35, 0.88)';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
    drawGrid(ctx, canvasSize.w, canvasSize.h);
    drawCrosshairStyled(
      ctx,
      mouseRef.current.active ? mouseRef.current.x : canvasSize.w / 2,
      mouseRef.current.active ? mouseRef.current.y : canvasSize.h / 2,
      crosshair.settings,
    );
    const t = targetRef.current;
    if (t) drawCharacter(ctx, t, scaleRef.current, 1);
  }, [canvasSize]);

  // ── 显示目标 ───────────────────────────────────────────

  const showNext = useCallback(() => {
    if (completedRef.current) return;
    const target = generateTarget(gameType, canvasSize.w, canvasSize.h);
    targetRef.current = target;
    animRef.current = { start: performance.now(), target, phase: 'spawning' };
    hitResultRef.current = 'none';
    scaleRef.current = 0.3;
    startFrameLoop();
  }, [gameType, canvasSize, startFrameLoop]);

  // ── 点击 ───────────────────────────────────────────────

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = targetRef.current;
      if (!target || completedRef.current) return;
      if (animRef.current.phase === 'spawning') {
        // 还在出场动画，提前结束动画让目标立即可点
        scaleRef.current = 1;
        animRef.current.phase = 'playing';
      }
      if (animRef.current.phase === 'feedback') return; // 已经在反馈中了

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

      const result: ClickResult = {
        x: Math.round(clickX * 100) / 100,
        y: Math.round(clickY * 100) / 100,
        targetX: target.x,
        targetY: target.y,
        distance: Math.round(distance * 100) / 100,
        reactionTime: Math.round(reactionTime * 100) / 100,
        isHeadshot: hitType === 'headshot',
        isBodyHit: hitType === 'hit',
      };
      resultsRef.current = [...resultsRef.current, result];

      // 特效（命中音调五阶循环，由低到高；连续五爆头触发五杀音效）
      const tone = hitToneRef.current;
      if (hitType === 'headshot') {
        headshotStreakRef.current++;
        spawnParticles(target.x, target.y, 20);
        spawnFloatingText(target.x, target.y - 30, 'HEADSHOT', '#7c3aed');
        if (headshotStreakRef.current >= 5) {
          headshotStreakRef.current = 0;
          hitToneRef.current = 0;
          spawnFloatingText(target.x, target.y - 60, 'ACE!', '#ffd700');
          playAceSound();
        } else {
          playHeadshotSoundPitched(tone);
          hitToneRef.current = (tone + 1) % 5;
        }
      } else if (hitType === 'hit') {
        headshotStreakRef.current = 0;
        spawnFloatingText(target.x, target.y - 30, 'HIT', '#ffffff');
        playBodyHitSoundPitched(tone);
        hitToneRef.current = (tone + 1) % 5;
      } else {
        headshotStreakRef.current = 0;
        spawnFloatingText(target.x, target.y - 30, 'MISS', '#ff6666');
        playMissSound();
      }

      startFrameLoop();

      // 统计
      const results = resultsRef.current;
      const headshots = results.filter((r) => r.isHeadshot).length;
      const bodyHits = results.filter((r) => r.isBodyHit).length;
      const overallHits = headshots + bodyHits;
      setRemaining(totalTargets.current - results.length);
      setAccuracy(Math.round((overallHits / results.length) * 100));
      setHeadshotRate(
        results.length > 0 ? Math.round((headshots / results.length) * 100) : 0,
      );

      // 下一个 / 结束
      if (results.length >= totalTargets.current) {
        completedRef.current = true;
        playCompleteSound();
        timeoutRef.current = setTimeout(() => onComplete(resultsRef.current), 500);
      } else {
        timeoutRef.current = setTimeout(() => showNext(), 800);
      }
    },
    [onComplete, showNext, spawnParticles, spawnFloatingText, startFrameLoop],
  );

  // ── init / cleanup ─────────────────────────────────────

  const handleCountdownFinish = useCallback(() => {
    setCountingDown(false);
  }, []);

  useEffect(() => {
    if (countingDown) return; // wait for countdown
    timeoutRef.current = setTimeout(() => {
      if (!completedRef.current) showNext();
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [countingDown, showNext]);

  drawStaticRef.current = drawStatic;

  // 鼠标跟随：更新准星位置并重绘静态帧
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    drawStaticRef.current();
  }, []);

  useEffect(() => {
    drawStatic();
  }, [canvasSize, drawStatic]);

  useEffect(() => {
    return () => {
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
        className="absolute inset-0 cursor-none"
        onMouseMove={handleMouseMove}
        style={{ touchAction: 'none' }}
      />

      {countingDown && <CountdownOverlay title="静态精度测试" onFinish={handleCountdownFinish} />}

      <Overlay
        remaining={remaining}
        total={totalTargets.current}
        accuracy={accuracy}
        headshotRate={headshotRate}
      />

      <FpsHudFrame label="STATIC · AIM TEST" />
    </div>
  );
}

export default StaticClickTest;
