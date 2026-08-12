import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { CrosshairSettings } from '../types/crosshair';

const DEFAULT: CrosshairSettings = {
  style: 'cross',
  color: '#00ff88',
  thickness: 1.5,
  gap: 7,
  size: 14,
  opacity: 0.4,
};

const CrosshairCtx = createContext<{
  settings: CrosshairSettings;
  update: (s: Partial<CrosshairSettings>) => void;
  reset: () => void;
}>({
  settings: DEFAULT,
  update: () => {},
  reset: () => {},
});

export function CrosshairProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CrosshairSettings>(DEFAULT);

  const update = useCallback((partial: Partial<CrosshairSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT), []);

  return (
    <CrosshairCtx.Provider value={{ settings, update, reset }}>
      {children}
    </CrosshairCtx.Provider>
  );
}

export function useCrosshair() {
  return useContext(CrosshairCtx);
}

/** Draw crosshair at (cx, cy) with given settings. */
export function drawCrosshairStyled(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: CrosshairSettings,
) {
  ctx.save();
  ctx.strokeStyle = s.color + Math.round(s.opacity * 255).toString(16).padStart(2, '0');
  ctx.fillStyle = s.color + Math.round(s.opacity * 255).toString(16).padStart(2, '0');
  ctx.lineWidth = s.thickness;

  const gap = s.gap;
  const len = s.size;

  switch (s.style) {
    case 'cross': {
      ctx.beginPath();
      ctx.moveTo(cx - len - gap, cy); ctx.lineTo(cx - gap, cy);
      ctx.moveTo(cx + gap, cy); ctx.lineTo(cx + len + gap, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - len - gap); ctx.lineTo(cx, cy - gap);
      ctx.moveTo(cx, cy + gap); ctx.lineTo(cx, cy + len + gap);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s.thickness * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dot': {
      ctx.beginPath();
      ctx.arc(cx, cy, s.thickness * 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'chevron': {
      ctx.beginPath();
      ctx.moveTo(cx, cy - len - gap);
      ctx.lineTo(cx, cy - gap);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - len * 0.7, cy + gap);
      ctx.lineTo(cx, cy + gap + len * 0.7);
      ctx.lineTo(cx + len * 0.7, cy + gap);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}
