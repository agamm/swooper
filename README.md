# Swooper

**An AI domain finder where you describe the *shape* of the name with patterns, and it only shows you domains that are actually available.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fagamm%2Fswooper&env=OPENROUTER_API_KEY,DOMAINR_RAPIDAPI_KEY&envDescription=API%20keys%20for%20AI%20suggestions%20and%20domain%20availability%20checks&envLink=https%3A%2F%2Fgithub.com%2Fagamm%2Fswooper%2Fblob%2Fmain%2F.env.example)

## The idea

```
fire(animals).com   →   firedog.com   firetiger.com   firewolf.com
```

- `( )` — the AI fills it in (e.g. `(animals)`, `(two cybersecurity terms)`).
- `/` — exact options, no AI (e.g. `(com/io)` → both `.com` and `.io`).
- Everything else is literal. Combine up to 4 patterns per query.

## API keys

| Key | Required? | Get it |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | **Required** for AI suggestions (without it, only `/`-style literal patterns work) | https://openrouter.ai/keys |
| `DOMAINR_RAPIDAPI_KEY` | Optional — improves availability accuracy; RDAP+WHOIS cover most TLDs without it | https://rapidapi.com/domainr/api/domainr |

Optional: set `OPENROUTER_MODEL` to override the model (default `google/gemini-3.5-flash`, cheaper `google/gemini-3.1-flash-lite`).

## Run locally

```bash
npm install
cp .env.example .env.local   # add your OpenRouter key
npm run dev
```

Open http://localhost:3000.

## Stack

Next.js + Vercel AI SDK + OpenRouter.

## License

[MIT](LICENSE) © Agam More
