import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, LIMITS, loadSettings, saveSettings, type Settings } from "../lib/settings";

const KEY = "pulso.settings.v1";

describe("configurações salvas no aparelho", () => {
  afterEach(() => localStorage.clear());

  it("abre no padrão quando não há nada salvo", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("guarda e recupera o que foi ajustado", () => {
    const custom: Settings = { workSeconds: 45, restSeconds: 20, rounds: 6, playlistUrl: "https://open.spotify.com/playlist/abc" };
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
  });

  it("não quebra com conteúdo corrompido", () => {
    localStorage.setItem(KEY, "{isso não é json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("traz números fora da faixa de volta para o limite", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ workSeconds: 9999, restSeconds: -50, rounds: 0, playlistUrl: 42 }),
    );
    const loaded = loadSettings();
    expect(loaded.workSeconds).toBe(LIMITS.work.max);
    expect(loaded.restSeconds).toBe(LIMITS.rest.min);
    expect(loaded.rounds).toBe(LIMITS.rounds.min);
    expect(loaded.playlistUrl).toBe("");
  });

  it("preenche campos faltantes com o padrão", () => {
    localStorage.setItem(KEY, JSON.stringify({ rounds: 4 }));
    const loaded = loadSettings();
    expect(loaded.rounds).toBe(4);
    expect(loaded.workSeconds).toBe(DEFAULT_SETTINGS.workSeconds);
    expect(loaded.playlistUrl).toBe(DEFAULT_SETTINGS.playlistUrl);
  });
});
