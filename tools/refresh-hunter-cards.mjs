// Runs outside Vercel. No DB keys or customer names are needed here.
import {appendFile} from 'node:fs/promises'
const base=process.env.BAMBI_APP_URL,secret=process.env.HUNTER_REFRESH_SECRET
if(!base||!secret||secret.length<32)throw Error('Set BAMBI_APP_URL and HUNTER_REFRESH_SECRET (32+ characters).')
const url=new URL('/api/hunter-refresh',base)
if(url.protocol!=='https:'&&url.hostname!=='localhost')throw Error('HTTPS is required.')
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function call(query='',body){
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch(url+query,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${secret}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(130000)})
   if(r.ok)return await r.json()
   if(r.status>=400&&r.status<500&&r.status!==429)throw Object.assign(Error(`Request rejected: ${r.status}`),{fatal:true})
   throw Error(`Temporary failure: ${r.status}`)
  }catch(e){if(e.fatal||attempt===2)throw e;await pause(body?125000:10000)}
 }
}
let after='0',upper,store,ok=0,failed=0
try{
 do{
  const q=new URLSearchParams({after,...(upper===undefined?{}:{upper,store})})
  const batch=await call('?'+q);upper=batch.upper;store=batch.store
  for(const c of batch.cards){
   try{await call('',{id:String(c.id),store});ok++;console.log(`Card #${c.hunter_no}: updated`)}
   catch(e){if(e.fatal)throw e;failed++;console.error(`Card #${c.hunter_no}: failed after retries`)}
  }
  after=batch.next
 }while(after!==null)
} catch(e){failed++;console.error(e.message)}
const summary=`Hunter print refresh: ${ok} updated, ${failed} failed.\n`
console.log(summary)
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary)
if(failed)process.exitCode=1
