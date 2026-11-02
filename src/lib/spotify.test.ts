import { describe, expect, it } from "vitest";
import { looksLikeSpotify, parseSpotifyLink } from "../lib/spotify";

describe("link da playlist do Spotify", () => {
  it("entende link de playlist com parâmetros de compartilhamento", () => {
    const alvo = parseSpotifyLink(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123&nd=1",
    );
    expect(alvo).toEqual({
      kind: "playlist",
      id: "37i9dQZF1DXcBWIGoYBM5M",
      webUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    });
  });

  it("entende link com prefixo de idioma", () => {
    expect(parseSpotifyLink("https://open.spotify.com/intl-pt/album/4aawyAB9vmqN3uQ7FjRGTy")?.kind).toBe("album");
  });

  it("entende faixa e álbum", () => {
    expect(parseSpotifyLink("https://open.spotify.com/track/7jPvXb1gPZ4mMCiTKMmzCs")?.id).toBe("7jPvXb1gPZ4mMCiTKMmzCs");
  });

  it("devolve null para o que não é link do Spotify", () => {
    expect(parseSpotifyLink("https://youtube.com/watch?v=abc")).toBeNull();
    expect(parseSpotifyLink("")).toBeNull();
  });

  it("reconhece link encurtado do Spotify, que abre e redireciona", () => {
    expect(parseSpotifyLink("https://spotify.link/abc123")).toBeNull();
    expect(looksLikeSpotify("https://spotify.link/abc123")).toBe(true);
  });

  it("não confunde outros sites com Spotify", () => {
    expect(looksLikeSpotify("https://meusite.com/spotify")).toBe(false);
  });
});
