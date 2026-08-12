import type { ClickResult } from '../types/calibration';

/**
 * 计算命中精度，距离<15像素算命中，返回命中率(0-100)
 */
export function calculateAccuracy(clicks: ClickResult[]): number {
  if (clicks.length === 0) return 0;

  const hits = clicks.filter((c) => c.distance < 15).length;
  return (hits / clicks.length) * 100;
}

/**
 * 计算一致性，用反应时间的标准差来衡量，返回分数(0-100)
 *
 * 标准差越小说明操作越稳定，得分越高。
 * 标准差 >= 200ms → 0分，标准差趋近于0 → 100分。
 */
export function calculateConsistency(clicks: ClickResult[]): number {
  if (clicks.length < 2) return 0;

  const reactionTimes = clicks.map((c) => c.reactionTime);
  const mean = reactionTimes.reduce((sum, t) => sum + t, 0) / reactionTimes.length;
  const variance =
    reactionTimes.reduce((sum, t) => sum + (t - mean) ** 2, 0) / reactionTimes.length;
  const stdDev = Math.sqrt(variance);

  // 标准差>=200ms得0分，趋近0得100分，线性映射
  const score = Math.max(0, 100 - (stdDev / 200) * 100);
  return Math.round(score * 100) / 100;
}

/**
 * 根据当前DPI、精度和一致性给出建议DPI
 */
export function suggestDPI(
  currentDPI: number,
  accuracy: number,
  consistency: number,
): { suggestedDPI: number; reason: string } {
  let multiplier: number;
  let reason: string;

  if (accuracy < 60) {
    multiplier = 0.85;
    reason = '精度偏低（<60%），建议降低灵敏度以提高控制力';
  } else if (accuracy >= 60 && accuracy <= 80 && consistency < 60) {
    multiplier = 0.9;
    reason = '精度尚可但手不够稳（一致性<60），建议适当降低DPI';
  } else if (accuracy > 80 && consistency > 80) {
    multiplier = 1;
    reason = '精度和稳定性都很好，当前DPI适合你';
  } else {
    multiplier = 1.05;
    reason = '表现中等，建议微调以寻找更优手感';
  }

  let suggestedDPI = Math.round(currentDPI * multiplier);

  // 限制在 400-3200 范围
  suggestedDPI = Math.max(400, Math.min(3200, suggestedDPI));

  return { suggestedDPI, reason };
}

/**
 * 综合评分 = 精度*0.6 + 一致性*0.4
 */
export function calculateOverallScore(accuracy: number, consistency: number): number {
  return Math.round((accuracy * 0.6 + consistency * 0.4) * 100) / 100;
}
