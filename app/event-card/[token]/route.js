import { eventDB } from '@/lib/event-server'
import { renderEventImage } from '@/lib/event-image'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(_request,{params}) {
 const {token}=await params,id=token.replace(/\.png$/,'')
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return new Response('Not found',{status:404})
 try {
  const db=eventDB(),{data:card,error}=await db.from('bambi_event_cards').select('card_no,display_name,stamps,marked_slots,event_id').eq('print_token',id).maybeSingle()
  if(error)throw error
  if(!card)return new Response('Not found',{status:404})
  const {data:event,error:ee}=await db.from('bambi_events').select('id,name,max_stamps,event_type,layout,starts_on,ends_on').eq('id',card.event_id).single()
  if(ee)throw ee
  const cache=new Map()
  async function getAsset(assetId) {
   if(!cache.has(assetId))cache.set(assetId,(async()=>{
    const {data:a,error:ae}=await db.from('bambi_event_assets').select('storage_path').eq('id',assetId).eq('event_id',event.id).single()
    if(ae)throw ae
    const {data,error:de}=await db.storage.from('bambi-event-assets').download(a.storage_path)
    if(de)throw de
    return Buffer.from(await data.arrayBuffer())
   })())
   return cache.get(assetId)
  }
  const image=await renderEventImage(event,card,getAsset)
  return new Response(image,{headers:{'Content-Type':'image/png','Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})
 }catch{return new Response('Card image unavailable',{status:503})}
}
