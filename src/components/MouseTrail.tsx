import { useEffect, useRef } from 'react';

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const MAX_PARTICLES = 180;

/**
 * 鼠标轨迹 + 点击粒子爆发。Canvas 全屏覆盖，pointer-events: none。
 * 样式（.cursor-trail）定义在 index.css。
 */
export default function MouseTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef({ x: -999, y: -999, lastX: -999, lastY: -999 });
  const particlesRef = useRef<TrailParticle[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const push = (p: TrailParticle) => {
      particlesRef.current.push(p);
      if (particlesRef.current.length > MAX_PARTICLES) {
        particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);
      }
    };

    const onMove = (e: MouseEvent) => {
      const p = posRef.current;
      const dx = e.clientX - p.lastX;
      const dy = e.clientY - p.lastY;
      const dist = Math.hypot(dx, dy);
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      p.x = e.clientX;
      p.y = e.clientY;
      if (dist < 2) return;
      const speedBoost = Math.min(1.6, dist / 26);
      const count = dist > 12 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        push({
          x: e.clientX + (Math.random() - 0.5) * 4,
          y: e.clientY + (Math.random() - 0.5) * 4,
          vx: -dx * 0.05 + (Math.random() - 0.5) * 36,
          vy: -dy * 0.05 + (Math.random() - 0.5) * 36,
          life: 0.3 + Math.random() * 0.25 + speedBoost * 0.08,
          maxLife: 0.65,
          size: 1.1 + Math.random() * 1.7 + speedBoost,
          color: Math.random() > 0.45 ? '#00ff88' : '#22d3ee',
        });
      }
    };

    const onClick = (e: MouseEvent) => {
      const colors = ['#00ff88', '#22d3ee', '#a78bfa', '#ffd700'];
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
        const speed = 70 + Math.random() * 130;
        push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.35 + Math.random() * 0.3,
          maxLife: 0.7,
          size: 1.4 + Math.random() * 2.4,
          color: colors[i % colors.length],
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onClick);

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ps = particlesRef.current;
      for (const p of ps) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * dpr, p.y * dpr, p.size * dpr * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      particlesRef.current = ps.filter((p) => p.life > 0);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onClick);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="cursor-trail" aria-hidden="true" />;
}
