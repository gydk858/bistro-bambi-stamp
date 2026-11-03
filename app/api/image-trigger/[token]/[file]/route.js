import { createClient } from '@supabase/supabase-js'
export const dynamic='force-dynamic'
export const runtime='nodejs'
const headers={'Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}
const reply=(body,status=200)=>Response.json(body,{status,headers})
export async function HEAD(){return new Response(null,{status:405,headers:{...headers,Allow:'GET'}})}
export async function GET(request,{params}){
 const {token,file}=await params
 if(!/^[a-f0-9]{64}$/.test(token)||!['switch.png','stamp.png','status.json'].includes(file))return reply({error:'Not found'},404)
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!key)return reply({error:'Supabase設定がありません。'},500)
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})}})
  if(file==='status.json'){
   const {data,error}=await db.from('bambi_image_trigger_tests').select('enabled,switch_count,stamp_count,updated_at').eq('token',token).maybeSingle()
   if(error)return reply({error:'状態の取得に失敗しました。'},500)
   return data?reply(data):reply({error:'Not found'},404)
  }
  const {data,error}=await db.rpc('bambi_image_trigger_test_step',{p_token:token,p_mode:file==='switch.png'?'switch':'stamp'})
  if(error)return reply({error:'テストの更新に失敗しました。SQLの適用を確認してください。'},500)
  if(!data)return reply({error:'テストが存在しないか停止中です。'},404)
  if(!/^(switch-[ab]|stamp-[1-5])\.png$/.test(data.filename))return reply({error:'画像名が不正です。'},500)
  const {data:asset}=db.storage.from('bambi-image-trigger-test').getPublicUrl(`${token}/${data.filename}`)
  return new Response(null,{status:307,headers:{...headers,Location:asset.publicUrl,'X-Test-Request-Count':String(data.count)}})
 }catch{return reply({error:'テスト処理に失敗しました。'},500)}
}
