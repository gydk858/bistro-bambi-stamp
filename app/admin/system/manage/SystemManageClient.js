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
          maxWidth: '980px',
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
            システム初期化
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.8,
            }}
          >
            利用者データを全削除し、IDを1から再開するための危険操作です。
            <br />
            イベントの切替ではなく、完全にやり直したいときだけ使用してください。
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
            利用者データを初期化して ID を 1 から再開
          </h2>

          <div
            style={{
              background: '#fff',
              border: '1px solid #f0d9d2',
              borderRadius: '16px',
              padding: '18px 20px',
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '19px',
                fontWeight: 700,
                color: '#8a4e3d',
                lineHeight: 1.8,
              }}
            >
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

          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              lineHeight: 1.8,
              marginBottom: '16px',
            }}
          >
            実行するには、下の入力欄へ <strong>RESET</strong> と入力してください。
          </p>

          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET と入力"
            style={{
              padding: '16px 18px',
              fontSize: '20px',
              borderRadius: '14px',
              border: '1px solid #dcbeb2',
              background: '#fff',
              color: '#6b4235',
              minWidth: '320px',
              outline: 'none',
              marginBottom: '18px',
            }}
          />

          <div>
            <button
              onClick={handleResetSystem}
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
              {loading ? '初期化中...' : 'システム初期化を実行'}
            </button>
          </div>

          {message && (
            <div
              style={{
                marginTop: '20px',
                background: '#fff',
                border: '1px solid #f0d9d2',
                borderRadius: '16px',
                padding: '16px 18px',
                whiteSpace: 'pre-wrap',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '19px',
                  fontWeight: 700,
                  color: '#7a4b3a',
                  lineHeight: 1.8,
                }}
              >
                {message}
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/admin/system"
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
            管理者専用メニューに戻る
          </a>

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
            管理メニューに戻る
          </a>
        </div>
      </div>
    </div>
  )
}