'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff8f4 0%, #fffdfb 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#fffaf8',
          border: '1px solid #f0d9d2',
          borderRadius: '28px',
          padding: '40px 36px',
          boxShadow: '0 14px 34px rgba(194, 144, 128, 0.12)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1
            style={{
              fontSize: '42px',
              fontWeight: 900,
              color: '#7a4b3a',
              margin: 0,
            }}
          >
            -Bistro-Bambi
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '24px',
              color: '#9a6b5b',
              fontWeight: 700,
            }}
          >
            スタンプカード管理ログイン
          </p>

          <p
            style={{
              margin: '18px 0 0 0',
              fontSize: '19px',
              color: '#9b7568',
              lineHeight: 1.8,
            }}
          >
            管理画面に入るための
            <br />
            パスワードを入力してください。
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontSize: '20px',
                fontWeight: 700,
                color: '#7a4b3a',
                marginBottom: '10px',
              }}
            >
              パスワード
            </label>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
              }}
            >
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  flex: 1,
                  padding: '18px 18px',
                  fontSize: '22px',
                  borderRadius: '16px',
                  border: '1px solid #dcbeb2',
                  background: '#fff',
                  color: '#6b4235',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={{
                  padding: '16px 18px',
                  fontSize: '18px',
                  fontWeight: 700,
                  borderRadius: '14px',
                  border: '1px solid #e6c6bb',
                  background: '#fff',
                  color: '#7a4b3a',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {showPassword ? '隠す' : '表示'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '18px 20px',
              fontSize: '22px',
              fontWeight: 800,
              borderRadius: '16px',
              border: 'none',
              background: '#d98b7b',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 8px 18px rgba(217, 139, 123, 0.25)',
            }}
          >
            ログイン
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: '20px',
              background: '#fff',
              border: '1px solid #f0d9d2',
              borderRadius: '16px',
              padding: '16px 18px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '19px',
                fontWeight: 700,
                color: '#a35f4f',
                lineHeight: 1.7,
              }}
            >
              {message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}