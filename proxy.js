import { NextResponse } from 'next/server'
import { EVENT_COOKIE, validEventSession } from './lib/event-session'
export function proxy(request) {
  const pathname = request.nextUrl.pathname
  const protectedPath = (pathname.startsWith('/admin') && pathname !== '/admin/login') || (pathname.startsWith('/api/admin-') && !['/api/admin-login','/api/admin-logout'].includes(pathname))
  if (protectedPath && !validEventSession(request.cookies.get(EVENT_COOKIE)?.value)) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: '管理ログインをやり直してください。' }, { status: 401 })
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }
  const response = NextResponse.next()
  if (pathname.startsWith('/hunter-user/') || pathname.startsWith('/hunter-print/') || pathname.startsWith('/api/hunter-owner') || pathname.startsWith('/hunter-access/') || pathname.startsWith('/api/hunters') || pathname.startsWith('/event-access/') || pathname.startsWith('/api/event-')) {
    response.headers.set('Referrer-Policy', 'no-referrer')
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return response
}
export const config = { matcher: ['/admin/:path*','/api/:path*','/event-access/:path*','/hunter-access/:path*','/hunter-user/:path*','/hunter-print/:path*'] }
