import { useRef, useEffect } from 'react';
import { Crosshair as CrosshairIcon, RotateCcw } from 'lucide-react';
import { useCrosshair, drawCrosshairStyled } from '../hooks/useCrosshair';
import type { CrosshairStyle, CrosshairSettings as CrosshairSettingsType } from '../types/crosshair';
import GlassCard from './GlassCard';

const STYLES: { key: CrosshairStyle; label: string }[] = [
  { key: 'cross', label: '十字' },
  { key: 'dot', label: '圆点' },
  { key: 'chevron', label: 'V 形' },
];

const COLORS = ['#00ff88', '#22d3ee', '#ff4444', '#ffd700', '#a78bfa', '#ffffff'];

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

  const sliders: { key: 'thickness' | 'gap' | 'size' | 'opacity'; label: string; min: number; max: number; step: number }[] = [
    { key: 'thickness', label: '粗细', min: 0.5, max: 4, step: 0.5 },
    { key: 'gap', label: '间距', min: 2, max: 20, step: 1 },
    { key: 'size', label: '长度', min: 6, max: 30, step: 1 },
    { key: 'opacity', label: '透明度', min: 0.1, max: 1, step: 0.05 },
  ];

  return (
    <GlassCard className="p-5 sm:p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CrosshairIcon size={14} className="text-[#a78bfa]" />
          <span className="text-xs uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            准星设置
          </span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-[11px] text-[#8b93a7] hover:text-[#00ff88] transition-colors cursor-pointer"
        >
          <RotateCcw size={11} />
          重置
        </button>
      </div>

      <div className="flex gap-4 sm:gap-5">
        <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded-xl crosshair-preview border border-white/10">
          <canvas ref={previewRef} width={80} height={80} className="w-20 h-20" />
        </div>

        <div className="flex-1 space-y-2.5 min-w-0">
          <div className="flex gap-1.5">
            {STYLES.map((s) => (
              <button
                key={s.key}
                onClick={() => update({ style: s.key })}
                className="flex-1 py-1.5 text-[11px] rounded-lg transition-all cursor-pointer"
                style={{
                  background: settings.style === s.key ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.04)',
                  color: settings.style === s.key ? '#00ff88' : '#8b93a7',
                  border: settings.style === s.key ? '1px solid rgba(0,255,136,0.35)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => update({ color: c })}
                className="w-5 h-5 rounded-full transition-all cursor-pointer"
                style={{
                  backgroundColor: c,
                  boxShadow: settings.color === c ? `0 0 10px ${c}` : 'none',
                  transform: settings.color === c ? 'scale(1.2)' : 'scale(1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                aria-label={`准星颜色 ${c}`}
              />
            ))}
          </div>

          {sliders.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[11px] text-[#8b93a7]">
              <span className="w-10 flex-shrink-0">{s.label}</span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={settings[s.key]}
                onChange={(e) => update({ [s.key]: Number(e.target.value) } as Partial<CrosshairSettingsType>)}
                className="flex-1 h-1 accent-[#00ff88] cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-[10px]">{settings[s.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
