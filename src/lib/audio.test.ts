import { describe, expect, it } from "vitest";
import { beep, cueFor, gong, haptic, playCue, tickTock } from "../lib/audio";

describe("sinal sonoro de cada troca de fase", () => {
  it("usa o gongo para começar (e recomeçar) o exercício", () => {
    expect(cueFor("work")).toBe("gong");
  });

  it("usa o tic-tac de cronômetro na pausa", () => {
    expect(cueFor("rest")).toBe("tick-tock");
  });

  it("usa o gongo no fim do preparo", () => {
    expect(cueFor("prepare")).toBe("gong");
  });
});

describe("reprodução sem Web Audio", () => {
  it("não quebra quando o navegador não tem AudioContext (jsdom, navegador antigo)", () => {
    expect(() => {
      playCue("gong");
      playCue("tick-tock");
      beep();
      gong();
      tickTock();
      haptic();
      haptic([100, 50, 100]);
    }).not.toThrow();
  });
});
