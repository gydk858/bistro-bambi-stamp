'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const BINGO_PROGRAM_CODE = 'bingo_regular'

export default function BingoCustomersClient() {
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState(null)
  const [message, setMessage] = useState('')

  const [store, setStore] = useState(null)
  const [customers, setCustomers] = useState([])
  const [searchText, setSearchText] = useState('')
  const [edits, setEdits] = useState({})

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setLoading(true)
    setMessage('')

    try {
      const currentStore = await fetchCurrentStore()
      setStore(currentStore)
      await fetchCustomers(currentStore.store_id)
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `初期表示に失敗しました: ${error.message}`
          : '初期表示に失敗しました'
      )
    } finally {
      setLoading(false)
    }
  }

  const fetchCurrentStore = async () => {
    const { data: setting, error: settingError } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'current_store_code')
      .maybeSingle()

    if (settingError) throw settingError

    const currentStoreCode = setting?.setting_value

    if (!currentStoreCode) {
      throw new Error('current_store_code が設定されていません')
    }

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('store_id, store_code, store_name, status')
      .eq('store_code', currentStoreCode)
      .eq('status', 'active')
      .maybeSingle()

    if (storeError) throw storeError
    if (!storeData) throw new Error('現在の対象店舗が見つかりません')

    return storeData
  }

  const fetchCustomers = async (storeId = store?.store_id) => {
    if (!storeId) return []

    const { data: userRows, error: userError } = await supabase
      .from('users')
      .select(`
        user_id,
        store_id,
        display_name,
        status,
        customer_note,
        updated_at
      `)
      .eq('store_id', storeId)
      .order('user_id', { ascending: true })

    if (userError) throw userError

    const users = userRows || []
    const userIds = users.map((user) => user.user_id)

    if (userIds.length === 0) {
      setCustomers([])
      setEdits({})
      return []
    }

    const { data: cardRows, error: cardError } = await supabase
      .from('v_bingo_cards_current')
      .select(`
        user_id,
        card_id,
        display_name,
        current_bingo_count,
        grid_size,
        card_status,
        program_code,
        updated_at
      `)
      .in('user_id', userIds)
      .eq('program_code', BINGO_PROGRAM_CODE)
      .eq('card_status', 'active')

    if (cardError) throw cardError

    const cardMap = {}
    ;(cardRows || []).forEach((card) => {
      cardMap[String(card.user_id)] = card
    })

    const rows = users
      .filter((user) => cardMap[String(user.user_id)])
      .map((user) => {
        const card = cardMap[String(user.user_id)]

        return {
          ...user,
          card_id: card.card_id,
          current_bingo_count: card.current_bingo_count ?? 0,
          grid_size: card.grid_size ?? 5,
          card_status: card.card_status,
          card_updated_at: card.updated_at,
          display_name: card.display_name || user.display_name || '未登録',
        }
      })

    setCustomers(rows)

    const nextEdits = {}
    rows.forEach((customer) => {
      nextEdits[customer.user_id] = {
        displayName: customer.display_name || '未登録',
        customerNote: customer.customer_note || '',
      }
    })
    setEdits(nextEdits)

    return rows
  }

  const reload = async () => {
    if (!store?.store_id) return

    setLoading(true)
    setMessage('再読み込み中です...')

    try {
      await fetchCustomers(store.store_id)
      setMessage('ビンゴカード一覧を再読み込みしました')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `再読み込みに失敗しました: ${error.message}`
          : '再読み込みに失敗しました'
      )
    } finally {
      setLoading(false)
    }
  }

  const syncBingoCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-bingo-card/${targetUserId}`, {
      method: 'POST',
      cache: 'no-store',
    })

    const syncJson = await syncRes.json()

    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(syncJson.error || syncJson.message || 'ビンゴカード画像の同期に失敗しました')
    }

    return syncJson
  }

  const updateEdit = (userId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {
          displayName: '',
          customerNote: '',
        }),
        [field]: value,
      },
    }))
  }

  const saveCustomer = async (customer) => {
    const edit = edits[customer.user_id]
    if (!edit) return

    setSavingUserId(customer.user_id)
    setMessage(`${customer.user_id} を保存中です...`)

    try {
      const displayName = edit.displayName.trim() === '' ? '未登録' : edit.displayName.trim()
      const customerNote = edit.customerNote.trim() === '' ? null : edit.customerNote.trim()

      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName,
          customer_note: customerNote,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', customer.user_id)

      if (error) throw error

      await syncBingoCardImage(customer.user_id)
      await fetchCustomers(store.store_id)

      setMessage(`${customer.user_id} を保存しました`)
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `${customer.user_id} の保存に失敗しました: ${error.message}`
          : `${customer.user_id} の保存に失敗しました`
      )
    } finally {
      setSavingUserId(null)
    }
  }

  const filteredCustomers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    if (!keyword) return customers

    return customers.filter((customer) => {
      const joined = [
        customer.user_id,
        customer.display_name,
        customer.customer_note,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase()

      return joined.includes(keyword)
    })
  }, [customers, searchText])

  const totalBingoCount = customers.reduce(
    (sum, customer) => sum + Number(customer.current_bingo_count || 0),
    0
  )

  const hasBingoCount = customers.filter(
    (customer) => Number(customer.current_bingo_count || 0) > 0
  ).length

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '0'
    return Number(value).toLocaleString()
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <section style={styles.panel}>
            <p style={styles.loadingText}>読み込み中です...</p>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🎯</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>ビンゴ 顧客一覧</p>
              <p style={styles.headerDescription}>
                ビンゴカードの番号、氏名、ビンゴ状況、メモを一覧で確認・管理します。
              </p>
              <p style={styles.storeText}>
                現在の対象店舗：
                {store ? `${store.store_name} (${store.store_code})` : '未取得'}
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <Link href="/admin/bingo" style={styles.navButton}>
              カード操作
            </Link>

            <Link href="/admin/bingo/manage" style={styles.navButton}>
              イベント管理
            </Link>

            <Link href="/admin" style={styles.navButton}>
              管理メニュー
            </Link>

            <button onClick={logout} style={styles.navButton}>
              ログアウト
            </button>
          </nav>
        </header>

        {message && (
          <div style={styles.messageBox}>
            {message}
          </div>
        )}

        <section style={styles.summaryGrid}>
          <SummaryCard
            label="通常ビンゴカード数"
            value={`${customers.length}枚`}
            sub="登録済み通常ビンゴカード"
          />

          <SummaryCard
            label="ビンゴ数合計"
            value={formatNumber(totalBingoCount)}
            sub="表示店舗の合計"
          />

          <SummaryCard
            label="ビンゴあり"
            value={`${hasBingoCount}枚`}
            sub="1件以上ビンゴしているカード"
          />

          <SummaryCard
            label="表示中"
            value={`${filteredCustomers.length}枚`}
            sub="現在の条件に一致"
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>表示条件</h2>
              <p style={styles.description}>
                カード番号、氏名、メモで絞り込みできます。
              </p>
            </div>
          </div>

          <div style={styles.filterGrid}>
            <label>
              <div style={styles.inputLabel}>検索</div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={styles.input}
                placeholder="カード番号・氏名・メモ"
              />
            </label>

            <button type="button" onClick={reload} style={styles.secondaryButton}>
              再読み込み
            </button>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>ビンゴカード一覧</h2>
              <p style={styles.description}>
                氏名とメモを編集できます。「カード」ボタンでビンゴカード管理画面を検索済み状態で開きます。
              </p>
            </div>
          </div>

          {filteredCustomers.length === 0 ? (
            <div style={styles.emptyBox}>
              条件に一致するビンゴカードはありません。
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>カード番号</th>
                    <th style={styles.th}>氏名</th>
                    <th style={styles.th}>ビンゴ状況</th>
                    <th style={styles.th}>メモ</th>
                    <th style={styles.th}>カード状態</th>
                    <th style={styles.th}>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map((customer) => {
                    const edit = edits[customer.user_id] || {
                      displayName: customer.display_name || '未登録',
                      customerNote: customer.customer_note || '',
                    }

                    const isSaving = savingUserId === customer.user_id
                    const bingoCount = Number(customer.current_bingo_count || 0)

                    return (
                      <tr key={customer.user_id}>
                        <td style={styles.tdStrong}>
                          <div>{customer.user_id}</div>
                          <div style={styles.userSub}>Card ID: {customer.card_id}</div>
                        </td>

                        <td style={styles.td}>
                          <input
                            type="text"
                            value={edit.displayName}
                            onChange={(e) => updateEdit(customer.user_id, 'displayName', e.target.value)}
                            style={styles.nameInput}
                            placeholder="氏名"
                          />
                        </td>

                        <td style={styles.tdCenter}>
                          <div style={bingoCount > 0 ? styles.completedStamp : styles.normalStamp}>
                            {formatNumber(customer.current_bingo_count)} ビンゴ
                          </div>
                          <div style={styles.userSub}>
                            {customer.grid_size} × {customer.grid_size}
                          </div>
                        </td>

                        <td style={styles.td}>
                          <input
                            type="text"
                            value={edit.customerNote}
                            onChange={(e) => updateEdit(customer.user_id, 'customerNote', e.target.value)}
                            style={styles.noteInput}
                            placeholder="メモ"
                          />
                        </td>

                        <td style={styles.tdCenter}>
                          <span style={styles.statusBadge}>
                            {customer.card_status || 'active'}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button
                              type="button"
                              onClick={() => saveCustomer(customer)}
                              disabled={isSaving}
                              style={{
                                ...styles.primaryMiniButton,
                                ...(isSaving ? styles.disabledButton : {}),
                              }}
                            >
                              {isSaving ? '保存中' : '保存'}
                            </button>

                            <Link
                              href={`/admin/bingo?user_id=${encodeURIComponent(customer.user_id)}`}
                              style={styles.linkMiniButton}
                            >
                              開く
                            </Link>
                          </div>
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

function SummaryCard({ label, value, sub }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
      <div style={styles.summarySub}>{sub}</div>
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
  storeText: {
    margin: '8px 0 0',
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.6,
    fontWeight: 800,
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
  messageBox: {
    marginBottom: '18px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px 16px',
    fontSize: '15px',
    color: theme.deep,
    fontWeight: 900,
    lineHeight: 1.7,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '14px',
    marginBottom: '18px',
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
    fontSize: '26px',
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
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    marginBottom: '18px',
  },
  sectionHead: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  description: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 1fr) 180px',
    gap: '12px',
    alignItems: 'end',
  },
  inputLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 13px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
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
  tableWrap: {
    overflowX: 'auto',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '1180px',
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
  userSub: {
    marginTop: '4px',
    fontSize: '11px',
    color: theme.muted,
    fontWeight: 800,
  },
  nameInput: {
    width: '220px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  noteInput: {
    width: '360px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  normalStamp: {
    color: theme.deep,
    fontWeight: 950,
  },
  completedStamp: {
    color: theme.green,
    fontWeight: 950,
  },
  statusBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.pale,
    color: theme.deep,
    fontSize: '12px',
    fontWeight: 950,
  },
  actionGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
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
  linkMiniButton: {
    padding: '9px 12px',
    fontSize: '13px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.65,
    cursor: 'default',
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
  loadingText: {
    fontSize: '18px',
    margin: 0,
    color: theme.muted,
  },
}