/**
 * Motor do treino intervalado: funções puras, sem relógio, sem DOM.
 *
 * O plano é uma lista de segmentos com posição absoluta em ms. A posição atual
 * é sempre derivada de "quanto tempo passou desde o início", nunca de um
 * contador que vai subtraindo 1 a cada tick — é isso que mantém o timer certo
 * quando o navegador estrangula os timers (aba em segundo plano, tela apagada).
 */

export type SegmentKind = "prepare" | "work" | "rest";

export interface Segment {
  kind: SegmentKind;
  /** Rodada (1-based) a que este segmento pertence. */
  round: number;
  /** Início absoluto, em ms, contado da partida. */
  start: number;
  /** Duração em ms. */
  duration: number;
}

export interface Plan {
  segments: Segment[];
  /** Duração total em ms. */
  duration: number;
  rounds: number;
}

export interface Position {
  finished: boolean;
  segment: Segment;
  /** ms restantes no segmento atual. */
  remaining: number;
  round: number;
  /** 0..1 do segmento atual, para o anel de progresso. */
  progress: number;
  /** ms decorridos desde a partida. */
  elapsed: number;
}

export const PREPARE_SECONDS = 3;

export interface PlanInput {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  prepareSeconds?: number;
}

export function buildPlan({
  workSeconds,
  restSeconds,
  rounds,
  prepareSeconds = PREPARE_SECONDS,
}: PlanInput): Plan {
  const work = Math.max(0, workSeconds) * 1000;
  const rest = Math.max(0, restSeconds) * 1000;
  const total = Math.max(1, Math.floor(rounds));
  const prepare = Math.max(0, prepareSeconds) * 1000;
  const segments: Segment[] = [];
  let cursor = 0;

  if (prepare > 0) {
    segments.push({ kind: "prepare", round: 1, start: cursor, duration: prepare });
    cursor += prepare;
  }

  for (let round = 1; round <= total; round++) {
    segments.push({ kind: "work", round, start: cursor, duration: work });
    cursor += work;
    // A última rodada termina no fim do exercício: sem pausa sobrando.
    if (rest > 0 && round < total) {
      segments.push({ kind: "rest", round, start: cursor, duration: rest });
      cursor += rest;
    }
  }

  return { segments, duration: cursor, rounds: total };
}

export function locate(plan: Plan, elapsedMs: number): Position {
  const first = plan.segments[0];
  if (!first) throw new Error("Plano vazio: buildPlan sempre gera ao menos um segmento.");

  const elapsed = Math.min(Math.max(0, elapsedMs), plan.duration);
  const last = plan.segments[plan.segments.length - 1] ?? first;

  if (elapsed >= plan.duration) {
    return {
      finished: true,
      segment: last,
      remaining: 0,
      round: plan.rounds,
      progress: 1,
      elapsed: plan.duration,
    };
  }

  let segment = first;
  for (const candidate of plan.segments) {
    if (elapsed >= candidate.start) segment = candidate;
    else break;
  }

  const remaining = segment.start + segment.duration - elapsed;
  return {
    finished: false,
    segment,
    remaining,
    round: segment.round,
    progress: segment.duration === 0 ? 1 : 1 - remaining / segment.duration,
    elapsed,
  };
}

/** Segundos cheios restantes, arredondando para cima (mostra 30 até faltar 29,1). */
export function remainingSeconds(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000 - 1e-6));
}

/** "05:30" a partir de ms restantes. */
export function formatClock(remainingMs: number): string {
  const totalSeconds = remainingSeconds(remainingMs);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Duração total formatada, para o resumo da tela inicial. */
export function formatDuration(ms: number): string {
  return formatClock(ms);
}

/** Identifica um segmento de forma estável, para detectar troca de fase. */
export function segmentKey(segment: Segment): string {
  return `${segment.kind}-${segment.round}-${segment.start}`;
}
