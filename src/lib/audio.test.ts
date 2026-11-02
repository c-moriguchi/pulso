import { describe, expect, it } from "vitest";
import {
  beep,
  cueFor,
  FINISH_VOICE,
  haptic,
  playCue,
  speak,
  tickTock,
  voiceFor,
  vuvuzela,
  warmUpVoices,
} from "../lib/audio";

describe("sinal sonoro de cada troca de fase", () => {
  it("usa a vuvuzela para começar (e recomeçar) o exercício", () => {
    expect(cueFor("work")).toBe("vuvuzela");
  });

  it("usa o tic-tac de cronômetro na pausa", () => {
    expect(cueFor("rest")).toBe("tick-tock");
  });

  it("usa a vuvuzela no fim do preparo", () => {
    expect(cueFor("prepare")).toBe("vuvuzela");
  });
});

describe("voz que anuncia a fase", () => {
  it("fala 'Exercício' ao iniciar cada exercício", () => {
    expect(voiceFor("work")).toBe("Exercício");
    expect(voiceFor("prepare")).toBe("Exercício");
  });

  it("fala 'Pausa' ao entrar no descanso", () => {
    expect(voiceFor("rest")).toBe("Pausa");
  });

  it("fala 'Fim' no encerramento", () => {
    expect(FINISH_VOICE).toBe("Fim");
  });
});

describe("reprodução sem Web Audio nem voz", () => {
  it("não quebra quando o navegador não tem AudioContext nem speechSynthesis", () => {
    expect(() => {
      playCue("vuvuzela");
      playCue("tick-tock");
      beep();
      vuvuzela();
      tickTock();
      speak("Exercício");
      warmUpVoices();
      haptic();
      haptic([100, 50, 100]);
    }).not.toThrow();
  });
});
