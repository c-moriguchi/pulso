import { describe, expect, it } from "vitest";
import {
  buildPlan,
  formatClock,
  locate,
  remainingSeconds,
  segmentKey,
} from "../lib/workout";

const TABATA = { workSeconds: 20, restSeconds: 10, rounds: 8 };

describe("buildPlan", () => {
  it("monta preparo + 8 exercícios + 7 pausas no Tabata", () => {
    const plan = buildPlan(TABATA);
    expect(plan.segments).toHaveLength(1 + 8 + 7);
    expect(plan.segments[0]).toMatchObject({ kind: "prepare", duration: 3000, start: 0 });
    expect(plan.duration).toBe(3000 + 20_000 * 8 + 10_000 * 7);
  });

  it("não coloca pausa depois da última rodada", () => {
    const plan = buildPlan(TABATA);
    expect(plan.segments.at(-1)).toMatchObject({ kind: "work", round: 8 });
  });

  it("encadeia rodadas sem pausa quando a pausa é zero", () => {
    const plan = buildPlan({ workSeconds: 10, restSeconds: 0, rounds: 3 });
    expect(plan.segments.map((s) => s.kind)).toEqual(["prepare", "work", "work", "work"]);
    expect(plan.segments.map((s) => s.round)).toEqual([1, 1, 2, 3]);
    expect(plan.duration).toBe(3000 + 30_000);
  });

  it("soma a duração de cada segmento até o total", () => {
    const plan = buildPlan({ workSeconds: 45, restSeconds: 15, rounds: 5 });
    const soma = plan.segments.reduce((acc, s) => acc + s.duration, 0);
    expect(soma).toBe(plan.duration);
    expect(plan.duration).toBe(3000 + 45_000 * 5 + 15_000 * 4);
  });
});

describe("locate", () => {
  const plan = buildPlan(TABATA);

  it("começa no preparo com 3s restantes", () => {
    const pos = locate(plan, 0);
    expect(pos.segment.kind).toBe("prepare");
    expect(pos.remaining).toBe(3000);
    expect(pos.finished).toBe(false);
  });

  it("vira exercício exatamente no fim do preparo", () => {
    const pos = locate(plan, 3000);
    expect(pos.segment).toMatchObject({ kind: "work", round: 1 });
    expect(pos.remaining).toBe(20_000);
  });

  it("vira pausa no fim do exercício e já aponta para a próxima rodada", () => {
    const pos = locate(plan, 23_000);
    expect(pos.segment).toMatchObject({ kind: "rest", round: 1 });
    expect(pos.remaining).toBe(10_000);
  });

  it("termina exatamente na duração total", () => {
    const pos = locate(plan, plan.duration);
    expect(pos.finished).toBe(true);
    expect(pos.remaining).toBe(0);
    expect(pos.round).toBe(8);
  });

  it("não passa do fim quando o tempo decorrido excede o plano", () => {
    const pos = locate(plan, plan.duration + 60_000);
    expect(pos.finished).toBe(true);
    expect(pos.elapsed).toBe(plan.duration);
  });

  it("não atravessa segmentos quando o navegador atrasa os ticks", () => {
    // Um único salto de 55s (aba em segundo plano) tem de cair na fase certa.
    const pos = locate(plan, 3000 + 20_000 + 10_000 + 5_000);
    expect(pos.segment).toMatchObject({ kind: "work", round: 2 });
    expect(pos.remaining).toBe(15_000);
  });

  it("progresso vai de 0 a 1 dentro do segmento", () => {
    const plan2 = buildPlan({ workSeconds: 10, restSeconds: 0, rounds: 1, prepareSeconds: 0 });
    expect(locate(plan2, 0).progress).toBe(0);
    expect(locate(plan2, 5000).progress).toBeCloseTo(0.5, 5);
    expect(locate(plan2, 9999).progress).toBeGreaterThan(0.99);
  });
});

describe("formatação", () => {
  it("arredonda segundos para cima", () => {
    expect(remainingSeconds(20_000)).toBe(20);
    expect(remainingSeconds(19_999)).toBe(20);
    expect(remainingSeconds(1)).toBe(1);
    expect(remainingSeconds(0)).toBe(0);
  });

  it("mostra mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(65_000)).toBe("01:05");
    expect(formatClock(TABATA.workSeconds * 1000)).toBe("00:20");
  });

  it("gera chave estável por segmento", () => {
    const plan = buildPlan(TABATA);
    const [, firstWork, firstRest] = plan.segments;
    if (!firstWork || !firstRest) throw new Error("plano inesperado");
    expect(segmentKey(firstWork)).toBe(segmentKey(firstWork));
    expect(segmentKey(firstWork)).not.toBe(segmentKey(firstRest));
  });
});
