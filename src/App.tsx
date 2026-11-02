import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Check,
  ExternalLink,
  Minus,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useScreenWakeLock, useWorkout } from "./hooks/use-workout";
import { InstallPrompt } from "./components/InstallPrompt";
import { playCue, speak, unlockAudio } from "./lib/audio";
import { LIMITS, loadSettings, saveSettings, type Settings } from "./lib/settings";
import { looksLikeSpotify, parseSpotifyLink } from "./lib/spotify";
import { formatDuration } from "./lib/workout";

const TABATA = { workSeconds: 20, restSeconds: 10, rounds: 8 };

const PHASE = {
  prepare: { label: "Prepare-se", color: "text-accent" },
  work: { label: "Exercício", color: "text-primary" },
  rest: { label: "Pausa", color: "text-rest" },
} as const;

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  format,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  format: (value: number) => string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card p-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold tabular-nums">{format(value)}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="grid h-12 w-12 place-items-center rounded-full bg-secondary transition active:scale-95 disabled:opacity-40"
        >
          <Minus size={20} />
        </button>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="grid h-12 w-12 place-items-center rounded-full bg-secondary transition active:scale-95 disabled:opacity-40"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = loadSettings();
    // Atalho do ícone do app: .../?preset=tabata
    const wantsTabata = new URLSearchParams(window.location.search).get("preset") === "tabata";
    return wantsTabata ? { ...saved, ...TABATA } : saved;
  });

  const workout = useWorkout(settings);
  const { status, position, plan } = workout;

  useScreenWakeLock(status === "running" || status === "paused");

  // Salva sempre que algo muda: reabrir o app já vem com o último ajuste.
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const spotify = useMemo(() => parseSpotifyLink(settings.playlistUrl), [settings.playlistUrl]);
  const isTabata =
    settings.workSeconds === TABATA.workSeconds &&
    settings.restSeconds === TABATA.restSeconds &&
    settings.rounds === TABATA.rounds;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const phase = PHASE[position.segment.kind];

  if (status === "idle") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="mb-4 flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            pulso<span className="text-primary">.</span>
          </h1>
          <span className="text-sm text-muted-foreground">Total {formatDuration(plan.duration)}</span>
        </header>

        <InstallPrompt />

        <button
          type="button"
          onClick={() => setSettings((current) => ({ ...current, ...TABATA }))}
          className={`mb-4 flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
            isTabata ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Zap size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Tabata</span>
            <span className="block text-sm text-muted-foreground">20s exercício · 10s pausa · 8 rodadas</span>
          </span>
          {isTabata && <Check size={18} className="text-primary" />}
        </button>

        <div className="space-y-2.5">
          <Stepper
            label="Exercício"
            value={settings.workSeconds}
            onChange={(value) => update("workSeconds", value)}
            step={LIMITS.work.step}
            min={LIMITS.work.min}
            max={LIMITS.work.max}
            format={(value) => formatDuration(value * 1000)}
          />
          <Stepper
            label="Pausa"
            value={settings.restSeconds}
            onChange={(value) => update("restSeconds", value)}
            step={LIMITS.rest.step}
            min={LIMITS.rest.min}
            max={LIMITS.rest.max}
            format={(value) => formatDuration(value * 1000)}
          />
          <Stepper
            label="Rodadas"
            value={settings.rounds}
            onChange={(value) => update("rounds", value)}
            step={LIMITS.rounds.step}
            min={LIMITS.rounds.min}
            max={LIMITS.rounds.max}
            format={(value) => `${value}x`}
          />
        </div>

        <div className="mt-3 rounded-2xl bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="playlist" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music size={16} className="text-spotify" /> Playlist do Spotify
            </label>
            {spotify && (
              <a
                href={spotify.webUrl}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold transition active:scale-95"
              >
                <Play size={11} fill="currentColor" className="text-spotify" /> Tocar
              </a>
            )}
          </div>
          <input
            id="playlist"
            value={settings.playlistUrl}
            onChange={(event) => update("playlistUrl", event.target.value)}
            placeholder="Cole o link da playlist"
            inputMode="url"
            autoComplete="off"
            className="w-full rounded-xl bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {settings.playlistUrl && !spotify && !looksLikeSpotify(settings.playlistUrl) && (
            <p className="mt-2 text-xs text-destructive">
              Link inválido — cole o link de uma playlist do Spotify.
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { rotulo: "Vuvuzela", icone: <Megaphone size={14} className="text-primary" />, acao: () => playCue("vuvuzela") },
            { rotulo: "Tic-tac", icone: <Timer size={14} className="text-rest" />, acao: () => playCue("tick-tock") },
            { rotulo: "Voz", icone: <Volume2 size={14} className="text-accent" />, acao: () => speak("Exercício") },
          ].map(({ rotulo, icone, acao }) => (
            <button
              key={rotulo}
              type="button"
              aria-label={`Ouvir ${rotulo}`}
              onClick={() => {
                unlockAudio();
                acao();
              }}
              className="flex items-center justify-center gap-1.5 rounded-full bg-card px-2 py-2.5 text-xs font-medium text-muted-foreground transition active:scale-[0.98]"
            >
              {icone} {rotulo}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={workout.start}
          className="mt-5 flex h-16 items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-primary-foreground transition active:scale-[0.98]"
        >
          <Play size={22} fill="currentColor" /> Começar
        </button>
      </div>
    );
  }

  const finished = status === "finished";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Sair do treino"
          onClick={workout.stop}
          className="grid h-11 w-11 place-items-center rounded-full bg-card transition active:scale-95"
        >
          <X size={20} />
        </button>
        <span className="font-semibold tabular-nums">
          {finished
            ? `${plan.rounds} ${plan.rounds === 1 ? "rodada" : "rodadas"}`
            : `Rodada ${position.round}/${plan.rounds}`}
        </span>
        <span className="w-11" aria-hidden="true" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center">
        <div className={`relative ${finished ? "text-primary" : phase.color}`}>
          <svg width="300" height="300" viewBox="0 0 300 300" className="-rotate-90" aria-hidden="true">
            <circle cx="150" cy="150" r="130" stroke="var(--color-secondary)" strokeWidth="14" fill="none" />
            <circle
              cx="150"
              cy="150"
              r="130"
              stroke="currentColor"
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 130}
              strokeDashoffset={2 * Math.PI * 130 * (1 - position.progress)}
              style={{ transition: "stroke-dashoffset 220ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" role="status" aria-live="polite">
            <p className="text-sm font-semibold uppercase tracking-widest">
              {finished ? "Concluído!" : phase.label}
            </p>
            <p className="font-display text-7xl font-extrabold tabular-nums text-foreground">
              {finished ? "00:00" : workout.clock}
            </p>
            {!finished && (
              <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                {position.segment.kind === "rest"
                  ? `Próximo: rodada ${position.round + 1}`
                  : position.segment.kind === "work"
                    ? settings.restSeconds > 0
                      ? `Pausa ${settings.restSeconds}s`
                      : "Sem pausa"
                    : `${plan.rounds} rodadas · ${formatDuration(plan.duration)}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {settings.playlistUrl && (
        <a
          href={spotify?.webUrl ?? settings.playlistUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 flex items-center justify-center gap-2 rounded-full bg-card px-4 py-3 text-sm text-muted-foreground transition active:scale-[0.99]"
        >
          <Music size={16} className="text-spotify" /> Tocar playlist no Spotify
          <ExternalLink size={14} />
        </a>
      )}

      <div className="flex justify-center gap-4">
        <button
          type="button"
          aria-label="Recomeçar"
          onClick={workout.start}
          className="grid h-16 w-16 place-items-center rounded-full bg-card transition active:scale-95"
        >
          <RotateCcw size={24} />
        </button>
        {!finished && (
          <button
            type="button"
            aria-label={status === "paused" ? "Continuar" : "Pausar"}
            onClick={status === "paused" ? workout.resume : workout.pause}
            className="grid h-16 w-24 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95"
          >
            {status === "paused" ? <Play size={26} fill="currentColor" /> : <Pause size={26} fill="currentColor" />}
          </button>
        )}
        {finished && (
          <button
            type="button"
            onClick={workout.stop}
            className="flex h-16 items-center justify-center gap-2 rounded-full bg-primary px-8 font-bold text-primary-foreground transition active:scale-95"
          >
            <Check size={22} /> Novo treino
          </button>
        )}
      </div>
    </div>
  );
}
