import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const cookieStore = await cookies()
  const adminAuth = cookieStore.get('admin_auth')

  if (!adminAuth || adminAuth.value !== 'ok') {
    return NextResponse.json(
      { success: false, message: '未ログインです' },
      { status: 401 }
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data, error } = await supabase.rpc('reset_regular_customer_stamp_cards', {
    p_acted_by: 'admin_ui',
    p_reason: '管理画面から通常スタンプカード一括リセット',
  })

  if (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'リセットに失敗しました',
      },
      { status: 500 }
    )
  }

  const result = Array.isArray(data) && data.length > 0 ? data[0] : null

  return NextResponse.json({
    success: true,
    message: result
      ? `通常スタンプカードをリセットしました（${result.affected_cards ?? 0}件）`
      : '通常スタンプカードをリセットしました',
  })
}