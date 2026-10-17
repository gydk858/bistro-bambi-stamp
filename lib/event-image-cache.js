// Immutable version keys. No authorization decisions are cached here.
const entries=new Map(),pending=new Map()
const LIMIT=32*1024*1024,TTL=5*60*1000
let bytes=0
export async function cachedEventImage(key,produce) {
 const now=Date.now(),entry=entries.get(key)
 if(entry&&entry.expires>now){entries.delete(key);entries.set(key,entry);return entry.data}
 if(entry){bytes-=entry.data.length;entries.delete(key)}
 if(pending.has(key))return pending.get(key)
 const task=(async()=>{const data=await produce();if(data.length<=LIMIT){
  for(const [k,v] of entries){if(v.expires<=Date.now()){entries.delete(k);bytes-=v.data.length}}
  while(bytes+data.length>LIMIT&&entries.size){const k=entries.keys().next().value;bytes-=entries.get(k).data.length;entries.delete(k)}
  entries.set(key,{data,expires:Date.now()+TTL});bytes+=data.length
 }return data})()
 pending.set(key,task)
 try{return await task}finally{pending.delete(key)}
}
