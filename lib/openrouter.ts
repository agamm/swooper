import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

// Every prompt this app sends contains what the user is building, which is
// often unannounced product work. Restrict routing to Zero Data Retention
// endpoints so no provider keeps the prompt, and refuse providers that collect
// data for training. OpenRouter applies these filters to fallbacks too, so a
// failover cannot quietly land on a retaining provider.
//
// The trade-off: if a model has no ZDR endpoint, the request fails rather than
// silently downgrading. That is the intended behaviour — see ZDR_HINT.
const ZDR_ROUTING = {
  provider: {
    zdr: true,
    data_collection: 'deny' as const,
  },
}

export const ZDR_HINT =
  'No Zero Data Retention endpoint is available for this model. Pick a different model via OPENROUTER_MODEL / OPENROUTER_RANKER_MODEL, or check https://openrouter.ai/docs/features/zdr'

/** An OpenRouter model pinned to Zero Data Retention routing. */
export function zdrModel(modelId: string) {
  return openrouter(modelId, ZDR_ROUTING)
}

/** True when a request failed because no ZDR endpoint could serve the model. */
export function isNoZdrEndpointError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /no (?:allowed |available )?(?:endpoints|providers)/i.test(message) || /zdr/i.test(message)
}
