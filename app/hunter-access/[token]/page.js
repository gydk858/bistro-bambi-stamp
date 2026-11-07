import HuntersClient from '@/app/admin/hunters/HuntersClient'
import {eventDB} from '@/lib/event-server'
import {hunterAuth} from '@/lib/hunter-server'
export const dynamic='force-dynamic'
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'}
export default async function Page({params}){
 const {token}=await params
 try{await hunterAuth(eventDB(),token)}catch{return <main style={{padding:32}}>この専用URLは無効または停止中です。管理者に確認してください。</main>}
 return <HuntersClient staffMode accessToken={token}/>
}
