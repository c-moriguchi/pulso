import { useCallback, useEffect, useRef, useState } from "react";
import { connectMusic } from "../lib/audio";
import { addTracks, clearTracks, listTracks, type Track } from "../lib/music";

export interface Music {
  tracks: Track[];
  current: Track | null;
  playing: boolean;
  /** Nome da faixa atual, pronto para exibir. */
  title: string;
  add: (files: FileList | File[]) => Promise<void>;
  clear: () => Promise<void>;
  toggle: () => void;
  next: () => void;
  previous: () => void;
}

/**
 * Player das músicas do aparelho.
 *
 * Um único elemento `<audio>` cobre a reprodução (o navegador continua tocando
 * com a tela bloqueada) e o ganho passa pelo Web Audio, para poder abaixar a
 * música quando o sinal do treino toca.
 *
 * A intenção de tocar fica num ref (`intent`) e a UI lê o estado real do
 * elemento — assim o botão nunca mostra "tocando" com o áudio parado, e a lista
 * reinicia sozinha ao chegar no fim (inclusive com uma música só).
 */
export function useMusic(): Music {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [token, setToken] = useState(0);

  const elementRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const connected = useRef(false);
  const intent = useRef(false);

  const element = useCallback((): HTMLAudioElement | null => {
    if (typeof Audio === "undefined") return null;
    if (!elementRef.current) {
      const audio = new Audio();
      audio.preload = "auto";
      elementRef.current = audio;
    }
    return elementRef.current;
  }, []);

  // Lista guardada no aparelho, ao abrir.
  useEffect(() => {
    let alive = true;
    void listTracks().then((saved) => {
      if (alive) setTracks(saved);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Troca de faixa (ou repetição da mesma): revoga a URL antiga e aponta o elemento.
  useEffect(() => {
    const track = tracks[index];
    const audio = element();
    if (!track || !audio) return;
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(track.blob);
    audio.src = urlRef.current;
    if (!intent.current) return;
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        intent.current = false;
      });
  }, [tracks, index, token, element]);

  // Fim da faixa: emenda a próxima ou volta para a primeira.
  useEffect(() => {
    const audio = element();
    if (!audio) return;
    const onEnded = () => {
      setIndex((current) => (tracks.length > 1 ? (current + 1) % tracks.length : current));
      setToken((current) => current + 1);
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [element, tracks.length]);

  const play = useCallback(() => {
    const audio = element();
    if (!audio) return;
    if (!connected.current) {
      connectMusic(audio);
      connected.current = true;
    }
    intent.current = true;
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        intent.current = false;
      });
  }, [element]);

  const pause = useCallback(() => {
    const audio = elementRef.current;
    intent.current = false;
    audio?.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, pause, play]);

  const next = useCallback(() => {
    setIndex((current) => (tracks.length === 0 ? 0 : (current + 1) % tracks.length));
    setToken((current) => current + 1);
  }, [tracks.length]);

  const previous = useCallback(() => {
    setIndex((current) => (tracks.length === 0 ? 0 : (current - 1 + tracks.length) % tracks.length));
    setToken((current) => current + 1);
  }, [tracks.length]);

  const add = useCallback(async (files: FileList | File[]) => {
    const saved = await addTracks(Array.from(files));
    setTracks(saved);
  }, []);

  const clear = useCallback(async () => {
    const audio = elementRef.current;
    intent.current = false;
    audio?.pause();
    setPlaying(false);
    await clearTracks();
    setTracks([]);
    setIndex(0);
  }, []);

  return {
    tracks,
    current: tracks[index] ?? null,
    playing,
    title: tracks[index]?.name ?? "",
    add,
    clear,
    toggle,
    next,
    previous,
  };
}
