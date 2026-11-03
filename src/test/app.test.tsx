import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

// Sem `globals: true` no vitest, a limpeza automática do Testing Library não roda.
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

describe("tela inicial do Pulso", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("abre no padrão mostrando a duração total do treino", () => {
    render(<App />);
    // 30s exercício x 8 + 15s pausa x 7 + 3s de preparo = 5:48
    expect(screen.getByText("Total 05:48")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Começar/i })).toBeInTheDocument();
  });

  it("aplica o preset Tabata no toque", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Tabata/i }));
    // 20s x 8 + 10s x 7 + 3s = 3:53
    expect(screen.getByText("Total 03:53")).toBeInTheDocument();
  });

  it("guarda o ajuste para a próxima abertura", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Aumentar Exercício/i }));
    const saved = JSON.parse(localStorage.getItem("pulso.settings.v1") ?? "{}") as { workSeconds?: number };
    expect(saved.workSeconds).toBe(35);
  });

  it("reabre com o último ajuste salvo", () => {
    localStorage.setItem(
      "pulso.settings.v1",
      JSON.stringify({ workSeconds: 60, restSeconds: 0, rounds: 4, playlistUrl: "" }),
    );
    render(<App />);
    // 60s x 4 sem pausa + 3s de preparo = 4:03
    expect(screen.getByText("Total 04:03")).toBeInTheDocument();
  });

  it("explica como instalar quando o navegador não oferece o botão", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Como instalar/i }));
    expect(screen.getByText(/Adicionar à tela inicial/i)).toBeInTheDocument();
  });

  it("esconde o convite de instalação quando a pessoa dispensa", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Agora não/i }));
    expect(screen.queryByText(/Instalar o Pulso no celular/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("pulso.install-dismissed")).toBe("1");
  });

  it("deixa ouvir a vuvuzela, o tic-tac e a voz antes de começar", () => {
    render(<App />);
    for (const rotulo of [/Ouvir Vuvuzela/i, /Ouvir Tic-tac/i, /Ouvir Voz/i]) {
      expect(() => fireEvent.click(screen.getByRole("button", { name: rotulo }))).not.toThrow();
    }
  });

  it("oferece escolher músicas do celular quando ainda não há nenhuma", () => {
    render(<App />);
    expect(screen.getByText("Música do celular")).toBeInTheDocument();
    expect(screen.getByText(/Escolha músicas do celular/i)).toBeInTheDocument();
    const seletor = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(seletor?.accept).toBe("audio/*");
    expect(seletor?.multiple).toBe(true);
  });
});

describe("treino em andamento", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("começa no preparo e entra no exercício quando os 3s acabam", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Começar/i }));

    expect(screen.getByText("Prepare-se")).toBeInTheDocument();
    expect(screen.getByText("Rodada 1/8")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("Exercício")).toBeInTheDocument();
  });

  it("segue certo mesmo se o navegador pular os ticks (tela apagada)", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Começar/i }));

    // Um único salto de 3s (preparo) + 30s (exercício) + 15s (pausa) = na rodada 2.
    act(() => {
      vi.advanceTimersByTime(48_000);
    });

    expect(screen.getByText("Rodada 2/8")).toBeInTheDocument();
    expect(screen.getByText("Exercício")).toBeInTheDocument();
    expect(screen.getByText("00:30")).toBeInTheDocument();
  });

  it("o botão Parar encerra a sequência e volta para a configuração", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Começar/i }));
    expect(screen.getByText("Prepare-se")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Parar treino/i }));

    expect(screen.getByRole("button", { name: /Começar/i })).toBeInTheDocument();
    expect(screen.queryByText("Prepare-se")).not.toBeInTheDocument();
  });

  it("pausa segura o relógio parado", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Começar/i }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("00:30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Pausar/i }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("00:30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("00:25")).toBeInTheDocument();
  });
});
