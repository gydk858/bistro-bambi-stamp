import { prepareCardPrint, cardPrintContext, directCardPrint } from '@/lib/event-print'
import { eventDB, currentEventStore } from '@/lib/event-server'
import { isEventAdmin, adminEvent, eventAssets, eventCards, eventFields, eventReply as reply, sameOrigin } from '@/lib/event-access'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  if (!await isEventAdmin()) return reply({ error: '管理ログインをやり直してください。' }, 401)
  try {
    const db=eventDB(), q=new URL(request.url).searchParams, id=q.get('event_id')
    if(!id) {
      const { data,error }=await db.from('bambi_events').select(eventFields).eq('store_id',await currentEventStore(db)).order('created_at',{ascending:false}).limit(1000)
      if(error)throw error
      return reply({events:data})
    }
    const event=await adminEvent(db,id)
    if(!event)return reply({error:'イベントが見つかりません。'},404)
    const [cards,assets,total]=await Promise.all([eventCards(db,id,q),eventAssets(db,id),db.from('bambi_event_cards').select('id',{head:true,count:'exact'}).eq('event_id',id)])
    if(total.error)throw total.error
    return reply({event,...cards,assets,has_cards:total.count>0})
  }catch(e){return reply({error:e.message||'取得に失敗しました。'},500)}
}
export async function POST(request) {
  if(!await isEventAdmin())return reply({error:'管理ログインをやり直してください。'},401)
  if(!sameOrigin(request))return reply({error:'操作元を確認できません。'},403)
  try {
    const payload=await request.json()
    if(JSON.stringify(payload).length>100000)return reply({error:'設定が大きすぎます。'},400)
    const db=eventDB()
    if(payload.action==='direct_print'){const event=await adminEvent(db,payload.event_id);if(!event)return reply({error:'イベントが見つかりません。'},404);return reply(await directCardPrint(db,payload.card_id,event.id))}
    if(payload.action==='prepare_card'){const event=await adminEvent(db,payload.event_id);if(!event)return reply({error:'イベントが見つかりません。'},404);const {card}=await cardPrintContext(db,payload.card_id,event.id);return reply({result:card,...await prepareCardPrint(db,card)})}
    const {data,error}=await db.rpc('bambi_event_action_v2',{p_store_id:await currentEventStore(db),p_action:payload.action,p_data:payload,p_access_token:null})
    if(error)return reply({error:error.message},400)
    let warning=''
    if(data?.storage_paths?.length){try{const {error:cleanup}=await db.storage.from('bambi-event-assets').remove(data.storage_paths);if(cleanup)warning='削除は完了しましたが、画像ファイルの後片付けに失敗しました。Storage内に未使用ファイルが残っています。'}catch{warning='削除は完了しましたが、Storage内に未使用ファイルが残っています。'}}
    if(data?.print_paths?.length){for(let i=0;i<data.print_paths.length;i+=100){const {error:cleanup}=await db.storage.from('bambi-event-prints').remove(data.print_paths.slice(i,i+100));if(cleanup)warning='削除は完了しましたが、印刷画像の後片付けに失敗しました。'}}
    if(data?.live_paths?.length){for(let i=0;i<data.live_paths.length;i+=100){const {error:cleanup}=await db.storage.from('bambi-event-live').remove(data.live_paths.slice(i,i+100));if(cleanup)warning='削除は完了しましたが、公開画像の削除に失敗しました。Supabase Storageのbambi-event-liveから対象画像を削除してください。'}}
    const {storage_paths,print_paths,live_paths,...result}=data||{}
    return reply({result,warning,...(['create_card','update_card','stamp_card','update_name'].includes(payload.action)?await prepareCardPrint(db,result):{})})
  }catch(e){return reply({error:e.message||'保存に失敗しました。'},500)}
}
