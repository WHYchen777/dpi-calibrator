import { useRef, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;  // '#00ff88' or '#7c3aed'
  alpha: number;
  alphaDir: number;
}

// ── Constants ────────────────────────────────────────────────

const PARTICLE_COUNT = 40;
const GRID_SPACING = 80;
const CONNECTION_DIST = 100;
const MOUSE_RANGE = 150;

// ── Helpers ──────────────────────────────────────────────────

function drawRadialGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Base gradient: top-left dark to bottom-right slightly purple
  const grad = ctx.createRadialGradient(w * 0.35, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h));
  grad.addColorStop(0, '#1a1a3e');   // center glow
  grad.addColorStop(0.4, '#0f0f2e'); // mid
  grad.addColorStop(1, '#0a0a1a');   // edges
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(26, 26, 62, 0.15)';
  ctx.lineWidth = 1;
  for (let x = GRID_SPACING; x < w; x += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = GRID_SPACING; y < h; y += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

// ── Component ────────────────────────────────────────────────

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let particles: Particle[] = [];
    let mouseX = w / 2;
    let mouseY = h / 2;
    let raf = 0;

    // ── Resize ─────────────────────────────────────────

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();

    // ── Init particles ─────────────────────────────────

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isGreen = i < PARTICLE_COUNT / 2;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,   // 0.1–0.3 px/frame
        vy: (Math.random() - 0.5) * 0.5,
        size: 1 + Math.random() * 2,
        color: isGreen ? '#00ff88' : '#7c3aed',
        alpha: 0.2 + Math.random() * 0.4,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
      });
    }

    // ── Mouse ──────────────────────────────────────────

    const onMouse = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse, { passive: true });

    // ── Draw connections between nearby particles ──────

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
            const midColor = a.color === b.color ? a.color : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = midColor + alpha.toString(16).padStart(2, '0');
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    // ── Animate ────────────────────────────────────────

    const animate = () => {
      ctx.clearRect(0, 0, w, h);

      // Layer 1: radial gradient
      drawRadialGradient(ctx, w, h);

      // Layer 2: grid
      drawGrid(ctx, w, h);

      // Layer 3: particles + connections
      drawConnections();

      for (const p of particles) {
        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Bounce at edges
        if (p.x <= 0)   { p.x = 0;   p.vx = Math.abs(p.vx); }
        if (p.x >= w)   { p.x = w;   p.vx = -Math.abs(p.vx); }
        if (p.y <= 0)   { p.y = 0;   p.vy = Math.abs(p.vy); }
        if (p.y >= h)   { p.y = h;   p.vy = -Math.abs(p.vy); }

        // Mouse attraction
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RANGE && dist > 0) {
          const force = (1 - dist / MOUSE_RANGE) * 0.35;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
          // Dampen to avoid runaway speed
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > 1.2) {
            const scale = 1.2 / speed;
            p.vx *= scale;
            p.vy *= scale;
          }
        }

        // Alpha pulse
        p.alpha += p.alphaDir * 0.002;
        if (p.alpha > 0.6) p.alphaDir = -1;
        if (p.alpha < 0.15) p.alphaDir = 1;

        // Draw particle
        const alphaHex = Math.round(p.alpha * 255).toString(16).padStart(2, '0');

        // Glow aura
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.alpha * 0.4 * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + alphaHex;
        ctx.fill();
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0"
      style={{ zIndex: -1 }}
    />
  );
}
