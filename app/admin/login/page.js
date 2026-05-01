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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.brandMark}>🦌</div>

          <h1 style={styles.title}>-Bistro-Bambi</h1>

          <p style={styles.subtitle}>
            管理画面ログイン
          </p>

          <p style={styles.description}>
            管理画面に入るためのパスワードを入力してください。
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={styles.formGroup}>
            <label htmlFor="password" style={styles.label}>
              パスワード
            </label>

            <div style={styles.passwordRow}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                style={styles.toggleButton}
              >
                {showPassword ? '隠す' : '表示'}
              </button>
            </div>
          </div>

          <button type="submit" style={styles.loginButton}>
            ログイン
          </button>
        </form>

        {message && (
          <div style={styles.messageBox}>
            <p style={styles.messageText}>
              {message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

const theme = {
  bg: '#eef2ec',
  bg2: '#f7faf5',
  panel: '#fbfdf9',
  border: '#d8e3d2',
  border2: '#c4d3bd',
  text: '#263427',
  muted: '#6c7b67',
  deep: '#2f4a34',
  green: '#52785a',
  pale: '#e6efe1',
  white: '#ffffff',
  danger: '#8f5b50',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    color: theme.text,
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '28px',
    padding: '40px 36px',
    boxShadow: '0 14px 34px rgba(47, 74, 52, 0.10)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  brandMark: {
    width: '72px',
    height: '72px',
    borderRadius: '22px',
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    margin: '0 auto 18px',
  },
  title: {
    fontSize: '42px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '14px 0 0',
    fontSize: '23px',
    color: theme.deep,
    fontWeight: 900,
  },
  description: {
    margin: '16px 0 0',
    fontSize: '16px',
    color: theme.muted,
    lineHeight: 1.8,
  },
  formGroup: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '15px',
    fontWeight: 900,
    color: theme.deep,
    marginBottom: '10px',
  },
  passwordRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '16px 16px',
    fontSize: '18px',
    borderRadius: '14px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  toggleButton: {
    padding: '15px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '13px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  loginButton: {
    width: '100%',
    padding: '16px 18px',
    fontSize: '18px',
    fontWeight: 950,
    borderRadius: '14px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  messageBox: {
    marginTop: '20px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '15px 16px',
  },
  messageText: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 900,
    color: theme.danger,
    lineHeight: 1.7,
  },
}