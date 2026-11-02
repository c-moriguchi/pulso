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

export type Cue = "trumpet" | "tick-tock";

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
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
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

/** Fanfarra de trombeta: três notas subindo (dó–mi–sol), som de "vai!". */
export function fanfare(): void {
  const audio = engine();
  if (!audio) return;
  const start = audio.ctx.currentTime + 0.01;

  const notes: Array<[number, number, number]> = [
    [523.25, 0, 0.18], // dó5
    [659.25, 0.18, 0.18], // mi5
    [783.99, 0.36, 0.5], // sol5, sustentado
  ];
  for (const [frequency, at, duration] of notes) {
    trumpetNote(audio.ctx, audio.out, frequency, start + at, duration);
  }

  // Um estalo agudo no primeiro ataque: ajuda a furar a música no momento em que
  // a pessoa precisa olhar o relógio.
  click(audio.ctx, audio.out, 3000, 0.45, 0.03, start);
}

/**
 * Uma nota de trombeta.
 *
 * O que faz soar como metal e não como sintetizador: duas serras levemente
 * desafinadas (efeito de naipe), "scoop" de afinação na entrada, filtro que abre
 * no ataque e fecha no sustento (o "blat"), vibrato que só entra depois, e um
 * formante em ~1,8 kHz — a faixa que dá brilho e atravessa a mixagem.
 */
function trumpetNote(
  context: AudioContext,
  target: GainNode,
  frequency: number,
  at: number,
  duration: number,
): void {
  const end = at + duration;

  const oscA = context.createOscillator();
  const oscB = context.createOscillator();
  oscA.type = "sawtooth";
  oscB.type = "sawtooth";
  for (const osc of [oscA, oscB]) {
    osc.frequency.setValueAtTime(frequency * 0.94, at);
    osc.frequency.exponentialRampToValueAtTime(frequency, at + 0.045);
  }
  oscB.frequency.exponentialRampToValueAtTime(frequency * 1.004, at + 0.045);

  // Vibrato com profundidade crescendo: entrada firme, cauda "cantada".
  const vibrato = context.createOscillator();
  vibrato.frequency.value = 5.2;
  const vibratoDepth = context.createGain();
  vibratoDepth.gain.setValueAtTime(0, at);
  vibratoDepth.gain.linearRampToValueAtTime(frequency * 0.006, at + 0.22);
  vibrato.connect(vibratoDepth);
  vibratoDepth.connect(oscA.frequency);
  vibratoDepth.connect(oscB.frequency);

  const body = context.createBiquadFilter();
  body.type = "lowpass";
  body.Q.value = 1.6;
  body.frequency.setValueAtTime(frequency * 2.2, at);
  body.frequency.exponentialRampToValueAtTime(Math.min(frequency * 8, 9000), at + 0.05);
  body.frequency.exponentialRampToValueAtTime(frequency * 4, end);

  // Brilho de metal: realça 2–4 kHz, a faixa que o ouvido separa da música.
  // (Filtro passa-faixa não serve aqui: ele não cria harmônico que a nota não tem.)
  const brilliance = context.createBiquadFilter();
  brilliance.type = "highshelf";
  brilliance.frequency.value = 2200;
  brilliance.gain.value = 5;

  const amp = context.createGain();
  envelope(amp.gain, at, 0.52, end);

  oscA.connect(body);
  oscB.connect(body);
  body.connect(brilliance);
  brilliance.connect(amp);
  amp.connect(target);

  for (const node of [oscA, oscB, vibrato]) {
    node.start(at);
    node.stop(end + 0.08);
  }
}

/** Ataque rápido + queda para o sustento + corte curto (jeito de metal, não de sino). */
function envelope(param: AudioParam, at: number, peak: number, end: number): void {
  const sustain = at + 0.11;
  const release = Math.max(sustain, end - 0.04);
  param.setValueAtTime(0.0001, at);
  param.exponentialRampToValueAtTime(peak, at + 0.025);
  param.exponentialRampToValueAtTime(peak * 0.62, sustain);
  param.setValueAtTime(peak * 0.62, release);
  param.exponentialRampToValueAtTime(0.0001, end + 0.06);
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
  return phase === "rest" ? "tick-tock" : "trumpet";
}

export function playCue(cue: Cue): void {
  if (cue === "tick-tock") tickTock();
  else fanfare();
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
