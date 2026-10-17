import { createEventSession, EVENT_COOKIE } from '@/lib/event-session'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const { password } = await request.json()

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { success: false, message: 'パスワードが違います' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ success: true })

  response.cookies.set('admin_auth', 'ok', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  response.cookies.set(EVENT_COOKIE, createEventSession(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 })
  return response
}