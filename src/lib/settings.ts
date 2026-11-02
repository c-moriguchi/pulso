/**
 * Configurações do treino salvas no próprio aparelho (localStorage).
 * Sem conta, sem servidor: o app abre já com o último ajuste usado.
 */

export interface Settings {
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  playlistUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  workSeconds: 30,
  restSeconds: 15,
  rounds: 8,
  playlistUrl: "",
};

const STORAGE_KEY = "pulso.settings.v1";

export const LIMITS = {
  work: { min: 5, max: 600, step: 5 },
  rest: { min: 0, max: 600, step: 5 },
  rounds: { min: 1, max: 99, step: 1 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      workSeconds: clamp(Number(parsed.workSeconds ?? DEFAULT_SETTINGS.workSeconds), LIMITS.work.min, LIMITS.work.max),
      restSeconds: clamp(Number(parsed.restSeconds ?? DEFAULT_SETTINGS.restSeconds), LIMITS.rest.min, LIMITS.rest.max),
      rounds: clamp(Number(parsed.rounds ?? DEFAULT_SETTINGS.rounds), LIMITS.rounds.min, LIMITS.rounds.max),
      playlistUrl: typeof parsed.playlistUrl === "string" ? parsed.playlistUrl : "",
    };
  } catch {
    // Configuração corrompida: cair no padrão é melhor do que quebrar o app.
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Modo privado/storage cheio: seguir sem persistir.
  }
}
