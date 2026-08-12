export type TestType = 'static' | 'tracking' | 'flick';

export interface ClickResult {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  distance: number;
  reactionTime: number;
  isHeadshot: boolean;
  isBodyHit: boolean;
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
