import { config } from 'dotenv'
import { resolve } from 'path'

// Next.js reads .env.local first and falls back to .env, so the tests do too.
// dotenv never overwrites an already-set variable, which keeps that precedence
// and lets CI inject secrets through the real environment instead.
for (const file of ['.env.local', '.env']) {
  config({ path: resolve(process.cwd(), file) })
}
