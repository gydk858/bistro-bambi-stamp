import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = {
  'Cache-Control': 'no-store',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Image-Mode': 'fresh-storage',
}

export async function GET(request, { params }) {
  const { token } = await params
  const id = token.replace(/\.png$/, '')
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
    return new Response('Not found', { status: 404, headers })
  }
  try {
    // Read only the existing public live PNG: no DB, rendering or privileged key.
    const url = new URL(`/storage/v1/object/public/bambi-event-live/${id.toLowerCase()}.png`, process.env.NEXT_PUBLIC_SUPABASE_URL)
    // A new origin fetch for each request; the customer-facing URL stays fixed.
    url.searchParams.set('cacheNonce', randomUUID())
    const upstream = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      return new Response('Image unavailable. Prepare the card image first.', { status: upstream.status === 404 ? 404 : 503, headers })
    }
    if (!upstream.headers.get('content-type')?.toLowerCase().startsWith('image/png') || Number(upstream.headers.get('content-length')) > 20971520) {
      await upstream.body?.cancel()
      throw Error('Invalid image response')
    }
    const image = Buffer.from(await upstream.arrayBuffer())
    if (image.length > 20971520 || !image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('Invalid PNG')
    return new Response(image, { headers: { ...headers, 'Content-Type': 'image/png', 'Content-Length': String(image.length) } })
  } catch {
    console.error('event-card-fast image fetch failed')
    return new Response('Image temporarily unavailable', { status: 503, headers })
  }
}

export async function HEAD(request, context) {
  const response = await GET(request, context)
  await response.body?.cancel()
  return new Response(null, { status: response.status, headers: response.headers })
}
