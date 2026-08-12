import type { CalibrationSession } from '../types/calibration';

const STORAGE_KEY = 'dpi-calibrator-history';

export function saveSession(session: CalibrationSession): void {
  const history = loadHistory();
  history.push(session);
  // Keep only last 20 records
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function loadHistory(): CalibrationSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CalibrationSession[];
  } catch {
    return [];
  }
}
