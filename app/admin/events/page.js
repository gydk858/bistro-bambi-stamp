import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { EVENT_COOKIE, validEventSession } from '@/lib/event-session'
import EventsClient from './EventsClient'
export const dynamic = 'force-dynamic'
export default async function EventsPage() {
  if (!validEventSession((await cookies()).get(EVENT_COOKIE)?.value)) redirect('/admin/login')
  return <EventsClient />
}
