import HunterUser from './HunterUser'
export const dynamic='force-dynamic'
export const metadata={title:'マイハンティングカード',robots:{index:false,follow:false},referrer:'no-referrer'}
export default async function Page({params}){const {token}=await params;return <HunterUser token={token}/>}
