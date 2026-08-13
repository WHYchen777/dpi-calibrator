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

const TEST_OPTIONS: { key: TestPhase; label: string; desc: string; icon: ReactNode; accent: string }[] = [
  { key: 'static', label: '静态精度', desc: '定位 + 反应', icon: <Crosshair size={16} />, accent: '#00ff88' },
  { key: 'tracking', label: '动态跟枪', desc: '追踪能力', icon: <Target size={16} />, accent: '#ff4d4d' },
  { key: 'flick', label: '甩枪瞬狙', desc: '反应 + 微调', icon: <Rocket size={16} />, accent: '#22d3ee' },
  { key: 'smooth', label: '平滑跟枪', desc: '稳定操控', icon: <Activity size={16} />, accent: '#a78bfa' },
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

interface ResultsState {
  static: ClickResult[] | null;
  tracking: TrackingResultData | null;
  flick: FlickResultData | null;
  smooth: SmoothResultData | null;
}

const EMPTY_RESULTS: ResultsState = { static: null, tracking: null, flick: null, smooth: null };
const ALL_TESTS: TestPhase[] = ['static', 'tracking', 'flick', 'smooth'];

function App() {
  const [currentStep, setCurrentStep] = useState<Step>('home');
  const [testQueue, setTestQueue] = useState<TestPhase[]>(ALL_TESTS);
  const [selectedTests, setSelectedTests] = useState<TestPhase[]>(ALL_TESTS);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    mouseDPI: 800,
    gameSensitivity: 1,
    edpi: 800,
    gameType: 'valorant',
    gameName: '',
  });
  const [staticTargetCount, setStaticTargetCount] = useState(15);
  const [results, setResults] = useState<ResultsState>(EMPTY_RESULTS);

  const edpi = useMemo(
    () => Math.round(userSettings.mouseDPI * userSettings.gameSensitivity * 10) / 10,
    [userSettings.mouseDPI, userSettings.gameSensitivity],
  );

  const { text: subtitle } = useTypewriter('校准你的战斗手感', 80);

  const toggleTest = (key: TestPhase) => {
    setSelectedTests((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  };

  const handleStartTest = () => {
    if (selectedTests.length === 0) return;
    setResults(EMPTY_RESULTS);
    setTestQueue(selectedTests);
    setCurrentStep('testing');
  };

  const handleTestComplete = (
    key: TestPhase,
    data: ClickResult[] | TrackingResultData | FlickResultData | SmoothResultData,
  ) => {
    setResults((prev) => ({ ...prev, [key]: data }));
    const remaining = testQueue.filter((t) => t !== key);
    if (remaining.length === 0) {
      setCurrentStep('result');
    } else {
      setTestQueue(remaining);
    }
  };

  const handleRestart = () => {
    setResults(EMPTY_RESULTS);
    setTestQueue(selectedTests);
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

          {/* 测试选择 */}
          <GlassCard className="p-6 sm:p-7 mb-8 animate-fade-slide" style={{ animationDelay: '180ms' }}>
            <SectionHeader icon={<Activity size={14} className="text-[#22d3ee]" />} title="选择测试" hint="可多选 · 按顺序进行" />

            <div className="grid grid-cols-2 gap-2">
              {TEST_OPTIONS.map((opt) => {
                const active = selectedTests.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggleTest(opt.key)}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 cursor-pointer text-left"
                    style={{
                      background: active
                        ? 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))'
                        : 'rgba(255,255,255,0.02)',
                      border: active ? `1px solid ${opt.accent}66` : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: active ? `0 0 18px ${opt.accent}1a` : undefined,
                      opacity: active ? 1 : 0.45,
                    }}
                    aria-pressed={active}
                  >
                    <span style={{ color: active ? opt.accent : '#8b93a7' }}>{opt.icon}</span>
                    <span className="flex-1">
                      <span className="block text-[12px] font-bold" style={{ color: active ? '#e8ecf4' : '#8b93a7' }}>
                        {opt.label}
                      </span>
                      <span className="block text-[10px] text-[#8b93a7]/70">{opt.desc}</span>
                    </span>
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        border: active ? `1px solid ${opt.accent}` : '1px solid rgba(255,255,255,0.2)',
                        color: active ? opt.accent : '#8b93a7',
                      }}
                    >
                      {active ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[#8b93a7]/60 mt-2.5 font-mono">
              当前选择 {selectedTests.length}/4 项{selectedTests.length === 0 ? '，请至少选择一项' : ''}
            </p>

            {/* 固定靶数量设置 */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8b93a7]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>固定靶目标数</span>
                <span className="text-lg font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#00ff88' }}>{staticTargetCount}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStaticTargetCount((v) => Math.max(5, v - 5))}
                  className="w-9 h-9 rounded-lg text-sm font-bold transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', color: '#8b93a7' }}
                  aria-label="减少目标数"
                >−5</button>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={staticTargetCount}
                  onChange={(e) => setStaticTargetCount(Number(e.target.value))}
                  className="flex-1 accent-[#00ff88] cursor-pointer"
                  aria-label="固定靶目标数"
                />
                <button
                  onClick={() => setStaticTargetCount((v) => Math.min(30, v + 5))}
                  className="w-9 h-9 rounded-lg text-sm font-bold transition-all cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', color: '#8b93a7' }}
                  aria-label="增加目标数"
                >+5</button>
              </div>
              <p className="text-[10px] text-[#8b93a7]/60 mt-2 font-mono">固定靶数量 5-30，决定测试时长与采样精度</p>
            </div>
          </GlassCard>

          {/* 开始按钮 */}
          <GlowButton
            onClick={handleStartTest}
            variant="accent"
            size="lg"
            pulse
            disabled={selectedTests.length === 0}
            className="w-full animate-fade-slide"
            style={{ animationDelay: '240ms' }}
          >
            开始校准测试{selectedTests.length > 0 ? `（${selectedTests.length} 项）` : ''}
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
    const phase = testQueue[0];
    return (
      <>
        {phase === 'static' && (
          <StaticClickTest
            onComplete={(r) => handleTestComplete('static', r)}
            gameType={userSettings.gameType}
            targetCount={staticTargetCount}
          />
        )}
        {phase === 'tracking' && (
          <TrackingTest
            onComplete={(r) => handleTestComplete('tracking', r)}
            gameType={userSettings.gameType}
          />
        )}
        {phase === 'flick' && (
          <FlickTest
            onComplete={(r) => handleTestComplete('flick', r)}
            gameType={userSettings.gameType}
          />
        )}
        {phase === 'smooth' && (
          <SmoothTrackingTest
            onComplete={(r) => handleTestComplete('smooth', r)}
            gameType={userSettings.gameType}
          />
        )}
      </>
    );
  }

  // ── RESULT ────────────────────────────────────────────
  if (currentStep === 'result') {
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <div className="relative z-10">
          <ResultPanel
            staticResults={results.static}
            trackingResults={results.tracking}
            flickResults={results.flick}
            smoothResults={results.smooth}
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