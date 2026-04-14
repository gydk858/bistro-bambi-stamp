'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StampManageClient() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [archiveMessage, setArchiveMessage] = useState('')
  const [archiveLoading, setArchiveLoading] = useState(false)

  const handleReset = async () => {
    const ok = window.confirm(
      '本当に全てのスタンプを 0 に戻しますか？この操作は元に戻せません。'
    )

    if (!ok) return

    setLoading(true)
    setMessage('')

    try {
      const res = await fetch('/api/admin-reset-stamps', {
        method: 'POST',
      })

      const result = await res.json()

      if (!res.ok) {
        setMessage(result.message || result.error || 'リセットに失敗しました')
        return
      }

      setMessage(result.message || 'リセットしました')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'リセットに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    const ok = window.confirm(
      '現在のスタンプイベントのカードをアーカイブしますか？\nアーカイブ後は通常画面や bot からは表示されなくなります。'
    )

    if (!ok) return

    setArchiveLoading(true)
    setArchiveMessage('')

    try {
      const { data, error } = await supabase.rpc('archive_active_stamp_cards', {
        p_acted_by: 'admin_ui',
        p_reason: '管理画面からスタンプイベント終了',
      })

      if (error || !data || data.length === 0) {
        setArchiveMessage('アーカイブに失敗しました')
        return
      }

      const result = data[0]
      setArchiveMessage(
        `現在のスタンプカードをアーカイブしました（${result.affected_cards}件）`
      )
    } catch (error) {
      setArchiveMessage(
        error instanceof Error ? error.message : 'アーカイブに失敗しました'
      )
    } finally {
      setArchiveLoading(false)
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
            スタンプ管理
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.8,
            }}
          >
            スタンプイベントのリセットと、イベント終了時のアーカイブを行います。
          </p>
        </div>

        <div
          style={{
            background: '#fffaf8',
            border: '1px solid #f0d9d2',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
            marginBottom: '24px',
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
            イベントは継続したまま、中身だけ初期化したい場合に使います。
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
            現在イベントのカードをアーカイブ
          </h2>

          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              lineHeight: 1.8,
              marginBottom: '22px',
            }}
          >
            現在のスタンプイベントを終了し、現役カードをすべてアーカイブします。
            <br />
            アーカイブ後は通常画面・bot・画像生成では表示されません。
          </p>

          <button
            onClick={handleArchive}
            disabled={archiveLoading}
            style={{
              padding: '18px 28px',
              fontSize: '22px',
              fontWeight: 800,
              borderRadius: '16px',
              border: '1px solid #e7b8aa',
              background: archiveLoading ? '#f3ece9' : '#fff',
              color: '#8a4e3d',
              cursor: archiveLoading ? 'default' : 'pointer',
            }}
          >
            {archiveLoading ? 'アーカイブ中...' : '現在イベントを終了してアーカイブ'}
          </button>

          {archiveMessage && (
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
                {archiveMessage}
              </p>
            </div>
          )}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/admin/stamp"
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
            スタンプ画面に戻る
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
            管理メニュー
          </a>
        </div>
      </div>
    </div>
  )
}