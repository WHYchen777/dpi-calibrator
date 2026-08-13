import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  Crosshair,
  Target,
  Rocket,
  Zap,
  Gamepad2,
  Activity,
  MousePointer2,
} from 'lucide-react';
import type {
  UserSettings,
  ClickResult,
  TrackingResultData,
  FlickResultData,
  SmoothResultData,
} from './types/calibration';
import StaticClickTest from './components/StaticClickTest';
import TrackingTest from './components/TrackingTest';
import FlickTest from './components/FlickTest';
import SmoothTrackingTest from './components/SmoothTrackingTest';
import ResultPanel from './components/ResultPanel';
import AnimatedBackground from './components/AnimatedBackground';
import GlowButton from './components/GlowButton';
import GlassCard from './components/GlassCard';
import CrosshairSettings from './components/CrosshairSettings';
import DecimalInput from './components/DecimalInput';
import CountUpNumber from './components/CountUpNumber';

type Step = 'home' | 'testing' | 'result';
type TestPhase = 'static' | 'tracking' | 'flick' | 'smooth';

const GAME_OPTIONS: { value: UserSettings['gameType']; label: string; icon: ReactNode }[] = [
  { value: 'valorant', label: 'Valorant', icon: <Target size={16} /> },
  { value: 'csgo', label: 'CS2', icon: <Crosshair size={16} /> },
  { value: 'apex', label: 'Apex', icon: <Rocket size={16} /> },
  { value: 'overwatch', label: 'Overwatch', icon: <Zap size={16} /> },
  { value: 'other', label: '其他', icon: <Gamepad2 size={16} /> },
];

const TEST_STEPS: { key: TestPhase; label: string; desc: string; icon: ReactNode }[] = [
  { key: 'static', label: '静态精度', desc: '定位 + 反应', icon: <Crosshair size={14} /> },
  { key: 'tracking', label: '动态跟枪', desc: '追踪能力', icon: <Target size={14} /> },
  { key: 'flick', label: '甩枪瞬狙', desc: '快速瞄准', icon: <Rocket size={14} /> },
  { key: 'smooth', label: '平滑跟枪', desc: '稳定操控', icon: <Activity size={14} /> },
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

function SectionHeader({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs uppercase tracking-[0.2em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          {title}
        </span>
      </div>
      {hint && <span className="text-[10px] text-[#8b93a7]/60 font-mono">{hint}</span>}
    </div>
  );
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
  const [flickResults, setFlickResults] = useState<FlickResultData | null>(null);
  const [smoothResults, setSmoothResults] = useState<SmoothResultData | null>(null);

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
    setTestPhase('flick');
  };

  const handleFlickComplete = (results: FlickResultData) => {
    setFlickResults(results);
    setTestPhase('smooth');
  };

  const handleSmoothComplete = (results: SmoothResultData) => {
    setSmoothResults(results);
    setCurrentStep('result');
  };

  const handleRestart = () => {
    setStaticResults(null);
    setTrackingResults(null);
    setFlickResults(null);
    setSmoothResults(null);
    setTestPhase('static');
    setCurrentStep('home');
  };

  // ── HOME ──────────────────────────────────────────────
  if (currentStep === 'home') {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden py-12">
        <AnimatedBackground />

        <div className="relative z-10 w-full max-w-xl mx-auto px-5">
          {/* Header */}
          <header className="text-center mb-9 animate-fade-slide">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-6 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_10px_#00ff88] animate-pulse" />
              <span className="text-[10px] tracking-[0.35em] text-[#8b93a7]" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                EDPI · LAB
              </span>
            </div>
            <h1
              className="text-4xl sm:text-6xl font-black tracking-[0.14em] mb-4 gradient-text"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              DPI CALIBRATOR
            </h1>
            <div className="flex items-center gap-2 justify-center mb-4">
              <div className="h-px w-14 bg-gradient-to-r from-transparent to-[#00ff8850]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_10px_#00ff88]" />
              <div className="h-px w-14 bg-gradient-to-l from-transparent to-[#00ff8850]" />
            </div>
            <p className="text-base text-[#8b93a7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span>{subtitle}</span>
              <span className="animate-pulse text-[#00ff88]">|</span>
            </p>
          </header>

          {/* 设备参数 */}
          <GlassCard className="p-6 sm:p-7 mb-5 animate-fade-slide" style={{ animationDelay: '60ms' }}>
            <SectionHeader icon={<MousePointer2 size={14} className="text-[#00ff88]" />} title="设备参数" hint="DPI × 灵敏度 = eDPI" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">鼠标 DPI</label>
                <div className="relative">
                  <DecimalInput
                    value={userSettings.mouseDPI}
                    onValueChange={(v) => setUserSettings((prev) => ({ ...prev, mouseDPI: v }))}
                    className="input-cyber pr-14"
                    min={100}
                    max={32000}
                    ariaLabel="鼠标 DPI"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#8b93a7] font-mono pointer-events-none">
                    DPI
                  </span>
                </div>
              </div>
              <div>
                <label className="field-label">游戏内灵敏度</label>
                <div className="relative">
                  <DecimalInput
                    value={userSettings.gameSensitivity}
                    onValueChange={(v) => setUserSettings((prev) => ({ ...prev, gameSensitivity: v }))}
                    className="input-cyber pr-14"
                    min={0.01}
                    max={100}
                    ariaLabel="游戏内灵敏度"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#8b93a7] font-mono pointer-events-none">
                    SENS
                  </span>
                </div>
              </div>
            </div>

            {/* eDPI 显示 */}
            <div className="edpi-panel">
              <div className="relative z-10 flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#00ff88]/90" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    eDPI
                  </span>
                  <span className="text-[11px] text-[#8b93a7] font-mono mt-1">
                    {userSettings.mouseDPI || 0} × {userSettings.gameSensitivity || 0} =
                  </span>
                </div>
                <CountUpNumber value={edpi} className="text-3xl font-bold text-glow-accent ml-auto" />
              </div>
            </div>
          </GlassCard>

          {/* 准星设置 */}
          <CrosshairSettings />

          {/* 游戏类型 */}
          <GlassCard className="p-6 sm:p-7 mb-5 animate-fade-slide" style={{ animationDelay: '120ms' }}>
            <SectionHeader icon={<Gamepad2 size={14} className="text-[#a78bfa]" />} title="游戏类型" hint="影响目标分布与移动模式" />
            <div className="grid grid-cols-5 gap-2">
              {GAME_OPTIONS.map((opt) => {
                const active = userSettings.gameType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setUserSettings((prev) => ({
                        ...prev,
                        gameType: opt.value,
                        gameName: opt.value === 'other' ? prev.gameName : '',
                      }))
                    }
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200 cursor-pointer"
                    style={{
                      background: active
                        ? 'linear-gradient(160deg, rgba(0,255,136,0.14), rgba(34,211,238,0.06))'
                        : 'rgba(255,255,255,0.03)',
                      border: active ? '1px solid rgba(0,255,136,0.45)' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: active ? '0 0 16px rgba(0,255,136,0.15)' : undefined,
                    }}
                  >
                    <span className={active ? 'text-[#00ff88]' : 'text-[#8b93a7]'}>{opt.icon}</span>
                    <span className="text-[10px]" style={{ color: active ? '#e8ecf4' : '#8b93a7' }}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* 测试流程 */}
          <GlassCard className="p-6 sm:p-7 mb-8 animate-fade-slide" style={{ animationDelay: '180ms' }}>
            <SectionHeader icon={<Activity size={14} className="text-[#22d3ee]" />} title="测试流程" hint="4 项科学指标" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TEST_STEPS.map((s, i) => (
                <div key={s.key} className="protocol-step">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[#00ff88]">{s.icon}</span>
                    <span className="text-[9px] font-mono text-[#8b93a7]/60">0{i + 1}</span>
                  </div>
                  <p className="text-[11px] font-bold text-[#e8ecf4]">{s.label}</p>
                  <p className="text-[10px] text-[#8b93a7]">{s.desc}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* 开始按钮 */}
          <GlowButton onClick={handleStartTest} variant="accent" size="lg" pulse className="w-full animate-fade-slide" style={{ animationDelay: '240ms' }}>
            开始校准测试
          </GlowButton>
          <p className="text-center text-[11px] text-[#8b93a7]/60 mt-4 font-mono animate-fade-slide" style={{ animationDelay: '300ms' }}>
            建议使用桌面浏览器 · 保持鼠标 1:1 直线移动
          </p>
        </div>
      </div>
    );
  }

  // ── TESTING ───────────────────────────────────────────
  if (currentStep === 'testing') {
    return (
      <>
        {testPhase === 'static' && (
          <StaticClickTest onComplete={handleStaticComplete} gameType={userSettings.gameType} />
        )}
        {testPhase === 'tracking' && (
          <TrackingTest onComplete={handleTrackingComplete} gameType={userSettings.gameType} />
        )}
        {testPhase === 'flick' && (
          <FlickTest onComplete={handleFlickComplete} gameType={userSettings.gameType} />
        )}
        {testPhase === 'smooth' && (
          <SmoothTrackingTest onComplete={handleSmoothComplete} gameType={userSettings.gameType} />
        )}
      </>
    );
  }

  // ── RESULT ────────────────────────────────────────────
  if (currentStep === 'result' && staticResults && trackingResults && flickResults && smoothResults) {
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10">
          <ResultPanel
            staticResults={staticResults}
            trackingResults={trackingResults}
            flickResults={flickResults}
            smoothResults={smoothResults}
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
