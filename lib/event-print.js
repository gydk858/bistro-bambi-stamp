import { renderEventImage } from './event-image'
import { cachedEventImage } from './event-image-cache'
export const PRINT_BUCKET='bambi-event-prints'
export async function cardPrintContext(db,cardId,eventId) {
 const {data:card,error}=await db.from('bambi_event_cards').select('*').eq('id',cardId).eq('event_id',eventId).single()
 if(error)throw error
 const {data:event,error:ee}=await db.from('bambi_events').select('id,name,max_stamps,event_type,layout,starts_on,ends_on,version').eq('id',eventId).single()
 if(ee)throw ee
 return {card,event}
}
export async function storedEventPrint(db,event,card,profile='large') {
 const path=`${event.id}/${card.id}/v26-${card.version}-${event.version}-${profile}.png`
 return cachedEventImage(path,async()=>{
  const {data:stored,error:readError}=await db.storage.from(PRINT_BUCKET).download(path)
  if(!readError&&stored)return Buffer.from(await stored.arrayBuffer())
  const assets=new Map()
  async function getAsset(id){if(!assets.has(id))assets.set(id,(async()=>{
   const {data:a,error:ae}=await db.from('bambi_event_assets').select('storage_path').eq('id',id).eq('event_id',event.id).single();if(ae)throw ae
   const {data,error}=await db.storage.from('bambi-event-assets').download(a.storage_path);if(error)throw error
   return Buffer.from(await data.arrayBuffer())
  })());return assets.get(id)}
  if(event.layout?.background){const ids=new Set([event.layout.background]);for(const [i,s]of(event.layout.slots||[]).entries())if(event.event_type==='specific'?(card.marked_slots||[]).includes(s.id):i<card.stamps)ids.add(event.layout.stamp_mode==='individual'?s.asset_id:event.layout.stamp);await Promise.all([...ids].map(getAsset))}
  const png=await renderEventImage(event,card,getAsset,profile)
  // Reserve the path before upload so deletion can clean up generated images too.
  const {error:recordError}=await db.from('bambi_event_renders').upsert({card_id:card.id,storage_path:path},{onConflict:'storage_path'})
  if(recordError)throw recordError
  const {error}=await db.storage.from(PRINT_BUCKET).upload(path,png,{contentType:'image/png',cacheControl:'31536000',upsert:false})
  if(error&&String(error.statusCode||error.status)!=='409')throw error
  return png
 })
}
export async function prepareCardPrint(db,card) {
 try{const context=await cardPrintContext(db,card.id,card.event_id);await storedEventPrint(db,context.event,context.card);return {print_ready:true}}
 catch(error){console.error('event-print prepare failed',{code:error?.code||error?.statusCode||'unknown'});return {print_ready:false,print_error:'カードは保存済みですが、印刷画像の準備に失敗しました。「画像を再準備」を押してください。'}}
}
