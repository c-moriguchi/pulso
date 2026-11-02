/**
 * Sons do treino via Web Audio (sem arquivos, sem rede → funciona offline).
 *
 * O contexto precisa ser criado/retomado dentro de um gesto do usuário, por isso
 * `unlockAudio()` é chamado no toque em "Começar".
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio(): void {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Bipe curto de contagem (3, 2, 1). */
export function beep(): void {
  const ctx = audioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
  osc.start();
  osc.stop(ctx.currentTime + 0.16);
}

/** Gongo de troca de fase: harmônicos somados, cauda de 3s. */
export function gong(): void {
  const ctx = audioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [110, 220.5, 331, 443, 587].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const peak = 0.25 / (index + 1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3);
    osc.start(now);
    osc.stop(now + 3.05);
  });
}
