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
  SkipBack,
  SkipForward,
  Square,
  Timer,
  Volume2,
  Zap,
} from "lucide-react";
import { useMusic } from "./hooks/use-music";
import { useScreenWakeLock, useWorkout } from "./hooks/use-workout";
import { InstallPrompt } from "./components/InstallPrompt";
import { playCue, speak, unlockAudio } from "./lib/audio";
import { LIMITS, loadSettings, saveSettings, type Settings } from "./lib/settings";
import { parseSpotifyLink } from "./lib/spotify";
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
  const music = useMusic();
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
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music size={16} className="text-spotify" /> Música do celular
            </p>
            <label className="shrink-0 cursor-pointer rounded-full bg-secondary px-3 py-1 text-xs font-semibold transition active:scale-95">
              {music.tracks.length ? "Trocar" : "Escolher"}
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files;
                  if (files && files.length > 0) void music.add(files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {music.tracks.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={music.playing ? "Pausar música" : "Tocar música"}
                onClick={music.toggle}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary transition active:scale-95"
              >
                {music.playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{music.title}</p>
                <p className="text-xs text-muted-foreground">
                  {music.tracks.length} {music.tracks.length === 1 ? "música" : "músicas"} · abaixa no sinal
                </p>
              </div>
              <button
                type="button"
                aria-label="Próxima música"
                onClick={music.next}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary transition active:scale-95"
              >
                <SkipForward size={15} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Escolha músicas do celular: tocam dentro do app e abaixam sozinhas na hora do sinal.
            </p>
          )}

          {spotify && (
            <a
              href={spotify.webUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ou tocar a playlist no Spotify <ExternalLink size={11} />
            </a>
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
          onClick={() => {
            workout.start();
            if (music.tracks.length > 0 && !music.playing) music.toggle();
          }}
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
      <header className="flex items-center justify-center">
        <span className="font-semibold tabular-nums">
          {finished
            ? `${plan.rounds} ${plan.rounds === 1 ? "rodada" : "rodadas"}`
            : `Rodada ${position.round}/${plan.rounds}`}
        </span>
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

      {music.tracks.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-card px-2 py-2">
          <button
            type="button"
            aria-label="Música anterior"
            onClick={music.previous}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary transition active:scale-95"
          >
            <SkipBack size={15} />
          </button>
          <button
            type="button"
            aria-label={music.playing ? "Pausar música" : "Tocar música"}
            onClick={music.toggle}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary transition active:scale-95"
          >
            {music.playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>
          <button
            type="button"
            aria-label="Próxima música"
            onClick={music.next}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary transition active:scale-95"
          >
            <SkipForward size={15} />
          </button>
          <p className="min-w-0 flex-1 truncate pl-1 text-xs text-muted-foreground">{music.title}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {!finished && (
          <button
            type="button"
            aria-label="Parar treino"
            onClick={workout.stop}
            className="flex h-16 w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-card text-[0.7rem] font-semibold text-muted-foreground transition active:scale-95"
          >
            <Square size={18} fill="currentColor" /> Parar
          </button>
        )}
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
        <button
          type="button"
          aria-label="Recomeçar"
          onClick={workout.start}
          className="flex h-16 w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl bg-card text-[0.7rem] font-semibold text-muted-foreground transition active:scale-95"
        >
          <RotateCcw size={18} /> Recomeçar
        </button>
        {finished && (
          <button
            type="button"
            aria-label="Novo treino"
            onClick={workout.stop}
            className="flex h-16 items-center justify-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground transition active:scale-95"
          >
            <Check size={20} /> Novo treino
          </button>
        )}
      </div>
    </div>
  );
}
