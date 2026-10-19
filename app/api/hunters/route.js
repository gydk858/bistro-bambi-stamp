import sharp from 'sharp'
import {randomUUID} from 'node:crypto'
import {eventDB} from '@/lib/event-server'
import {eventReply as reply,sameOrigin} from '@/lib/event-access'
import {hunterAuth,hunterCard,hunterAsset,hunterPublicURL,prepareHunterPrint,HUNTER_FIELDS,hunterRanks,hunterStats,withMission} from '@/lib/hunter-server'
import {renderHunterImage,hunterTemplate,renderHunterRecords} from '@/lib/hunter-image'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120
const pngResponse=png=>new Response(png,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})
const clean=c=>{const {print_owner,print_until,issue_key,store_id,...rest}=c;return rest}
export async function GET(request){
 const db=eventDB(),q=new URL(request.url).searchParams;let auth
 try{auth=await hunterAuth(db,request.headers.get('x-hunter-token'))}catch(e){return reply({error:e.message},401)}
 try{
  const {store,settings,operator}=auth
  if(q.has('template'))return pngResponse(await sharp(hunterTemplate()).png().toBuffer())
  if(q.has('asset'))return pngResponse(await hunterAsset(db,store)(q.get('asset')))
  if(q.has('image')){const c=await hunterCard(db,store,q.get('image'));return pngResponse(q.get('page')==='2'?await renderHunterRecords(c,await hunterStats(db,c.id),settings.animals):await renderHunterImage(settings,withMission(c,await hunterRanks(db,store)),hunterAsset(db,store)))}
  if(q.has('id')){const card=await hunterCard(db,store,q.get('id'));const {data:history,error}=await db.from('bambi_hunter_history').select('id,action,before_data,after_data,actor,created_at').eq('hunter_id',card.id).order('created_at',{ascending:false}).limit(30);if(error)throw error;const rp=Math.max(0,Math.floor(Number(q.get('record_page'))||0));const {data:records,error:re,count:record_count}=await db.from('bambi_hunter_records').select('*',{count:'exact'}).eq('hunter_id',card.id).order('created_at',{ascending:false}).range(rp*30,rp*30+29);if(re)throw re;return reply({card,history,records,record_count,stats:await hunterStats(db,card.id),ranks:await hunterRanks(db,store),print_url:hunterPublicURL(db,card)})}
  const term=(q.get('search')||'').trim().replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));if(term&&!/^\d{1,15}$/.test(term))throw Error('管理番号を数字で入力してください。')
  const page=Math.max(0,Math.min(100000,Math.floor(Number(q.get('page'))||0)));let query=db.from('bambi_hunters').select(HUNTER_FIELDS,{count:'exact'}).eq('store_id',store);if(term)query=query.eq('hunter_no',term)
  const {data:cards,error,count}=await query.order('hunter_no',{ascending:true}).range(page*50,page*50+49);if(error)throw error;return reply({cards,count,ranks:await hunterRanks(db,store),settings})
 }catch(e){return reply({error:e.message||'取得に失敗しました。'},400)}
}
export async function POST(request){
 if(!sameOrigin(request))return reply({error:'操作元を確認できません。'},403)
 const db=eventDB();let auth;const token=request.headers.get('x-hunter-token')||null
 try{auth=await hunterAuth(db,token)}catch(e){return reply({error:e.message},401)}
 try{
  const {store,operator}=auth
  if(request.headers.get('content-type')?.includes('multipart/form-data')){
   const fd=await request.formData(),file=fd.get('file'),kind=fd.get('kind')
   if(!['photo','background'].includes(kind)||(operator&&kind!=='photo'))return reply({error:'この画像は登録できません。'},403)
   if(!file||typeof file.arrayBuffer!=='function'||file.size>2*1024*1024)throw Error('2MB以下の画像を選んでください。')
   const pipeline=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:40000000}),meta=await pipeline.metadata();if(!['png','jpeg','webp'].includes(meta.format)||meta.pages>1)throw Error('静止画のPNG・JPEG・WebPを選んでください。')
   const png=await pipeline.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).png().toBuffer();if(png.length>5*1024*1024)throw Error('画像が大きすぎます。')
   const id=randomUUID(),storage_path=`${store}/${id}.png`;const {error}=await db.storage.from('bambi-hunter-assets').upload(storage_path,png,{contentType:'image/png',upsert:false});if(error)throw error
   const {error:e}=await db.from('bambi_hunter_assets').insert({id,store_id:store,kind,storage_path});if(e){await db.storage.from('bambi-hunter-assets').remove([storage_path]);throw e}return reply({asset:{id,kind}})
  }
  const body=await request.json();if(JSON.stringify(body).length>10000)throw Error('入力が長すぎます。')
  if(body.action==='prepare'){const card=await hunterCard(db,store,body.id);return reply({card,print_url:hunterPublicURL(db,card),...await prepareHunterPrint(store,card.id)})}
  const old=['create','profile','background'],next=['animals_save','rank_save','record_save','record_delete','legacy_count','owner_rotate','owner_access'];if(!old.includes(body.action)&&!next.includes(body.action))throw Error('この操作は利用できません。')
  if(body.action==='profile') {const c=await hunterCard(db,store,body.id);const ranks=await hunterRanks(db,store);if(body.rank&&body.rank!==c.rank&&!ranks.some(r=>r.rank===body.rank))throw Error('先にランクを設定に登録してください。');body.mission=c.mission}
  if(body.action==='create'&&body.rank&&!(await hunterRanks(db,store)).some(r=>r.rank===body.rank))throw Error('先にランクを設定に登録してください。')
  const {data,error}=await db.rpc(next.includes(body.action)?'bambi_hunter_action_v214':'bambi_hunter_action',next.includes(body.action)?{p_store:store,p_action:body.action,p_data:body,p_owner:null}:{p_store:store,p_action:body.action,p_data:body,p_token:null});if(error)throw error
  if(['create','profile','record_save','record_delete','legacy_count','owner_rotate','owner_access'].includes(body.action))return reply({card:clean(data),print_url:hunterPublicURL(db,data),...await prepareHunterPrint(store,data.id)})
  return reply({settings:data})
 }catch(e){return reply({error:e.code==='23514'?'入力範囲を確認してください。頭数は0〜999999、サイズは正の数・最小≦最大です。1頭の場合は最小と最大を同じにしてください。文字数の上限も確認してください。':e.message||'保存に失敗しました。'},400)}
}
