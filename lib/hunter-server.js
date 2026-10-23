import {randomUUID} from 'node:crypto'
import {eventDB,currentEventStore} from './event-server'
import {isEventAdmin} from './event-access'
import {renderHunterImage,renderHunterRecords,combineHunterImages} from './hunter-image'
export const HUNTER_FIELDS='id,hunter_no,tag,display_name,rank,kills,bio,mission,photo_id,print_token,version,updated_at,legacy_kills,owner_token,owner_enabled'
export async function hunterAuth(db,token){
 if(token)throw Error('スタッフ専用入口は廃止されました。管理ログインをご利用ください。')
 if(!await isEventAdmin())throw Error('管理ログインが必要です。')
 const store=await currentEventStore(db),{data,error}=await db.rpc('bambi_hunter_action',{p_store:store,p_action:'init',p_data:{},p_token:null});if(error)throw error;return {store,settings:data,operator:false}
}
export async function hunterCard(db,store,id){const {data,error}=await db.from('bambi_hunters').select(HUNTER_FIELDS).eq('id',id).eq('store_id',store).single();if(error)throw Error('カードが見つかりません。');return data}
export function hunterAsset(db,store){const cache=new Map();return async id=>{if(!cache.has(id))cache.set(id,(async()=>{const {data:a,error}=await db.from('bambi_hunter_assets').select('storage_path').eq('id',id).eq('store_id',store).single();if(error)throw error;const {data,error:e}=await db.storage.from('bambi-hunter-assets').download(a.storage_path);if(e)throw e;return Buffer.from(await data.arrayBuffer())})());return cache.get(id)}}
export function hunterPublicURL(db,card){return db.storage.from('bambi-hunter-live').getPublicUrl(`${card.print_token}.png`).data.publicUrl}
export async function prepareHunterPrint(store,id){
 const db=eventDB(20000),owner=randomUUID();let claimed=false,uncertain=false
 const lock=async action=>{const {data,error}=await db.rpc('bambi_hunter_print_lock',{p_id:id,p_owner:owner,p_action:action});if(error)throw error;return data}
 try{
  if(!await lock('claim'))return {print_ready:false,print_error:'別の担当者が画像を更新中です。少し待って「印刷画像を再準備」を押してください。'}
  claimed=true
  for(let i=0;i<4;i++){
   const card=await hunterCard(db,store,id),{data:settings,error}=await db.from('bambi_hunter_settings').select('*').eq('store_id',store).single();if(error)throw error
   const ranks=await hunterRanks(db,store),stats=await hunterStats(db,id),effective=withMission(card,ranks);const png=await renderHunterImage(settings,effective,hunterAsset(db,store)),records=await renderHunterRecords(card,stats,settings.animals);if(!await lock('renew'))throw Error('画像更新の有効期限が切れました。')
   uncertain=true;const {error:e}=await db.storage.from('bambi-hunter-live').upload(`${card.print_token}.png`,png,{contentType:'image/png',cacheControl:'0',upsert:true});if(e)throw e;const {error:re}=await db.storage.from('bambi-hunter-live').upload(`${card.print_token}-records.png`,records,{contentType:'image/png',cacheControl:'0',upsert:true});if(re)throw re;const all=await combineHunterImages(png,records);const {error:ae}=await db.storage.from('bambi-hunter-live').upload(`${card.print_token}-all.png`,all,{contentType:'image/png',cacheControl:'0',upsert:true});if(ae)throw ae;const horizontal=await combineHunterImages(png,records,'horizontal');if(!await lock('renew'))throw Error('画像更新の有効期限が切れました。');const {error:he}=await db.storage.from('bambi-hunter-live').upload(`${card.print_token}-horizontal.png`,horizontal,{contentType:'image/png',cacheControl:'0',upsert:true});if(he)throw he;uncertain=false
   const latest=await hunterCard(db,store,id),{data:s,error:se}=await db.from('bambi_hunter_settings').select('version').eq('store_id',store).single();if(se)throw se
   if(card.version===latest.version&&settings.version===s.version)return {print_ready:true}
  }throw Error('更新が続いています。')
 }catch{return {print_ready:false,print_error:'データは保存済みですが印刷画像を更新できませんでした。少し待って「印刷画像を再準備」を押してください。通信障害後は最大2分お待ちください。'}}
 finally{if(claimed&&!uncertain)try{await lock('release')}catch{}}
}

export async function hunterRanks(db,store){const {data,error}=await db.from('bambi_hunter_ranks').select('rank,mission').eq('store_id',store).order('rank');if(error)throw error;return data.sort((a,b)=>Number(a.rank)-Number(b.rank))}
export async function hunterStats(db,id){const {data,error}=await db.rpc('bambi_hunter_stats',{p_id:id});if(error)throw error;return data}
export function withMission(card,ranks){return {...card,mission:ranks.find(r=>r.rank===card.rank)?.mission??card.mission}}
export async function hunterOwner(db,token){if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('ユーザー専用ページが無効です。');const {data,error}=await db.from('bambi_hunters').select(HUNTER_FIELDS+',store_id').eq('owner_token',token).eq('owner_enabled',true).single();if(error||!data)throw Error('ユーザー専用ページが無効です。');return data}
