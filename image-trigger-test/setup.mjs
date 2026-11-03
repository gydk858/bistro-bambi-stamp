import { readFile, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,site=process.argv[2]
 if(!url||!key)throw Error('.env.localのSupabase設定を確認してください。')
 if(!site||!/^https:\/\/[^/]+\/?$/.test(site))throw Error('引数にアプリのhttps://ドメインを指定してください。')
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}})
 const {error:schemaError}=await db.from('bambi_image_trigger_tests').select('token').limit(1)
 if(schemaError)throw Error('先に同梱SQLをSupabaseのSQL Editorで実行してください。')
 const bucket='bambi-image-trigger-test',token=randomBytes(32).toString('hex')
 const names=['switch-a.png','switch-b.png',...Array.from({length:6},(_,i)=>`stamp-${i}.png`)]
 const images=await Promise.all(names.map(async name=>({name,bytes:await readFile(new URL(`images/${name}`,import.meta.url))})))
 const {data:buckets,error}=await db.storage.listBuckets();if(error)throw Error('Storageの取得に失敗しました。')
 const existing=buckets.find(b=>b.id===bucket)
 if(existing&&!existing.public)throw Error('同名の非公開バケットがあります。変更せず停止しました。')
 if(!existing){const {error}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:20971520,allowedMimeTypes:['image/png']});if(error)throw Error('テスト用バケットの作成に失敗しました。')}
 console.log(`テスト画像の保存先：${bucket}/${token}/`)
 for(const {name,bytes} of images){const {error}=await db.storage.from(bucket).upload(`${token}/${name}`,bytes,{contentType:'image/png',cacheControl:'0',upsert:false});if(error)throw Error(`${name}の保存に失敗しました。途中までの画像は残っています。`)}
 const {error:insertError}=await db.from('bambi_image_trigger_tests').insert({token});if(insertError)throw Error('テスト状態の作成に失敗しました。画像は残っています。')
 const base=site.replace(/\/$/,'')+`/api/image-trigger/${token}`
 const result={switch:base+'/switch.png',stamp:base+'/stamp.png',status:base+'/status.json',control:db.storage.from(bucket).getPublicUrl(`${token}/stamp-0.png`).data.publicUrl,token}
 await writeFile(new URL(`urls-${token.slice(0,8)}.json`,import.meta.url),JSON.stringify(result,null,2))
 console.log(JSON.stringify(result,null,2))
 console.log('switch/stamp URLを開くとテスト状態が進みます。状態確認はstatus URLを使ってください。')
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
