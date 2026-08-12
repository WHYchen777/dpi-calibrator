import { useRef, useEffect } from 'react';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import type { CrosshairStyle } from '../types/crosshair';
import GlassCard from './GlassCard';

const STYLES: { key: CrosshairStyle; label: string }[] = [
  { key: 'cross', label: '十字' },
  { key: 'dot', label: '圆点' },
  { key: 'chevron', label: 'V形' },
];

const COLORS = ['#00ff88', '#ff4444', '#ffd700', '#7c3aed', '#00ccff', '#ffffff'];

export default function CrosshairSettings() {
  const { settings, update, reset } = useCrosshair();
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 80, 80);
    drawCrosshairStyled(ctx, 40, 40, settings);
  }, [settings]);

  return (
    <GlassCard className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]"
          style={{ fontFamily: "'Orbitron', sans-serif" }}>
          ◈ 准星设置
        </p>
        <button onClick={reset}
          className="text-[10px] text-[#8892b0] hover:text-[#00ff88] transition-colors cursor-pointer">
          重置
        </button>
      </div>

      <div className="flex gap-4">
        {/* Preview */}
        <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded-lg"
          style={{ backgroundColor: '#0a0a0f', border: '1px solid rgba(255,255,255,0.06)' }}>
          <canvas ref={previewRef} width={80} height={80} className="w-20 h-20" />
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-2">
          {/* Style */}
          <div className="flex gap-1">
            {STYLES.map((s) => (
              <button key={s.key}
                onClick={() => update({ style: s.key })}
                className="flex-1 py-1 text-[10px] rounded transition-all cursor-pointer"
                style={{
                  background: settings.style === s.key ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)',
                  color: settings.style === s.key ? '#00ff88' : '#8892b0',
                  border: settings.style === s.key ? '1px solid rgba(0,255,136,0.3)' : '1px solid transparent',
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Color */}
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button key={c}
                onClick={() => update({ color: c })}
                className="w-5 h-5 rounded-full transition-all cursor-pointer"
                style={{
                  backgroundColor: c,
                  boxShadow: settings.color === c ? `0 0 8px ${c}` : 'none',
                  transform: settings.color === c ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          {/* Sliders */}
          <div className="flex items-center gap-2 text-[10px] text-[#8892b0]">
            <span className="w-8">粗细</span>
            <input type="range" min={0.5} max={4} step={0.5} value={settings.thickness}
              onChange={(e) => update({ thickness: Number(e.target.value) })}
              className="flex-1 h-1 accent-[#00ff88] cursor-pointer" />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#8892b0]">
            <span className="w-8">间距</span>
            <input type="range" min={2} max={20} step={1} value={settings.gap}
              onChange={(e) => update({ gap: Number(e.target.value) })}
              className="flex-1 h-1 accent-[#00ff88] cursor-pointer" />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#8892b0]">
            <span className="w-8">长度</span>
            <input type="range" min={6} max={30} step={1} value={settings.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
              className="flex-1 h-1 accent-[#00ff88] cursor-pointer" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
