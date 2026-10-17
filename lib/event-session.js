import { createHmac, timingSafeEqual } from 'node:crypto'
export const EVENT_COOKIE = 'bambi_event_session'
const sign = value => createHmac('sha256', process.env.ADMIN_PASSWORD).update(`event-admin:${value}`).digest('hex')
export function createEventSession() {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000)
  return `${expires}.${sign(expires)}`
}
export function validEventSession(value = '') {
  if (!process.env.ADMIN_PASSWORD) return false
  const [expires, signature, extra] = value.split('.')
  if (extra || !/^\d+$/.test(expires || '') || Number(expires) <= Date.now() || !/^[a-f0-9]{64}$/.test(signature || '')) return false
  return timingSafeEqual(Buffer.from(signature), Buffer.from(sign(expires)))
}
