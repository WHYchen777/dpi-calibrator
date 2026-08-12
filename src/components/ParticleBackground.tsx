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

const PARTICLE_COUNT = 50;
const COLORS = ['#00ff88', '#00ff8830', '#7c3aed', '#7c3aed40'];

export default function ParticleBackground() {
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

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();

    // Init particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        size: 0.5 + Math.random() * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.1 + Math.random() * 0.4,
        alphaDir: Math.random() > 0.5 ? 1 : -1,
      });
    }

    const onMouse = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse, { passive: true });

    const animate = () => {
      ctx!.clearRect(0, 0, w, h);

      for (const p of particles) {
        // Move slowly
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;

        // Wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Subtle mouse attraction (< 200px)
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          const force = (1 - dist / 200) * 20;
          p.vx += (dx / dist) * force * 0.016;
          p.vy += (dy / dist) * force * 0.016;
          // Dampen
          p.vx *= 0.98;
          p.vy *= 0.98;
        }

        // Alpha pulse
        p.alpha += p.alphaDir * 0.003;
        if (p.alpha > 0.5) p.alphaDir = -1;
        if (p.alpha < 0.08) p.alphaDir = 1;

        // Draw
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = p.color.replace('30', '').replace('40', '') + `,${p.alpha.toFixed(2)})`
          .replace('rgb', 'rgba');
        ctx!.fill();

        // Glow for closer particles
        if (p.size > 1.5) {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx!.fillStyle = p.color.replace('30', '').replace('40', '') + `,${(p.alpha * 0.15).toFixed(3)})`
            .replace('rgb', 'rgba');
          ctx!.fill();
        }
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
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
