/**
 * Sons do treino via Web Audio (sem arquivos, sem rede → funciona offline).
 *
 * Objetivo: o sinal tem de ser percebido **por cima da música**. O app não tem
 * como abaixar o áudio de outro app (Spotify roda fora dele), então o caminho é
 * outra coisa: ataque curto e agudo (2–4 kHz, faixa que o ouvido separa melhor da
 * música), transientes de ruído para "furar" a mixagem e um limitador no fim da
 * cadeia para tocar no volume máximo sem distorcer.
 *
 * O contexto precisa ser criado/retomado dentro de um gesto do usuário, por isso
 * `unlockAudio()` é chamado no toque em "Começar" e nos botões de ouvir os sons.
 */

export type Cue = "gong" | "tick-tock";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/** Cadeia de saída: ganho master → limitador (compressor) → alto-falante. */
function engine(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;
    const master = context.createGain();
    // Acima de 1.0 de propósito: o limitador logo depois segura o pico sem
    // distorcer, e o sinal fica no teto — é o que precisa para vencer a música.
    master.gain.value = 2.4;
    master.connect(limiter);
    limiter.connect(context.destination);
    ctx = context;
    out = master;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return out ? { ctx, out } : null;
}

export function unlockAudio(): void {
  engine();
}

/** Ruído branco curto reaproveitado nos transientes (ataque que "corta" a música). */
function noise(context: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(context.sampleRate * 0.12);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Estalo agudo: ruído em banda, decaimento rápido. */
function click(
  context: AudioContext,
  target: GainNode,
  frequency: number,
  peak: number,
  decay: number,
  at: number,
): void {
  const source = context.createBufferSource();
  source.buffer = noise(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 1.2;
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(target);
  source.start(at);
  source.stop(at + decay + 0.01);
}

/** Parcial senoidal, com ataque instantâneo e cauda exponencial. */
function partial(
  context: AudioContext,
  target: GainNode,
  frequency: number,
  peak: number,
  decay: number,
  at: number,
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(target);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

/** Bipe de contagem (3, 2, 1): agudo e curto. */
export function beep(): void {
  const audio = engine();
  if (!audio) return;
  const now = audio.ctx.currentTime;
  partial(audio.ctx, audio.out, 1320, 0.75, 0.12, now);
  partial(audio.ctx, audio.out, 2640, 0.3, 0.07, now);
  click(audio.ctx, audio.out, 3200, 0.6, 0.03, now);
}

/** Gongo de troca de fase: corpo grave + harmônicos + estalo agudo de ataque. */
export function gong(): void {
  const audio = engine();
  if (!audio) return;
  const now = audio.ctx.currentTime;

  // Corpo do sino (dá o "peso") e harmônicos altos (dão o corte na mixagem).
  const partials: Array<[number, number, number]> = [
    [98, 0.34, 3.0],
    [196.5, 0.26, 2.6],
    [294, 0.18, 2.2],
    [587, 0.15, 1.7],
    [1174, 0.12, 1.1],
  ];
  for (const [frequency, peak, decay] of partials) {
    partial(audio.ctx, audio.out, frequency, peak, decay, now);
  }

  // Ataque: é isso que faz o som aparecer por cima da música.
  click(audio.ctx, audio.out, 2600, 0.85, 0.06, now);
  click(audio.ctx, audio.out, 3800, 0.6, 0.04, now);
}

/** Tic-tac de cronômetro (pausa): quatro estalos alternados, timbre de relógio. */
export function tickTock(): void {
  const audio = engine();
  if (!audio) return;
  const start = audio.ctx.currentTime + 0.01;

  for (let index = 0; index < 4; index++) {
    const at = start + index * 0.22;
    const isTick = index % 2 === 0;
    click(audio.ctx, audio.out, isTick ? 3400 : 2100, 1.0, 0.06, at);
    partial(audio.ctx, audio.out, isTick ? 1700 : 1050, 0.3, 0.06, at);
  }
}

/** Qual som marca a troca para esta fase. */
export function cueFor(phase: "prepare" | "work" | "rest"): Cue {
  return phase === "rest" ? "tick-tock" : "gong";
}

export function playCue(cue: Cue): void {
  if (cue === "tick-tock") tickTock();
  else gong();
}

/**
 * Vibração como reforço (Android). O iOS não expõe a API; a chamada é ignorada.
 */
export function haptic(pattern: number | number[] = 180): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Alguns navegadores bloqueiam fora de gesto do usuário: não é erro fatal.
  }
}
