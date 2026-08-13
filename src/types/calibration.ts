export type TestType = 'static' | 'tracking' | 'flick' | 'smooth';

export interface ClickResult {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  distance: number;
  reactionTime: number;
  isHeadshot: boolean;
  isBodyHit: boolean;
  /** 是否为甩枪测试中的微调射击 */
  isMicro?: boolean;
  /** 微调射击用时（ms） */
  microTime?: number;
  /** 甩枪 A/B 对比轮次 */
  round?: 'A' | 'B';
}

export interface TestResult {
  type: TestType;
  clicks: ClickResult[];
  accuracy: number;
  avgReactionTime: number;
  consistency: number;
}

export interface CalibrationSession {
  id: string;
  date: string;
  currentDPI: number;
  suggestedDPI: number;
  tests: TestResult[];
  overallScore: number;
  recommendation: string;
}

export interface UserSettings {
  mouseDPI: number;
  gameSensitivity: number;
  edpi: number;
  gameType: 'valorant' | 'csgo' | 'apex' | 'overwatch' | 'other';
  gameName: string;
}

export interface PhaseResult {
  phase: 1 | 2 | 3;
  avgDistance: number;
  score: number;
  perfectRatio: number;
}

export interface TrackingResultData {
  phaseResults: PhaseResult[];
  totalScore: number;
  maxCombo: number;
  distances: number[];
  avgDistance: number;
  headshotTrackingRatio: number;
  totalFrames: number;
}

export interface FlickRoundResult {
  round: 'A' | 'B';
  sensMultiplier: number;
  clicks: ClickResult[];
  accuracy: number;
  headshotRate: number;
  avgDistance: number;
  avgReactionTime: number;
  /** 微调命中率（0-100） */
  microHitRate: number;
  /** 平均微调用时（ms） */
  avgMicroTime: number;
}

export interface FlickResultData {
  clicks: ClickResult[];
  accuracy: number;
  headshotRate: number;
  avgDistance: number;
  avgReactionTime: number;
  /** 灵敏度对比两轮数据 */
  rounds: FlickRoundResult[];
  /** 用户手感偏好 */
  preference: 'A' | 'B' | 'equal' | null;
  /** 偏好档位的灵敏度倍率 */
  preferredMultiplier: number;
}

export interface SmoothResultData {
  avgDistance: number;
  stability: number;
  headshotRatio: number;
  distances: number[];
  totalFrames: number;
}
