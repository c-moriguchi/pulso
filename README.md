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

## Música dentro do app

O Pulso toca **arquivos de música do próprio celular**: no cartão "Música do celular" você
escolhe os arquivos (MP3, M4A, WAV…), eles ficam guardados no aparelho (IndexedDB) e tocam
dentro do app — inclusive durante o treino, com controles na tela de treino em andamento.

Como o app é dono do áudio, ele consegue **abaixar a música** automaticamente quando um sinal
toca (vuvuzela, voz, bipe), e devolve o volume em seguida. Medido no build: a música vai de
0,85 para 0,136 e volta — é isso que faz o aviso aparecer por cima.

O Spotify não entra nessa conta: a API dele não permite que outro app controle a reprodução
(seria preciso conta Premium + login, e não funciona no navegador do celular). O link da
playlist, se existir, aparece como atalho opcional logo abaixo do cartão.

## Sons

| Momento | O que toca |
|---|---|
| Exercício começa / nova rodada | **Vuvuzela** + voz dizendo **"Exercício"** |
| Pausa começa | **Tic-tac de cronômetro** + voz dizendo **"Pausa"** |
| 3, 2, 1 antes de cada troca | Bipe agudo |
| Fim do treino | **Vuvuzela** + voz dizendo **"Fim"** |

Botões **Vuvuzela**, **Tic-tac** e **Voz** na tela inicial para conferir antes do treino.

A vuvuzela é sintetizada: fundamental grave (~233 Hz) com a oitava junto, duas ondas
desafinadas batendo entre si (efeito de arquibancada), saturação por `WaveShaper` para o
timbre rasgado e uma modulação rápida que imita a vibração do plástico. Tudo passa por um
limitador: medido no build, pico em −1,9 dBFS e 0 amostras em clipping.

A voz vem do `speechSynthesis` do próprio aparelho (não é áudio do app), em pt-BR. O
instrumento toca primeiro e a palavra entra ~0,4 s depois, para não se atropelarem.

## Limites conhecidos

- **O app não abaixa o Spotify.** Música de outro app (ou o player embutido) tem
  volume próprio que o Pulso não controla. Por isso o sinal é desenhado para
  atravessar a mixagem — se ainda ficar abafado, aumente o volume do celular: o
  sinal está no teto e sobe junto.
- No iPhone, o botão lateral de **silencioso** pode calar os sons do Safari.
- A voz depende de o celular ter uma voz em português instalada (Android: Google TTS;
  iPhone: voz padrão em pt-BR). Sem ela, os sons do instrumento continuam marcando tudo.
- Som com o app **fechado** depende do sistema; o cronômetro continua certo, mas o
  gongo pode não tocar. A tela fica ligada durante o treino quando o navegador permite.
- As músicas escolhidas ficam no aparelho: funcionam offline e não precisam de conta. Ocupam
  espaço do navegador (alguns navegadores limitam a ~50 MB a ~2 GB, dependendo do aparelho).
- Ao publicar uma versão nova, aumente `VERSION` em `public/sw.js` para limpar os
  caches antigos no próximo acesso.
