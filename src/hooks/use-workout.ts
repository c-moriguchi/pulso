import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { beep, gong, unlockAudio } from "../lib/audio";
import {
  buildPlan,
  formatClock,
  formatDuration,
  locate,
  remainingSeconds,
  segmentKey,
  type Plan,
  type Position,
} from "../lib/workout";

export type WorkoutStatus = "idle" | "running" | "paused" | "finished";

interface UseWorkoutOptions {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
}

export interface Workout {
  status: WorkoutStatus;
  plan: Plan;
  position: Position;
  /** Relógio pronto para exibir: "00:20" (ou "3" no preparo). */
  clock: string;
  /** Duração total do treino, formatada. */
  total: string;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const TICK_MS = 200;

/**
 * Relógio do treino baseado em timestamps, não em contagem regressiva.
 *
 * Guardar apenas "quando começou" (com o tempo pausado descontado) faz o timer
 * continuar certo mesmo se o navegador atrasar ou congelar os ticks: ao voltar,
 * a posição é recalculada do zero a partir do relógio do sistema.
 */
export function useWorkout({ workSeconds, restSeconds, rounds }: UseWorkoutOptions): Workout {
  const plan = useMemo(
    () => buildPlan({ workSeconds, restSeconds, rounds }),
    [workSeconds, restSeconds, rounds],
  );

  const [status, setStatus] = useState<WorkoutStatus>("idle");
  const [now, setNow] = useState(() => Date.now());

  // Instante virtual de partida e tempo acumulado em pausa (em ms).
  const startedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);

  const elapsed = useMemo(() => {
    if (startedAt.current === null) return 0;
    const pauseSoFar = pausedTotal.current + (pausedAt.current === null ? 0 : now - pausedAt.current);
    return Math.max(0, now - startedAt.current - pauseSoFar);
  }, [now]);

  const position = useMemo(() => locate(plan, elapsed), [plan, elapsed]);

  const tick = useCallback(() => setNow(Date.now()), []);

  // Ticks só enquanto corre; ao voltar de segundo plano o cálculo é refeito na hora.
  useEffect(() => {
    if (status !== "running") return;
    tick();
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, tick]);

  // Fim do treino.
  useEffect(() => {
    if (status !== "running") return;
    if (position.finished) {
      setStatus("finished");
      gong();
    }
  }, [status, position.finished]);

  // Sons de fase: gongo na troca, bipe nos últimos 3 segundos.
  const lastSegment = useRef<string | null>(null);
  const lastBeepedSecond = useRef<number | null>(null);

  useEffect(() => {
    if (status === "idle" || status === "finished") {
      lastSegment.current = null;
      lastBeepedSecond.current = null;
      return;
    }
    const key = segmentKey(position.segment);
    if (lastSegment.current !== null && lastSegment.current !== key) {
      gong();
      lastBeepedSecond.current = null;
    }
    lastSegment.current = key;

    if (status !== "running" || position.finished) return;
    const secondsLeft = remainingSeconds(position.remaining);
    if (secondsLeft > 0 && secondsLeft <= 3 && lastBeepedSecond.current !== secondsLeft) {
      lastBeepedSecond.current = secondsLeft;
      beep();
    }
  }, [status, position]);

  const start = useCallback(() => {
    unlockAudio();
    startedAt.current = Date.now();
    pausedTotal.current = 0;
    pausedAt.current = null;
    lastSegment.current = null;
    lastBeepedSecond.current = null;
    setNow(Date.now());
    setStatus("running");
  }, []);

  const pause = useCallback(() => {
    if (status !== "running") return;
    pausedAt.current = Date.now();
    setStatus("paused");
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused" || pausedAt.current === null) return;
    pausedTotal.current += Date.now() - pausedAt.current;
    pausedAt.current = null;
    setNow(Date.now());
    setStatus("running");
  }, [status]);

  const stop = useCallback(() => {
    startedAt.current = null;
    pausedTotal.current = 0;
    pausedAt.current = null;
    lastSegment.current = null;
    lastBeepedSecond.current = null;
    setStatus("idle");
  }, []);

  const clock =
    status === "idle"
      ? formatDuration(plan.duration)
      : position.segment.kind === "prepare" && !position.finished
        ? String(remainingSeconds(position.remaining))
        : formatClock(position.remaining);

  return {
    status,
    plan,
    position,
    clock,
    total: formatDuration(plan.duration),
    start,
    pause,
    resume,
    stop,
  };
}

/**
 * Mantém a tela ligada durante o treino (Wake Lock API).
 * O bloqueio é liberado pelo navegador ao sair da página, então re-solicitamos
 * quando ela volta a ficar visível. Sem suporte, o treino segue normalmente.
 */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    const wakeLock = nav.wakeLock;
    if (!wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const lock = await wakeLock.request("screen");
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Negado (bateria fraca, política do navegador): não é erro fatal.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
