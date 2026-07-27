// Turn "google/gemini-3.5-flash" into "Gemini 3.5 Flash" for the UI byline.
// Lives on its own so client components can render a model name without
// importing the server-only OpenRouter clients.
export function prettifyModelName(id: string): string {
  const slug = id.split('/').pop() ?? id
  return slug
    .split('-')
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}
