import {randomInt} from 'node:crypto'
import {eventDB} from '@/lib/event-server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=30
const headers={'Content-Type':'image/png','Cache-Control':'no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
export async function GET(request,{params}){
 const {token}=await params
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(token))return new Response('not found',{status:404})
 const page=randomInt(2),name=page?`${token}-records.png`:`${token}.png`
 try{const {data,error}=await eventDB(15000).storage.from('bambi-hunter-live').download(name);if(error||!data)return new Response('image not ready',{status:404,headers:{'Cache-Control':'no-store'}});return new Response(await data.arrayBuffer(),{headers:{...headers,'X-Hunter-Page':String(page+1)}})}catch{return new Response('image unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
}
export function HEAD(){return new Response(null,{headers})}
