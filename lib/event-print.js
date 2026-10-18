import { randomUUID } from 'node:crypto'
import { eventDB } from './event-server'
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
function printPath(event,card,profile='large'){return `${event.id}/${card.id}/v211-${card.version}-${event.version}-${profile}.png`}
export async function storedEventPrint(db,event,card,profile='large') {
 const path=printPath(event,card,profile)
 return cachedEventImage(path,async()=>{
  const {data:stored,error:readError}=await db.storage.from(PRINT_BUCKET).download(path)
  if(!readError&&stored)return Buffer.from(await stored.arrayBuffer())
  const assets=new Map()
  async function getAsset(id){if(!assets.has(id))assets.set(id,(async()=>{
   const {data:a,error:ae}=await db.from('bambi_event_assets').select('storage_path').eq('id',id).eq('event_id',event.id).single();if(ae)throw ae
   const {data,error}=await db.storage.from('bambi-event-assets').download(a.storage_path);if(error)throw error
   return Buffer.from(await data.arrayBuffer())
  })());return assets.get(id)}
  if(event.layout?.background){const ids=new Set([event.layout.background]);for(const [i,s]of(event.layout.slots||[]).entries())if(event.event_type==='sequential'?i<card.stamps:(card.marked_slots||[]).includes(s.id)){const asset=event.layout.puzzle?(event.layout.puzzle_mode==='import'?s.asset_id:null):event.layout.stamp_mode==='individual'?s.asset_id:event.layout.stamp;if(asset)ids.add(asset)}await Promise.all([...ids].map(getAsset))}
  const png=await renderEventImage(event,card,getAsset,profile)
  // Reserve the path before upload so deletion can clean up generated images too.
  const {error:recordError}=await db.from('bambi_event_renders').upsert({card_id:card.id,storage_path:path},{onConflict:'storage_path'})
  if(recordError)throw recordError
  const {error}=await db.storage.from(PRINT_BUCKET).upload(path,png,{contentType:'image/png',cacheControl:'31536000',upsert:false})
  if(error&&String(error.statusCode||error.status)!=='409')throw error
  return png
 })
}
export const LIVE_BUCKET='bambi-event-live'
export async function publishLivePrint(db,card) {
 // All publication requests have a 20-second network timeout, well below the lease.
 const owner=randomUUID(),args={p_card_id:card.id,p_event_id:card.event_id,p_owner:owner}
 async function lock(action){const {data,error}=await db.rpc('bambi_event_live_lock',{...args,p_action:action});if(error)throw error;return data}
 // Generate before claiming so expensive first-time renders do not hold the lease.
 let context=await cardPrintContext(db,card.id,card.event_id)
 await storedEventPrint(db,context.event,context.card)
 if(!await lock('claim'))throw Error('画像更新中です。少し待って再準備してください。')
 let uploadUncertain=false
 try{
  for(let attempt=0;attempt<4;attempt++){
   context=await cardPrintContext(db,card.id,card.event_id)
   const png=await storedEventPrint(db,context.event,context.card)
   if(!await lock('renew'))throw Error('画像更新の権限が期限切れです。再準備してください。')
   uploadUncertain=true
   const {error}=await db.storage.from(LIVE_BUCKET).upload(`${context.card.print_token}.png`,png,{contentType:'image/png',cacheControl:'0',upsert:true})
   if(error)throw error
   uploadUncertain=false
   const latest=await cardPrintContext(db,card.id,card.event_id)
   if(latest.card.version===context.card.version&&latest.event.version===context.event.version)return
   // If another staff member saved during upload, publish the newest state before releasing.
  }
  throw Error('更新が続いています。少し待って画像を再準備してください。')
 }finally{
  // On a transport failure keep the lease until expiry; the remote write may still be running.
  if(!uploadUncertain)await lock('release')
 }
}
export async function prepareCardPrint(db,card) {
 try{await publishLivePrint(eventDB(20000),card);return {print_ready:true}}
 catch(error){console.error('event-print prepare failed',{code:error?.code||error?.statusCode||'unknown'});return {print_ready:false,print_error:'カードは保存済みですが、公開画像を更新できませんでした。少し待って「画像を再準備」を押してください。通信障害後は最大2分待ってから再試行してください。'}}
}

// Diagnostic snapshot: private bucket, scoped authorization is checked by callers.
// This bypasses the application route/DB only after issuance; it is not a live card URL.
export async function directCardPrint(db,cardId,eventId) {
 const {event,card}=await cardPrintContext(db,cardId,eventId)
 await storedEventPrint(db,event,card)
 const expiresIn=24*60*60
 const {data,error}=await db.storage.from(PRINT_BUCKET).createSignedUrl(printPath(event,card),expiresIn)
 if(error)throw error
 if(!data?.signedUrl)throw Error('比較用URLを発行できませんでした。')
 return {direct_url:data.signedUrl,expires_at:new Date(Date.now()+expiresIn*1000).toISOString(),card_version:card.version,event_version:event.version}
}
