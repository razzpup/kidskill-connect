/**
 * Points the browser-side Supabase URL at the running ngrok tunnel.
 *
 * ngrok's free plan hands out a new https://*.ngrok-free.dev domain every time it
 * restarts, and NEXT_PUBLIC_SUPABASE_URL is baked into the client bundle at server
 * start — so a stale value here is exactly why a second device gets "Load failed"
 * while the host machine, still talking to 127.0.0.1, looks fine. This reads the
 * live tunnel from ngrok's local inspection API (127.0.0.1:4040) and rewrites
 * .env.local to match, through the demo-proxy's /supabase prefix (see demo-proxy.mjs).
 *
 * Run this AFTER `npm run tunnel` is up, then restart `npm run dev` so the new
 * NEXT_PUBLIC_* value actually gets compiled in.
 *
 *     node scripts/sync-ngrok-url.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'

const ENV_PATH = new URL('../.env.local', import.meta.url)
const NGROK_URL_PATH = new URL('../.ngrok-url', import.meta.url)

async function currentTunnelUrl() {
  const res = await fetch('http://127.0.0.1:4040/api/tunnels').catch(() => null)
  if (!res || !res.ok) {
    throw new Error('Could not reach ngrok\'s local API on :4040 — is `npm run tunnel` running?')
  }
  const { tunnels } = await res.json()
  const https = tunnels.find((t) => t.proto === 'https')
  if (!https) throw new Error('No https tunnel found — is `npm run tunnel` up?')
  return https.public_url
}

const publicUrl = await currentTunnelUrl()
const supabaseUrl = `${publicUrl}/supabase`

let env = readFileSync(ENV_PATH, 'utf8')
if (env.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
  env = env.replace(/^NEXT_PUBLIC_SUPABASE_URL=.*$/m, `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`)
} else {
  env += `\nNEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}\n`
}
writeFileSync(ENV_PATH, env)
writeFileSync(NGROK_URL_PATH, publicUrl + '\n')

console.log(`Tunnel:  ${publicUrl}`)
console.log(`Set NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl} in .env.local`)
console.log('Now restart `npm run dev` — NEXT_PUBLIC_* values are compiled in at server start.')
