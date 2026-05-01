'use client'

import { useState } from 'react'

export default function SystemManageClient() {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleResetSystem = async () => {
    setMessage('')

    if (confirmText !== 'RESET') {
      setMessage('実行するには「RESET」と入力してください')
      return
    }

    const ok = window.confirm(
      '本当にシステム初期化を実行しますか？\n\n' +
        'この操作で users / cards / stamp_cards / bingo_cards / 履歴 が削除され、IDは1から再開されます。\n' +
        'この操作は元に戻せません。'
    )

    if (!ok) return

    setLoading(true)

    try {
      const res = await fetch('/api/admin-reset-system', {
        method: 'POST',
      })

      const json = await res.json()

      if (!res.ok) {
        setMessage(json.message || 'システム初期化に失敗しました')
        return
      }

      const result = json.result

      setMessage(
        [
          json.message || 'システム初期化を実行しました。',
          '',
          result
            ? `users: ${result.deleted_users}件 / cards: ${result.deleted_cards}件 / stamp_cards: ${result.deleted_stamp_cards}件 / bingo_cards: ${result.deleted_bingo_cards}件 / bingo_cells: ${result.deleted_bingo_cells}件 / stamp_histories: ${result.deleted_stamp_histories}件 / bingo_histories: ${result.deleted_bingo_histories}件`
            : '',
          '',
          '次回の新規発行からIDは1から再開されます。',
        ]
          .filter(Boolean)
          .join('\n')
      )

      setConfirmText('')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'システム初期化に失敗しました'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>⚠️</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>システム初期化</p>
              <p style={styles.headerDescription}>
                利用者データを全削除し、IDを1から再開するための危険操作です。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin/system" style={styles.navButton}>
              システム設定
            </a>

            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>
          </nav>
        </header>

        <section style={styles.warningPanel}>
          <div style={styles.warningBadge}>DANGER</div>
          <h2 style={styles.warningTitle}>この操作は元に戻せません</h2>
          <p style={styles.warningText}>
            イベントの切替ではなく、システムを完全にやり直したいときだけ使用してください。
            通常スタンプ、ビンゴ、利用者、履歴データが削除されます。
          </p>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.sectionTitle}>
            利用者データを初期化して ID を 1 から再開
          </h2>

          <div style={styles.deleteBox}>
            <p style={styles.deleteText}>
              削除対象:
              <br />
              users / cards / stamp_cards / bingo_cards / bingo_card_cells / stamp_histories / bingo_mark_histories
              <br />
              <br />
              残るもの:
              <br />
              card_programs / card_types / bingo_product_mappings などのマスタ
            </p>
          </div>

          <p style={styles.description}>
            実行するには、下の入力欄へ <strong>RESET</strong> と入力してください。
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET と入力"
            style={styles.input}
          />

          <div style={{ marginTop: '18px' }}>
            <button
              onClick={handleResetSystem}
              disabled={loading}
              style={{
                ...styles.dangerButton,
                ...(loading ? styles.disabledButton : {}),
              }}
            >
              {loading ? '初期化中...' : 'システム初期化を実行'}
            </button>
          </div>

          {message && (
            <div style={styles.messageBox}>
              <p style={styles.messageText}>
                {message}
              </p>
            </div>
          )}
        </section>
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
  dangerPale: '#f3ece9',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    color: theme.text,
    padding: '24px',
  },
  container: {
    maxWidth: '1180px',
    margin: '0 auto',
  },
  header: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '24px',
    padding: '24px 28px',
    marginBottom: '18px',
    boxShadow: '0 12px 30px rgba(47, 74, 52, 0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  brandMark: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: theme.dangerPale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    border: `1px solid ${theme.border2}`,
  },
  title: {
    fontSize: '38px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: '20px',
    color: theme.danger,
    fontWeight: 900,
  },
  headerDescription: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.6,
  },
  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  navButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 800,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  warningPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    marginBottom: '18px',
  },
  warningBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.dangerPale,
    border: `1px solid ${theme.border2}`,
    color: theme.danger,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  warningTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.danger,
    margin: 0,
  },
  warningText: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '10px 0 0',
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    lineHeight: 1.35,
  },
  deleteBox: {
    marginTop: '18px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '18px 20px',
  },
  deleteText: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 800,
    color: theme.danger,
    lineHeight: 1.8,
  },
  description: {
    fontSize: '16px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '18px 0 12px',
  },
  input: {
    width: '100%',
    maxWidth: '360px',
    boxSizing: 'border-box',
    padding: '13px 14px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  dangerButton: {
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 950,
    borderRadius: '13px',
    border: 'none',
    background: theme.danger,
    color: theme.white,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(143, 91, 80, 0.18)',
  },
  disabledButton: {
    opacity: 0.65,
    cursor: 'default',
  },
  messageBox: {
    marginTop: '18px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px 16px',
    whiteSpace: 'pre-wrap',
  },
  messageText: {
    margin: 0,
    fontSize: '15px',
    color: theme.deep,
    fontWeight: 900,
    lineHeight: 1.8,
  },
}