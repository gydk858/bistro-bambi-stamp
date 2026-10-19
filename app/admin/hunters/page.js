import {redirect} from 'next/navigation'
import {isEventAdmin} from '@/lib/event-access'
import HuntersClient from './HuntersClient'
export const dynamic='force-dynamic'
export default async function Page(){if(!await isEventAdmin())redirect('/admin/login');return <HuntersClient/>}
