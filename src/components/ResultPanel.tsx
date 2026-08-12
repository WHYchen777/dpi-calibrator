import { useState } from 'react';
import type { ClickResult, UserSettings, TrackingResultData, CalibrationSession } from '../types/calibration';
import {
  calculateAccuracy,
  calculateConsistency,
  suggestDPI,
  calculateOverallScore,
} from '../utils/dpiAlgorithm';
import { saveSession } from '../utils/storage';
import GlassCard from './GlassCard';
import GlowButton from './GlowButton';
import ProgressRing from './ProgressRing';

interface ResultPanelProps {
  staticResults: ClickResult[];
  trackingResults: TrackingResultData;
  userSettings: UserSettings;
  onRestart: () => void;
}

function getRating(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'S', color: '#ffd700', bg: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,180,0,0.05))' };
  if (score >= 75) return { label: 'A', color: '#00ff88', bg: 'linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,200,100,0.03))' };
  if (score >= 60) return { label: 'B', color: '#7c3aed', bg: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(100,40,200,0.03))' };
  return { label: 'C', color: '#ff6b35', bg: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,80,30,0.03))' };
}

function getTrackingGrade(ratio: number): { grade: string; color: string } {
  if (ratio > 90) return { grade: 'S', color: '#ffd700' };
  if (ratio > 70) return { grade: 'A', color: '#00ff88' };
  if (ratio > 50) return { grade: 'B', color: '#7c3aed' };
  return { grade: 'C', color: '#ff6b35' };
}

const PHASE_LABELS = ['Ⅰ', 'Ⅱ', 'Ⅲ'];

export default function ResultPanel({
  staticResults,
  trackingResults,
  userSettings,
  onRestart,
}: ResultPanelProps) {
  const accuracy = calculateAccuracy(staticResults);
  const consistency = calculateConsistency(staticResults);
  const dpiSuggestion = suggestDPI(userSettings.edpi, accuracy, consistency);
  const overallScore = calculateOverallScore(accuracy, consistency);
  const rating = getRating(overallScore);

  const headshots = staticResults.filter((r) => r.isHeadshot).length;
  const bodyHits = staticResults.filter((r) => r.isBodyHit).length;
  const totalHits = headshots + bodyHits;

  const avgReaction = staticResults.length > 0
    ? Math.round(staticResults.reduce((s, r) => s + r.reactionTime, 0) / staticResults.length) : 0;
  const reactionTimes = staticResults.map((r) => r.reactionTime);
  const fastest = reactionTimes.length > 0 ? Math.min(...reactionTimes) : 0;
  const slowest = reactionTimes.length > 0 ? Math.max(...reactionTimes) : 0;

  const headshotTrackRatio = trackingResults.headshotTrackingRatio || 0;
  const trackGrade = getTrackingGrade(headshotTrackRatio);

  const suggestedGameSensitivity = Math.round((dpiSuggestion.suggestedDPI / userSettings.mouseDPI) * 100) / 100;
  const suggestedMouseDPI = Math.round(dpiSuggestion.suggestedDPI / userSettings.gameSensitivity);

  const [dpiTab, setDpiTab] = useState<'sens' | 'dpi'>('sens');
  const [trackingExpanded, setTrackingExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const maxPhaseDist = Math.max(...trackingResults.phaseResults.map((p) => p.avgDistance), 1);

  return (
    <div className="min-h-screen py-8 px-4 animate-fade-slide" style={{ backgroundColor: 'transparent' }}>
      <div className="w-full max-w-2xl mx-auto space-y-6">

        {/* ── Hero Banner ─────────────────────────── */}
        <div className="rounded-2xl p-8 text-center relative overflow-hidden" style={{ background: rating.bg, border: `1px solid ${rating.color}30` }}>
          <div className="absolute inset-0 opacity-10"
            style={{ background: `radial-gradient(circle at center, ${rating.color} 0%, transparent 70%)` }} />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: rating.color, fontFamily: "'Orbitron', sans-serif" }}>
              Performance Rating
            </p>
            <div className="text-8xl font-black mb-2" style={{ fontFamily: "'Orbitron', sans-serif", color: rating.color, textShadow: `0 0 40px ${rating.color}60` }}>
              {rating.label}
            </div>
            <p className="text-[#8892b0] text-sm">
              综合评分 {Math.round(overallScore)} · {rating.label === 'S' ? '超凡表现' : rating.label === 'A' ? '稳定发挥' : rating.label === 'B' ? '还有提升空间' : '需要调整设置'}
            </p>
          </div>
        </div>

        {/* ── Row 1: Accuracy + Reaction ──────────── */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0] mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ◈ 精度评分
            </p>
            <span className="text-5xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {Math.round(accuracy)}
            </span>
            <span className="text-lg text-[#00ff8860]">%</span>
            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full progress-shimmer" style={{ width: `${accuracy}%` }} />
            </div>
            <div className="flex gap-3 mt-2 text-xs">
              <span>💀 <span style={{ color: '#ff4d4d' }}>{headshots}</span> <span className="text-[#8892b0]">爆头</span></span>
              <span>🎯 <span style={{ color: '#fff' }}>{bodyHits}</span> <span className="text-[#8892b0]">身体</span></span>
              <span className="text-[#8892b0]">{totalHits}/{staticResults.length} 命中</span>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0] mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ⏱ 反应时间
            </p>
            <span className="text-5xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {avgReaction}
            </span>
            <span className="text-lg text-[#8892b0]">ms</span>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-[#8892b0]">最快 <span style={{ color: '#00ff88' }}>{Math.round(fastest)}ms</span></span>
              <span className="text-[#8892b0]">最慢 <span style={{ color: '#ff6b35' }}>{Math.round(slowest)}ms</span></span>
            </div>
          </GlassCard>
        </div>

        {/* ── Row 2: Tracking + Progress Ring ─────── */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                🎯 追踪能力
              </p>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${trackGrade.color}20`, color: trackGrade.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {trackGrade.grade}
              </span>
            </div>

            {/* Mini bar chart */}
            <div className="flex items-end justify-center gap-3 h-16 mb-3">
              {trackingResults.phaseResults.map((p, i) => {
                const h = Math.max(6, (p.avgDistance / maxPhaseDist) * 60);
                return (
                  <div key={p.phase} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#8892b0]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(p.avgDistance)}</span>
                    <div className="w-7 rounded-t transition-all duration-700 relative" style={{ height: h, background: `linear-gradient(to top, ${i === 0 ? '#ff6b35' : i === 1 ? '#ffaa44' : '#ff4d4d'}, transparent)` }}>
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffd700', boxShadow: '0 0 6px #ffd700' }} />
                    </div>
                    <span className="text-[10px] text-[#8892b0]">{PHASE_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div>
                <span className="text-[#8892b0]">连击 </span>
                <span style={{ color: '#ffd700', fontFamily: "'JetBrains Mono', monospace" }}>{trackingResults.maxCombo}</span>
              </div>
              <div>
                <span className="text-[#8892b0]">距离 </span>
                <span style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(trackingResults.avgDistance)}px</span>
              </div>
              <div>
                <span className="text-[#8892b0]">爆头率 </span>
                <span style={{ color: '#ff4d4d', fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(headshotTrackRatio)}%</span>
              </div>
            </div>

            <button onClick={() => setTrackingExpanded(!trackingExpanded)}
              className="w-full text-[10px] text-[#8892b0] hover:text-[#00ff88] mt-3 pt-2 border-t border-white/5 transition-colors cursor-pointer">
              {trackingExpanded ? '▲ 收起' : '▼ 展开详情'}
            </button>

            {trackingExpanded && (
              <div className="mt-2 space-y-1.5">
                {trackingResults.phaseResults.map((p, i) => (
                  <div key={p.phase} className="flex justify-between text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-[#8892b0]">阶段{PHASE_LABELS[i]}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span className="text-[#ffd700]">{p.score}分</span>
                      {' '}
                      <span className="text-[#8892b0]">{p.avgDistance}px</span>
                      {' '}
                      <span style={{ color: '#ff4d4d' }}>{p.perfectRatio}%</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 flex flex-col items-center justify-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8892b0] mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ◉ 综合评分
            </p>
            <ProgressRing progress={overallScore} size={130} strokeWidth={8} color={rating.color} />
            <p className="text-sm font-bold mt-2" style={{ color: rating.color, fontFamily: "'Orbitron', sans-serif" }}>
              {rating.label}级
            </p>
          </GlassCard>
        </div>

        {/* ── DPI Card ──────────────────────────────── */}
        <GlassCard className="p-6" highlight>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#00ff88] mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            ◆ DPI 建议
          </p>

          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            {[
              { label: '鼠标 DPI', value: userSettings.mouseDPI },
              { label: '游戏灵敏度', value: userSettings.gameSensitivity },
              { label: '综合 eDPI', value: userSettings.edpi, accent: true },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] text-[#8892b0] mb-1">{item.label}</p>
                <p className="text-lg font-bold" style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: item.accent ? '#ff6b35' : '#e0e0e0',
                }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Arrow transition */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-2xl text-[#8892b0] line-through" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {userSettings.edpi}
            </span>
            <span className="text-2xl" style={{ color: '#00ff88' }}>→</span>
            <span className="text-4xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {dpiSuggestion.suggestedDPI}
            </span>
          </div>

          <p className="text-xs text-[#8892b0] text-center mb-4">{dpiSuggestion.reason}</p>

          {/* Tab switch */}
          <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1">
            <button onClick={() => setDpiTab('sens')}
              className="flex-1 py-1.5 text-xs rounded-md transition-all"
              style={{
                background: dpiTab === 'sens' ? 'rgba(0,255,136,0.12)' : 'transparent',
                color: dpiTab === 'sens' ? '#00ff88' : '#8892b0',
              }}>
              方案A: 改灵敏度
            </button>
            <button onClick={() => setDpiTab('dpi')}
              className="flex-1 py-1.5 text-xs rounded-md transition-all"
              style={{
                background: dpiTab === 'dpi' ? 'rgba(0,255,136,0.12)' : 'transparent',
                color: dpiTab === 'dpi' ? '#00ff88' : '#8892b0',
              }}>
              方案B: 改DPI
            </button>
          </div>

          <div className="px-4 py-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(0,255,136,0.06)' }}>
            {dpiTab === 'sens' ? (
              <span className="text-[#8892b0]">
                鼠标DPI保持 <span style={{ color: '#00ff88' }}>{userSettings.mouseDPI}</span>，游戏灵敏度改为{' '}
                <span className="font-bold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>{suggestedGameSensitivity}</span>
              </span>
            ) : (
              <span className="text-[#8892b0]">
                游戏灵敏度保持 <span style={{ color: '#00ff88' }}>{userSettings.gameSensitivity}</span>，鼠标DPI改为{' '}
                <span className="font-bold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>{suggestedMouseDPI}</span>
              </span>
            )}
          </div>
        </GlassCard>

        {/* ── Buttons ───────────────────────────────── */}
        <div className="flex gap-3 pb-8">
          <GlowButton onClick={onRestart} variant="accent" pulse className="flex-1">重新测试</GlowButton>
          <GlowButton
            onClick={() => {
              const session: CalibrationSession = {
                id: Date.now().toString(36),
                date: new Date().toISOString(),
                currentDPI: userSettings.edpi,
                suggestedDPI: dpiSuggestion.suggestedDPI,
                tests: [
                  {
                    type: 'static',
                    clicks: staticResults,
                    accuracy,
                    avgReactionTime: avgReaction,
                    consistency,
                  },
                  {
                    type: 'tracking',
                    clicks: trackingResults.distances.map((d) => ({
                      x: 0, y: 0,
                      targetX: 0, targetY: 0,
                      distance: d, reactionTime: 0,
                      isHeadshot: false, isBodyHit: false,
                    })),
                    accuracy: 0,
                    avgReactionTime: 0,
                    consistency: 0,
                  },
                ],
                overallScore,
                recommendation: dpiSuggestion.reason,
              };
              saveSession(session);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            variant="outline"
            className="flex-1"
          >
            {saved ? '✓ 已保存' : '保存记录'}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}
