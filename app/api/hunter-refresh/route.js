import {timingSafeEqual} from 'node:crypto'
import {eventDB,currentEventStore} from '@/lib/event-server'
import {prepareHunterPrint,hunterCard} from '@/lib/hunter-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}})
function authorized(request){
 const secret=process.env.HUNTER_REFRESH_SECRET
 if(!secret||secret.length<32)return false
 const a=Buffer.from(request.headers.get('authorization')||''),b=Buffer.from(`Bearer ${secret}`)
 return a.length===b.length&&timingSafeEqual(a,b)
}
// Snapshot bounded by hunter number; issuing a new card cannot extend a run forever.
export async function GET(request){
 if(!authorized(request))return reply({error:'Unauthorized'},401)
 try{
  const db=eventDB(20000),store=await currentEventStore(db),q=new URL(request.url).searchParams
  if(q.has('store')&&q.get('store')!==String(store))return reply({error:'Store changed. Start a new run.'},409)
  const after=q.get('after')||'0';let upper=q.get('upper')
  if(!/^\d{1,15}$/.test(after)||(upper!==null&&!/^\d{1,15}$/.test(upper)))return reply({error:'Invalid cursor'},400)
  if(upper===null){const {data,error}=await db.from('bambi_hunters').select('hunter_no').eq('store_id',store).order('hunter_no',{ascending:false}).limit(1);if(error)throw error;upper=String(data[0]?.hunter_no||0)}
  const {data,error}=await db.from('bambi_hunters').select('id,hunter_no').eq('store_id',store).gt('hunter_no',after).lte('hunter_no',upper).order('hunter_no',{ascending:true}).limit(50)
  if(error)throw error
  return reply({store:String(store),upper,cards:data,next:data.length?String(data[data.length-1].hunter_no):null})
 }catch{return reply({error:'Could not read refresh targets'},503)}
}
export async function POST(request){
 if(!authorized(request))return reply({error:'Unauthorized'},401)
 try{
  const data=await request.json()
  if(typeof data.id!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(data.id)||typeof data.store!=='string')return reply({error:'Invalid target'},400)
  const db=eventDB(20000),store=await currentEventStore(db)
  if(data.store!==String(store))return reply({error:'Store changed. Start a new run.'},409)
  await hunterCard(db,store,data.id)
  const result=await prepareHunterPrint(store,data.id)
  return reply({ok:result.print_ready},result.print_ready?200:503)
 }catch{return reply({error:'Could not refresh this card'},503)}
}
