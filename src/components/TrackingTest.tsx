import { useRef, useState, useEffect, useCallback } from 'react';
import { playPhaseSound, playComboSound, playCompleteSound } from '../utils/soundEngine';
import CountdownOverlay from './CountdownOverlay';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import AnimatedBackground from './AnimatedBackground';

type GameType = 'valorant' | 'csgo' | 'apex' | 'overwatch' | 'other';

interface PhaseResult {
  phase: 1 | 2 | 3;
  avgDistance: number;
  score: number;
  perfectRatio: number;
}

interface TrackingResult {
  phaseResults: PhaseResult[];
  totalScore: number;
  maxCombo: number;
  distances: number[];
  avgDistance: number;
  headshotTrackingRatio: number;
  totalFrames: number;
}

interface TrackingTestProps {
  onComplete: (results: TrackingResult) => void;
  gameType: GameType;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  // movement state
  state: string;
  stateTimer: number;
  pauseTimer: number;
  dashTimer: number;
  jumpVy: number;
  baseY: number;
  bobPhase: number;
  strafeTarget: number;
}

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

const TEST_DURATION = 15000;
const HEADSHOT_THRESHOLD = 15;
const BODY_THRESHOLD = 30;
const TRAIL_LENGTH = 6;

// ── 绘制辅助 ──────────────────────────────────────────

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 80; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 80; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

// Crosshair drawn via drawCrosshairStyled from useCrosshair hook

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  tilt: number,
  alpha: number,
) {
  const { x, y, radius: r } = enemy;
  const bodyW = r * 2.2;
  const bodyH = r * 3.5;
  const neckGap = r * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;

  // 身体（倾斜）
  ctx.translate(x, y + r + neckGap);
  if (tilt !== 0) {
    ctx.rotate(tilt);
  }

  // 身体矩形（原点在中心顶部）
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, 0, bodyW, bodyH, 3);
  ctx.fill();

  // 身体轮廓线
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, 0, bodyW, bodyH, 3);
  ctx.stroke();

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
  ctx.globalAlpha = alpha;

  // 头部
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#dd5555';
  ctx.fill();

  // 头部高光
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();

  ctx.restore();
}

// ── HUD 叠加层 ────────────────────────────────────────

function Overlay({
  timeLeft,
  score,
  combo,
  headshotRatio,
  avgDistance,
}: {
  timeLeft: number;
  score: number;
  combo: number;
  headshotRatio: number;
  avgDistance: number;
}) {
  const progress = Math.max(0, (timeLeft / 15) * 100);
  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none z-10"
      style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.7) 60%, transparent 100%)' }}>
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left */}
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>时间</span>
            <span className="ml-2 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{timeLeft.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>🔥</span>
            <span className="ml-1 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: combo >= 3 ? '#ffd700' : '#888' }}>{combo}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>💀</span>
            <span className="ml-1 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ff4d4d' }}>{headshotRatio}%</span>
          </div>
        </div>
        {/* Center: progress */}
        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full progress-shimmer" style={{ width: `${progress}%` }} />
        </div>
        {/* Right */}
        <div className="flex items-center gap-5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>距离</span>
            <span className="ml-1 text-sm font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{avgDistance}px</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>得分</span>
            <span className="ml-1 text-sm font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#ffd700' }}>{score}</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#00ff8860]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            追踪测试
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 组件 ──────────────────────────────────────────────

function TrackingTest({ onComplete, gameType }: TrackingTestProps) {
  const crosshair = useCrosshair();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enemyRef = useRef<Enemy | null>(null);
  const mouseRef = useRef({ x: -100, y: -100, active: false });
  const trailRef = useRef<TrailPoint[]>([]);
  const rafRef = useRef<number>(0);
  const completedRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastPhaseRef = useRef(0);

  // 统计
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const headshotFramesRef = useRef(0);
  const totalFramesRef = useRef(0);
  const allDistancesRef = useRef<number[]>([]);

  // 阶段统计（每5秒一个阶段）
  const phaseScoreRef = useRef<[number, number, number]>([0, 0, 0]);
  const phaseDistRef = useRef<[number[], number[], number[]]>([[], [], []]);
  const phaseHeadshotRef = useRef<[number, number, number]>([0, 0, 0]);
  const phaseFrameRef = useRef<[number, number, number]>([0, 0, 0]);

  const [canvasSize, setCanvasSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [countingDown, setCountingDown] = useState(true);
  const [timeLeft, setTimeLeft] = useState(15);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [headshotRatio, setHeadshotRatio] = useState(0);
  const [avgDistance, setAvgDistance] = useState(0);

  const frameCounterRef = useRef(0);

  // ── 敌人初始化 ─────────────────────────────────────

  const initEnemy = useCallback((w: number, h: number): Enemy => {
    const radius = 12;
    return {
      x: w / 2,
      y: h * 0.5,
      vx: 200,
      vy: 0,
      radius,
      state: 'moving_right',
      stateTimer: 0,
      pauseTimer: 0,
      dashTimer: 1000 + Math.random() * 2000,
      jumpVy: 0,
      baseY: h * 0.5,
      bobPhase: 0,
      strafeTarget: w / 2 + 150 + Math.random() * 200,
    };
  }, []);

  // ── resize ─────────────────────────────────────────

  useEffect(() => {
    const onResize = () =>
      setCanvasSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    if (remaining <= 0 && !completedRef.current) {
      completedRef.current = true;
      // 计算结果
      const allDist = [...allDistancesRef.current];
      const totalFrames = totalFramesRef.current || 1;
      const avgAll = allDist.length > 0
        ? Math.round(allDist.reduce((s, d) => s + d, 0) / allDist.length * 100) / 100
        : 0;
      const htr = Math.round((headshotFramesRef.current / totalFrames) * 100);

      const phaseResults: PhaseResult[] = [1, 2, 3].map((p) => {
        const dists = phaseDistRef.current[p - 1];
        const pf = phaseFrameRef.current[p - 1] || 1;
        return {
          phase: p as 1 | 2 | 3,
          avgDistance: dists.length > 0 ? Math.round(dists.reduce((s, d) => s + d, 0) / dists.length * 100) / 100 : 0,
          score: phaseScoreRef.current[p - 1],
          perfectRatio: Math.round((phaseHeadshotRef.current[p - 1] / pf) * 100),
        };
      });

      onComplete({
        phaseResults,
        totalScore: scoreRef.current,
        maxCombo: maxComboRef.current,
        distances: allDist,
        avgDistance: avgAll,
        headshotTrackingRatio: htr,
        totalFrames,
      });
      playCompleteSound();
      return;
    }

    const w = canvasSize.w;
    const h = canvasSize.h;
    const dt = Math.min(0.05, 0.016);
    const margin = 80;

    // 当前阶段
    const currentPhase = elapsed < 5000 ? 1 : elapsed < 10000 ? 2 : 3;
    if (currentPhase !== lastPhaseRef.current && lastPhaseRef.current > 0) {
      playPhaseSound();
    }
    lastPhaseRef.current = currentPhase;

    // 初始化敌人
    if (!enemyRef.current) {
      enemyRef.current = initEnemy(w, h);
    }
    const enemy = enemyRef.current!;

    // ── 游戏类型移动逻辑 ──────────────────────────
    const isValCS = gameType === 'valorant' || gameType === 'csgo';
    const isApex = gameType === 'apex';
    const isOW = gameType === 'overwatch';

    enemy.stateTimer += dt * 1000;

    if (isValCS) {
      // Valorant/CSGO：短距离peek移动
      if (enemy.state === 'moving_right') {
        enemy.vx = 200;
        enemy.vy = 0;
        if (enemy.x >= enemy.strafeTarget) {
          enemy.state = 'pause_right';
          enemy.stateTimer = 0;
          enemy.pauseTimer = 300 + Math.random() * 500;
        }
      } else if (enemy.state === 'pause_right') {
        enemy.vx = 0;
        if (enemy.stateTimer >= enemy.pauseTimer) {
          enemy.state = 'moving_left';
          enemy.stateTimer = 0;
          enemy.strafeTarget = margin + 100 + Math.random() * (w - margin * 2 - 200);
        }
      } else if (enemy.state === 'moving_left') {
        enemy.vx = -200;
        enemy.vy = 0;
        if (enemy.x <= enemy.strafeTarget) {
          enemy.state = 'pause_left';
          enemy.stateTimer = 0;
          enemy.pauseTimer = 300 + Math.random() * 500;
        }
      } else if (enemy.state === 'pause_left') {
        enemy.vx = 0;
        if (enemy.stateTimer >= enemy.pauseTimer) {
          enemy.state = 'moving_right';
          enemy.stateTimer = 0;
          enemy.strafeTarget = w - margin - 100 - Math.random() * (w - margin * 2 - 200);
        }
      }
      // 轻微身体上下浮动
      enemy.bobPhase += dt * 3;
      enemy.y = enemy.baseY + Math.sin(enemy.bobPhase) * 8;
    } else if (isApex) {
      // Apex：快速大范围 + 跳跃
      if (enemy.stateTimer > 1200 + Math.random() * 800) {
        enemy.stateTimer = 0;
        const angle = Math.random() * Math.PI * 2;
        const speed = 250 + Math.random() * 400;
        enemy.vx = Math.cos(angle) * speed;
        enemy.vy = Math.sin(angle) * speed * 0.5;
        enemy.strafeTarget = angle; // reuse as angle storage
      }
      // 跳跃
      if (now - (enemy as any)._lastJump > 2500 + Math.random() * 1500 || !(enemy as any)._lastJump) {
        (enemy as any)._lastJump = now;
        enemy.jumpVy = -400 - Math.random() * 300;
      }
      // 重力
      enemy.jumpVy += 900 * dt;
      enemy.y += enemy.jumpVy * dt;
      // 落地
      if (enemy.y > enemy.baseY + 50) {
        enemy.y = enemy.baseY;
        enemy.jumpVy = 0;
      }
      if (enemy.y < margin) { enemy.y = margin; enemy.jumpVy = Math.abs(enemy.jumpVy) * 0.5; }
      enemy.bobPhase += dt * 2;
      if (enemy.jumpVy === 0) {
        enemy.y = enemy.baseY + Math.sin(enemy.bobPhase) * 5;
      }
    } else if (isOW) {
      // Overwatch：中速 + 技能冲刺
      if (enemy.stateTimer > enemy.dashTimer) {
        // 冲刺
        enemy.stateTimer = 0;
        enemy.dashTimer = 2000 + Math.random() * 3000;
        (enemy as any)._dashDir = Math.random() > 0.5 ? 1 : -1;
        (enemy as any)._dashDuration = 0;
      }
      const inDash = (enemy as any)._dashDuration !== undefined && (enemy as any)._dashDuration < 300;
      if (inDash) {
        (enemy as any)._dashDuration += dt * 1000;
        enemy.vx = ((enemy as any)._dashDir) * 550;
      } else {
        (enemy as any)._dashDuration = undefined;
        // 普通平移
        if (enemy.stateTimer > 2000 + Math.random() * 1000) {
          enemy.stateTimer = 0;
          enemy.strafeTarget = margin + 100 + Math.random() * (w - margin * 2 - 200);
        }
        const dir = enemy.x < enemy.strafeTarget ? 1 : -1;
        enemy.vx = dir * 280;
        if (Math.abs(enemy.x - enemy.strafeTarget) < 30) {
          enemy.strafeTarget = margin + 100 + Math.random() * (w - margin * 2 - 200);
        }
      }
      enemy.bobPhase += dt * 3;
      enemy.y = enemy.baseY + Math.sin(enemy.bobPhase) * 20;
    } else {
      // other：简单正弦
      enemy.vx = 200;
      enemy.bobPhase += dt * 2.5;
      enemy.y = enemy.baseY + Math.sin(enemy.bobPhase) * 60;
    }

    // 应用速度
    enemy.x += enemy.vx * dt;
    if (!isApex) enemy.y += enemy.vy * dt;

    // 边界限制（所有模式）
    if (enemy.x - enemy.radius < margin) { enemy.x = margin + enemy.radius; enemy.vx = Math.abs(enemy.vx); }
    if (enemy.x + enemy.radius > w - margin) { enemy.x = w - margin - enemy.radius; enemy.vx = -Math.abs(enemy.vx); }
    if (!isApex) {
      if (enemy.y - enemy.radius < margin) { enemy.y = margin + enemy.radius; }
      if (enemy.y + enemy.radius > h - margin) { enemy.y = h - margin - enemy.radius; }
    }

    // 身体倾斜（基于水平速度）
    const tilt = Math.max(-0.25, Math.min(0.25, enemy.vx / 800));

    // ── 计分 ──────────────────────────────────────
    const mouse = mouseRef.current;
    let dist = Infinity;
    let frameScore = 0;
    let isHeadshotFrame = false;

    if (mouse.active) {
      dist = Math.sqrt((mouse.x - enemy.x) ** 2 + (mouse.y - enemy.y) ** 2);
      allDistancesRef.current.push(dist);
      phaseDistRef.current[currentPhase - 1].push(dist);
      totalFramesRef.current++;
      phaseFrameRef.current[currentPhase - 1]++;

      if (dist < HEADSHOT_THRESHOLD) {
        frameScore = 3;
        isHeadshotFrame = true;
        headshotFramesRef.current++;
        phaseHeadshotRef.current[currentPhase - 1]++;
        comboRef.current++;
        if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
        if (comboRef.current % 5 === 0 && comboRef.current > 0) playComboSound();
      } else if (dist < BODY_THRESHOLD) {
        frameScore = 1;
        comboRef.current = 0;
      } else {
        comboRef.current = 0;
      }
      scoreRef.current += frameScore;
      phaseScoreRef.current[currentPhase - 1] += frameScore;
    }

    // ── 拖尾 ──────────────────────────────────────
    trailRef.current.push({ x: enemy.x, y: enemy.y, alpha: 1 });
    if (trailRef.current.length > TRAIL_LENGTH) trailRef.current.shift();
    for (let i = 0; i < trailRef.current.length; i++) {
      trailRef.current[i].alpha = (i / trailRef.current.length) * 0.25;
    }

    // ── 绘制 ──────────────────────────────────────
    ctx.fillStyle = 'rgba(15, 15, 35, 0.88)';
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h);
    drawCrosshairStyled(ctx, w / 2, h / 2, crosshair.settings);

    // 拖尾
    for (const t of trailRef.current) {
      drawEnemy(ctx, { ...enemy, x: t.x, y: t.y }, tilt * 0.3, t.alpha);
    }

    // 敌人本体（爆头追踪时发光）
    const bodyAlpha = isHeadshotFrame ? 1 : 0.9;
    drawEnemy(ctx, enemy, tilt, bodyAlpha);
    if (isHeadshotFrame) {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 连线
    if (mouse.active && dist < 200) {
      ctx.beginPath();
      ctx.moveTo(mouse.x, mouse.y);
      ctx.lineTo(enemy.x, enemy.y);
      ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.2 - dist / 1000)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 十字准星
    if (mouse.active) {
      const cs = 12;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mouse.x - cs, mouse.y); ctx.lineTo(mouse.x + cs, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - cs); ctx.lineTo(mouse.x, mouse.y + cs);
      ctx.stroke();
      // 距离环
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, HEADSHOT_THRESHOLD, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,77,77,0.15)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, BODY_THRESHOLD, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.stroke();
    }

    // ── 更新 React state（每10帧） ────────────────
    frameCounterRef.current++;
    if (frameCounterRef.current % 10 === 0) {
      const tf = totalFramesRef.current || 1;
      const allDist = allDistancesRef.current;
      setTimeLeft(remaining / 1000);
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setHeadshotRatio(Math.round((headshotFramesRef.current / tf) * 100));
      setAvgDistance(allDist.length > 0 ? Math.round(allDist.reduce((s, d) => s + d, 0) / allDist.length) : 0);
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [canvasSize, gameType, initEnemy, onComplete]);

  // ── 启动 ─────────────────────────────────────────

  const handleCountdownFinish = useCallback(() => {
    setCountingDown(false);
  }, []);

  useEffect(() => {
    if (countingDown) return;
    const timeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate);
    }, 300);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countingDown]);

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

      {countingDown && <CountdownOverlay onFinish={handleCountdownFinish} />}

      <Overlay
        timeLeft={timeLeft}
        score={score}
        combo={combo}
        headshotRatio={headshotRatio}
        avgDistance={avgDistance}
      />

    </div>
  );
}

export default TrackingTest;
