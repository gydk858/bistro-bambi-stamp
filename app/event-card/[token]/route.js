import { eventDB } from '@/lib/event-server'
import { renderEventImage } from '@/lib/event-image'
import { cachedEventImage } from '@/lib/event-image-cache'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request,{params}) {
 const {token}=await params,id=token.replace(/\.png$/,'')
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})
 try {
  const db=eventDB(),{data:card,error}=await db.from('bambi_event_cards').select('card_no,display_name,stamps,marked_slots,event_id,version').eq('print_token',id).maybeSingle()
  if(error)throw error
  if(!card)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})
  const {data:event,error:ee}=await db.from('bambi_events').select('id,name,max_stamps,event_type,layout,starts_on,ends_on,version').eq('id',card.event_id).single()
  if(ee)throw ee
  const image=await cachedEventImage(`png-v25:${id}:${card.version}:${event.version}`,async()=>{
   const assets=new Map()
   async function getAsset(assetId){if(!assets.has(assetId))assets.set(assetId,(async()=>{
    const {data:a,error:ae}=await db.from('bambi_event_assets').select('storage_path').eq('id',assetId).eq('event_id',event.id).single()
    if(ae)throw ae
    const {data,error:de}=await db.storage.from('bambi-event-assets').download(a.storage_path)
    if(de)throw de
    return Buffer.from(await data.arrayBuffer())
   })());return assets.get(assetId)}
   // Download only required images, concurrently rather than one per stamped slot.
   if(event.layout?.background){const needed=new Set([event.layout.background]);for(const [i,s] of (event.layout.slots||[]).entries())if(event.event_type==='specific'?(card.marked_slots||[]).includes(s.id):i<card.stamps)needed.add(event.layout.stamp_mode==='individual'?s.asset_id:event.layout.stamp);await Promise.all([...needed].map(getAsset))}
   return renderEventImage(event,card,getAsset)
  })
  return new Response(image,{headers:{'Content-Type':'image/png','Content-Length':String(image.length),'Cache-Control':'public, max-age=1, s-maxage=1, must-revalidate','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})
 }catch(error){console.error('event-card image request failed',{code:error?.code||'unknown'});return new Response('Card image unavailable',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'1'}})}
}
export async function HEAD(request,context){const response=await GET(request,context);return new Response(null,{status:response.status,headers:response.headers})}
