import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import SettingsClient from '../SettingsClient'

export default async function SettingsPage() {
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get('admin_auth')

  if (!adminAuth || adminAuth.value !== 'ok') {
    redirect('/admin/login')
  }

  return <SettingsClient />
}