# Pulso — timer de treino intervalado

Timer para treino em intervalos: preparo de 3s, exercício, pausa e rodadas, com
preset Tabata, gongo de troca de fase e playlist do Spotify. Instala na tela
inicial do celular e funciona sem internet.

## Rodar no computador

```sh
npm install
npm run dev          # abre em http://localhost:5173
```

## Testes e build

```sh
npm test             # 26 testes (motor do timer, configurações, telas)
npm run build        # gera dist/ (estático, ~340 KB)
npm run preview      # serve o build em http://localhost:4173
```

## Publicar (GitHub Pages)

1. Suba o projeto para um repositório no GitHub.
2. No repositório: **Settings → Pages → Source: GitHub Actions**.
3. Cada push na `main` roda o workflow `.github/workflows/deploy.yml`, testa e publica.
4. O endereço fica `https://<usuario>.github.io/<repositorio>/`.

O workflow já publica no subdiretório certo (`BASE_PATH=/<repositorio>/`). Se o
repositório se chamar `<usuario>.github.io`, troque para `BASE_PATH: /`.

## Instalar no celular

- **Android/Chrome:** abra o link → menu **⋮** → *Instalar app* (ou *Adicionar à tela inicial*).
- **iPhone/Safari:** abra o link → **Compartilhar** → *Adicionar à Tela de Início*.

Depois disso o Pulso abre em tela cheia, com ícone próprio, e funciona offline.

## Como foi feito

- `src/lib/workout.ts` — motor do treino em funções puras: monta o plano de
  segmentos e localiza a fase atual a partir do tempo decorrido.
- `src/hooks/use-workout.ts` — relógio baseado em timestamps (`Date.now()`), não
  em contagem regressiva. Se o navegador congela os ticks (tela apagada, app em
  segundo plano), ao voltar o tempo está certo. Também segura a tela ligada
  (Wake Lock) durante o treino.
- `src/lib/settings.ts` — ajustes salvos no aparelho (localStorage).
- `src/lib/audio.ts` — bipe e gongo gerados por Web Audio (sem arquivos, offline).
- `public/sw.js` — service worker: app shell em cache e navegação network-first.
- `public/manifest.webmanifest` + ícones — é o que faz o app ser instalável.

## Sons

- **Gongo** ao começar/retomar o exercício e no fim do treino.
- **Tic-tac de cronômetro** ao entrar na pausa.
- **Bipe agudo** nos 3, 2, 1 antes de cada troca, mais vibração no celular (Android).
- Botões **Ouvir gongo** / **Ouvir tic-tac** na tela inicial para conferir antes.

O som é gerado com ataque curto e agudo (2–4 kHz) e passa por um limitador, para
ser percebido por cima da música. Medido no build: pico em −1,4 dBFS e 0 amostras
em clipping — ou seja, tocando no teto do volume sem distorcer.

## Limites conhecidos

- **O app não abaixa o Spotify.** Música de outro app (ou o player embutido) tem
  volume próprio que o Pulso não controla. Por isso o sinal é desenhado para
  atravessar a mixagem — se ainda ficar abafado, aumente o volume do celular: o
  sinal está no teto e sobe junto.
- No iPhone, o botão lateral de **silencioso** pode calar os sons do Safari.
- Som com o app **fechado** depende do sistema; o cronômetro continua certo, mas o
  gongo pode não tocar. A tela fica ligada durante o treino quando o navegador permite.
- A playlist do Spotify precisa de internet; o resto do app não.
- Ao publicar uma versão nova, aumente `VERSION` em `public/sw.js` para limpar os
  caches antigos no próximo acesso.
