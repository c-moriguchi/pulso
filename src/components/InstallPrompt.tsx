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
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Download size={18} />
        </span>
        <div className="flex-1">
          <p className="font-semibold leading-tight">Instalar o Pulso no celular</p>
          <p className="text-sm text-muted-foreground">Ícone na tela inicial, abre sem internet.</p>
        </div>
        <button
          type="button"
          aria-label="Agora não"
          onClick={dismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition active:scale-95"
        >
          <X size={16} />
        </button>
      </div>

      <button
        type="button"
        onClick={install}
        className="mt-3 w-full rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition active:scale-[0.98]"
      >
        {deferred ? "Instalar agora" : "Como instalar"}
      </button>

      {showSteps && !deferred && (
        <div className="mt-3 space-y-2 rounded-xl bg-secondary/60 p-3 text-sm">
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
