import { useRef, useState, useEffect, useCallback } from 'react';
import type { ClickResult, FlickResultData, FlickRoundResult } from '../types/calibration';
import {
  playHeadshotSound,
  playBodyHitSound,
  playMissSound,
  playCompleteSound,
  playMicroKillSound,
  playPhaseSound,
} from '../utils/soundEngine';
import CountdownOverlay from './CountdownOverlay';
import FpsHudFrame from './FpsHudFrame';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import AnimatedBackground from './AnimatedBackground';

type GameType = 'valorant' | 'csgo' | 'apex' | 'overwatch' | 'other';
type HitResult = 'headshot' | 'hit' | 'miss' | 'none';
type AppPhase = 'intro' | 'playing' | 'compare';

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

interface MicroCore {
  ox: number;
  oy: number;
  radius: number;
  spawnedAt: number;
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

interface Tracer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

const FLICK_MARGIN = 90;
const MICRO_TIMEOUT = 1500; // 金色核心（微调靶）持续时长（ms），比旧版更充裕
const ROUND_SENS: Record<'A' | 'B', number> = { A: 1, B: 1.2 };

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

/** 微调核心：金色小核心 + 倒计时圆环 */
function drawMicroCore(
  ctx: CanvasRenderingContext2D,
  t: Target,
  m: MicroCore,
  now: number,
) {
  const cx = t.x + m.ox;
  const cy = t.y + m.oy;
  const remain = Math.max(0, 1 - (now - m.spawnedAt) / MICRO_TIMEOUT);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, m.radius + 7, -Math.PI / 2, -Math.PI / 2 + remain * Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.95)';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, m.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe066';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - m.radius * 0.25, cy - m.radius * 0.25, m.radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  ctx.restore();
}

// ── HUD 叠加层 ──────────────────────────────────────────

function Overlay({
  round,
  sens,
  remaining,
  total,
  accuracy,
  headshotRate,
  microRate,
  avgReaction,
}: {
  round: 'A' | 'B';
  sens: number;
  remaining: number;
  total: number;
  accuracy: number;
  headshotRate: number;
  microRate: number;
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
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>轮次</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: round === 'B' ? '#22d3ee' : '#00ff88' }}>
              {round} ×{sens.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>目标</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {done}<span className="text-[#8b93a7]">/{total}</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>命中</span>
            <span className="ml-2 text-sm font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{accuracy}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>击杀</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ff4d4d' }}>{headshotRate}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>微调</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ffd700' }}>{microRate}%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>反应</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#22d3ee' }}>{avgReaction}ms</span>
          </div>
        </div>
        <div className="w-44 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full progress-shimmer" style={{ width: progress + '%' }} />
        </div>
        <span className="hud-label">FLICK · AB</span>
      </div>
    </div>
  );
}

// ── 引导屏 ──────────────────────────────────────────────

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className="glass-card p-7 w-full max-w-md">
        <p className="hud-label mb-4 text-center">灵敏度对比测试</p>
        <h2 className="text-xl font-bold mb-4 text-center" style={{ fontFamily: "'Orbitron', sans-serif", color: '#22d3ee' }}>
          甩枪瞬狙 · A/B 对比
        </h2>
        <ul className="space-y-2.5 text-xs text-[#8b93a7] mb-6">
          <li className="flex gap-2"><span className="text-[#00ff88]">01</span> 目标出现后甩枪命中，再快速微调点击金色核心完成击杀</li>
          <li className="flex gap-2"><span className="text-[#00ff88]">02</span> 轮次 A：灵敏度 ×1.00（当前手感）</li>
          <li className="flex gap-2"><span className="text-[#22d3ee]">03</span> 轮次 B：灵敏度 ×1.20（更快档位）</li>
          <li className="flex gap-2"><span className="text-[#a78bfa]">04</span> 完成后选择更顺手的一档，系统将据此微调 eDPI 建议</li>
        </ul>
        <button onClick={onStart} className="glow-btn w-full py-3" style={{ borderColor: 'rgba(34,211,238,0.45)', color: '#22d3ee' }}>
          开始测试
        </button>
        <p className="text-[10px] text-[#8b93a7]/60 text-center mt-4 font-mono">准星移动距离按档位缩放，保持鼠标习惯动作即可</p>
      </div>
    </div>
  );
}

// ── 对比屏 ──────────────────────────────────────────────

function RoundCard({ title, color, r }: { title: string; color: string; r: FlickRoundResult }) {
  const rows: [string, string][] = [
    ['命中率', r.accuracy + '%'],
    ['击杀率', r.headshotRate + '%'],
    ['平均反应', r.avgReactionTime + 'ms'],
    ['微调命中', r.microHitRate + '%'],
    ['平均微调', r.avgMicroTime + 'ms'],
  ];
  return (
    <div className="rounded-xl p-4" style={{ background: color + '0d', border: '1px solid ' + color + '40' }}>
      <p className="text-center text-xs font-bold mb-3" style={{ color, fontFamily: "'Orbitron', sans-serif" }}>{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row[0]} className="flex justify-between text-[11px]">
            <span className="text-[#8b93a7]">{row[0]}</span>
            <span className="font-mono" style={{ color }}>{row[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareScreen({
  roundA,
  roundB,
  onPick,
}: {
  roundA: FlickRoundResult;
  roundB: FlickRoundResult;
  onPick: (p: 'A' | 'B' | 'equal') => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
      <div className="glass-card p-7 w-full max-w-lg">
        <p className="hud-label mb-2 text-center">ROUND COMPLETE</p>
        <h2 className="text-lg font-bold mb-5 text-center" style={{ fontFamily: "'Orbitron', sans-serif", color: '#00ff88' }}>
          哪一档更顺手？
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <RoundCard title="A · ×1.00 当前" color="#00ff88" r={roundA} />
          <RoundCard title="B · ×1.20 更快" color="#22d3ee" r={roundB} />
        </div>
        <p className="text-[11px] text-[#8b93a7] text-center mb-4">命中率更高的一档可能更适合你，但手感优先</p>
        <div className="flex gap-2">
          <button onClick={() => onPick('A')} className="glow-btn flex-1 py-2.5 text-xs" style={{ borderColor: 'rgba(0,255,136,0.45)', color: '#00ff88' }}>A 更顺手</button>
          <button onClick={() => onPick('equal')} className="glow-btn flex-1 py-2.5 text-xs" style={{ borderColor: 'rgba(255,255,255,0.18)', color: '#e8ecf4' }}>差不多</button>
          <button onClick={() => onPick('B')} className="glow-btn flex-1 py-2.5 text-xs" style={{ borderColor: 'rgba(34,211,238,0.45)', color: '#22d3ee' }}>B 更顺手</button>
        </div>
      </div>
    </div>
  );
}

// ── 组件 ────────────────────────────────────────────────

export default function FlickTest({ onComplete, targetCount = 12, gameType }: FlickTestProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [appPhase, setAppPhase] = useState<AppPhase>('intro');
  const [round, setRound] = useState<'A' | 'B'>('A');
  const [countingDown, setCountingDown] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [headshotRate, setHeadshotRate] = useState(0);
  const [microRate, setMicroRate] = useState(0);
  const [avgReaction, setAvgReaction] = useState(0);

  const crosshair = useCrosshair();
  const resultsRef = useRef<ClickResult[]>([]);
  const targetRef = useRef<Target | null>(null);
  const microRef = useRef<MicroCore | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const tracersRef = useRef<Tracer[]>([]);
  const floatingRef = useRef<FloatingText[]>([]);
  const animRef = useRef({ start: 0, target: null as Target | null, phase: 'idle' as 'idle' | 'spawning' | 'playing' | 'feedback' });
  const hitResultRef = useRef<HitResult>('none');
  const hitmarkRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const roundRef = useRef<'A' | 'B'>('A');
  const sensRef = useRef(ROUND_SENS.A);
  const roundTargets = useRef(0);
  const mainShotsRef = useRef(0);
  const mainHitsRef = useRef(0);
  const microShotsRef = useRef(0);
  const microHitsRef = useRef(0);
  const headshotCountRef = useRef(0);
  const reactionSumRef = useRef(0);
  const crosshairPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const lastMouseRef = useRef({ x: 0, y: 0, initialized: false });

  useEffect(() => {
    const onResize = () => setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── 特效 ─────────────────────────────────────────────

  const spawnParticles = useCallback((x: number, y: number, count = 18, colors: string[] = ['#ffd700', '#ff8844']) => {
    const p: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 240;
      const life = 0.3 + Math.random() * 0.45;
      p.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color: colors[i % colors.length],
        size: 1.5 + Math.random() * 3,
      });
    }
    particlesRef.current = [...particlesRef.current, ...p];
  }, []);

  const spawnFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingRef.current.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
  }, []);

  const spawnTracer = useCallback((x1: number, y1: number, x2: number, y2: number, color: string) => {
    tracersRef.current.push({ x1, y1, x2, y2, life: 0.18, maxLife: 0.18, color });
    if (tracersRef.current.length > 24) tracersRef.current.shift();
  }, []);

  const setHitmark = useCallback((x: number, y: number, at: number) => {
    hitmarkRef.current = { x, y, at };
  }, []);

  // ── 流程 ─────────────────────────────────────────────

  const showNext = useCallback(() => {
    if (completedRef.current) return;
    const target = generateTarget(gameType, canvasSize.w, canvasSize.h);
    targetRef.current = target;
    microRef.current = null;
    hitResultRef.current = 'none';
    animRef.current = { start: performance.now(), target, phase: 'spawning' };
  }, [gameType, canvasSize]);

  const startRound = useCallback(
    (r: 'A' | 'B') => {
      roundRef.current = r;
      sensRef.current = ROUND_SENS[r];
      const count = r === 'A' ? Math.ceil(targetCount / 2) : Math.floor(targetCount / 2);
      roundTargets.current = count;
      setRemaining(count);
      setAccuracy(0);
      setHeadshotRate(0);
      setMicroRate(0);
      setAvgReaction(0);
      mainShotsRef.current = 0;
      mainHitsRef.current = 0;
      microShotsRef.current = 0;
      microHitsRef.current = 0;
      headshotCountRef.current = 0;
      reactionSumRef.current = 0;
      targetRef.current = null;
      microRef.current = null;
      animRef.current = { start: 0, target: null, phase: 'idle' };
      particlesRef.current = [];
      tracersRef.current = [];
      floatingRef.current = [];
      hitmarkRef.current = null;
      hitResultRef.current = 'none';
      crosshairPosRef.current = { x: canvasSize.w / 2, y: canvasSize.h / 2 };
      lastMouseRef.current.initialized = false;
      setRound(r);
      setCountingDown(true);
    },
    [canvasSize, targetCount],
  );

  const scheduleAdvance = useCallback(() => {
    const mainShots = mainShotsRef.current;
    setRemaining(Math.max(0, roundTargets.current - mainShots));
    if (mainShots > 0) {
      setAccuracy(Math.round((mainHitsRef.current / mainShots) * 100));
      setAvgReaction(Math.round(reactionSumRef.current / mainShots));
      setHeadshotRate(Math.round((headshotCountRef.current / roundTargets.current) * 100));
    }
    if (microShotsRef.current > 0) {
      setMicroRate(Math.round((microHitsRef.current / microShotsRef.current) * 100));
    }
    // 金色核心（微调靶）未解决前不推进流程：不加载新靶位、不切换轮次，
    // 避免微调未命中时其他靶位被提前消耗/误记轮次
    if (microRef.current) return;
    if (mainShots >= roundTargets.current) {
      if (roundRef.current === 'A') {
        playPhaseSound();
        timeoutRef.current = setTimeout(() => startRound('B'), 750);
      } else {
        playCompleteSound();
        timeoutRef.current = setTimeout(() => setAppPhase('compare'), 850);
      }
    } else {
      timeoutRef.current = setTimeout(() => showNext(), 400);
    }
  }, [showNext, startRound]);

  const resolveMicro = useCallback(
    (hit: boolean) => {
      const target = targetRef.current;
      const m = microRef.current;
      if (!target || !m) return;
      microRef.current = null;
      microShotsRef.current++;
      const now = performance.now();
      const cross = crosshairPosRef.current;
      const cx = target.x + m.ox;
      const cy = target.y + m.oy;
      const dist = Math.hypot(cross.x - cx, cross.y - cy);
      const microTime = now - m.spawnedAt;
      resultsRef.current = [
        ...resultsRef.current,
        {
          x: Math.round(cross.x * 100) / 100,
          y: Math.round(cross.y * 100) / 100,
          targetX: Math.round(cx * 100) / 100,
          targetY: Math.round(cy * 100) / 100,
          distance: Math.round(dist * 100) / 100,
          reactionTime: Math.round(microTime * 100) / 100,
          isHeadshot: hit,
          isBodyHit: false,
          isMicro: true,
          microTime: Math.round(microTime * 100) / 100,
          round: roundRef.current,
        },
      ];
      animRef.current = { start: now, target, phase: 'feedback' };
      if (hit) {
        microHitsRef.current++;
        headshotCountRef.current++;
        hitResultRef.current = 'headshot';
        spawnParticles(cx, cy, 22, ['#ffe066', '#ffd700']);
        spawnFloatingText(cx, cy - 26, 'KILL', '#ffd700');
        playMicroKillSound();
        setHitmark(cross.x, cross.y, now);
      } else {
        hitResultRef.current = 'miss';
        playMissSound();
      }
      scheduleAdvance();
    },
    [scheduleAdvance, setHitmark, spawnFloatingText, spawnParticles],
  );

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
      crosshairPosRef.current.x,
      crosshairPosRef.current.y,
      crosshair.settings,
    );

    const target = targetRef.current;
    const anim = animRef.current;

    if (target && microRef.current && anim.phase !== 'feedback') {
      if (now - microRef.current.spawnedAt > MICRO_TIMEOUT) {
        resolveMicro(false);
      }
    }

    if (target && anim.phase === 'spawning') {
      const progress = Math.min(1, (now - anim.start) / 120);
      const eased = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
      drawTarget(ctx, target, target.radius * (0.4 + eased * 0.6), false);
      if (progress >= 1) anim.phase = 'playing';
    } else if (target && anim.phase === 'feedback') {
      const elapsed = now - anim.start;
      const fade = Math.min(1, elapsed / 240);
      drawTarget(ctx, target, target.radius * (1 - fade * 0.6), hitResultRef.current === 'headshot');
      if (elapsed > 240) {
        anim.phase = 'idle';
        targetRef.current = null;
      }
    } else if (target) {
      drawTarget(ctx, target, target.radius, false);
    }

    if (target && microRef.current) {
      drawMicroCore(ctx, target, microRef.current, now);
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
    }
    ctx.globalAlpha = 1;

    for (const tr of tracersRef.current) tr.life -= dt;
    tracersRef.current = tracersRef.current.filter((tr) => tr.life > 0);
    for (const tr of tracersRef.current) {
      const a = tr.life / tr.maxLife;
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const ft of floatingRef.current) {
      ft.y -= 60 * dt;
      ft.life -= dt;
    }
    floatingRef.current = floatingRef.current.filter((ft) => ft.life > 0);
    for (const ft of floatingRef.current) {
      const alpha = ft.life / ft.maxLife;
      const size = 18 + (1 - alpha) * 8;
      ctx.font = 'bold ' + size + 'px sans-serif';
      ctx.textAlign = 'center';
      if (ft.text === 'KILL' || ft.text === 'HEADSHOT') {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 16;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (hitmarkRef.current) {
      const hm = hitmarkRef.current;
      if (now - hm.at < 180) {
        const r = 7;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hm.x - r, hm.y - r); ctx.lineTo(hm.x + r, hm.y + r);
        ctx.moveTo(hm.x + r, hm.y - r); ctx.lineTo(hm.x - r, hm.y + r);
        ctx.stroke();
      } else {
        hitmarkRef.current = null;
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [canvasSize, crosshair.settings, resolveMicro]);

  // ── 交互 ─────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const last = lastMouseRef.current;
    if (!last.initialized) {
      last.x = e.clientX;
      last.y = e.clientY;
      last.initialized = true;
      return;
    }
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;
    const s = sensRef.current;
    const pos = crosshairPosRef.current;
    pos.x = Math.min(canvasSize.w - 4, Math.max(4, pos.x + dx * s));
    pos.y = Math.min(canvasSize.h - 4, Math.max(4, pos.y + dy * s));
  }, [canvasSize]);

  const handleClick = useCallback(
    () => {
      if (appPhase !== 'playing' || countingDown || completedRef.current) return;
      const target = targetRef.current;
      if (!target) return;
      if (animRef.current.phase === 'spawning') animRef.current.phase = 'playing';
      if (animRef.current.phase === 'feedback') return;

      const now = performance.now();
      const cross = crosshairPosRef.current;
      const r = roundRef.current;

      // 微调射击：点击金色核心完成击杀
      if (microRef.current) {
        const m = microRef.current;
        const cx = target.x + m.ox;
        const cy = target.y + m.oy;
        const dist = Math.hypot(cross.x - cx, cross.y - cy);
        const hit = dist < m.radius;
        spawnTracer(cross.x, cross.y, cx, cy, hit ? '#ffd700' : '#ff5555');
        resolveMicro(hit);
        return;
      }

      // 甩枪主射击
      const distance = Math.hypot(cross.x - target.x, cross.y - target.y);
      const reactionTime = now - target.appearedAt;
      const hitType: HitResult =
        distance < target.radius ? 'headshot' : distance < target.radius + 20 ? 'hit' : 'miss';

      resultsRef.current = [
        ...resultsRef.current,
        {
          x: Math.round(cross.x * 100) / 100,
          y: Math.round(cross.y * 100) / 100,
          targetX: Math.round(target.x * 100) / 100,
          targetY: Math.round(target.y * 100) / 100,
          distance: Math.round(distance * 100) / 100,
          reactionTime: Math.round(reactionTime * 100) / 100,
          isHeadshot: hitType === 'headshot',
          isBodyHit: hitType === 'hit',
          isMicro: false,
          round: r,
        },
      ];

      mainShotsRef.current++;
      reactionSumRef.current += reactionTime;
      if (hitType !== 'miss') mainHitsRef.current++;

      if (hitType === 'headshot') {
        spawnParticles(target.x, target.y, 20, ['#ffd700', '#ff8844']);
        spawnFloatingText(target.x, target.y - 30, 'HEADSHOT', '#ffd700');
        playHeadshotSound();
      } else if (hitType === 'hit') {
        spawnParticles(target.x, target.y, 10, ['#ffffff', '#ffd9d9']);
        playBodyHitSound();
      } else {
        spawnFloatingText(target.x, target.y - 30, 'MISS', '#ff6666');
        playMissSound();
      }
      spawnTracer(cross.x, cross.y, target.x, target.y, hitType === 'miss' ? '#ff5555' : '#ffd700');

      if (hitType !== 'miss') {
        setHitmark(cross.x, cross.y, now);
        // 生成微调核心：需要第二次精确点击完成击杀
        const angle = Math.random() * Math.PI * 2;
        const off = 14 + Math.random() * 12;
        microRef.current = {
          ox: Math.cos(angle) * off,
          oy: Math.sin(angle) * off,
          radius: 6 + Math.random() * 2,
          spawnedAt: now,
        };
      } else {
        hitResultRef.current = 'miss';
        animRef.current = { start: now, target, phase: 'feedback' };
      }

      scheduleAdvance();
    },
    [appPhase, countingDown, resolveMicro, scheduleAdvance, setHitmark, spawnFloatingText, spawnParticles, spawnTracer],
  );

  const handleCountdownFinish = useCallback(() => setCountingDown(false), []);

  // ── 汇总 ─────────────────────────────────────────────

  const buildRound = useCallback((r: 'A' | 'B'): FlickRoundResult => {
    const clicks = resultsRef.current.filter((c) => c.round === r);
    const main = clicks.filter((c) => !c.isMicro);
    const micro = clicks.filter((c) => c.isMicro);
    const hits = main.filter((c) => c.isHeadshot || c.isBodyHit).length;
    const kills = micro.filter((c) => c.isHeadshot).length;
    return {
      round: r,
      sensMultiplier: ROUND_SENS[r],
      clicks,
      accuracy: main.length ? Math.round((hits / main.length) * 100) : 0,
      headshotRate: main.length ? Math.round((kills / main.length) * 100) : 0,
      avgDistance: main.length ? Math.round((main.reduce((s, c) => s + c.distance, 0) / main.length) * 100) / 100 : 0,
      avgReactionTime: main.length ? Math.round(main.reduce((s, c) => s + c.reactionTime, 0) / main.length) : 0,
      microHitRate: micro.length ? Math.round((kills / micro.length) * 100) : 0,
      avgMicroTime: micro.length ? Math.round(micro.reduce((s, c) => s + (c.microTime ?? 0), 0) / micro.length) : 0,
    };
  }, []);

  const finishCompare = useCallback(
    (pref: 'A' | 'B' | 'equal') => {
      if (completedRef.current) return;
      completedRef.current = true;
      const a = buildRound('A');
      const b = buildRound('B');
      const all = [...a.clicks, ...b.clicks];
      const main = all.filter((c) => !c.isMicro);
      const kills = all.filter((c) => c.isMicro && c.isHeadshot).length;
      const hits = main.filter((c) => c.isHeadshot || c.isBodyHit).length;
      const data: FlickResultData = {
        clicks: all,
        accuracy: main.length ? Math.round((hits / main.length) * 100) : 0,
        headshotRate: main.length ? Math.round((kills / main.length) * 100) : 0,
        avgDistance: main.length ? Math.round((main.reduce((s, c) => s + c.distance, 0) / main.length) * 100) / 100 : 0,
        avgReactionTime: main.length ? Math.round(main.reduce((s, c) => s + c.reactionTime, 0) / main.length) : 0,
        rounds: [a, b],
        preference: pref,
        preferredMultiplier: pref === 'B' ? ROUND_SENS.B : pref === 'A' ? ROUND_SENS.A : 1,
      };
      onComplete(data);
    },
    [buildRound, onComplete],
  );

  // ── 生命周期 ─────────────────────────────────────────

  useEffect(() => {
    if (appPhase !== 'playing' || countingDown) return;
    timeoutRef.current = setTimeout(() => {
      if (!completedRef.current && !targetRef.current) showNext();
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [appPhase, countingDown, showNext]);

  useEffect(() => {
    if (appPhase !== 'playing' || countingDown) return;
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [appPhase, countingDown, frame]);

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

      {appPhase === 'playing' && !countingDown && (
        <Overlay
          round={round}
          sens={sensRef.current}
          remaining={remaining}
          total={roundTargets.current}
          accuracy={accuracy}
          headshotRate={headshotRate}
          microRate={microRate}
          avgReaction={avgReaction}
        />
      )}

      {countingDown && (
        <CountdownOverlay title={'甩枪测试 · 轮次 ' + round} onFinish={handleCountdownFinish} />
      )}

      {appPhase === 'intro' && (
        <IntroScreen onStart={() => { setAppPhase('playing'); startRound('A'); }} />
      )}

      {appPhase === 'compare' && (
        <CompareScreen
          roundA={buildRound('A')}
          roundB={buildRound('B')}
          onPick={finishCompare}
        />
      )}

      <FpsHudFrame
        label="FLICK · AB TEST"
        left={<span>A ×1.00 · B ×1.20 · 甩枪 + 微调</span>}
        right={<span>命中目标后点击金色核心完成击杀</span>}
      />
    </div>
  );
}
