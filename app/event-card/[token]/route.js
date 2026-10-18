import { eventDB } from '@/lib/event-server'
import { storedEventPrint } from '@/lib/event-print'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request,{params}) {
 const {token}=await params,id=token.replace(/\.png$/,'')
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})
 try {
  const db=eventDB(),{data:card,error}=await db.from('bambi_event_cards').select('id,card_no,display_name,stamps,marked_slots,event_id,version').eq('print_token',id).maybeSingle()
  if(error)throw error
  if(!card)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})
  const {data:event,error:ee}=await db.from('bambi_events').select('id,name,max_stamps,event_type,layout,starts_on,ends_on,version').eq('id',card.event_id).single()
  if(ee)throw ee
  const image=await storedEventPrint(db,event,card,new URL(request.url).searchParams.get('size')==='original'?'original':'large')
  return new Response(image,{headers:{'Content-Type':'image/png','Content-Length':String(image.length),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})
 }catch(error){console.error('event-card image request failed',{code:error?.code||'unknown'});return new Response('Card image unavailable',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'1'}})}
}
export async function HEAD(request,context){const response=await GET(request,context);return new Response(null,{status:response.status,headers:response.headers})}
