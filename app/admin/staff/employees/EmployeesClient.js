'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function EmployeesClient() {
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState(null)
  const [message, setMessage] = useState('')

  const [store, setStore] = useState(null)
  const [employees, setEmployees] = useState([])
  const [cardMap, setCardMap] = useState({})

  const [statusFilter, setStatusFilter] = useState('active')
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

      const employeeRows = await fetchEmployees(currentStore.store_id)
      await fetchStaffCardsForEmployees(employeeRows)
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

  const fetchEmployees = async (storeId = store?.store_id) => {
    if (!storeId) return []

    const { data, error } = await supabase
      .from('employee_profiles')
      .select(`
        user_id,
        store_id,
        staff_code,
        employee_name,
        employment_status,
        resigned_at,
        employee_note,
        updated_at
      `)
      .eq('store_id', storeId)
      .order('staff_code', { ascending: true })

    if (error) throw error

    const rows = data || []
    setEmployees(rows)

    const nextEdits = {}
    rows.forEach((employee) => {
      nextEdits[employee.user_id] = {
        employeeName: employee.employee_name || '',
        employmentStatus: employee.employment_status || 'active',
        resignedAt: employee.resigned_at || '',
        employeeNote: employee.employee_note || '',
      }
    })
    setEdits(nextEdits)

    return rows
  }

  const fetchStaffCardsForEmployees = async (employeeRows = employees) => {
    const userIds = (employeeRows || [])
      .map((employee) => employee.user_id)
      .filter((userId) => userId !== null && userId !== undefined)

    if (userIds.length === 0) {
      setCardMap({})
      return {}
    }

    const { data, error } = await supabase
      .from('v_staff_stamp_cards_current')
      .select(`
        user_id,
        staff_code,
        current_count,
        max_count,
        card_id,
        card_status,
        program_code
      `)
      .in('user_id', userIds)
      .eq('program_code', 'stamp_staff_attendance')
      .eq('card_status', 'active')

    if (error) throw error

    const map = {}
    ;(data || []).forEach((card) => {
      map[String(card.user_id)] = card
    })

    setCardMap(map)
    return map
  }

  const reload = async () => {
    if (!store?.store_id) return

    setLoading(true)
    setMessage('再読み込み中です...')

    try {
      const employeeRows = await fetchEmployees(store.store_id)
      await fetchStaffCardsForEmployees(employeeRows)
      setMessage('従業員一覧を再読み込みしました')
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

  const updateEdit = (userId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {
          employeeName: '',
          employmentStatus: 'active',
          resignedAt: '',
          employeeNote: '',
        }),
        [field]: value,
      },
    }))
  }

  const saveEmployee = async (employee) => {
    const edit = edits[employee.user_id]
    if (!edit) return

    setSavingUserId(employee.user_id)
    setMessage(`${employee.staff_code} を保存中です...`)

    try {
      const employmentStatus = edit.employmentStatus || 'active'

      const { error } = await supabase.rpc('update_employee_profile_admin', {
        p_user_id: Number(employee.user_id),
        p_employee_name: edit.employeeName.trim() === '' ? null : edit.employeeName.trim(),
        p_employment_status: employmentStatus,
        p_resigned_at:
          employmentStatus === 'retired' && edit.resignedAt
            ? edit.resignedAt
            : null,
        p_employee_note: edit.employeeNote.trim() === '' ? null : edit.employeeNote.trim(),
      })

      if (error) throw error

      const employeeRows = await fetchEmployees(store.store_id)
      await fetchStaffCardsForEmployees(employeeRows)

      setMessage(`${employee.staff_code} を保存しました`)
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `${employee.staff_code} の保存に失敗しました: ${error.message}`
          : `${employee.staff_code} の保存に失敗しました`
      )
    } finally {
      setSavingUserId(null)
    }
  }

  const markRetiredToday = (employee) => {
    const today = new Date().toISOString().slice(0, 10)
    updateEdit(employee.user_id, 'employmentStatus', 'retired')
    updateEdit(employee.user_id, 'resignedAt', today)
  }

  const markActive = (employee) => {
    updateEdit(employee.user_id, 'employmentStatus', 'active')
    updateEdit(employee.user_id, 'resignedAt', '')
  }

  const filteredEmployees = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()

    return employees.filter((employee) => {
      const status = employee.employment_status || 'active'

      if (statusFilter === 'active' && status !== 'active') return false
      if (statusFilter === 'retired' && status !== 'retired') return false

      if (!keyword) return true

      const joined = [
        employee.staff_code,
        employee.employee_name,
        employee.employee_note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return joined.includes(keyword)
    })
  }, [employees, statusFilter, searchText])

  const activeCount = employees.filter(
    (employee) => (employee.employment_status || 'active') === 'active'
  ).length

  const retiredCount = employees.filter(
    (employee) => employee.employment_status === 'retired'
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
            <div style={styles.brandMark}>👥</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>従業員一覧・退職管理</p>
              <p style={styles.headerDescription}>
                従業員名、在籍状況、退職日、メモを管理します。
              </p>
              <p style={styles.storeText}>
                現在の対象店舗：
                {store ? `${store.store_name} (${store.store_code})` : '未取得'}
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <Link href="/admin/staff/card" style={styles.navButton}>
              従業員カード
            </Link>

            <Link href="/admin/staff/payroll" style={styles.navButton}>
              給与管理
            </Link>

            <Link href="/admin/staff" style={styles.navButton}>
              従業員管理
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
            label="従業員数"
            value={`${employees.length}人`}
            sub="登録済み従業員"
          />

          <SummaryCard
            label="在籍中"
            value={`${activeCount}人`}
            sub="通常表示対象"
          />

          <SummaryCard
            label="退職済み"
            value={`${retiredCount}人`}
            sub="通常は非表示にできます"
          />

          <SummaryCard
            label="表示中"
            value={`${filteredEmployees.length}人`}
            sub="現在の条件に一致"
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>表示条件</h2>
              <p style={styles.description}>
                在籍中のみ、退職済みも含める、退職済みのみを切り替えられます。
              </p>
            </div>
          </div>

          <div style={styles.filterGrid}>
            <label>
              <div style={styles.inputLabel}>表示対象</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.select}
              >
                <option value="active">在籍中のみ</option>
                <option value="all">退職済みも表示</option>
                <option value="retired">退職済みのみ</option>
              </select>
            </label>

            <label>
              <div style={styles.inputLabel}>検索</div>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={styles.input}
                placeholder="従業員コード・氏名・メモ"
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
              <h2 style={styles.sectionTitle}>従業員一覧</h2>
              <p style={styles.description}>
                退職済みにすると、通常一覧や給与履歴画面で非表示にできます。
                過去の給与履歴自体は削除されません。
              </p>
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div style={styles.emptyBox}>
              条件に一致する従業員はいません。
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>従業員コード</th>
                    <th style={styles.th}>氏名</th>
                    <th style={styles.th}>状態</th>
                    <th style={styles.th}>退職日</th>
                    <th style={styles.th}>現在スタンプ</th>
                    <th style={styles.th}>メモ</th>
                    <th style={styles.th}>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => {
                    const edit = edits[employee.user_id] || {
                      employeeName: employee.employee_name || '',
                      employmentStatus: employee.employment_status || 'active',
                      resignedAt: employee.resigned_at || '',
                      employeeNote: employee.employee_note || '',
                    }

                    const card = cardMap[String(employee.user_id)]
                    const isRetired = edit.employmentStatus === 'retired'
                    const isSaving = savingUserId === employee.user_id

                    return (
                      <tr key={employee.user_id}>
                        <td style={styles.tdStrong}>
                          <div>{employee.staff_code}</div>
                          <div style={styles.userSub}>ID: {employee.user_id}</div>
                        </td>

                        <td style={styles.td}>
                          <input
                            type="text"
                            value={edit.employeeName}
                            onChange={(e) => updateEdit(employee.user_id, 'employeeName', e.target.value)}
                            style={styles.nameInput}
                            placeholder="氏名"
                          />
                        </td>

                        <td style={styles.td}>
                          <select
                            value={edit.employmentStatus}
                            onChange={(e) => updateEdit(employee.user_id, 'employmentStatus', e.target.value)}
                            style={isRetired ? styles.statusSelectRetired : styles.statusSelectActive}
                          >
                            <option value="active">在籍中</option>
                            <option value="retired">退職済み</option>
                          </select>
                        </td>

                        <td style={styles.td}>
                          <input
                            type="date"
                            value={edit.resignedAt || ''}
                            onChange={(e) => updateEdit(employee.user_id, 'resignedAt', e.target.value)}
                            disabled={!isRetired}
                            style={{
                              ...styles.dateInput,
                              ...(!isRetired ? styles.disabledInput : {}),
                            }}
                          />
                        </td>

                        <td style={styles.tdCenter}>
                          {card ? formatNumber(card.current_count) : '-'}
                        </td>

                        <td style={styles.td}>
                          <input
                            type="text"
                            value={edit.employeeNote}
                            onChange={(e) => updateEdit(employee.user_id, 'employeeNote', e.target.value)}
                            style={styles.noteInput}
                            placeholder="メモ"
                          />
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            {isRetired ? (
                              <button
                                type="button"
                                onClick={() => markActive(employee)}
                                style={styles.secondaryMiniButton}
                              >
                                在籍に戻す
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => markRetiredToday(employee)}
                                style={styles.dangerMiniButton}
                              >
                                退職
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => saveEmployee(employee)}
                              disabled={isSaving}
                              style={{
                                ...styles.primaryMiniButton,
                                ...(isSaving ? styles.disabledButton : {}),
                              }}
                            >
                              {isSaving ? '保存中' : '保存'}
                            </button>

                            <Link
                              href={`/admin/staff/card?staff_code=${encodeURIComponent(employee.staff_code)}`}
                              style={styles.linkMiniButton}
                            >
                              カード
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
    gridTemplateColumns: '220px minmax(260px, 1fr) 180px',
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
  select: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 13px',
    fontSize: '15px',
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
    minWidth: '1280px',
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
    width: '180px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  statusSelectActive: {
    width: '120px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.pale,
    color: theme.deep,
    outline: 'none',
    fontWeight: 900,
  },
  statusSelectRetired: {
    width: '120px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.dangerPale,
    color: theme.danger,
    outline: 'none',
    fontWeight: 900,
  },
  dateInput: {
    width: '150px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  disabledInput: {
    background: theme.panel2,
    color: theme.muted,
  },
  noteInput: {
    width: '240px',
    boxSizing: 'border-box',
    padding: '9px 10px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
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
  secondaryMiniButton: {
    padding: '9px 12px',
    fontSize: '13px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  dangerMiniButton: {
    padding: '9px 12px',
    fontSize: '13px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
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