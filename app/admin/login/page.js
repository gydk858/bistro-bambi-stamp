'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage('')

    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const result = await res.json()

    if (!res.ok) {
      setMessage(result.message || 'ログインに失敗しました')
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>管理画面ログイン</h1>

      <form onSubmit={handleLogin}>
        <input
          type="password"
          placeholder="パスワードを入力"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px', marginRight: '8px' }}
        />
        <button type="submit">ログイン</button>
      </form>

      {message && <p style={{ marginTop: '16px' }}>{message}</p>}
    </div>
  )
}