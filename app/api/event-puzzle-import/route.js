import sharp from 'sharp'
import {randomUUID} from 'node:crypto'
import {puzzleZip} from '@/lib/puzzle-zip'
import {eventDB} from '@/lib/event-server'
import {isEventAdmin,adminEvent,eventReply as reply,sameOrigin} from '@/lib/event-access'
export const runtime='nodejs'
export const maxDuration=120
export async function POST(request){
 if(!await isEventAdmin())return reply({error:'管理ログインが必要です。'},401)
 if(!sameOrigin(request))return reply({error:'操作元を確認できません。'},403)
 const db=eventDB(),paths=[],assets=[]
 try{
  const fd=await request.formData(),id=fd.get('event_id'),file=fd.get('file'),event=await adminEvent(db,id)
  if(!event||event.event_type!=='puzzle')throw Error('画像パズルのイベントを選んでください。')
  const {count,error}=await db.from('bambi_event_cards').select('id',{count:'exact',head:true}).eq('event_id',id);if(error)throw error;if(count)throw Error('カード発行後は取り込めません。')
  if(!file||file.size>4*1024*1024)throw Error('ZIPは4MB以下にしてください。')
  const images=puzzleZip(Buffer.from(await file.arrayBuffer())),metadata=[]
  for(const f of images){const m=await sharp(f.data,{limitInputPixels:40000000}).metadata();if(m.format!=='png'||m.pages>1||!m.hasAlpha)throw Error('透過PNGを使用してください。');metadata.push(m)}
  if(metadata.reduce((sum,m)=>sum+m.width*m.height,0)>100000000)throw Error('画像全体の解像度が大きすぎます。全ピースを同じ比率で縮小してください。')
  if(metadata.some(m=>m.width!==metadata[0].width||m.height!==metadata[0].height))throw Error('全ピースのキャンバス寸法を揃えてください。')
  const m=metadata[0],factor=Math.min(1,1600/Math.max(m.width,m.height)),w=Math.round(m.width*factor),h=Math.round(m.height*factor)
  async function save(data,kind){if(data.length>5*1024*1024)throw Error('画像の容量が大きすぎます。');const assetId=randomUUID(),path=`${id}/${assetId}.png`;const {error:u}=await db.storage.from('bambi-event-assets').upload(path,data,{contentType:'image/png',upsert:false});if(u)throw u;paths.push(path);const a={id:assetId,event_id:id,storage_path:path,kind,width:w,height:h};const {error:e}=await db.from('bambi_event_assets').insert(a);if(e)throw e;assets.push(a);return assetId}
  const normalized=[];for(const f of images)normalized.push(await sharp(f.data).resize(w,h,{fit:'fill'}).png().toBuffer())
  const background=await save(await sharp({create:{width:w,height:h,channels:4,background:'#e9ede5'}}).composite(normalized.map(input=>({input,left:0,top:0}))).png().toBuffer(),'background'),slots=[]
  for(const [i,f]of images.entries()){const asset_id=await save(normalized[i],'piece');slots.push({id:randomUUID(),label:`お題${i+1}`,x:50,y:50,size:8.6,angle:0,asset_id})}
  return reply({assets:assets.map(({storage_path,...a})=>a),layout:{puzzle:true,puzzle_mode:'import',background,aspect:w/h,stamp_mode:'common',stamp:'',slots,number:{x:76,y:14,size:2,visible:false},name:{x:76,y:20,size:2,visible:false}}})
 }catch(e){for(const a of assets)await db.from('bambi_event_assets').delete().eq('id',a.id);if(paths.length)await db.storage.from('bambi-event-assets').remove(paths);return reply({error:e.message||'取り込みに失敗しました。'},400)}
}
