import { eventDB } from '@/lib/event-server'
import { isEventAdmin, adminEvent, sameOrigin, eventReply as reply } from '@/lib/event-access'
import { renderEventImage } from '@/lib/event-image'
export const dynamic='force-dynamic'
export const runtime='nodejs'

export async function POST(request) {
 if(!await isEventAdmin())return reply({error:'管理ログインをやり直してください。'},401)
 if(!sameOrigin(request))return reply({error:'操作元を確認できません。'},403)
 try{
  const text=await request.text()
  if(text.length>100000)return reply({error:'設定が大きすぎます。'},400)
  let input;try{input=JSON.parse(text)}catch{return reply({error:'設定が不正です。'},400)}
  if(!input||!['sequential','specific'].includes(input.event_type)||typeof input.card_no!=='string'||!/^\d{1,18}$/.test(input.card_no)||typeof input.display_name!=='string'||input.display_name.length>40||typeof input.filled!=='boolean'||!input.layout?.background||input.layout.puzzle)return reply({error:'台紙・見本の番号・名前を確認してください。'},400)
  const db=eventDB(),event=await adminEvent(db,input.event_id)
  if(!event)return reply({error:'イベントが見つかりません。'},404)
  // This RPC validates only; it does not issue cards or update the event.
  const {error:invalid}=await db.rpc('bambi_validate_layout',{p_event:event.id,p_layout:input.layout,p_complete:input.filled})
  if(invalid)return reply({error:invalid.message},400)
  const assets=new Map()
  async function getAsset(id){
   if(!assets.has(id))assets.set(id,(async()=>{
    const {data:asset,error}=await db.from('bambi_event_assets').select('storage_path').eq('id',id).eq('event_id',event.id).single()
    if(error||!asset)throw Error('このイベントの画像を取得できません。')
    const {data,error:readError}=await db.storage.from('bambi-event-assets').download(asset.storage_path)
    if(readError)throw Error('画像を読み込めませんでした。')
    return Buffer.from(await data.arrayBuffer())
   })())
   return assets.get(id)
  }
  const slots=input.layout.slots||[]
  const card={card_no:input.card_no,display_name:input.display_name,stamps:input.filled?slots.length:0,marked_slots:input.filled?slots.map(s=>s.id):[]}
  const png=await renderEventImage({...event,event_type:input.event_type,layout:input.layout},card,getAsset,'large')
  return new Response(png,{headers:{'Content-Type':'image/png','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
 }catch{return reply({error:'プレビューを作成できませんでした。台紙と配置を確認し、再度お試しください。'},500)}
}
