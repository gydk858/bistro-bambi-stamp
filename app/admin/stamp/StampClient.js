'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const SUPABASE_PUBLIC_CARD_BASE =
  'https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live'

export default function StampClient() {
  const [userId, setUserId] = useState('')
  const [cardRecord, setCardRecord] = useState(null)
  const [message, setMessage] = useState('')

  const [createMessage, setCreateMessage] = useState('')
  const [editName, setEditName] = useState('')
  const [nameMessage, setNameMessage] = useState('')
  const [previewKey, setPreviewKey] = useState(Date.now())
  const [copiedFixed, setCopiedFixed] = useState(false)

  const normalizeToHalfWidthNumber = (value) => {
    return value
      .replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      )
      .replace(/[^0-9]/g, '')
  }

  const refreshPreview = () => {
    setPreviewKey(Date.now())
  }

  const getFixedCardUrl = (targetUserId) => {
    return `${SUPABASE_PUBLIC_CARD_BASE}/${targetUserId}.png`
  }

  const getPreviewUrl = (targetRecord) => {
    if (!targetRecord) return ''
    const fixedUrl = getFixedCardUrl(targetRecord.user_id)
    return `${fixedUrl}?preview=${previewKey}`
  }

  const syncCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-card/${targetUserId}`, {
      method: 'POST',
      cache: 'no-store',
    })

    const syncJson = await syncRes.json()

    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(syncJson.error || syncJson.message || 'カード画像の同期に失敗しました')
    }

    return syncJson
  }

  const fetchStampCardByUserId = async (targetUserId) => {
    const { data, error } = await supabase
      .from('v_stamp_cards_current')
      .select('*')
      .eq('user_id', Number(targetUserId))
      .eq('program_code', 'stamp_regular')
      .eq('card_status', 'active')
      .maybeSingle()

    if (error) {
      throw new Error('カード情報の取得に失敗しました')
    }

    if (!data) {
      throw new Error('このスタンプカードは現在使用できません')
    }

    return data
  }

  const searchUser = async () => {
    setMessage('')
    setNameMessage('')
    setCopiedFixed(false)

    if (!userId) {
      setCardRecord(null)
      setEditName('')
      setMessage('番号を入力してください')
      return
    }

    try {
      const data = await fetchStampCardByUserId(userId)

      await syncCardImage(data.user_id)

      const refreshedData = await fetchStampCardByUserId(data.user_id)

      setCardRecord(refreshedData)
      setEditName(refreshedData.display_name || '')
      setMessage('カードを表示しました')
      refreshPreview()
    } catch (error) {
      setCardRecord(null)
      setEditName('')
      setMessage(
        error instanceof Error ? error.message : 'カード情報の取得に失敗しました'
      )
    }
  }

  const createCard = async () => {
    setCreateMessage('')
    setMessage('')
    setNameMessage('')
    setCopiedFixed(false)

    try {
      const now = new Date().toISOString()

      const { data: createdUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          display_name: '未登録',
          status: 'active',
          updated_at: now,
        })
        .select('user_id, display_name, updated_at')
        .maybeSingle()

      if (createUserError || !createdUser) {
        throw new Error('ユーザー作成に失敗しました')
      }

      const { data: createdCardRows, error: createCardError } = await supabase.rpc(
        'create_stamp_card_for_user',
        {
          p_user_id: createdUser.user_id,
          p_program_code: 'stamp_regular',
          p_max_count: 12,
          p_note: '管理画面から新規発行',
        }
      )

      if (createCardError) {
        throw new Error(`カード発行に失敗しました: ${createCardError.message}`)
      }

      if (!createdCardRows || createdCardRows.length === 0) {
        throw new Error('カード発行結果を取得できませんでした')
      }

      await syncCardImage(createdUser.user_id)

      const fetchedCard = await fetchStampCardByUserId(createdUser.user_id)

      setCreateMessage(`カード番号 ${createdUser.user_id} を発行しました`)
      setMessage('新規カードを発行しました')
      setUserId(String(createdUser.user_id))
      setCardRecord(fetchedCard)
      setEditName(fetchedCard.display_name || '')
      refreshPreview()
    } catch (error) {
      setCreateMessage(
        error instanceof Error ? error.message : 'カード発行に失敗しました'
      )
    }
  }

  const saveName = async () => {
    setNameMessage('')
    setCopiedFixed(false)

    if (!cardRecord) {
      setNameMessage('先にカードを検索してください')
      return
    }

    const trimmedName = editName.trim()

    const { data, error } = await supabase
      .from('users')
      .update({
        display_name: trimmedName === '' ? '未登録' : trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cardRecord.user_id)
      .select()
      .maybeSingle()

    if (error || !data) {
      setNameMessage('氏名の保存に失敗しました')
      return
    }

    try {
      await syncCardImage(data.user_id)
    } catch (error) {
      setNameMessage(
        error instanceof Error
          ? error.message
          : 'カード画像の同期に失敗しました'
      )
      return
    }

    setCardRecord((prev) =>
      prev
        ? {
            ...prev,
            display_name: data.display_name,
            updated_at: data.updated_at,
          }
        : prev
    )
    setEditName(data.display_name || '')
    setNameMessage('氏名を保存しました')
    refreshPreview()
  }

  const updateStampCount = async (diff) => {
    if (!cardRecord) return

    const { data, error } = await supabase.rpc('increment_stamp_card', {
      p_card_id: cardRecord.card_id,
      p_amount: diff,
      p_acted_by: 'admin_ui',
      p_reason: diff > 0 ? '管理画面からスタンプ追加' : '管理画面からスタンプ減算',
    })

    if (error || !data || data.length === 0) {
      setMessage('スタンプ更新に失敗しました')
      return
    }

    const updated = data[0]

    try {
      await syncCardImage(cardRecord.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'カード画像の同期に失敗しました'
      )
      return
    }

    setCardRecord((prev) =>
      prev
        ? {
            ...prev,
            current_count: updated.current_count,
            max_count: updated.max_count,
            completed_at: updated.completed_at,
            updated_at: new Date().toISOString(),
          }
        : prev
    )

    setMessage(`スタンプ数を ${updated.current_count} に更新しました`)
    refreshPreview()
    setCopiedFixed(false)
  }

  const resetStampCard = async () => {
    if (!cardRecord) return

    const { data, error } = await supabase.rpc('reset_stamp_card', {
      p_card_id: cardRecord.card_id,
      p_acted_by: 'admin_ui',
      p_reason: '管理画面からリセット',
    })

    if (error || !data || data.length === 0) {
      setMessage('スタンプのリセットに失敗しました')
      return
    }

    const resetResult = data[0]

    try {
      await syncCardImage(cardRecord.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'カード画像の同期に失敗しました'
      )
      return
    }

    setCardRecord((prev) =>
      prev
        ? {
            ...prev,
            current_count: resetResult.current_count,
            max_count: resetResult.max_count,
            completed_at: null,
            updated_at: new Date().toISOString(),
          }
        : prev
    )

    setMessage('スタンプをリセットしました')
    refreshPreview()
    setCopiedFixed(false)
  }

  const copyFixedCardUrl = async () => {
    if (!cardRecord) return

    const fullUrl = getFixedCardUrl(cardRecord.user_id)

    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedFixed(true)
      setTimeout(() => setCopiedFixed(false), 2000)
    } catch {
      setCopiedFixed(false)
      setMessage('固定URLのコピーに失敗しました')
    }
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🌿</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>スタンプカード管理</p>
              <p style={styles.headerDescription}>
                通常スタンプカードの発行、検索、氏名登録、スタンプ更新を行います。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>

            <a href="/admin/stamp/manage" style={styles.navButton}>
              スタンプ管理
            </a>

            <button onClick={logout} style={styles.navButton}>
              ログアウト
            </button>
          </nav>
        </header>

        {(message || createMessage || nameMessage) && (
          <div style={styles.messageArea}>
            {createMessage && <div style={styles.message}>{createMessage}</div>}
            {message && <div style={styles.message}>{message}</div>}
            {nameMessage && <div style={styles.message}>{nameMessage}</div>}
          </div>
        )}

        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>01</span>
                <h2 style={styles.sectionTitle}>カード新規発行</h2>
              </div>

              <p style={styles.description}>
                名前未登録の通常スタンプカードを新しく発行します。
              </p>

              <button onClick={createCard} style={styles.primaryButton}>
                カード新規発行
              </button>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>02</span>
                <h2 style={styles.sectionTitle}>カード検索</h2>
              </div>

              <div style={styles.formStack}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="番号を入力"
                  value={userId}
                  onChange={(e) =>
                    setUserId(normalizeToHalfWidthNumber(e.target.value))
                  }
                  style={styles.input}
                />

                <button onClick={searchUser} style={styles.primaryButton}>
                  検索
                </button>
              </div>
            </section>

            {cardRecord && (
              <>
                <section style={styles.panel}>
                  <div style={styles.sectionHead}>
                    <span style={styles.sectionNumber}>03</span>
                    <h2 style={styles.sectionTitle}>氏名登録・修正</h2>
                  </div>

                  <div style={styles.formStack}>
                    <input
                      type="text"
                      placeholder="氏名を入力"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={styles.input}
                    />

                    <button onClick={saveName} style={styles.primaryButton}>
                      氏名を保存
                    </button>
                  </div>

                  <p style={styles.smallNote}>
                    空欄で保存すると、氏名未登録に戻せます。
                  </p>
                </section>

                <section style={styles.panel}>
                  <div style={styles.sectionHead}>
                    <span style={styles.sectionNumber}>04</span>
                    <h2 style={styles.sectionTitle}>スタンプ更新</h2>
                  </div>

                  <p style={styles.description}>
                    来店時にスタンプ数を調整します。
                  </p>

                  <div style={styles.stampActions}>
                    <button onClick={() => updateStampCount(-1)} style={styles.stampButton}>
                      -1
                    </button>
                    <button onClick={() => updateStampCount(1)} style={styles.stampButton}>
                      +1
                    </button>
                    <button onClick={resetStampCard} style={styles.dangerButton}>
                      リセット
                    </button>
                  </div>
                </section>
              </>
            )}
          </aside>

          <main style={styles.main}>
            <section style={styles.summaryGrid}>
              <SummaryCard
                label="カード番号"
                value={cardRecord ? cardRecord.user_id : '-'}
                sub="検索または新規発行後に表示"
              />
              <SummaryCard
                label="氏名"
                value={cardRecord ? cardRecord.display_name || '未登録' : '-'}
                sub="カードに表示される名前"
              />
              <SummaryCard
                label="現在スタンプ数"
                value={cardRecord ? `${cardRecord.current_count} / ${cardRecord.max_count}` : '-'}
                sub="通常スタンプカード"
              />
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>カード情報</h2>
                  <p style={styles.mainDescription}>
                    カード番号、氏名、現在スタンプ数、固定URLを確認します。
                  </p>
                </div>
              </div>

              {cardRecord ? (
                <div style={styles.infoGrid}>
                  <InfoItem label="番号" value={cardRecord.user_id} />
                  <InfoItem label="カードID" value={cardRecord.card_id} />
                  <InfoItem label="氏名" value={cardRecord.display_name || '未登録'} />
                  <InfoItem label="現在のスタンプ数" value={cardRecord.current_count} />
                  <InfoItem label="最大スタンプ数" value={cardRecord.max_count} />
                  <InfoItem label="状態" value={cardRecord.card_status || 'active'} />
                </div>
              ) : (
                <div style={styles.emptyBox}>
                  カードを検索すると、ここに情報が表示されます。
                </div>
              )}

              {cardRecord && (
                <div style={styles.urlBox}>
                  <div style={styles.inputLabel}>固定カードURL</div>

                  <div style={styles.urlRow}>
                    <a
                      href={getFixedCardUrl(cardRecord.user_id)}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.link}
                    >
                      {getFixedCardUrl(cardRecord.user_id)}
                    </a>

                    <button
                      onClick={copyFixedCardUrl}
                      style={copiedFixed ? styles.copyButtonActive : styles.copyButton}
                    >
                      {copiedFixed ? 'コピー済み' : 'コピー'}
                    </button>
                  </div>

                  <p style={styles.smallNote}>
                    GTA内印刷機能や実運用で使う固定URLです。
                  </p>
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>カード画像プレビュー</h2>
                  <p style={styles.mainDescription}>
                    氏名保存やスタンプ更新後は自動で画像を同期します。
                  </p>
                </div>
              </div>

              {cardRecord ? (
                <>
                  <div style={styles.previewFrame}>
                    <img
                      src={getPreviewUrl(cardRecord)}
                      alt={`カード ${cardRecord.user_id}`}
                      style={styles.previewImage}
                    />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <button onClick={refreshPreview} style={styles.secondaryButton}>
                      プレビュー再読み込み
                    </button>
                  </div>
                </>
              ) : (
                <div style={styles.emptyBox}>
                  カード検索後に、ここへ大きくプレビュー表示されます。
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summarySub}>{sub}</div>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
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
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    color: theme.text,
    padding: '24px',
  },
  container: {
    maxWidth: '1640px',
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
  messageArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '18px',
  },
  message: {
    fontSize: '15px',
    fontWeight: 800,
    color: theme.deep,
    background: theme.white,
    padding: '13px 15px',
    borderRadius: '14px',
    border: `1px solid ${theme.border}`,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '370px minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    position: 'sticky',
    top: '16px',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minWidth: 0,
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
  },
  sectionNumber: {
    fontSize: '13px',
    fontWeight: 900,
    color: theme.white,
    background: theme.green,
    borderRadius: '999px',
    padding: '5px 9px',
    lineHeight: 1,
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 900,
    color: theme.deep,
    margin: 0,
  },
  description: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '0 0 14px',
  },
  smallNote: {
    fontSize: '13px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '10px 0 0',
  },
  formStack: {
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
  inputLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '6px',
  },
  primaryButton: {
    width: '100%',
    justifyContent: 'center',
    padding: '13px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
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
  },
  stampActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  stampButton: {
    padding: '17px 18px',
    fontSize: '26px',
    fontWeight: 950,
    borderRadius: '14px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  dangerButton: {
    gridColumn: '1 / -1',
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 900,
    borderRadius: '14px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '14px',
  },
  summaryCard: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 10px 24px rgba(47, 74, 52, 0.06)',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: 900,
    color: theme.muted,
    marginBottom: '8px',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1.3,
    wordBreak: 'break-word',
  },
  summarySub: {
    fontSize: '12px',
    color: theme.muted,
    marginTop: '8px',
    lineHeight: 1.5,
  },
  mainSectionHead: {
    marginBottom: '16px',
  },
  mainTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  mainDescription: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  infoItem: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  infoLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '8px',
  },
  infoValue: {
    fontSize: '18px',
    color: theme.deep,
    fontWeight: 900,
    wordBreak: 'break-word',
  },
  emptyBox: {
    background: theme.white,
    border: `1px dashed ${theme.border2}`,
    borderRadius: '16px',
    padding: '42px 24px',
    textAlign: 'center',
    color: theme.muted,
    fontSize: '17px',
    lineHeight: 1.8,
  },
  urlBox: {
    marginTop: '16px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  urlRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  link: {
    color: theme.green,
    fontWeight: 900,
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
  copyButton: {
    padding: '10px 13px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
  },
  copyButtonActive: {
    padding: '10px 13px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
  },
  previewFrame: {
    background: theme.white,
    padding: '16px',
    borderRadius: '18px',
    border: `1px solid ${theme.border}`,
  },
  previewImage: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: '16px',
    border: `1px solid ${theme.border2}`,
    display: 'block',
    background: theme.white,
  },
}