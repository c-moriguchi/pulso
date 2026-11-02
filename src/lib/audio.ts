/**
 * Sons do treino via Web Audio (sem arquivos, sem rede → funciona offline).
 *
 * Objetivo: o sinal tem de ser percebido **por cima da música**. O app não tem
 * como abaixar o áudio de outro app (Spotify roda fora dele), então o caminho é
 * outro: timbre rasgado e denso (vuvuzela), estalos agudos (2–4 kHz, faixa que o
 * ouvido separa melhor da música) e um limitador no fim da cadeia para tocar no
 * volume máximo sem distorcer.
 *
 * A voz das trocas ("exercício", "pausa", "fim") sai pelo `speechSynthesis` do
 * próprio aparelho — é a voz do sistema, em pt-BR, e não passa pelo limitador.
 *
 * O contexto precisa ser criado/retomado dentro de um gesto do usuário, por isso
 * `unlockAudio()` é chamado no toque em "Começar" e nos botões de ouvir os sons.
 */

export type Cue = "vuvuzela" | "tick-tock";

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
  warmUpVoices();
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

/** Curva de saturação: é o que dá o timbre "rasgado" da vuvuzela. */
function saturation(amount: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let index = 0; index < samples; index++) {
    const x = (index * 2) / samples - 1;
    curve[index] = Math.tanh(x * amount);
  }
  return curve;
}

/**
 * Vuvuzela: uma nota só, densa e rasgada.
 *
 * O que faz soar como vuvuzela e não como buzina de sintetizador: fundamental
 * grave (si bemol 3, ~233 Hz) com oitava junto, duas ondas levemente desafinadas
 * batendo entre si (o "coro" de arquibancada), saturação por `WaveShaper` para o
 * timbre rasgado, sopro inicial de ~80 ms e uma modulação rápida de amplitude que
 * imita a vibração do plástico.
 */
export function vuvuzela(): void {
  const audio = engine();
  if (!audio) return;
  const { ctx: context, out: target } = audio;
  const at = context.currentTime + 0.01;
  const duration = 0.8;
  const end = at + duration;

  const shaper = context.createWaveShaper();
  shaper.curve = saturation(6);
  shaper.oversample = "2x";

  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 150;

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 3800;
  lowpass.Q.value = 0.9;

  const amp = context.createGain();
  amp.gain.setValueAtTime(0.0001, at);
  amp.gain.exponentialRampToValueAtTime(0.3, at + 0.08);
  amp.gain.setValueAtTime(0.3, end - 0.15);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  // Vibração do plástico: modulação de amplitude rápida e rasa.
  const rasp = context.createOscillator();
  rasp.frequency.value = 31;
  const raspDepth = context.createGain();
  raspDepth.gain.value = 0.05;
  rasp.connect(raspDepth);
  raspDepth.connect(amp.gain);

  const voices: Array<[number, number]> = [
    [233, 0.5],
    [236.5, 0.5], // bate ~3,5 Hz com a anterior: efeito de várias vuvuzelas
    [466, 0.22],
    [116.5, 0.12],
  ];

  const started: OscillatorNode[] = [rasp];
  for (const [frequency, level] of voices) {
    const osc = context.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = level;
    osc.connect(gain);
    gain.connect(shaper);
    started.push(osc);
  }

  shaper.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(amp);
  amp.connect(target);

  for (const node of started) {
    node.start(at);
    node.stop(end + 0.05);
  }
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
  return phase === "rest" ? "tick-tock" : "vuvuzela";
}

export function playCue(cue: Cue): void {
  if (cue === "tick-tock") tickTock();
  else vuvuzela();
}

/* ───────────────────────────── voz das trocas ───────────────────────────── */

/** O que a voz fala em cada fase. */
export function voiceFor(phase: "prepare" | "work" | "rest"): string {
  return phase === "rest" ? "Pausa" : "Exercício";
}

export const FINISH_VOICE = "Fim";

let cachedVoice: SpeechSynthesisVoice | null = null;

function speech(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

/** Melhor voz portuguesa disponível no aparelho (prefere pt-BR e voz local, que funciona offline). */
function ptVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = synth.getVoices();
  if (voices.length === 0) return null; // ainda carregando: fala com a voz padrão
  const portuguese = voices.filter((voice) => voice.lang.toLowerCase().startsWith("pt"));
  cachedVoice =
    portuguese.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("pt-br") && voice.localService) ??
    portuguese.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("pt-br")) ??
    portuguese[0] ??
    null;
  return cachedVoice;
}

/**
 * Aquece a síntese de voz dentro do gesto do usuário.
 * Sem isso, alguns navegadores (iOS em especial) recusam falar depois, quando a
 * fala é disparada por um timer e não por um toque.
 */
export function warmUpVoices(): void {
  const synth = speech();
  if (!synth) return;
  ptVoice(synth); // dispara o carregamento da lista
  if (typeof SpeechSynthesisUtterance === "undefined") return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  silent.lang = "pt-BR";
  try {
    synth.speak(silent);
  } catch {
    // Sem vozes instaladas: o som do instrumento continua marcando a troca.
  }
}

export function speak(line: string): void {
  const synth = speech();
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
  try {
    synth.cancel(); // um aviso novo substitui o anterior em vez de enfileirar
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.lang = "pt-BR";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = ptVoice(synth);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  } catch {
    // Aparelho sem voz pt-BR: o instrumento já sinalizou a troca.
  }
}

/* ───────────────────────────── música do celular ───────────────────────────── */

let musicGain: GainNode | null = null;
let musicLevel = 0.85;

/**
 * Conecta o elemento de música ao mesmo AudioContext, para poder abaixá-lo na
 * hora do sinal. Vai direto na saída (não passa pelo limitador dos sinais, senão
 * a música seria "bombeada" a cada aviso).
 */
export function connectMusic(element: HTMLAudioElement): GainNode | null {
  if (musicGain) return musicGain;
  const audio = engine();
  if (!audio) return null;
  try {
    const source = audio.ctx.createMediaElementSource(element);
    const gain = audio.ctx.createGain();
    gain.gain.value = musicLevel;
    source.connect(gain);
    gain.connect(audio.ctx.destination);
    musicGain = gain;
    return gain;
  } catch {
    // Navegador recusou conectar: a música toca direto, só não abaixa no sinal.
    return null;
  }
}

/** Abaixa a música por um instante, para o aviso (vuvuzela, voz, bipe) aparecer. */
export function duckMusic(holdMs = 1600): void {
  const audio = engine();
  if (!audio || !musicGain) return;
  const now = audio.ctx.currentTime;
  const gain = musicGain.gain;
  const low = musicLevel * 0.16;
  const holdEnd = now + 0.12 + holdMs / 1000;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(low, now + 0.12);
  gain.setValueAtTime(low, holdEnd);
  gain.linearRampToValueAtTime(musicLevel, holdEnd + 0.45);
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
