// When LANDING_ONLY is true, the deployment shows a "deploy your own" landing
// page instead of the live tool, and the AI API routes refuse to run. This lets
// you host a public showcase (e.g. swooper.vercel.app) that points people to the
// repo WITHOUT spending your own OpenRouter credits on strangers' searches.
//
// Set NEXT_PUBLIC_LANDING_ONLY=true on your hosted Vercel project.
// Leave it unset (the default) to run the full, working app — e.g. when someone
// self-hosts their own copy with their own key, or for local development.
export const LANDING_ONLY = process.env.NEXT_PUBLIC_LANDING_ONLY === 'true'
