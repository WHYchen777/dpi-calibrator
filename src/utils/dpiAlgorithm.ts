import type { ClickResult } from '../types/calibration';

/** 计算命中精度，距离<15像素算命中，返回命中率(0-100) */
export function calculateAccuracy(clicks: ClickResult[]): number {
  if (clicks.length === 0) return 0;
  const hits = clicks.filter((c) => c.distance < 15).length;
  return (hits / clicks.length) * 100;
}

/** 计算一致性：用反应时间的标准差来衡量，返回分数(0-100) */
export function calculateConsistency(clicks: ClickResult[]): number {
  if (clicks.length < 2) return 0;
  const reactionTimes = clicks.map((c) => c.reactionTime);
  const mean = reactionTimes.reduce((sum, t) => sum + t, 0) / reactionTimes.length;
  const variance = reactionTimes.reduce((sum, t) => sum + (t - mean) ** 2, 0) / reactionTimes.length;
  const stdDev = Math.sqrt(variance);
  const score = Math.max(0, 100 - (stdDev / 200) * 100);
  return Math.round(score * 100) / 100;
}

/** 甩枪测试汇总：命中率、爆头率、平均偏差、平均反应时间 */
export function calculateFlickScore(clicks: ClickResult[]) {
  // 排除微调射击，只统计甩枪主射击
  const main = clicks.filter((c) => !c.isMicro);
  if (main.length === 0) {
    return { accuracy: 0, headshotRate: 0, avgDistance: 0, avgReactionTime: 0 };
  }
  const hits = main.filter((c) => c.isHeadshot || c.isBodyHit).length;
  const headshots = main.filter((c) => c.isHeadshot).length;
  const avgDistance = main.reduce((s, c) => s + c.distance, 0) / main.length;
  const avgReactionTime = main.reduce((s, c) => s + c.reactionTime, 0) / main.length;
  return {
    accuracy: Math.round((hits / main.length) * 1000) / 10,
    headshotRate: Math.round((headshots / main.length) * 1000) / 10,
    avgDistance: Math.round(avgDistance * 100) / 100,
    avgReactionTime: Math.round(avgReactionTime * 100) / 100,
  };
}

/** 平滑跟枪稳定度：基于相邻帧偏差的抖动，抖动越小越稳 (0-100) */
export function calculateSmoothStability(distances: number[]): number {
  if (distances.length < 3) return 0;
  let jitter = 0;
  let count = 0;
  for (let i = 1; i < distances.length; i++) {
    const delta = Math.abs(distances[i] - distances[i - 1]);
    if (delta < 200) {
      jitter += delta;
      count++;
    }
  }
  const avgJitter = count > 0 ? jitter / count : 0;
  const score = Math.max(0, Math.min(100, 100 - avgJitter * 4));
  return Math.round(score * 100) / 100;
}

/** 综合瞄准评分：静态精度 25% + 静态一致性 15% + 甩枪精度 25% + 跟枪爆头率 20% + 平滑稳定度 15% */
export function calculateAimScore(parts: {
  staticAccuracy: number;
  staticConsistency: number;
  flickAccuracy: number;
  trackingRatio: number;
  smoothStability: number;
}): number {
  const score =
    parts.staticAccuracy * 0.25 +
    parts.staticConsistency * 0.15 +
    parts.flickAccuracy * 0.25 +
    parts.trackingRatio * 0.2 +
    parts.smoothStability * 0.15;
  return Math.round(score * 100) / 100;
}

/** 根据当前 eDPI、精度、一致性与综合瞄准评分给出建议 eDPI */
export function suggestDPI(
  currentDPI: number,
  accuracy: number,
  consistency: number,
  aimScore?: number,
): { suggestedDPI: number; reason: string } {
  const perf = aimScore ?? (accuracy * 0.6 + consistency * 0.4);
  let multiplier: number;
  let reason: string;

  if (perf < 60) {
    multiplier = 0.85;
    reason = '综合表现偏低（<60），建议降低灵敏度以提升控制力';
  } else if (perf < 75) {
    multiplier = 0.92;
    reason = '表现中等偏下，建议略微降低灵敏度换取更稳的操控';
  } else if (perf >= 88) {
    multiplier = 1.06;
    reason = '控制力出色，可以小幅提高灵敏度挖掘更大潜力';
  } else {
    multiplier = 1;
    reason = '当前灵敏度比较合适，建议保持并继续打磨';
  }

  let suggestedDPI = Math.round(currentDPI * multiplier);
  suggestedDPI = Math.max(400, Math.min(3200, suggestedDPI));

  return { suggestedDPI, reason };
}

/** 综合评分 = 精度*0.6 + 一致性*0.4 */
export function calculateOverallScore(accuracy: number, consistency: number): number {
  return Math.round((accuracy * 0.6 + consistency * 0.4) * 100) / 100;
}

/** 根据甩枪 A/B 灵敏度对比的偏好，微调建议 eDPI */
export function adjustDPIByPreference(
  suggestedDPI: number,
  preference: 'A' | 'B' | 'equal' | null | undefined,
): { dpi: number; note: string } {
  if (preference === 'B') {
    return {
      dpi: Math.max(100, Math.round(suggestedDPI * 1.1)),
      note: '你更偏好更快的 B 档（+20% 速度），建议值上浮 10%',
    };
  }
  if (preference === 'A') {
    return {
      dpi: Math.max(100, Math.round(suggestedDPI * 0.96)),
      note: '你更偏好当前速度的 A 档，建议值微降 4% 换取更稳控制',
    };
  }
  return { dpi: suggestedDPI, note: '' };
}
