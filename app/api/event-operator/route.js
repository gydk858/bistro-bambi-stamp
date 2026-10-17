import { eventDB } from '@/lib/event-server'
import { operatorEvent, eventAssets, eventCards, eventReply as reply, sameOrigin } from '@/lib/event-access'
export const dynamic = 'force-dynamic'
export async function GET(request) {
  try {
    const db=eventDB(), event=await operatorEvent(db,request.headers.get('x-event-access'))
    if(!event)return reply({error:'この専用入口は利用できません。主催者に確認してください。'},403)
    const q=new URL(request.url).searchParams
    const [cards,assets]=await Promise.all([eventCards(db,event.id,q,true),eventAssets(db,event.id)])
    const {store_id,...safeEvent}=event
    return reply({event:safeEvent,...cards,assets})
  }catch{return reply({error:'読み込みに失敗しました。番号と接続状況を確認してください。'},400)}
}
export async function POST(request) {
  if(!sameOrigin(request))return reply({error:'操作元を確認できません。'},403)
  try {
    const token=request.headers.get('x-event-access'),db=eventDB(),event=await operatorEvent(db,token)
    if(!event)return reply({error:'専用入口が停止中、終了済み、またはURLが変更されています。'},403)
    const p=await request.json()
    if(!['create_card','update_card'].includes(p.action))return reply({error:'この操作はできません。'},403)
    // 認証済みイベントIDだけを使用。外部から指定されたevent_idは使わない。
    const payload={event_id:event.id,card_id:p.card_id,version:p.version,issue_key:p.issue_key,display_name:p.display_name,stamps:p.stamps,marked_slots:p.marked_slots,reason:p.reason}
    const {data,error}=await db.rpc('bambi_event_action_v2',{p_store_id:event.store_id,p_action:p.action,p_data:payload,p_access_token:token})
    if(error)return reply({error:error.message},400)
    return reply({result:data})
  }catch{return reply({error:'処理に失敗しました。通信状況を確認して再試行してください。'},500)}
}
