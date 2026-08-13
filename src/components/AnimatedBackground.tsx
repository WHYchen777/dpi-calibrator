import { useRef, useEffect } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  alphaDir: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
}

// ── 组件 ────────────────────────────────────────────────

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let raf = 0;
    let t = 0;

    const particles: Particle[] = [];
    const stars: Star[] = [];
    for (let i = 0; i < 34; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2,
        color: i % 2 === 0 ? '#00ff88' : '#22d3ee',
        alpha: 0.15 + Math.random() * 0.35,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
      });
    }
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      t += 0.005;

      // 底色
      ctx.fillStyle = '#06070c';
      ctx.fillRect(0, 0, w, h);

      // 极光光斑
      const g1 = ctx.createRadialGradient(
        w * 0.25 + Math.sin(t) * w * 0.08,
        h * 0.2 + Math.cos(t * 0.8) * h * 0.06,
        0,
        w * 0.25,
        h * 0.2,
        Math.max(w, h) * 0.55,
      );
      g1.addColorStop(0, 'rgba(0,255,136,0.10)');
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(
        w * 0.8 + Math.cos(t * 0.7) * w * 0.06,
        h * 0.75 + Math.sin(t * 0.9) * h * 0.05,
        0,
        w * 0.8,
        h * 0.75,
        Math.max(w, h) * 0.5,
      );
      g2.addColorStop(0, 'rgba(124,58,237,0.12)');
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // 网格
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // 星点闪烁
      for (const s of stars) {
        const a = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 3 + s.phase));
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // 粒子连线
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.1;
            ctx.strokeStyle = `rgba(148,163,184,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.alpha += p.alphaDir * 0.005;
        if (p.alpha > 0.5) { p.alpha = 0.5; p.alphaDir = -1; }
        if (p.alpha < 0.1) { p.alpha = 0.1; p.alphaDir = 1; }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // 暗角
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} />;
}
