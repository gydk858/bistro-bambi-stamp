import EventsClient from '@/app/admin/events/EventsClient'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'イベント専用カード受付', robots: { index:false, follow:false }, referrer:'no-referrer' }
export default async function EventAccessPage({ params }) {
 const {token}=await params
 return <EventsClient accessToken={token} />
}
