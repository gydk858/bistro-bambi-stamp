import { eventDB } from '@/lib/event-server'
import { isEventAdmin, adminEvent, operatorEvent } from '@/lib/event-access'
export const dynamic='force-dynamic'
export async function GET(request,{params}) {
 try {
  const {id}=await params,db=eventDB()
  const {data:asset,error}=await db.from('bambi_event_assets').select('*').eq('id',id).maybeSingle()
  if(error||!asset)return new Response('Not found',{status:404})
  const token=request.headers.get('x-event-access')
  const event=token?await operatorEvent(db,token):await isEventAdmin()?await adminEvent(db,asset.event_id):null
  if(!event||event.id!==asset.event_id)return new Response('Forbidden',{status:403})
  const {data,error:downloadError}=await db.storage.from('bambi-event-assets').download(asset.storage_path)
  if(downloadError)throw downloadError
  return new Response(await data.arrayBuffer(),{headers:{'Content-Type':'image/png','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})
 }catch{return new Response('Image unavailable',{status:503})}
}
