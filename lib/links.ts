// Shared external links used across the public UI.

export const GITHUB_URL = 'https://github.com/agamm/appealing.ai'

export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'

// One-click deploy that prompts the user for their own keys.
// Mirrors the env vars documented in .env.example.
export const VERCEL_DEPLOY_URL =
  'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fagamm%2Fappealing.ai' +
  '&env=OPENROUTER_API_KEY,DOMAINR_RAPIDAPI_KEY,NEXT_PUBLIC_POSTHOG_KEY' +
  '&envDescription=API%20keys%20for%20AI%20suggestions%20and%20domain%20availability%20checks' +
  '&envLink=https%3A%2F%2Fgithub.com%2Fagamm%2Fappealing.ai%2Fblob%2Fmain%2F.env.example'
