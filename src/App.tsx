import { useState, useEffect, useMemo } from 'react';
import type { UserSettings, ClickResult, TrackingResultData } from './types/calibration';
import StaticClickTest from './components/StaticClickTest';
import TrackingTest from './components/TrackingTest';
import ResultPanel from './components/ResultPanel';
import AnimatedBackground from './components/AnimatedBackground';
import GlowButton from './components/GlowButton';
import GlassCard from './components/GlassCard';
import CrosshairSettings from './components/CrosshairSettings';

type Step = 'home' | 'testing' | 'result';
type TestPhase = 'static' | 'tracking';

const GAME_OPTIONS: { value: UserSettings['gameType']; label: string; icon: string }[] = [
  { value: 'valorant', label: 'Valorant', icon: 'V' },
  { value: 'csgo', label: 'CS2', icon: 'CS' },
  { value: 'apex', label: 'Apex', icon: 'A' },
  { value: 'overwatch', label: 'Overwatch', icon: 'OW' },
  { value: 'other', label: '其他', icon: '?' },
];

// Typewriter effect
function useTypewriter(text: string, speed = 60) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplay('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplay(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return { text: display, done };
}

function App() {
  const [currentStep, setCurrentStep] = useState<Step>('home');
  const [testPhase, setTestPhase] = useState<TestPhase>('static');
  const [userSettings, setUserSettings] = useState<UserSettings>({
    mouseDPI: 800,
    gameSensitivity: 1,
    edpi: 800,
    gameType: 'valorant',
    gameName: '',
  });
  const [staticResults, setStaticResults] = useState<ClickResult[] | null>(null);
  const [trackingResults, setTrackingResults] = useState<TrackingResultData | null>(null);

  const edpi = useMemo(
    () => Math.round(userSettings.mouseDPI * userSettings.gameSensitivity * 10) / 10,
    [userSettings.mouseDPI, userSettings.gameSensitivity],
  );

  const { text: subtitle } = useTypewriter('校准你的战斗手感', 80);

  const handleStartTest = () => {
    setTestPhase('static');
    setCurrentStep('testing');
  };

  const handleStaticComplete = (results: ClickResult[]) => {
    setStaticResults(results);
    setTestPhase('tracking');
  };

  const handleTrackingComplete = (results: TrackingResultData) => {
    setTrackingResults(results);
    setCurrentStep('result');
  };

  const handleRestart = () => {
    setStaticResults(null);
    setTrackingResults(null);
    setTestPhase('static');
    setCurrentStep('home');
  };

  // ── HOME ──────────────────────────────────────────────
  if (currentStep === 'home') {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 w-full max-w-lg mx-auto px-6 animate-fade-slide">
          {/* Title with radial glow */}
          <div className="text-center mb-10 relative">
            {/* Pulsing glow behind title */}
            <div
              className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                top: '-60px',
                width: '400px',
                height: '200px',
                background: 'radial-gradient(ellipse at center, rgba(0,255,136,0.15) 0%, transparent 70%)',
                animation: 'titleGlowPulse 3s ease-in-out infinite',
              }}
            />
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-[0.25em] mb-4 text-glow-accent relative"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              DPI CALIBRATOR
            </h1>
            {/* Decorative line */}
            <div className="flex items-center gap-2 justify-center mb-3">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#00ff8860]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#00ff8860]" />
            </div>
            <p className="text-lg text-[#8892b0]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span>{subtitle}</span>
              <span className="animate-pulse text-[#00ff88]">|</span>
            </p>
          </div>

          {/* Settings Card */}
          <GlassCard className="p-6 mb-6 space-y-5">
            {/* Mouse DPI */}
            <div>
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#8892b0] mb-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="w-1 h-1 rounded-full bg-[#00ff88]" />
                鼠标 DPI
              </label>
              <input
                type="number"
                value={userSettings.mouseDPI || ''}
                onChange={(e) =>
                  setUserSettings({ ...userSettings, mouseDPI: Number(e.target.value) || 0 })
                }
                className="input-cyber text-lg"
                min={400}
                max={32000}
                step={100}
              />
            </div>

            {/* Game Sensitivity */}
            <div>
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#8892b0] mb-2"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="w-1 h-1 rounded-full bg-[#00ff88]" />
                游戏内灵敏度
              </label>
              <input
                type="number"
                value={userSettings.gameSensitivity || ''}
                onChange={(e) =>
                  setUserSettings({ ...userSettings, gameSensitivity: Number(e.target.value) || 0 })
                }
                className="input-cyber text-lg"
                min={0.01}
                max={100}
                step={0.01}
              />
            </div>

            {/* eDPI Display */}
            <div className="flex items-center justify-between px-3 py-3 rounded-lg"
              style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.1)' }}>
              <span className="text-xs uppercase tracking-widest text-[#8892b0]"
                style={{ fontFamily: "'Orbitron', sans-serif" }}>eDPI</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#8892b0]">
                  {userSettings.mouseDPI} × {userSettings.gameSensitivity} =
                </span>
                <span className="text-2xl font-bold text-glow-accent"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {edpi}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Crosshair Settings */}
          <CrosshairSettings />

          {/* Game Selection */}
          <GlassCard className="p-6 mb-8">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#8892b0] mb-4"
              style={{ fontFamily: "'Orbitron', sans-serif" }}>
              <span className="w-1 h-1 rounded-full bg-[#7c3aed]" />
              游戏类型
            </label>
            <div className="grid grid-cols-5 gap-2">
              {GAME_OPTIONS.map((opt) => {
                const active = userSettings.gameType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setUserSettings({ ...userSettings, gameType: opt.value, gameName: opt.value === 'other' ? userSettings.gameName : '' })
                    }
                    className="flex flex-col items-center gap-1 py-3 rounded-lg transition-all duration-200 cursor-pointer"
                    style={{
                      background: active ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.03)',
                      border: active ? '1px solid rgba(0,255,136,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: active ? '0 0 12px rgba(0,255,136,0.15)' : undefined,
                    }}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{
                        fontFamily: "'Orbitron', sans-serif",
                        color: active ? '#00ff88' : '#8892b0',
                        textShadow: active ? '0 0 8px #00ff8840' : undefined,
                      }}
                    >
                      {opt.icon}
                    </span>
                    <span className="text-[10px]"
                      style={{ color: active ? '#e0e0e0' : '#8892b0' }}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Start Button */}
          <GlowButton
            onClick={handleStartTest}
            variant="accent"
            size="lg"
            pulse
            className="w-full"
          >
            开始测试
          </GlowButton>
        </div>
      </div>
    );
  }

  // ── TESTING ───────────────────────────────────────────
  if (currentStep === 'testing') {
    return (
      <>
        {testPhase === 'static' && (
          <StaticClickTest
            onComplete={handleStaticComplete}
            gameType={userSettings.gameType}
          />
        )}
        {testPhase === 'tracking' && (
          <TrackingTest
            onComplete={handleTrackingComplete}
            gameType={userSettings.gameType}
          />
        )}
      </>
    );
  }

  // ── RESULT ────────────────────────────────────────────
  if (currentStep === 'result' && staticResults && trackingResults) {
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10">
          <ResultPanel
            staticResults={staticResults}
            trackingResults={trackingResults}
            userSettings={{ ...userSettings, edpi }}
            onRestart={handleRestart}
          />
        </div>
      </div>
    );
  }

  return null;
}

export default App;
