/**
 * Playlist do Spotify: só o endereço, sem player embutido.
 *
 * O player do Spotify dentro da página não é confiável: para quem não está logado
 * no navegador ele toca apenas 30 s de prévia ("Preview") e, em app instalado no
 * celular, costuma não tocar nada. A música fica no app do Spotify — o Pulso manda
 * os sons por cima, que é o que ele faz bem.
 */

export type SpotifyKind = "playlist" | "album" | "track";

export interface SpotifyTarget {
  kind: SpotifyKind;
  id: string;
  /** Endereço limpo, sem parâmetros de rastreio. */
  webUrl: string;
}

const LINK = /open\.spotify\.com\/(?:intl-[\w-]+\/)?(playlist|album|track)\/([A-Za-z0-9]+)/;

export function parseSpotifyLink(url: string): SpotifyTarget | null {
  const match = url.trim().match(LINK);
  const kind = match?.[1] as SpotifyKind | undefined;
  const id = match?.[2];
  if (!kind || !id) return null;
  return { kind, id, webUrl: `https://open.spotify.com/${kind}/${id}` };
}

/** Qualquer link do Spotify serve para abrir (inclusive encurtados, que redirecionam). */
export function looksLikeSpotify(url: string): boolean {
  return /(?:open\.)?spotify\.(?:com|link)/i.test(url.trim());
}
