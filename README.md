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

Naming a real-world category gives you real members of it; describing a *style*
(`(brandable)`, `(two cybersecurity terms)`) gets you coined words instead.

## Describe mode

If you don't want to write a pattern, switch to **Describe** and write a
paragraph about what you're building and how you want it to sound. You get five
patterns back, each taking a different naming strategy — a literal category, a
coined blend, a metaphor, an abstract brandable, a TLD pun — with a one-line
rationale and sample expansions.

Picking one runs it immediately and leaves your paragraph and the other four on
screen, so switching between angles costs one click.

## Finding a name in the results

- **Filter** to just the available names, or **sort** them best-first (short,
  clean, easy to say).
- **AI pick** — a toggle that hands the available names to a cheaper model and
  returns its top five with a one-line reason each.
- **More like this** — the wand on any available row reruns the search seeded
  with that name.

Availability is reported as available, taken, or **unknown**. Unknown means the
registry did not give a straight answer; it is never silently folded into
"taken", so a free name can't disappear from the list.

## API keys

| Key | Required? | Get it |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | **Required** for AI suggestions (without it, only `/`-style literal patterns work) | https://openrouter.ai/keys |
| `DOMAINR_RAPIDAPI_KEY` | Optional — improves availability accuracy; RDAP+WHOIS cover most TLDs without it | https://rapidapi.com/domainr/api/domainr |

Optional: `OPENROUTER_MODEL` overrides the generation model (default
`anthropic/claude-sonnet-5`, cheaper `google/gemini-3.5-flash`), and
`OPENROUTER_RANKER_MODEL` overrides the model behind the AI pick panel
(default `google/gemini-3.1-flash-lite`).

## Prompt privacy

Your prompts describe what you're building, often before it's announced. Every
OpenRouter call is pinned to [Zero Data
Retention](https://openrouter.ai/docs/features/zdr) routing (`zdr: true`) and
refuses providers that collect data for training (`data_collection: "deny"`).
OpenRouter applies both to failover too, so a fallback can't quietly land on a
retaining provider.

The trade-off: if you override a model with one that has no ZDR endpoint, the
request fails rather than silently downgrading.

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
