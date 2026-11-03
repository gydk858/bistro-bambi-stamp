import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
export const BUCKET='bambi-animation-test'
export const FILES=[['still.png','image/png'],['test.gif','image/gif'],['test.png','image/png'],['test.apng','image/png']]
export async function uploadTest(db,{read=readFile,checkFetch=fetch,log=console.log,run=randomUUID()}={}) {
 const images=await Promise.all(FILES.map(async([name,type])=>({name,type,bytes:await read(new URL(`./images/${name}`,import.meta.url))})))
 const {data:buckets,error:listError}=await db.storage.listBuckets()
 if(listError)throw Error('Storageの取得に失敗しました。接続先とサービスロールキーを確認してください。')
 const existing=buckets.find(b=>b.id===BUCKET)
 if(existing&&!existing.public)throw Error('同名の非公開バケットがあります。設定を変更せず停止しました。')
 if(!existing){const {error}=await db.storage.createBucket(BUCKET,{public:true,fileSizeLimit:20971520,allowedMimeTypes:['image/png','image/gif']});if(error)throw Error('テスト用バケットの作成に失敗しました。権限を確認してください。')}
 const results=[]
 for(const {name,type,bytes} of images){
  const key=`${run}/${name}`
  const {error}=await db.storage.from(BUCKET).upload(key,bytes,{contentType:type,cacheControl:'0',upsert:false})
  if(error)throw Error(`${name}のアップロードに失敗しました。成功済みの画像は削除していません。`)
  const {data}=db.storage.from(BUCKET).getPublicUrl(key)
  const url=data.publicUrl
  log(`${name}: ${url}`)
  // Two anonymous GETs verify direct serving and exact bytes, not GTA support.
  const checks=[]
  for(let i=0;i<2;i++){
   try{const response=await checkFetch(url,{signal:AbortSignal.timeout(20000)});const body=Buffer.from(await response.arrayBuffer());checks.push({status:response.status,contentType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),matches:response.ok&&createHash('sha256').update(body).digest('hex')===createHash('sha256').update(bytes).digest('hex')})}
   catch{checks.push({matches:false,error:'直接URLの確認がタイムアウトまたは通信失敗しました。'})}
  }
  results.push({name,url,checks})
  log(checks.every(c=>c.matches)?'  直接取得2回・ファイル一致：OK':'  直接取得に失敗または不一致：URLをブラウザで確認してください。')
 }
 return {bucket:BUCKET,run,results}
}
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key)throw Error('.env.localにNEXT_PUBLIC_SUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYが必要です。キーをチャットへ送る必要はありません。')
 const {createClient}=await import('@supabase/supabase-js')
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}})
 const result=await uploadTest(db)
 await writeFile(new URL(`./urls-${result.run}.json`,import.meta.url),JSON.stringify(result,null,2))
 console.log('完了。表示したSupabaseのURLで新しく印刷してください。まずstill.pngを連続表示してください。')
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1})
