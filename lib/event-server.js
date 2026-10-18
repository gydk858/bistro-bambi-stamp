import { createClient } from '@supabase/supabase-js'
export function eventDB(fetchTimeout=0) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabaseのサーバー環境変数を確認してください。')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, ...(fetchTimeout?{global:{fetch:(input,init={})=>fetch(input,{...init,signal:AbortSignal.timeout(fetchTimeout)})}}:{}) })
}
export async function currentEventStore(db) {
  const { data: setting, error } = await db.from('app_settings').select('setting_value').eq('setting_key', 'current_store_code').single()
  if (error) throw new Error('対象店舗の設定を取得できません。')
  const { data, error: storeError } = await db.from('stores').select('store_id').eq('store_code', setting.setting_value).eq('status', 'active').single()
  if (storeError) throw new Error('対象店舗が見つかりません。')
  return data.store_id
}
