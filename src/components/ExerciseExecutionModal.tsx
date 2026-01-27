import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Pause, Play, SkipForward, Flag } from 'lucide-react';

const PREP_SECONDS = 10;
const REST_SECONDS = 60;
const CONCENTRIC_MS = 2000;
const ECCENTRIC_MS = 3000;

export interface ExerciseForModal {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  muscleGroup?: string;
}

interface ExerciseExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: ExerciseForModal;
  currentWeight: number;
  onComplete?: (weight: number) => void;
}

type Phase = 'preparation' | 'execution' | 'rest';

export const ExerciseExecutionModal: React.FC<ExerciseExecutionModalProps> = ({
  isOpen,
  onClose,
  exercise,
  currentWeight,
  onComplete,
}) => {
  const [phase, setPhase] = useState<Phase>('preparation');
  const [prepCount, setPrepCount] = useState(PREP_SECONDS);
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(1);
  const [barProgress, setBarProgress] = useState(0);
  const [barPhase, setBarPhase] = useState<'idle' | 'up' | 'down'>('idle');
  const [restSeconds, setRestSeconds] = useState(REST_SECONDS);
  const [paused, setPaused] = useState(false);

  const prepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const animStartRef = useRef<number>(0);
  const animDurationRef = useRef<number>(0);
  const animFromRef = useRef<number>(0);
  const animToRef = useRef<number>(0);
  const pausedProgressRef = useRef<number>(0);
  const barProgressRef = useRef<number>(0);
  const currentSetRef = useRef<number>(1);
  const currentRepRef = useRef<number>(1);

  const sets = exercise.sets ?? 1;
  const reps = exercise.reps ?? 1;

  const playNotification = useCallback(() => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      /* ignore */
    }
  }, []);

  const clearPrep = useCallback(() => {
    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
      prepIntervalRef.current = null;
    }
  }, []);

  const clearRest = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  const cancelBarAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('preparation');
    setPrepCount(PREP_SECONDS);
    setCurrentSet(1);
    setCurrentRep(1);
    setBarProgress(0);
    setBarPhase('idle');
    setRestSeconds(REST_SECONDS);
    setPaused(false);
    currentSetRef.current = 1;
    currentRepRef.current = 1;
    barProgressRef.current = 0;
    return () => {
      clearPrep();
      clearRest();
      cancelBarAnimation();
    };
  }, [isOpen, clearPrep, clearRest, cancelBarAnimation]);

  useEffect(() => {
    if (!isOpen || phase !== 'preparation' || paused) return;
    if (prepCount <= 0) {
      clearPrep();
      setPhase('execution');
      setBarPhase('up');
      animStartRef.current = performance.now();
      animDurationRef.current = CONCENTRIC_MS;
      animFromRef.current = 0;
      animToRef.current = 1;
      return;
    }
    prepIntervalRef.current = setInterval(() => {
      setPrepCount((c) => {
        if (c <= 1) {
          clearPrep();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      clearPrep();
    };
  }, [isOpen, phase, prepCount, paused, clearPrep]);

  useEffect(() => {
    if (!isOpen || phase !== 'execution' || barPhase === 'idle' || paused) return;

    const tick = (now: number) => {
      const elapsed = now - animStartRef.current;
      const duration = animDurationRef.current;
      const from = animFromRef.current;
      const to = animToRef.current;
      const t = Math.min(elapsed / duration, 1);
      const value = from + (to - from) * t;
      barProgressRef.current = value;
      setBarProgress(value);

      if (t >= 1) {
        cancelBarAnimation();
        if (barPhase === 'up') {
          setBarPhase('down');
          animStartRef.current = performance.now();
          animDurationRef.current = ECCENTRIC_MS;
          animFromRef.current = 1;
          animToRef.current = 0;
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setBarPhase('idle');
          setBarProgress(0);
          barProgressRef.current = 0;
          const cr = currentRepRef.current;
          const cs = currentSetRef.current;
          if (cr >= reps) {
            if (cs >= sets) {
              playNotification();
              if (onComplete && currentWeight > 0) {
                onComplete(currentWeight);
              }
              onClose();
              return;
            }
            setPhase('rest');
            setRestSeconds(REST_SECONDS);
            currentRepRef.current = 1;
            currentSetRef.current = cs + 1;
            setCurrentRep(1);
            setCurrentSet(cs + 1);
          } else {
            currentRepRef.current = cr + 1;
            setCurrentRep(cr + 1);
            setBarPhase('up');
            animStartRef.current = performance.now();
            animDurationRef.current = CONCENTRIC_MS;
            animFromRef.current = 0;
            animToRef.current = 1;
            rafRef.current = requestAnimationFrame(tick);
          }
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return cancelBarAnimation;
  }, [
    isOpen,
    phase,
    barPhase,
    sets,
    reps,
    paused,
    currentWeight,
    onComplete,
    onClose,
    playNotification,
    cancelBarAnimation,
  ]);

  useEffect(() => {
    if (phase !== 'rest' || paused) return;
    if (restSeconds <= 0) {
      clearRest();
      playNotification();
      setPhase('execution');
      setBarPhase('up');
      animStartRef.current = performance.now();
      animDurationRef.current = CONCENTRIC_MS;
      animFromRef.current = 0;
      animToRef.current = 1;
      return;
    }
    restIntervalRef.current = setInterval(() => {
      setRestSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      clearRest();
    };
  }, [phase, restSeconds, paused, clearRest, playNotification]);

  const handlePause = () => {
    if (phase === 'preparation') {
      if (!paused) clearPrep();
      setPaused((p) => !p);
      return;
    }
    if (phase === 'rest') {
      if (!paused) clearRest();
      setPaused((p) => !p);
      return;
    }
    if (phase === 'execution') {
      setPaused((p) => {
        const next = !p;
        if (next) {
          cancelBarAnimation();
          pausedProgressRef.current = barProgressRef.current;
        } else {
          const isUp = barPhase === 'up';
          const from = pausedProgressRef.current;
          const to = isUp ? 1 : 0;
          const duration = isUp ? CONCENTRIC_MS : ECCENTRIC_MS;
          const elapsed = isUp ? from * duration : (1 - from) * duration;
          animStartRef.current = performance.now() - elapsed;
          animDurationRef.current = duration;
          animFromRef.current = from;
          animToRef.current = to;
        }
        return next;
      });
    }
  };

  const handleSkipRest = () => {
    clearRest();
    setRestSeconds(0);
  };

  const handleFinish = () => {
    clearPrep();
    clearRest();
    cancelBarAnimation();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-deep-bg text-white"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-bold text-alien-green truncate flex-1 mr-2">
          {exercise.name}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePause}
            className="p-2.5 rounded-lg bg-card-bg border border-gray-700 hover:border-alien-green hover:bg-alien-green/10 text-alien-green transition-all"
            aria-label={paused ? 'Retomar' : 'Pausar'}
          >
            {paused ? <Play size={20} /> : <Pause size={20} />}
          </button>
          {phase === 'rest' && (
            <button
              onClick={handleSkipRest}
              className="p-2.5 rounded-lg bg-card-bg border border-gray-700 hover:border-alien-green hover:bg-alien-green/10 text-alien-green transition-all flex items-center gap-1.5"
              aria-label="Pular descanso"
            >
              <SkipForward size={18} />
              <span className="text-sm">Pular</span>
            </button>
          )}
          <button
            onClick={handleFinish}
            className="p-2.5 rounded-lg bg-card-bg border border-gray-700 hover:border-alien-green hover:bg-alien-green/10 text-alien-green transition-all flex items-center gap-1.5"
            aria-label="Finalizar exercício"
          >
            <Flag size={18} />
            <span className="text-sm">Finalizar</span>
          </button>
          <button
            onClick={handleFinish}
            className="p-2 rounded-lg hover:bg-card-bg text-gray-400 hover:text-alien-green transition-colors"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        {phase === 'preparation' && (
          <div className="flex flex-col items-center">
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">
              Prepare-se
            </p>
            <div
              className={`text-8xl font-black tabular-nums transition-all duration-300 ${
                prepCount <= 3 ? 'text-alien-green drop-shadow-[0_0_30px_rgba(57,255,20,0.8)]' : 'text-white'
              }`}
            >
              {paused ? '—' : prepCount}
            </div>
          </div>
        )}

        {phase === 'execution' && (
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="text-center mb-6">
              <p className="text-gray-400 text-sm mb-1">Série {currentSet} de {sets}</p>
              <p className="text-4xl font-bold text-alien-green tabular-nums">
                {currentRep} <span className="text-gray-500 font-normal">/</span> {reps}
              </p>
            </div>
            <div className="w-20 h-64 rounded-xl bg-card-bg border border-gray-700 overflow-hidden flex flex-col justify-end">
              <div
                className={`w-full rounded-t-lg bg-gradient-to-t from-alien-green to-[#2EE010] ${
                  (barPhase === 'up' || barPhase === 'down') && !paused ? 'animate-bar-glow' : ''
                }`}
                style={{
                  height: `${barProgress * 100}%`,
                  boxShadow: '0 0 20px rgba(57,255,20,0.6), 0 0 40px rgba(57,255,20,0.3)',
                }}
              />
            </div>
            <p className="text-gray-500 text-sm mt-4">
              {barPhase === 'up' && !paused && 'Força ↑'}
              {barPhase === 'down' && !paused && 'Controlada ↓'}
              {paused && 'Pausado'}
            </p>
          </div>
        )}

        {phase === 'rest' && (
          <div className="flex flex-col items-center">
            <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">
              Descanso — próxima série em
            </p>
            <div
              className={`text-7xl font-black tabular-nums ${
                restSeconds <= 5 ? 'text-alien-green drop-shadow-[0_0_25px_rgba(57,255,20,0.7)]' : 'text-white'
              }`}
            >
              {paused ? '—' : restSeconds}s
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
