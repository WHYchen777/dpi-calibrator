import type { ReactNode } from 'react';

interface FpsHudFrameProps {
  label?: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}

/**
 * FPS 风格 HUD 边框：四角括号 + 顶栏芯片 + 底部信息槽。
 * 纯展示层，pointer-events 关闭，不干扰测试交互。
 */
export default function FpsHudFrame({ label, left, right, children }: FpsHudFrameProps) {
  return (
    <div className="hud-frame">
      <span className="hud-corner hud-corner--tl" />
      <span className="hud-corner hud-corner--tr" />
      <span className="hud-corner hud-corner--bl" />
      <span className="hud-corner hud-corner--br" />
      <div className="hud-topbar">
        <span className="hud-chip">
          <i className="hud-dot" />
          EDPI · LAB
        </span>
        {label && <span className="hud-label hud-label--top">{label}</span>}
      </div>
      <div className="hud-bottombar">
        <div className="hud-slot">{left}</div>
        <div className="hud-slot hud-slot--right">{right}</div>
      </div>
      {children}
    </div>
  );
}
