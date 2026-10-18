import sharp from 'sharp'
import { randomUUID } from 'node:crypto'
import { eventDB } from '@/lib/event-server'
import { isEventAdmin, adminEvent, eventReply as reply, sameOrigin } from '@/lib/event-access'
export const runtime='nodejs'
export async function POST(request) {
 if(!await isEventAdmin())return reply({error:'管理ログインが必要です。'},401)
 if(!sameOrigin(request))return reply({error:'操作元を確認できません。'},403)
 try {
  const form=await request.formData(),id=form.get('event_id'),kind=form.get('kind'),file=form.get('file'),db=eventDB()
  if(!['background','stamp','puzzle_base'].includes(kind)||!file||typeof file.arrayBuffer!=='function'||file.size>2*1024*1024)return reply({error:'PNG・JPEG・WebPの2MB以下の画像を選んでください。'},400)
  const event=await adminEvent(db,id);if(!event)return reply({error:'イベントが見つかりません。'},404)
  const {count,error:checkError}=await db.from('bambi_event_cards').select('id',{count:'exact',head:true}).eq('event_id',id)
  if(checkError)throw checkError
  if(count)return reply({error:'カード発行後は画像を変更できません。'},400)
  const input=Buffer.from(await file.arrayBuffer()),pipeline=sharp(input,{limitInputPixels:40000000}),meta=await pipeline.metadata()
  if(!['png','jpeg','webp'].includes(meta.format)||meta.pages>1)return reply({error:'静止画のPNG・JPEG・WebPを選んでください。'},400)
  const limit=kind==='stamp'?512:1600
  const {data:png,info}=await pipeline.rotate().resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true})
  if(png.length>5*1024*1024)return reply({error:'画像が大きすぎます。解像度を下げてください。'},400)
  const assetId=randomUUID(),storagePath=`${id}/${assetId}.png`
  const {error:upError}=await db.storage.from('bambi-event-assets').upload(storagePath,png,{contentType:'image/png',upsert:false})
  if(upError)throw upError
  const {data,error}=await db.from('bambi_event_assets').insert({id:assetId,event_id:id,storage_path:storagePath,kind,width:info.width,height:info.height}).select('id,event_id,kind,width,height').single()
  if(error){await db.storage.from('bambi-event-assets').remove([storagePath]);throw error}
  return reply({asset:data})
 }catch{return reply({error:'画像の登録に失敗しました。画像形式とStorageの設定を確認してください。'},400)}
}
