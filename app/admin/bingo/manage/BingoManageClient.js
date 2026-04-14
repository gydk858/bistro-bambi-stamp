'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BingoManageClient() {
  const [targetUserId, setTargetUserId] = useState('')
  const [targetNumber, setTargetNumber] = useState('')
  const [closeMessage, setCloseMessage] = useState('')

  const [resetMessage, setResetMessage] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const [archiveMessage, setArchiveMessage] = useState('')
  const [archiveLoading, setArchiveLoading] = useState(false)

  const normalizeToHalfWidthNumber = (value) => {
    return value
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[^0-9]/g, '')
  }

  const syncBingoCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-bingo-card/${targetUserId}`, {
      method: 'POST',
      cache: 'no-store',
    })

    const syncJson = await syncRes.json()

    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(syncJson.error || 'ビンゴカード画像の同期に失敗しました')
    }

    return syncJson
  }

  const handleCloseNumber = async () => {
    setCloseMessage('')

    const userIdNum = Number(targetUserId)
    const numberNum = Number(targetNumber)

    if (!Number.isFinite(userIdNum) || userIdNum <= 0) {
      setCloseMessage('対象のIDを入力してください')
      return
    }

    if (!Number.isFinite(numberNum) || numberNum <= 0) {
      setCloseMessage('閉じる番号を入力してください')
      return
    }

    const { data: card, error: cardError } = await supabase
      .from('v_bingo_cards_current')
      .select('*')
      .eq('user_id', userIdNum)
      .eq('program_code', 'bingo_regular')
      .eq('card_status', 'active')
      .maybeSingle()

    if (cardError || !card) {
      setCloseMessage('対象のビンゴカードが見つかりません')
      return
    }

    const { data, error } = await supabase.rpc('unmark_bingo_number', {
      p_card_id: card.card_id,
      p_number: numberNum,
      p_acted_by: 'admin_ui',
      p_note: 'ビンゴ管理画面から番号を閉じる',
    })

    if (error || !data || data.length === 0) {
      setCloseMessage('番号を閉じる処理に失敗しました')
      return
    }

    const result = data[0]

    try {
      await syncBingoCardImage(userIdNum)
    } catch (syncError) {
      setCloseMessage(
        syncError instanceof Error
          ? syncError.message
          : '画像同期に失敗しました'
      )
      return
    }

    if (result.already_unmarked) {
      setCloseMessage(`${numberNum}番はすでに閉じています`)
    } else {
      setCloseMessage(`ID ${userIdNum} の ${numberNum}番を閉じました`)
    }
  }

  const handleResetAll = async () => {
    const ok = window.confirm(
      '本当に全てのビンゴカードをリセットしますか？この操作は元に戻せません。'
    )

    if (!ok) return

    setResetLoading(true)
    setResetMessage('')

    try {
      const { data, error } = await supabase.rpc('reset_all_bingo_cards', {
        p_acted_by: 'admin_ui',
        p_note: 'ビンゴ管理画面から全ビンゴカード一括リセット',
      })

      if (error || !data || data.length === 0) {
        setResetMessage('全ビンゴカードのリセットに失敗しました')
        return
      }

      const result = data[0]
      setResetMessage(
        `全ビンゴカードをリセットしました（カード ${result.affected_cards} 件 / マス ${result.affected_cells} 件）`
      )
    } catch (error) {
      setResetMessage(
        error instanceof Error
          ? error.message
          : '全ビンゴカードのリセットに失敗しました'
      )
    } finally {
      setResetLoading(false)
    }
  }

  const handleArchiveAll = async () => {
    const ok = window.confirm(
      '現在のビンゴイベントのカードをアーカイブしますか？\nアーカイブ後は通常画面や bot からは表示されなくなります。'
    )

    if (!ok) return

    setArchiveLoading(true)
    setArchiveMessage('')

    try {
      const { data, error } = await supabase.rpc('archive_active_bingo_cards', {
        p_acted_by: 'admin_ui',
        p_note: '管理画面からビンゴイベント終了',
      })

      if (error || !data || data.length === 0) {
        setArchiveMessage('アーカイブに失敗しました')
        return
      }

      const result = data[0]
      setArchiveMessage(
        `現在のビンゴカードをアーカイブしました（${result.affected_cards}件）`
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
            ビンゴ管理
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.8,
            }}
          >
            間違えて開けた番号を閉じたり、イベント終了時のリセットとアーカイブを行います。
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
            指定番号を閉じる
          </h2>

          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              lineHeight: 1.8,
              marginBottom: '22px',
            }}
          >
            ID と番号を指定して、間違えて開けたマスを閉じます。
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="対象IDを入力"
              value={targetUserId}
              onChange={(e) => setTargetUserId(normalizeToHalfWidthNumber(e.target.value))}
              style={{
                padding: '16px 18px',
                fontSize: '20px',
                borderRadius: '14px',
                border: '1px solid #dcbeb2',
                background: '#fff',
                color: '#6b4235',
                minWidth: '240px',
                outline: 'none',
              }}
            />

            <input
              type="text"
              inputMode="numeric"
              placeholder="閉じる番号を入力"
              value={targetNumber}
              onChange={(e) => setTargetNumber(normalizeToHalfWidthNumber(e.target.value))}
              style={{
                padding: '16px 18px',
                fontSize: '20px',
                borderRadius: '14px',
                border: '1px solid #dcbeb2',
                background: '#fff',
                color: '#6b4235',
                minWidth: '240px',
                outline: 'none',
              }}
            />

            <button
              onClick={handleCloseNumber}
              style={{
                padding: '16px 24px',
                fontSize: '20px',
                fontWeight: 700,
                borderRadius: '14px',
                border: '1px solid #e7b8aa',
                background: '#fff',
                color: '#8a4e3d',
                cursor: 'pointer',
              }}
            >
              番号を閉じる
            </button>
          </div>

          {closeMessage && (
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
                {closeMessage}
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
            全ビンゴカード一括リセット
          </h2>

          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              lineHeight: 1.8,
              marginBottom: '22px',
            }}
          >
            すべてのビンゴカードの開放状態を初期化します。
            <br />
            イベントは継続したまま、中身だけ初期化したい場合に使います。
          </p>

          <button
            onClick={handleResetAll}
            disabled={resetLoading}
            style={{
              padding: '18px 28px',
              fontSize: '22px',
              fontWeight: 800,
              borderRadius: '16px',
              border: 'none',
              background: resetLoading ? '#d8c5bf' : '#d98b7b',
              color: '#fff',
              cursor: resetLoading ? 'default' : 'pointer',
              boxShadow: '0 8px 18px rgba(217, 139, 123, 0.25)',
            }}
          >
            {resetLoading ? 'リセット中...' : '全ビンゴカードをリセット'}
          </button>

          {resetMessage && (
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
                {resetMessage}
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
            現在のビンゴイベントを終了し、現役カードをすべてアーカイブします。
            <br />
            アーカイブ後は通常画面・bot・画像生成では表示されません。
          </p>

          <button
            onClick={handleArchiveAll}
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
            href="/admin/bingo"
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
            ビンゴ画面に戻る
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