'use client'

import { useState } from 'react'

export default function SettingsClient() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    const ok = window.confirm(
      '本当に全てのスタンプを 0 に戻しますか？この操作は元に戻せません。'
    )

    if (!ok) return

    setLoading(true)
    setMessage('')

    const res = await fetch('/api/admin-reset-stamps', {
      method: 'POST',
    })

    const result = await res.json()

    if (!res.ok) {
      setMessage(result.message || 'リセットに失敗しました')
      setLoading(false)
      return
    }

    setMessage(result.message || 'リセットしました')
    setLoading(false)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff8f4 0%, #fffdfb 100%)',
        padding: '32px',
        color: '#5f4137',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: '#fff6f1',
            border: '1px solid #f2ddd5',
            borderRadius: '28px',
            padding: '28px 32px',
            marginBottom: '28px',
            boxShadow: '0 12px 30px rgba(201, 157, 145, 0.10)',
          }}
        >
          <h1
            style={{
              fontSize: '42px',
              fontWeight: 900,
              color: '#7a4b3a',
              margin: 0,
            }}
          >
            管理者画面
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.8,
            }}
          >
            月初の運用などで、全スタンプを一括でリセットできます。
          </p>
        </div>

        <div
          style={{
            background: '#fffaf8',
            border: '1px solid #f0d9d2',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
          }}
        >
          <h2
            style={{
              fontSize: '30px',
              fontWeight: 800,
              color: '#7a4b3a',
              marginTop: 0,
              marginBottom: '18px',
            }}
          >
            スタンプカード一括リセット
          </h2>

          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              lineHeight: 1.8,
              marginBottom: '22px',
            }}
          >
            すべてのお客様のスタンプ数を 0 に戻します。
            <br />
            実行前に、必要であれば確認をしてから進めてください。
          </p>

          <button
            onClick={handleReset}
            disabled={loading}
            style={{
              padding: '18px 28px',
              fontSize: '22px',
              fontWeight: 800,
              borderRadius: '16px',
              border: 'none',
              background: loading ? '#d8c5bf' : '#d98b7b',
              color: '#fff',
              cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 8px 18px rgba(217, 139, 123, 0.25)',
            }}
          >
            {loading ? 'リセット中...' : '全スタンプを 0 に戻す'}
          </button>

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
                  color: '#7a4b3a',
                  lineHeight: 1.7,
                }}
              >
                {message}
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <a
            href="/admin"
            style={{
              display: 'inline-block',
              padding: '14px 22px',
              fontSize: '20px',
              fontWeight: 700,
              borderRadius: '14px',
              border: '1px solid #e6c6bb',
              background: '#fff',
              color: '#7a4b3a',
              textDecoration: 'none',
            }}
          >
            管理画面に戻る
          </a>
        </div>
      </div>
    </div>
  )
}