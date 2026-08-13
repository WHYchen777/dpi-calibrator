import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import type {
  ClickResult,
  UserSettings,
  TrackingResultData,
  FlickResultData,
  SmoothResultData,
  CalibrationSession,
} from '../types/calibration';
import {
  calculateAccuracy,
  calculateConsistency,
  calculateFlickScore,
  calculateAimScore,
  adjustDPIByPreference,
  suggestDPI,
} from '../utils/dpiAlgorithm';
import { saveSession } from '../utils/storage';
import GlassCard from './GlassCard';
import GlowButton from './GlowButton';
import ProgressRing from './ProgressRing';

interface ResultPanelProps {
  staticResults: ClickResult[];
  trackingResults: TrackingResultData;
  flickResults: FlickResultData;
  smoothResults: SmoothResultData;
  userSettings: UserSettings;
  onRestart: () => void;
}

function getRating(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'S', color: '#ffd700', bg: 'linear-gradient(160deg, rgba(255,215,0,0.16), rgba(255,180,0,0.04))' };
  if (score >= 75) return { label: 'A', color: '#00ff88', bg: 'linear-gradient(160deg, rgba(0,255,136,0.14), rgba(0,200,100,0.03))' };
  if (score >= 60) return { label: 'B', color: '#a78bfa', bg: 'linear-gradient(160deg, rgba(167,139,250,0.14), rgba(124,58,237,0.03))' };
  return { label: 'C', color: '#ff6b35', bg: 'linear-gradient(160deg, rgba(255,107,53,0.14), rgba(255,80,30,0.03))' };
}

function getTrackingGrade(ratio: number): { grade: string; color: string } {
  if (ratio > 90) return { grade: 'S', color: '#ffd700' };
  if (ratio > 70) return { grade: 'A', color: '#00ff88' };
  if (ratio > 50) return { grade: 'B', color: '#a78bfa' };
  return { grade: 'C', color: '#ff6b35' };
}

const PHASE_LABELS = ['Ⅰ', 'Ⅱ', 'Ⅲ'];

const tooltipStyle = {
  background: 'rgba(10,12,20,0.92)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  fontSize: '11px',
  fontFamily: "'JetBrains Mono', monospace",
  color: '#e8ecf4',
};

export default function ResultPanel({
  staticResults,
  trackingResults,
  flickResults,
  smoothResults,
  userSettings,
  onRestart,
}: ResultPanelProps) {
  const accuracy = calculateAccuracy(staticResults);
  const consistency = calculateConsistency(staticResults);
  const flick = useMemo(() => calculateFlickScore(flickResults.clicks), [flickResults]);
  const aimScore = calculateAimScore({
    staticAccuracy: accuracy,
    staticConsistency: consistency,
    flickAccuracy: flick.accuracy,
    trackingRatio: trackingResults.headshotTrackingRatio,
    smoothStability: smoothResults.stability,
  });
  const dpiSuggestion = suggestDPI(userSettings.edpi, accuracy, consistency, aimScore);
  const rating = getRating(aimScore);

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

  // 甩枪 A/B 灵敏度对比数据（兼容旧记录：无 rounds 时仅显示整体）
  const flickRoundA = flickResults.rounds?.find((r) => r.round === 'A') ?? null;
  const flickRoundB = flickResults.rounds?.find((r) => r.round === 'B') ?? null;
  const prefLabel =
    flickResults.preference === 'B' ? 'B 档（+20% 速度）更顺手' :
    flickResults.preference === 'A' ? 'A 档（当前速度）更顺手' :
    flickResults.preference === 'equal' ? '两档手感接近' : '未对比';

  const dpiAdjust = adjustDPIByPreference(dpiSuggestion.suggestedDPI, flickResults.preference ?? null);
  const finalSuggestedDPI = dpiAdjust.dpi;
  const dpiReason = dpiSuggestion.reason + (dpiAdjust.note ? ' · ' + dpiAdjust.note : '');

  const suggestedGameSensitivity = Math.round((finalSuggestedDPI / userSettings.mouseDPI) * 100) / 100;
  const suggestedMouseDPI = Math.round(finalSuggestedDPI / userSettings.gameSensitivity);

  const [dpiTab, setDpiTab] = useState<'sens' | 'dpi'>('sens');
  const [trackingExpanded, setTrackingExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const maxPhaseDist = Math.max(...trackingResults.phaseResults.map((p) => p.avgDistance), 1);

  const reactionData = useMemo(
    () => staticResults.map((r, i) => ({ shot: i + 1, ms: Math.round(r.reactionTime) })),
    [staticResults],
  );

  const smoothData = useMemo(() => {
    const dists = smoothResults.distances;
    if (dists.length === 0) return [];
    const step = Math.max(1, Math.floor(dists.length / 60));
    return dists
      .filter((_, i) => i % step === 0)
      .map((d, i) => ({ t: i, dist: Math.round(d * 10) / 10 }));
  }, [smoothResults]);

  const radarData = [
    { ability: '静态精度', value: Math.round(accuracy) },
    { ability: '一致性', value: Math.round(consistency) },
    { ability: '甩枪精度', value: Math.round(flick.accuracy) },
    { ability: '跟枪爆头', value: Math.round(headshotTrackRatio) },
    { ability: '平滑稳定', value: Math.round(smoothResults.stability) },
  ];

  return (
    <div className="min-h-screen py-8 px-4 animate-fade-slide">
      <div className="w-full max-w-3xl mx-auto space-y-5">

        {/* ── Hero Banner ─────────────────────────── */}
        <div
          className="rounded-3xl p-8 text-center relative overflow-hidden"
          style={{ background: rating.bg, border: `1px solid ${rating.color}35` }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{ background: `radial-gradient(circle at 50% 0%, ${rating.color} 0%, transparent 65%)` }}
          />
          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-[0.35em] mb-4" style={{ color: rating.color, fontFamily: "'Orbitron', sans-serif" }}>
              Performance Rating
            </p>
            <div className="flex items-center justify-center gap-6 mb-4">
              <div
                className="text-7xl sm:text-8xl font-black leading-none"
                style={{ fontFamily: "'Orbitron', sans-serif", color: rating.color, textShadow: `0 0 40px ${rating.color}60` }}
              >
                {rating.label}
              </div>
              <div className="w-px h-16 bg-white/10" />
              <div className="text-left">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#8b93a7] mb-1">综合瞄准评分</p>
                <p className="text-4xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {Math.round(aimScore)}
                  <span className="text-lg text-[#8b93a7]">/100</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-[#8b93a7]">
              四维评估：静态精度 · 动态跟枪 · 甩枪瞬狙 · 平滑跟枪
            </p>
          </div>
        </div>

        {/* ── Row 1: 精度 / 反应 / 甩枪 ──────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ◈ 静态精度
            </p>
            <span className="text-4xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {Math.round(accuracy)}
            </span>
            <span className="text-lg text-[#00ff8860]">%</span>
            <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full progress-shimmer" style={{ width: `${accuracy}%` }} />
            </div>
            <div className="flex gap-3 mt-3 text-xs">
              <span>💀 <span style={{ color: '#ff4d4d' }}>{headshots}</span> <span className="text-[#8b93a7]">爆头</span></span>
              <span>🎯 <span style={{ color: '#fff' }}>{bodyHits}</span> <span className="text-[#8b93a7]">身体</span></span>
              <span className="text-[#8b93a7]">{totalHits}/{staticResults.length} 命中</span>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ⏱ 反应时间
            </p>
            <span className="text-4xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {avgReaction}
            </span>
            <span className="text-lg text-[#8b93a7]">ms</span>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-[#8b93a7]">最快 <span style={{ color: '#00ff88' }}>{Math.round(fastest)}ms</span></span>
              <span className="text-[#8b93a7]">最慢 <span style={{ color: '#ff6b35' }}>{Math.round(slowest)}ms</span></span>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ⚡ 甩枪精度 · A/B 对比
            </p>
            <span className="text-4xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#22d3ee' }}>
              {Math.round(flick.accuracy)}
            </span>
            <span className="text-lg text-[#8b93a7]">%</span>
            <div className="flex gap-3 mt-3 text-xs">
              <span className="text-[#8b93a7]">击杀 <span style={{ color: '#ff4d4d' }}>{flick.headshotRate}%</span></span>
              <span className="text-[#8b93a7]">反应 <span style={{ color: '#00ff88' }}>{Math.round(flick.avgReactionTime)}ms</span></span>
              <span className="text-[#8b93a7]">偏差 <span style={{ color: '#ffd700' }}>{flick.avgDistance}px</span></span>
            </div>
            {flickRoundA && flickRoundB && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#8b93a7]">灵敏度对比</p>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 text-[#8b93a7]">A ×1.00</span>
                  <div className="flex-1 h-1 rounded bg-white/5 overflow-hidden">
                    <div className="h-full rounded" style={{ width: Math.round(flickRoundA.accuracy) + '%', background: '#00ff88' }} />
                  </div>
                  <span className="w-10 text-right font-mono" style={{ color: '#00ff88' }}>{Math.round(flickRoundA.accuracy)}%</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 text-[#8b93a7]">B ×1.20</span>
                  <div className="flex-1 h-1 rounded bg-white/5 overflow-hidden">
                    <div className="h-full rounded" style={{ width: Math.round(flickRoundB.accuracy) + '%', background: '#22d3ee' }} />
                  </div>
                  <span className="w-10 text-right font-mono" style={{ color: '#22d3ee' }}>{Math.round(flickRoundB.accuracy)}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#8b93a7]">微调命中</span>
                  <span className="font-mono" style={{ color: '#ffd700' }}>A {flickRoundA.microHitRate}% · B {flickRoundB.microHitRate}%</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#8b93a7]">偏好</span>
                  <span className="font-mono" style={{ color: '#a78bfa' }}>{prefLabel}</span>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── Row 2: 跟枪 + 平滑 ────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                🎯 动态跟枪
              </p>
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${trackGrade.color}20`, color: trackGrade.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {trackGrade.grade}
              </span>
            </div>

            <div className="flex items-end justify-center gap-3 h-16 mb-3">
              {trackingResults.phaseResults.map((p, i) => {
                const h = Math.max(6, (p.avgDistance / maxPhaseDist) * 60);
                return (
                  <div key={p.phase} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#8b93a7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(p.avgDistance)}</span>
                    <div
                      className="w-7 rounded-t transition-all duration-700 relative"
                      style={{ height: h, background: `linear-gradient(to top, ${i === 0 ? '#ff6b35' : i === 1 ? '#ffaa44' : '#ff4d4d'}, transparent)` }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffd700', boxShadow: '0 0 6px #ffd700' }} />
                    </div>
                    <span className="text-[10px] text-[#8b93a7]">{PHASE_LABELS[i]}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div>
                <span className="text-[#8b93a7]">连击 </span>
                <span style={{ color: '#ffd700', fontFamily: "'JetBrains Mono', monospace" }}>{trackingResults.maxCombo}</span>
              </div>
              <div>
                <span className="text-[#8b93a7]">距离 </span>
                <span style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(trackingResults.avgDistance)}px</span>
              </div>
              <div>
                <span className="text-[#8b93a7]">爆头率 </span>
                <span style={{ color: '#ff4d4d', fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(headshotTrackRatio)}%</span>
              </div>
            </div>

            <button
              onClick={() => setTrackingExpanded(!trackingExpanded)}
              className="w-full text-[10px] text-[#8b93a7] hover:text-[#00ff88] mt-3 pt-2 border-t border-white/5 transition-colors cursor-pointer"
            >
              {trackingExpanded ? '▲ 收起' : '▼ 展开详情'}
            </button>

            {trackingExpanded && (
              <div className="mt-2 space-y-1.5">
                {trackingResults.phaseResults.map((p, i) => (
                  <div key={p.phase} className="flex justify-between text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-[#8b93a7]">阶段{PHASE_LABELS[i]}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      <span className="text-[#ffd700]">{p.score}分</span>
                      {' '}
                      <span className="text-[#8b93a7]">{p.avgDistance}px</span>
                      {' '}
                      <span style={{ color: '#ff4d4d' }}>{p.perfectRatio}%</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 flex flex-col items-center justify-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              ◉ 平滑跟枪稳定度
            </p>
            <ProgressRing progress={smoothResults.stability} size={130} strokeWidth={8} color={smoothResults.stability >= 80 ? '#00ff88' : smoothResults.stability >= 60 ? '#ffd700' : '#ff6b35'} />
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-[#8b93a7]">平均偏差 <span style={{ color: '#00ff88' }}>{smoothResults.avgDistance}px</span></span>
              <span className="text-[#8b93a7]">完美跟枪 <span style={{ color: '#ff4d4d' }}>{smoothResults.headshotRatio}%</span></span>
            </div>
          </GlassCard>
        </div>

        {/* ── 能力雷达图 ──────────────────────── */}
        <GlassCard className="p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            🕸 能力雷达图
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="rgba(255,255,255,0.12)" />
                  <PolarAngleAxis dataKey="ability" tick={{ fill: '#8b93a7', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="能力" dataKey="value" stroke="#00ff88" fill="rgba(0,255,136,0.28)" fillOpacity={0.7} strokeWidth={2} dot={{ r: 3, fill: '#00ff88' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {radarData.map((d) => (
                <div key={d.ability} className="flex items-center gap-3 text-xs">
                  <span className="w-16 text-[#8b93a7]">{d.ability}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full progress-shimmer" style={{ width: d.value + '%' }} />
                  </div>
                  <span className="w-8 text-right font-mono" style={{ color: '#00ff88' }}>{d.value}</span>
                </div>
              ))}
              <p className="text-[10px] text-[#8b93a7]/70 pt-1">维度越饱满代表综合瞄准能力越均衡</p>
            </div>
          </div>
        </GlassCard>

        {/* ── 数据曲线 ──────────────────────────── */}
        <GlassCard className="p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            📈 数据曲线
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-[#8b93a7] mb-2 font-mono">反应时间分布（每次点击，ms）</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={reactionData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="shot" tick={{ fill: '#8b93a7', fontSize: 10 }} stroke="transparent" />
                  <YAxis tick={{ fill: '#8b93a7', fontSize: 10 }} stroke="transparent" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,255,136,0.05)' }} />
                  <Bar dataKey="ms" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-[11px] text-[#8b93a7] mb-2 font-mono">平滑跟枪偏差曲线（越贴近 0 越好）</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={smoothData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="distGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ff88" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: '#8b93a7', fontSize: 10 }} stroke="transparent" />
                  <YAxis tick={{ fill: '#8b93a7', fontSize: 10 }} stroke="transparent" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="dist" stroke="#00ff88" strokeWidth={2} fill="url(#distGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        {/* ── DPI 建议 ──────────────────────────── */}
        <GlassCard className="p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8b93a7] mb-5" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            ◆ DPI 建议
          </p>

          <div className="grid grid-cols-3 gap-3 text-center mb-5">
            {[
              { label: '鼠标 DPI', value: userSettings.mouseDPI },
              { label: '游戏灵敏度', value: userSettings.gameSensitivity },
              { label: '综合 eDPI', value: userSettings.edpi, accent: true },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] text-[#8b93a7] mb-1">{item.label}</p>
                <p className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: item.accent ? '#ff6b35' : '#e8ecf4' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-2xl text-[#8b93a7] line-through" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {userSettings.edpi}
            </span>
            <span className="text-2xl" style={{ color: '#00ff88' }}>→</span>
            <span className="text-4xl font-bold text-glow-accent" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {finalSuggestedDPI}
            </span>
          </div>

          <p className="text-xs text-[#8b93a7] text-center mb-4">{dpiReason}</p>

          <div className="flex gap-1 mb-3 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setDpiTab('sens')}
              className="flex-1 py-1.5 text-xs rounded-md transition-all cursor-pointer"
              style={{
                background: dpiTab === 'sens' ? 'rgba(0,255,136,0.12)' : 'transparent',
                color: dpiTab === 'sens' ? '#00ff88' : '#8b93a7',
              }}
            >
              方案A: 改灵敏度
            </button>
            <button
              onClick={() => setDpiTab('dpi')}
              className="flex-1 py-1.5 text-xs rounded-md transition-all cursor-pointer"
              style={{
                background: dpiTab === 'dpi' ? 'rgba(0,255,136,0.12)' : 'transparent',
                color: dpiTab === 'dpi' ? '#00ff88' : '#8b93a7',
              }}
            >
              方案B: 改DPI
            </button>
          </div>

          <div className="px-4 py-3 rounded-lg text-xs" style={{ backgroundColor: 'rgba(0,255,136,0.06)' }}>
            {dpiTab === 'sens' ? (
              <span className="text-[#8b93a7]">
                鼠标DPI保持 <span style={{ color: '#00ff88' }}>{userSettings.mouseDPI}</span>，游戏灵敏度改为{' '}
                <span className="font-bold" style={{ color: '#00ff88', fontFamily: "'JetBrains Mono', monospace" }}>{suggestedGameSensitivity}</span>
              </span>
            ) : (
              <span className="text-[#8b93a7]">
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
                suggestedDPI: finalSuggestedDPI,
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
                  {
                    type: 'flick',
                    clicks: flickResults.clicks,
                    accuracy: flick.accuracy,
                    avgReactionTime: flick.avgReactionTime,
                    consistency: calculateConsistency(flickResults.clicks.filter((c) => !c.isMicro)),
                  },
                  {
                    type: 'smooth',
                    clicks: [],
                    accuracy: smoothResults.stability,
                    avgReactionTime: 0,
                    consistency: 0,
                  },
                ],
                overallScore: aimScore,
                recommendation: dpiReason,
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
