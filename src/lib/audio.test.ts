import { describe, expect, it } from "vitest";
import { beep, cueFor, fanfare, haptic, playCue, tickTock } from "../lib/audio";

describe("sinal sonoro de cada troca de fase", () => {
  it("usa a trombeta para começar (e recomeçar) o exercício", () => {
    expect(cueFor("work")).toBe("trumpet");
  });

  it("usa o tic-tac de cronômetro na pausa", () => {
    expect(cueFor("rest")).toBe("tick-tock");
  });

  it("usa a trombeta no fim do preparo", () => {
    expect(cueFor("prepare")).toBe("trumpet");
  });
});

describe("reprodução sem Web Audio", () => {
  it("não quebra quando o navegador não tem AudioContext (jsdom, navegador antigo)", () => {
    expect(() => {
      playCue("trumpet");
      playCue("tick-tock");
      beep();
      fanfare();
      tickTock();
      haptic();
      haptic([100, 50, 100]);
    }).not.toThrow();
  });
});
