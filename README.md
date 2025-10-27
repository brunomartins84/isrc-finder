# ISRC Tool (Spotify → ISRC)
Front-end estático (GitHub Pages) + back-end Serverless (Vercel).

## Visão geral
- **Front-end**: página simples que recebe a URL de álbum do Spotify e chama a API.
- **Back-end**: função serverless que usa o Client Credentials Flow do Spotify, obtém as faixas do álbum e retorna ISRCs (JSON ou CSV).

## Estrutura
```
isrc-tool/
├─ api/
│  └─ isrcs.js        # Função serverless (Vercel)
├─ index.html         # Front estático (pode ir para GitHub Pages)
├─ package.json       # (opcional) define Node 18 + ESM no Vercel
└─ README.md
```

## Deploy do back-end (Vercel)
1. Crie um repositório **isrc-tool** no GitHub (ou use este conteúdo).
2. Importe o repositório na **Vercel**.
3. Em **Settings → Environment Variables**, adicione:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
4. Deploy.

> A função ficará acessível em: `https://SEU-PROJETO.vercel.app/api/isrcs`

## Deploy do front (GitHub Pages)
1. Ative **Settings → Pages** na branch que contém `index.html` (ex.: `main`).
2. Edite no `index.html` a constante `API_URL` para apontar para sua URL da Vercel.

## Testes rápidos
### JSON
```bash
curl -X POST "https://SEU-PROJETO.vercel.app/api/isrcs"   -H 'content-type: application/json'   -d '{"albumUrl":"https://open.spotify.com/album/3AZnmlGW4bQNQsjOb9ksKg"}'
```

### CSV
```bash
curl -X POST "https://SEU-PROJETO.vercel.app/api/isrcs"   -H 'content-type: application/json'   -d '{"albumUrl":"https://open.spotify.com/album/3AZnmlGW4bQNQsjOb9ksKg", "format":"csv"}'   -o isrcs.csv
```

## Notas
- Não exponha `SPOTIFY_CLIENT_SECRET` no front; use apenas nas variáveis de ambiente da Vercel.
- A API usa batch (`/v1/tracks?ids=...`) para ser rápida.
- Tratamos CORS e preflight (OPTIONS) para funcionar direto do GitHub Pages.
