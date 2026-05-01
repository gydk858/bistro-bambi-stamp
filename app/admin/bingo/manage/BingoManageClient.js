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
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🎯</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>ビンゴ管理</p>
              <p style={styles.headerDescription}>
                番号の取り消し、全体リセット、イベント終了時のアーカイブを行います。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin/bingo" style={styles.navButton}>ビンゴ画面に戻る</a>
            <a href="/admin" style={styles.navButton}>管理メニュー</a>
          </nav>
        </header>

        <section style={styles.warningPanel}>
          <div style={styles.warningBadge}>IMPORTANT</div>
          <h2 style={styles.warningTitle}>操作前に確認してください</h2>
          <p style={styles.warningText}>
            この画面の操作は、ビンゴカード全体または指定カードに影響します。
            リセットやアーカイブは運用タイミングを確認してから実行してください。
          </p>
        </section>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.iconBox}>↩</div>
            <h2 style={styles.sectionTitle}>指定番号を閉じる</h2>

            <p style={styles.description}>
              ID と番号を指定して、間違えて開けたマスを閉じます。
            </p>

            <div style={styles.formGrid}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="対象IDを入力"
                value={targetUserId}
                onChange={(e) => setTargetUserId(normalizeToHalfWidthNumber(e.target.value))}
                style={styles.input}
              />

              <input
                type="text"
                inputMode="numeric"
                placeholder="閉じる番号を入力"
                value={targetNumber}
                onChange={(e) => setTargetNumber(normalizeToHalfWidthNumber(e.target.value))}
                style={styles.input}
              />

              <button onClick={handleCloseNumber} style={styles.dangerButton}>
                番号を閉じる
              </button>
            </div>

            {closeMessage && (
              <div style={styles.messageBox}>
                {closeMessage}
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.iconBox}>↺</div>
            <h2 style={styles.sectionTitle}>全ビンゴカード一括リセット</h2>

            <p style={styles.description}>
              すべてのビンゴカードの開放状態を初期化します。
              イベントは継続したまま、中身だけ初期化したい場合に使います。
            </p>

            <button
              onClick={handleResetAll}
              disabled={resetLoading}
              style={{
                ...styles.primaryButton,
                ...(resetLoading ? styles.disabledButton : {}),
              }}
            >
              {resetLoading ? 'リセット中...' : '全ビンゴカードをリセット'}
            </button>

            {resetMessage && (
              <div style={styles.messageBox}>
                {resetMessage}
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.iconBox}>□</div>
            <h2 style={styles.sectionTitle}>現在イベントのカードをアーカイブ</h2>

            <p style={styles.description}>
              現在のビンゴイベントを終了し、現役カードをすべてアーカイブします。
              アーカイブ後は通常画面・bot・画像生成では表示されません。
            </p>

            <button
              onClick={handleArchiveAll}
              disabled={archiveLoading}
              style={{
                ...styles.dangerButton,
                ...(archiveLoading ? styles.disabledDangerButton : {}),
              }}
            >
              {archiveLoading ? 'アーカイブ中...' : '現在イベントを終了してアーカイブ'}
            </button>

            {archiveMessage && (
              <div style={styles.messageBox}>
                {archiveMessage}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const theme = {
  bg: '#eef2ec',
  bg2: '#f7faf5',
  panel: '#fbfdf9',
  panel2: '#f3f7ef',
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
    background: theme.pale,
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
    color: theme.deep,
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
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    color: theme.deep,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  warningTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  warningText: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '10px 0 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '18px',
    alignItems: 'stretch',
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  iconBox: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 950,
    color: theme.deep,
    border: `1px solid ${theme.border2}`,
    marginBottom: '18px',
  },
  sectionTitle: {
    fontSize: '25px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    lineHeight: 1.35,
  },
  description: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '14px 0 20px',
  },
  formGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  primaryButton: {
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 950,
    borderRadius: '13px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  disabledButton: {
    opacity: 0.65,
    cursor: 'default',
  },
  dangerButton: {
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 950,
    borderRadius: '13px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
  },
  disabledDangerButton: {
    background: theme.dangerPale,
    opacity: 0.75,
    cursor: 'default',
  },
  messageBox: {
    marginTop: '18px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px 16px',
    fontSize: '15px',
    color: theme.deep,
    fontWeight: 900,
    lineHeight: 1.7,
  },
}