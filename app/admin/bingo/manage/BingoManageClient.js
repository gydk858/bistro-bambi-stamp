'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BingoManageClient() {
  const [resetMessage, setResetMessage] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const [archiveMessage, setArchiveMessage] = useState('')
  const [archiveLoading, setArchiveLoading] = useState(false)

  const [archivedCards, setArchivedCards] = useState([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [restoreLoadingCardId, setRestoreLoadingCardId] = useState(null)
  const [restoreMessage, setRestoreMessage] = useState('')

  useEffect(() => {
    fetchArchivedCards()
  }, [])

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

  const fetchArchivedCards = async () => {
    setArchivedLoading(true)

    try {
      const { data, error } = await supabase.rpc(
        'list_archived_regular_bingo_cards'
      )

      if (error) {
        throw error
      }

      setArchivedCards(Array.isArray(data) ? data : [])
    } catch (error) {
      setRestoreMessage(
        error instanceof Error
          ? `アーカイブ済みビンゴカード一覧の取得に失敗しました: ${error.message}`
          : 'アーカイブ済みビンゴカード一覧の取得に失敗しました'
      )
      setArchivedCards([])
    } finally {
      setArchivedLoading(false)
    }
  }

  const handleResetAll = async () => {
    const ok = window.confirm(
      [
        '本当に通常ビンゴカードをすべてリセットしますか？',
        '',
        'この操作で、通常ビンゴカードの開放状態は初期化されます。',
        'イベントは継続したまま、中身だけ初期化されます。',
        'この操作は元に戻せません。',
      ].join('\n')
    )

    if (!ok) return

    setResetLoading(true)
    setResetMessage('')

    try {
      const { data, error } = await supabase.rpc('reset_regular_bingo_cards', {
        p_acted_by: 'admin_ui',
        p_note: 'ビンゴ管理画面から通常ビンゴカード一括リセット',
      })

      if (error || !data || data.length === 0) {
        setResetMessage('通常ビンゴカードのリセットに失敗しました')
        return
      }

      const result = data[0]
      setResetMessage(
        `通常ビンゴカードをリセットしました（カード ${result.affected_cards} 件 / マス ${result.affected_cells} 件）`
      )
    } catch (error) {
      setResetMessage(
        error instanceof Error
          ? error.message
          : '通常ビンゴカードのリセットに失敗しました'
      )
    } finally {
      setResetLoading(false)
    }
  }

  const handleArchiveAll = async () => {
    const ok = window.confirm(
      [
        '現在の通常ビンゴイベントのカードをアーカイブしますか？',
        '',
        '対象は通常ビンゴカードのみです。',
        'アーカイブ後は通常画面や bot からは表示されなくなります。',
        'この操作は元に戻せません。',
      ].join('\n')
    )

    if (!ok) return

    setArchiveLoading(true)
    setArchiveMessage('')

    try {
      const { data, error } = await supabase.rpc(
        'archive_active_regular_bingo_cards',
        {
          p_acted_by: 'admin_ui',
          p_note: '管理画面から通常ビンゴイベント終了',
        }
      )

      if (error || !data || data.length === 0) {
        setArchiveMessage('アーカイブに失敗しました')
        return
      }

      const result = data[0]
      setArchiveMessage(
        `現在の通常ビンゴカードをアーカイブしました（${result.affected_cards}件）`
      )

      await fetchArchivedCards()
    } catch (error) {
      setArchiveMessage(
        error instanceof Error ? error.message : 'アーカイブに失敗しました'
      )
    } finally {
      setArchiveLoading(false)
    }
  }

  const handleRestore = async (card) => {
    const ok = window.confirm(
      [
        'この通常ビンゴカードを復元しますか？',
        '',
        `カード番号: ${card.user_id}`,
        `Card ID: ${card.card_id}`,
        `氏名: ${card.display_name || '未登録'}`,
        '',
        '復元後はビンゴカード管理画面で検索できるようになります。',
      ].join('\n')
    )

    if (!ok) return

    setRestoreLoadingCardId(card.card_id)
    setRestoreMessage('')

    try {
      const { data, error } = await supabase.rpc(
        'restore_regular_bingo_card',
        {
          p_card_id: Number(card.card_id),
          p_acted_by: 'admin_ui',
          p_note: '管理画面から通常ビンゴカードを復元',
        }
      )

      if (error || !data || data.length === 0) {
        setRestoreMessage('復元に失敗しました')
        return
      }

      const restored = data[0]
      setRestoreMessage(
        `カード番号 ${restored.user_id} / Card ID ${restored.card_id} を復元しました`
      )

      try {
        await syncBingoCardImage(restored.user_id)
      } catch {
        // 復元自体は成功しているため、画像同期失敗だけで処理失敗にはしない
      }

      await fetchArchivedCards()
    } catch (error) {
      setRestoreMessage(
        error instanceof Error ? error.message : '復元に失敗しました'
      )
    } finally {
      setRestoreLoadingCardId(null)
    }
  }

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '0'
    return Number(value).toLocaleString()
  }

  const formatDateTime = (value) => {
    if (!value) return '-'

    try {
      return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    } catch {
      return String(value)
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
              <p style={styles.subtitle}>ビンゴ イベント管理</p>
              <p style={styles.headerDescription}>
                通常ビンゴカードの一括リセット、イベント終了時のアーカイブ、復元を行います。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin/bingo" style={styles.navButton}>
              カード操作に戻る
            </a>

            <a href="/admin/bingo/customers" style={styles.navButton}>
              顧客一覧
            </a>

            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>
          </nav>
        </header>

        <section style={styles.warningPanel}>
          <div style={styles.warningBadge}>IMPORTANT</div>
          <h2 style={styles.warningTitle}>操作前に確認してください</h2>
          <p style={styles.warningText}>
            この画面の一括操作は、通常ビンゴカードに影響します。
            個別の番号を開く・閉じる操作は、ビンゴカード画面で対象カードを確認しながら行ってください。
          </p>
        </section>

        <div style={styles.grid}>
          <section style={styles.panel}>
            <div style={styles.iconBox}>↺</div>
            <h2 style={styles.sectionTitle}>通常ビンゴカード一括リセット</h2>

            <p style={styles.description}>
              通常ビンゴカードの開放状態を初期化します。
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
              {resetLoading ? 'リセット中...' : '通常ビンゴカードをリセット'}
            </button>

            {resetMessage && (
              <div style={styles.messageBox}>
                {resetMessage}
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.iconBox}>□</div>
            <h2 style={styles.sectionTitle}>通常ビンゴイベントをアーカイブ</h2>

            <p style={styles.description}>
              現在の通常ビンゴイベントを終了し、現役の通常ビンゴカードをアーカイブします。
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
              {archiveLoading ? 'アーカイブ中...' : '通常ビンゴイベントを終了してアーカイブ'}
            </button>

            {archiveMessage && (
              <div style={styles.messageBox}>
                {archiveMessage}
              </div>
            )}
          </section>
        </div>

        <section style={styles.restorePanel}>
          <div style={styles.restoreHeader}>
            <div>
              <div style={styles.restoreBadge}>ARCHIVED BINGO CARDS</div>
              <h2 style={styles.sectionTitle}>アーカイブ済み通常ビンゴカード</h2>
              <p style={styles.description}>
                アーカイブ済みの通常ビンゴカードを確認し、必要なカードだけ復元できます。
                復元時に同じカード番号の有効カードが存在する場合は、重複防止のため復元できません。
              </p>
            </div>

            <button
              type="button"
              onClick={fetchArchivedCards}
              disabled={archivedLoading}
              style={{
                ...styles.secondaryButton,
                ...(archivedLoading ? styles.disabledButton : {}),
              }}
            >
              {archivedLoading ? '読込中...' : '一覧更新'}
            </button>
          </div>

          {restoreMessage && (
            <div style={styles.messageBox}>
              {restoreMessage}
            </div>
          )}

          {archivedLoading ? (
            <div style={styles.emptyBox}>
              アーカイブ済みビンゴカードを読み込み中です...
            </div>
          ) : archivedCards.length === 0 ? (
            <div style={styles.emptyBox}>
              アーカイブ済みの通常ビンゴカードはありません。
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>カード番号</th>
                    <th style={styles.th}>Card ID</th>
                    <th style={styles.th}>氏名</th>
                    <th style={styles.th}>ビンゴ状況</th>
                    <th style={styles.th}>メモ</th>
                    <th style={styles.th}>アーカイブ日時</th>
                    <th style={styles.th}>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {archivedCards.map((card) => {
                    const isRestoring = restoreLoadingCardId === card.card_id

                    return (
                      <tr key={card.card_id}>
                        <td style={styles.tdStrong}>{card.user_id}</td>
                        <td style={styles.td}>{card.card_id}</td>
                        <td style={styles.td}>{card.display_name || '未登録'}</td>
                        <td style={styles.tdCenter}>
                          {formatNumber(card.current_bingo_count)} ビンゴ
                          <div style={styles.userSub}>
                            {card.grid_size} × {card.grid_size}
                          </div>
                        </td>
                        <td style={styles.tdMemo}>
                          {card.customer_note || '-'}
                        </td>
                        <td style={styles.td}>
                          {formatDateTime(card.archived_at)}
                        </td>
                        <td style={styles.td}>
                          <button
                            type="button"
                            onClick={() => handleRestore(card)}
                            disabled={isRestoring}
                            style={{
                              ...styles.primaryMiniButton,
                              ...(isRestoring ? styles.disabledButton : {}),
                            }}
                          >
                            {isRestoring ? '復元中' : '復元'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
    maxWidth: '1280px',
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
    marginBottom: '18px',
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  restorePanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  restoreHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  restoreBadge: {
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
  secondaryButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyBox: {
    background: theme.white,
    border: `1px dashed ${theme.border2}`,
    borderRadius: '16px',
    padding: '38px 24px',
    textAlign: 'center',
    color: theme.muted,
    fontSize: '16px',
    lineHeight: 1.8,
  },
  tableWrap: {
    overflowX: 'auto',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '980px',
  },
  th: {
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  td: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    verticalAlign: 'top',
  },
  tdStrong: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 900,
    verticalAlign: 'top',
  },
  tdCenter: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    textAlign: 'center',
    fontWeight: 900,
    verticalAlign: 'top',
  },
  tdMemo: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    fontSize: '14px',
    color: theme.text,
    verticalAlign: 'top',
    minWidth: '180px',
    maxWidth: '280px',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
  },
  userSub: {
    marginTop: '4px',
    fontSize: '11px',
    color: theme.muted,
    fontWeight: 800,
  },
  primaryMiniButton: {
    padding: '9px 12px',
    fontSize: '13px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    textDecoration: 'none',
  },
}