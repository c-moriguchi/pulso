import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "pulso.install-dismissed";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || iosStandalone;
}

/**
 * Convite para instalar na tela inicial.
 * No Android o navegador entrega um evento nativo de instalação; no iPhone só
 * existe o caminho manual (Compartilhar → Adicionar à Tela de Início).
 */
export function InstallPrompt() {
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const installed = isInstalled();
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // sem storage: o aviso volta na próxima abertura, sem quebrar nada
    }
  };

  const install = async () => {
    if (!deferred) {
      setShowSteps(true);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  };

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <Download size={16} className="shrink-0 text-primary" />
        <p className="flex-1 text-xs leading-tight">
          <span className="font-semibold">Instalar o Pulso no celular</span>{" "}
          <span className="text-muted-foreground">— ícone na tela, abre sem internet.</span>
        </p>
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition active:scale-95"
        >
          {deferred ? "Instalar" : "Como instalar"}
        </button>
        <button
          type="button"
          aria-label="Agora não"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition active:scale-95"
        >
          <X size={14} />
        </button>
      </div>

      {showSteps && !deferred && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-secondary/60 p-3 text-sm">
          {isIos ? (
            <p className="flex items-start gap-2">
              <Share size={16} className="mt-0.5 shrink-0" />
              <span>
                Toque em <strong>Compartilhar</strong> na barra do Safari e escolha{" "}
                <strong>Adicionar à Tela de Início</strong>.
              </span>
            </p>
          ) : (
            <p>
              Abra o menu <strong>⋮</strong> do Chrome e toque em{" "}
              <strong>Adicionar à tela inicial</strong> (ou <strong>Instalar app</strong>).
            </p>
          )}
          <p className="text-muted-foreground">
            Pronto: o Pulso aparece junto com os outros apps e abre sem internet.
          </p>
        </div>
      )}
    </div>
  );
}
