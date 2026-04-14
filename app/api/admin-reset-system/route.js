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

  const { data, error } = await supabase.rpc('reset_system_runtime_data', {
    p_acted_by: 'admin_ui',
    p_note: '管理画面からシステム初期化',
  })

  if (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'システム初期化に失敗しました',
      },
      { status: 500 }
    )
  }

  const result = Array.isArray(data) && data.length > 0 ? data[0] : null

  return NextResponse.json({
    success: true,
    message: '利用者データを初期化し、IDを1から再開する状態にしました。',
    result,
  })
}