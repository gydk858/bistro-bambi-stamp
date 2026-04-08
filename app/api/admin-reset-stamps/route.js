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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { error } = await supabase
    .from('users')
    .update({
      stamp_count: 0,
      updated_at: new Date().toISOString(),
    })
    .gte('user_id', 1)

  if (error) {
    return NextResponse.json(
      { success: false, message: 'リセットに失敗しました' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'すべてのスタンプを 0 にリセットしました',
  })
}