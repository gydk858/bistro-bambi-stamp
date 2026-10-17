import { cookies } from 'next/headers'
import { EVENT_COOKIE, validEventSession } from './event-session'
import { currentEventStore } from './event-server'
export const eventFields = 'id,name,description,status,event_type,max_stamps,layout,starts_on,ends_on,version,created_at'
export const cardFields = 'id,card_no,event_id,display_name,stamps,marked_slots,print_token,version'
export const eventReply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
export async function isEventAdmin() { return validEventSession((await cookies()).get(EVENT_COOKIE)?.value) }
export async function operatorEvent(db, token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) return null
  const { data, error } = await db.from('bambi_events').select(`${eventFields},store_id`).eq('access_token', token).eq('access_enabled', true).eq('status', 'active').maybeSingle()
  if (error) throw error
  return data
}
export async function adminEvent(db, id) {
  const store = await currentEventStore(db)
  const { data, error } = await db.from('bambi_events').select('*').eq('id', id).eq('store_id', store).maybeSingle()
  if (error) throw error
  return data
}
export async function eventAssets(db, id) {
  const { data, error } = await db.from('bambi_event_assets').select('id,event_id,width,height,kind').eq('event_id', id).order('created_at')
  if (error) throw error
  return data
}
export async function eventCards(db, id, query, operator = false) {
  const term=(query.get('search') || '').trim().replace(/[０-９]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
  if (term && !/^\d{1,18}$/.test(term)) throw new Error('カード番号を数字で入力してください。')
  const page=Math.max(0,Math.min(100000,Math.floor(Number(query.get('page'))||0)))
  let q=db.from('bambi_event_cards').select(cardFields,{count:'exact'}).eq('event_id',id)
  if(term)q=q.eq('card_no',term)
  const { data,error,count }=await q.order('card_no',{ascending:operator}).range(page*50,page*50+49)
  if(error)throw error
  return { cards:data,count }
}
export function sameOrigin(request) {
  try {
    const origin = new URL(request.headers.get('origin') || '')
    // Next.js Proxy may normalize request.url to localhost in local development.
    // Compare the browser Origin to the request Host, never a client-supplied forwarding header.
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === (request.headers.get('host') || new URL(request.url).host)
  } catch { return false }
}
