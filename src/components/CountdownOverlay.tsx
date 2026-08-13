import { useState, useEffect, useRef } from 'react';
import { playCountdownTick, playCountdownGo } from '../utils/soundEngine';

interface CountdownOverlayProps {
  seconds?: number;
  title?: string;
  onFinish: () => void;
}

export default function CountdownOverlay({ seconds = 3, title, onFinish }: CountdownOverlayProps) {
  const [display, setDisplay] = useState(seconds);
  const [phase, setPhase] = useState<'count' | 'go' | 'done'>('count');
  const [animKey, setAnimKey] = useState(0);

  // Use refs to avoid closure traps — all state reads go through refs
  const currentRef = useRef(seconds);
  const phaseRef = useRef<'count' | 'go' | 'done'>('count');
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    if (seconds <= 0) {
      setPhase('done');
      onFinishRef.current();
      return;
    }

    // Initialize
    currentRef.current = seconds;
    setDisplay(seconds);
    setPhase('count');
    phaseRef.current = 'count';
    playCountdownTick();

    const tick = () => {
      if (phaseRef.current === 'done') return;

      currentRef.current -= 1;
      const val = currentRef.current;

      if (val <= 0) {
        // Show GO
        phaseRef.current = 'go';
        setPhase('go');
        setAnimKey((k) => k + 1);
        playCountdownGo();

        // Done after 0.8s
        timeoutRef.current = setTimeout(() => {
          phaseRef.current = 'done';
          setPhase('done');
          onFinishRef.current();
        }, 800);
      } else {
        // Show next number
        setDisplay(val);
        setAnimKey((k) => k + 1);
        playCountdownTick();

        // Schedule next tick
        timeoutRef.current = setTimeout(tick, 900);
      }
    };

    // First tick after 900ms
    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    timeoutRef.current = setTimeout(tick, 900);

    return () => {
      phaseRef.current = 'done';
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [seconds]);

  if (phase === 'done') return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
      style={{ backgroundColor: 'rgba(6,7,12,0.72)', backdropFilter: 'blur(6px)' }}
    >
      <div className="flex flex-col items-center">
        {title && (
          <p
            className="mb-6 text-sm tracking-[0.4em] uppercase text-[#8b93a7]"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {title}
          </p>
        )}
        <span
          key={animKey}
          className="font-black text-glow-accent animate-[countdownPop_0.8s_ease-out]"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: phase === 'go' ? '7rem' : '10rem',
            color: phase === 'go' ? '#00ff88' : undefined,
            textShadow: phase === 'go'
              ? '0 0 40px #00ff88, 0 0 80px #00ff8860, 0 0 120px #00ff8830'
              : undefined,
          }}
        >
          {phase === 'go' ? 'GO!' : display}
        </span>
      </div>
    </div>
  );
}
