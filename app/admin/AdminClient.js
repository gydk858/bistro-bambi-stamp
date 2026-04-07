'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminClient() {
  const [userId, setUserId] = useState('')
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')

  const searchUser = async () => {
    setMessage('')

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) {
      setUser(null)
      setMessage('ユーザーが見つかりません')
      return
    }

    setUser(data)
    setMessage('ユーザーを取得しました')
  }

  const updateStampCount = async (diff) => {
    if (!user) return

    const newCount = Math.max(0, user.stamp_count + diff)

    const { data, error } = await supabase
      .from('users')
      .update({
        stamp_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
      .select()
      .maybeSingle()

    if (error || !data) {
      setMessage('更新に失敗しました')
      return
    }

    setUser(data)
    setMessage(`スタンプ数を ${data.stamp_count} に更新しました`)
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>スタンプ管理画面</h1>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={logout}>ログアウト</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="user_id を入力"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{ padding: '8px', marginRight: '8px' }}
        />
        <button onClick={searchUser}>検索</button>
      </div>

      {message && <p>{message}</p>}

      {user && (
        <div style={{ marginTop: '24px' }}>
          <p><strong>user_id:</strong> {user.user_id}</p>
          <p><strong>名前:</strong> {user.name}</p>
          <p><strong>現在のスタンプ数:</strong> {user.stamp_count}</p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => updateStampCount(-1)}>-1</button>
            <button onClick={() => updateStampCount(1)}>+1</button>
          </div>
        </div>
      )}
    </div>
  )
}