import { describe, expect, it } from "vitest";
import { addTracks, clearTracks, listTracks, trackTitle } from "../lib/music";

describe("nome da faixa", () => {
  it("tira a extensão e o caminho do arquivo", () => {
    expect(trackTitle("House Mix.mp3")).toBe("House Mix");
    expect(trackTitle("C:\\Musicas\\Treino 2026.m4a")).toBe("Treino 2026");
    expect(trackTitle("a.b.flac")).toBe("a.b");
  });

  it("mantém o nome quando não há extensão", () => {
    expect(trackTitle("playlist")).toBe("playlist");
  });
});

describe("músicas guardadas no aparelho sem IndexedDB", () => {
  it("devolve lista vazia em vez de quebrar (navegação privada, jsdom)", async () => {
    await expect(listTracks()).resolves.toEqual([]);
  });

  it("ignora arquivos que não são áudio e não quebra ao limpar", async () => {
    const pdf = new File(["x"], "treino.pdf", { type: "application/pdf" });
    await expect(addTracks([pdf])).resolves.toEqual([]);
    await expect(clearTracks()).resolves.toBeUndefined();
  });
});
