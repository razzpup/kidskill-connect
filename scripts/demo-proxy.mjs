/**
 * One public origin for the whole demo.
 *
 * ngrok's free plan gives a single static domain, but this app needs two things
 * reachable from a phone: the Next server, and Supabase itself. The browser talks to
 * Supabase directly — sign-in, the search RPC, and the realtime websocket that carries
 * the demo's central moment all go device → Kong, never through Next. So tunnelling
 * only port 3002 leaves NEXT_PUBLIC_SUPABASE_URL pointing at 127.0.0.1, which on a
 * phone is that phone's own loopback.
 *
 * This puts both behind one port, split by path:
 *
 *     /supabase/*  ->  127.0.0.1:54421   (Kong: auth, rest, realtime)
 *     everything   ->  127.0.0.1:3002    (Next)
 *
 * Websocket upgrades are forwarded for both, which a Next.js `rewrites` rule cannot do
 * — that is the whole reason this file exists rather than a line of next.config.ts.
 * Realtime needs it, and so does Next's own dev-mode hot reload.
 *
 *     node scripts/demo-proxy.mjs [--port 3003]
 */

import http from 'node:http'
import net from 'node:net'

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const PORT = Number(arg('--port', 3003))
const PREFIX = '/supabase'
const SUPABASE = { host: '127.0.0.1', port: Number(arg('--supabase-port', 54421)) }
const NEXT = { host: '127.0.0.1', port: Number(arg('--app-port', 3002)) }

/** Which upstream serves this path, and what path it should see. */
function route(url) {
  if (url === PREFIX || url.startsWith(PREFIX + '/')) {
    // Kong routes on the path, so the prefix has to come off before forwarding.
    return { upstream: SUPABASE, path: url.slice(PREFIX.length) || '/' }
  }
  return { upstream: NEXT, path: url }
}

const server = http.createServer((req, res) => {
  const { upstream, path } = route(req.url)

  const proxied = http.request(
    { host: upstream.host, port: upstream.port, method: req.method, path,
      headers: { ...req.headers, host: `${upstream.host}:${upstream.port}` } },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )

  proxied.on('error', (err) => {
    // A dead upstream should say which one, not just fail.
    const name = upstream.port === SUPABASE.port ? 'Supabase (54421)' : 'Next (3002)'
    res.writeHead(502, { 'content-type': 'text/plain' })
    res.end(`demo-proxy: ${name} is not answering — ${err.message}\n`)
  })

  req.pipe(proxied)
})

/**
 * Websockets. Realtime rides one of these, so if this handler is wrong the parent
 * dashboard simply never updates and nothing in the UI says why.
 */
server.on('upgrade', (req, clientSocket, head) => {
  const { upstream, path } = route(req.url)

  const upstreamSocket = net.connect(upstream.port, upstream.host, () => {
    const lines = [
      `${req.method} ${path} HTTP/1.1`,
      ...Object.entries(req.headers).flatMap(([k, v]) =>
        (Array.isArray(v) ? v : [v]).map((one) =>
          k.toLowerCase() === 'host' ? `host: ${upstream.host}:${upstream.port}` : `${k}: ${one}`,
        ),
      ),
      '', '',
    ]
    upstreamSocket.write(lines.join('\r\n'))
    if (head?.length) upstreamSocket.write(head)
    upstreamSocket.pipe(clientSocket)
    clientSocket.pipe(upstreamSocket)
  })

  const drop = () => {
    upstreamSocket.destroy()
    clientSocket.destroy()
  }
  upstreamSocket.on('error', drop)
  clientSocket.on('error', drop)
})

server.listen(PORT, () => {
  console.log(`demo-proxy listening on http://127.0.0.1:${PORT}`)
  console.log(`  ${PREFIX}/*  ->  http://${SUPABASE.host}:${SUPABASE.port}`)
  console.log(`  /*          ->  http://${NEXT.host}:${NEXT.port}`)
})
