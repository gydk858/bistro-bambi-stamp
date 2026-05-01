'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function PayrollHistoryClient() {
  const now = new Date()
  const defaultYear = now.getFullYear()
  const defaultMonth = now.getMonth() + 1

  const tableWrapRef = useRef(null)
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
  })

  const [isTableDragging, setIsTableDragging] = useState(false)

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [startYear, setStartYear] = useState(defaultYear)
  const [startMonth, setStartMonth] = useState(defaultMonth)
  const [endYear, setEndYear] = useState(defaultYear)
  const [endMonth, setEndMonth] = useState(defaultMonth)
  const [includeRetired, setIncludeRetired] = useState(false)

  const [rows, setRows] = useState([])

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    setMessage(initialLoading ? '' : '給与履歴を取得中です...')

    try {
      const { data, error } = await supabase.rpc('get_payroll_history_matrix', {
        p_start_year: Number(startYear),
        p_start_month: Number(startMonth),
        p_end_year: Number(endYear),
        p_end_month: Number(endMonth),
        p_include_retired: Boolean(includeRetired),
      })

      if (error) throw error

      setRows(data || [])
      setMessage(`給与履歴を取得しました（${(data || []).length}件）`)
    } catch (error) {
      console.error(error)
      setRows([])
      setMessage(
        error instanceof Error
          ? `給与履歴の取得に失敗しました: ${error.message}`
          : '給与履歴の取得に失敗しました'
      )
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const handleMouseDown = (event) => {
    if (!tableWrapRef.current) return

    const target = event.target

    if (
      target?.tagName === 'A' ||
      target?.tagName === 'BUTTON' ||
      target?.tagName === 'INPUT' ||
      target?.tagName === 'SELECT' ||
      target?.tagName === 'TEXTAREA'
    ) {
      return
    }

    dragStateRef.current.isDragging = true
    dragStateRef.current.startX = event.pageX - tableWrapRef.current.offsetLeft
    dragStateRef.current.scrollLeft = tableWrapRef.current.scrollLeft

    setIsTableDragging(true)
  }

  const handleMouseMove = (event) => {
    if (!dragStateRef.current.isDragging || !tableWrapRef.current) return

    event.preventDefault()

    const x = event.pageX - tableWrapRef.current.offsetLeft
    const walk = x - dragStateRef.current.startX

    tableWrapRef.current.scrollLeft = dragStateRef.current.scrollLeft - walk
  }

  const stopDragging = () => {
    dragStateRef.current.isDragging = false
    setIsTableDragging(false)
  }

  const months = useMemo(() => {
    const map = new Map()

    rows.forEach((row) => {
      const key = `${row.target_year}-${String(row.target_month).padStart(2, '0')}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          targetYear: row.target_year,
          targetMonth: row.target_month,
          label: `${row.target_year}年${row.target_month}月`,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.targetYear !== b.targetYear) return a.targetYear - b.targetYear
      return a.targetMonth - b.targetMonth
    })
  }, [rows])

  const employeeRows = useMemo(() => {
    const map = new Map()

    rows.forEach((row) => {
      const employeeKey = String(row.user_id)

      if (!map.has(employeeKey)) {
        map.set(employeeKey, {
          userId: row.user_id,
          staffCode: row.staff_code,
          employeeName: row.employee_name,
          employmentStatus: row.employment_status || 'active',
          resignedAt: row.resigned_at,
          employeeNote: row.employee_note,
          cells: {},
          totalAttendance: 0,
          totalCalculatedPay: 0,
          totalTransfer: 0,
          totalAdjustment: 0,
        })
      }

      const employee = map.get(employeeKey)
      const monthKey = `${row.target_year}-${String(row.target_month).padStart(2, '0')}`
      const halfKey =
        row.half_label === '前半'
          ? 'first'
          : row.half_label === '後半'
          ? 'second'
          : String(row.half_sort)

      if (!employee.cells[monthKey]) {
        employee.cells[monthKey] = {}
      }

      employee.cells[monthKey][halfKey] = row
      employee.totalAttendance += Number(row.attendance_count || 0)
      employee.totalCalculatedPay += Number(row.calculated_pay_amount || 0)
      employee.totalTransfer += Number(row.transfer_amount || 0)
      employee.totalAdjustment += Number(row.adjustment_amount || 0)
    })

    return Array.from(map.values()).sort((a, b) => {
      return String(a.staffCode || '').localeCompare(String(b.staffCode || ''), 'ja')
    })
  }, [rows])

  const monthlySummaries = useMemo(() => {
    return months.map((month) => {
      const monthRows = rows.filter(
        (row) =>
          Number(row.target_year) === Number(month.targetYear) &&
          Number(row.target_month) === Number(month.targetMonth)
      )

      const periodMap = new Map()

      monthRows.forEach((row) => {
        const periodKey = String(row.payroll_period_id)

        if (!periodMap.has(periodKey)) {
          periodMap.set(periodKey, {
            payrollPeriodId: row.payroll_period_id,
            halfLabel: row.half_label,
            halfSort: row.half_sort,
            totalPayAmount: Number(row.total_pay_amount || 0),
            totalTransferAmount: Number(row.total_transfer_amount || 0),
            totalAdjustmentAmount: Number(row.total_adjustment_amount || 0),
            previousVaultAfterAmount: Number(row.previous_vault_after_amount || 0),
            ranchProfitAmount: Number(row.ranch_profit_amount || 0),
            vaultBeforeAmount: Number(row.vault_before_amount || 0),
            extraIncomeAmount: Number(row.extra_income_amount || 0),
            vaultPlusRanchAmount: Number(row.vault_plus_ranch_amount || 0),
            vaultAfterAmount: Number(row.vault_after_amount || 0),
            storeProfitAmount: Number(row.store_profit_amount || 0),
            totalProfitAmount: Number(row.total_profit_amount || 0),
          })
        }
      })

      const periods = Array.from(periodMap.values()).sort((a, b) => a.halfSort - b.halfSort)
      const first = periods.find((period) => period.halfLabel === '前半') || null
      const second = periods.find((period) => period.halfLabel === '後半') || null

      return {
        ...month,
        periods,
        first,
        second,
        monthlyTotalPay: periods.reduce((sum, period) => sum + Number(period.totalPayAmount || 0), 0),
        monthlyTotalTransfer: periods.reduce((sum, period) => sum + Number(period.totalTransferAmount || 0), 0),
        monthlyRanchProfit: periods.reduce((sum, period) => sum + Number(period.ranchProfitAmount || 0), 0),
        monthlyExtraIncome: periods.reduce((sum, period) => sum + Number(period.extraIncomeAmount || 0), 0),
        monthlyStoreProfit: periods.reduce((sum, period) => sum + Number(period.storeProfitAmount || 0), 0),
        monthlyTotalProfit: periods.reduce((sum, period) => sum + Number(period.totalProfitAmount || 0), 0),
        lastVaultAfterAmount: periods.length > 0 ? periods[periods.length - 1].vaultAfterAmount : 0,
      }
    })
  }, [months, rows])

  const grandTotals = useMemo(() => {
    return employeeRows.reduce(
      (total, employee) => {
        total.attendance += Number(employee.totalAttendance || 0)
        total.calculatedPay += Number(employee.totalCalculatedPay || 0)
        total.transfer += Number(employee.totalTransfer || 0)
        total.adjustment += Number(employee.totalAdjustment || 0)
        return total
      },
      {
        attendance: 0,
        calculatedPay: 0,
        transfer: 0,
        adjustment: 0,
      }
    )
  }, [employeeRows])

  const storeInfo = rows.length > 0
    ? {
        storeName: rows[0].store_name,
        storeCode: rows[0].store_code,
      }
    : null

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const formatMoney = (value) => {
    if (value === null || value === undefined || value === '') return '0'
    return Number(value).toLocaleString()
  }

  const formatDate = (value) => {
    if (!value) return '-'
    return String(value).slice(0, 10)
  }

  const getCell = (employee, monthKey, halfKey) => {
    return employee.cells?.[monthKey]?.[halfKey] || null
  }

  const renderPayrollCell = (cell) => {
    if (!cell) {
      return <div style={styles.emptyCell}>-</div>
    }

    return (
      <div style={styles.payrollCell}>
        <div style={styles.cellMain}>{formatMoney(cell.attendance_count)}回</div>
        <div style={styles.cellLine}>支給 {formatMoney(cell.calculated_pay_amount)}</div>
        <div style={styles.cellLine}>振込 {formatMoney(cell.transfer_amount)}</div>
        {Number(cell.adjustment_amount || 0) !== 0 && (
          <div style={styles.cellAdjust}>調整 {formatMoney(cell.adjustment_amount)}</div>
        )}
      </div>
    )
  }

  const getMonthSummaryCell = (summary, halfKey, field) => {
    if (halfKey === 'first') {
      return summary.first ? summary.first[field] : 0
    }

    if (halfKey === 'second') {
      return summary.second ? summary.second[field] : 0
    }

    if (halfKey === 'total') {
      if (field === 'totalPayAmount') return summary.monthlyTotalPay
      if (field === 'totalTransferAmount') return summary.monthlyTotalTransfer
      if (field === 'ranchProfitAmount') return summary.monthlyRanchProfit
      if (field === 'extraIncomeAmount') return summary.monthlyExtraIncome
      if (field === 'storeProfitAmount') return summary.monthlyStoreProfit
      if (field === 'totalProfitAmount') return summary.monthlyTotalProfit
      if (field === 'vaultAfterAmount') return summary.lastVaultAfterAmount

      return null
    }

    return 0
  }

  const summaryRows = [
    {
      key: 'totalPayAmount',
      label: '総支払額',
      field: 'totalPayAmount',
      totalMode: 'sum',
    },
    {
      key: 'totalTransferAmount',
      label: '振込額',
      field: 'totalTransferAmount',
      totalMode: 'sum',
    },
    {
      key: 'previousVaultAfterAmount',
      label: '前回支払い後金庫',
      field: 'previousVaultAfterAmount',
      totalMode: 'blank',
    },
    {
      key: 'vaultBeforeAmount',
      label: '支払い前金庫',
      field: 'vaultBeforeAmount',
      totalMode: 'blank',
    },
    {
      key: 'ranchProfitAmount',
      label: '牧場利益',
      field: 'ranchProfitAmount',
      totalMode: 'sum',
    },
    {
      key: 'extraIncomeAmount',
      label: 'その他収入',
      field: 'extraIncomeAmount',
      totalMode: 'sum',
    },
    {
      key: 'vaultAfterAmount',
      label: '支払い後金庫',
      field: 'vaultAfterAmount',
      totalMode: 'last',
    },
    {
      key: 'storeProfitAmount',
      label: '営業利益',
      field: 'storeProfitAmount',
      totalMode: 'sum',
    },
    {
      key: 'totalProfitAmount',
      label: '経常利益',
      field: 'totalProfitAmount',
      totalMode: 'sum',
    },
  ]

  const renderSummaryValue = (summary, halfKey, summaryRow) => {
    if (halfKey === 'total' && summaryRow.totalMode === 'blank') {
      return '-'
    }

    const value = getMonthSummaryCell(summary, halfKey, summaryRow.field)

    if (value === null || value === undefined) {
      return '-'
    }

    return formatMoney(value)
  }

  if (initialLoading) {
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
            <div style={styles.brandMark}>📊</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>給与履歴一覧</p>
              <p style={styles.headerDescription}>
                店舗集計と従業員別給与履歴を、1つの横スクロール表で確認します。
              </p>
              <p style={styles.storeText}>
                対象店舗：
                {storeInfo ? ` ${storeInfo.storeName} (${storeInfo.storeCode})` : ' データ未取得'}
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <Link href="/admin/staff/payroll" style={styles.navButton}>
              給与管理
            </Link>

            <Link href="/admin/staff/payroll/monthly" style={styles.navButton}>
              月次一覧
            </Link>

            <Link href="/admin/staff/employees" style={styles.navButton}>
              従業員一覧
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

        {message && <div style={styles.messageBox}>{message}</div>}

        <section style={styles.summaryGrid}>
          <SummaryCard
            label="表示従業員"
            value={`${employeeRows.length}人`}
            sub={includeRetired ? '退職済みを含む' : '在籍中のみ'}
          />

          <SummaryCard
            label="総出勤数"
            value={`${formatMoney(grandTotals.attendance)}回`}
            sub="表示期間内の合計"
          />

          <SummaryCard
            label="総支給額"
            value={formatMoney(grandTotals.calculatedPay)}
            sub="計算支給額合計"
          />

          <SummaryCard
            label="総振込額"
            value={formatMoney(grandTotals.transfer)}
            sub={`調整額 ${formatMoney(grandTotals.adjustment)}`}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>表示条件</h2>
              <p style={styles.description}>
                開始年月〜終了年月を指定して、給与履歴を横断表示します。
              </p>
            </div>
          </div>

          <div style={styles.filterGrid}>
            <label>
              <div style={styles.inputLabel}>開始年</div>
              <input
                type="number"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                style={styles.input}
              />
            </label>

            <label>
              <div style={styles.inputLabel}>開始月</div>
              <input
                type="number"
                min="1"
                max="12"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                style={styles.input}
              />
            </label>

            <label>
              <div style={styles.inputLabel}>終了年</div>
              <input
                type="number"
                value={endYear}
                onChange={(e) => setEndYear(e.target.value)}
                style={styles.input}
              />
            </label>

            <label>
              <div style={styles.inputLabel}>終了月</div>
              <input
                type="number"
                min="1"
                max="12"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                style={styles.input}
              />
            </label>

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeRetired}
                onChange={(e) => setIncludeRetired(e.target.checked)}
                style={styles.checkbox}
              />
              退職済みも表示
            </label>

            <button
              type="button"
              onClick={fetchHistory}
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? '取得中...' : '履歴を表示'}
            </button>
          </div>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>給与履歴表</h2>
              <p style={styles.description}>
                表の中をクリックしたまま左右へドラッグすると、横スクロールできます。
              </p>
            </div>
          </div>

          {months.length === 0 ? (
            <div style={styles.emptyBox}>表示できる給与履歴がありません。</div>
          ) : (
            <div
              ref={tableWrapRef}
              style={{
                ...styles.unifiedTableWrap,
                ...(isTableDragging ? styles.unifiedTableWrapDragging : {}),
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDragging}
              onMouseLeave={stopDragging}
            >
              <table style={styles.unifiedTable}>
                <thead>
                  <tr>
                    <th style={styles.stickyTh} rowSpan="2">項目 / 従業員</th>
                    {months.map((month) => (
                      <th key={month.key} style={styles.monthTh} colSpan="3">
                        {month.label}
                      </th>
                    ))}
                    <th style={styles.totalTh} rowSpan="2">期間合計</th>
                  </tr>

                  <tr>
                    {months.map((month) => (
                      <Fragment key={`${month.key}-header-detail`}>
                        <th style={styles.th}>前半</th>
                        <th style={styles.th}>後半</th>
                        <th style={styles.th}>月合計</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td
                      style={styles.groupHeaderTd}
                      colSpan={months.length * 3 + 2}
                    >
                      店舗集計
                    </td>
                  </tr>

                  {summaryRows.map((summaryRow) => (
                    <tr key={summaryRow.key}>
                      <td style={styles.summaryStickyTd}>{summaryRow.label}</td>

                      {monthlySummaries.map((summary) => (
                        <Fragment key={`${summary.key}-${summaryRow.key}`}>
                          <td style={styles.summaryTd}>
                            {renderSummaryValue(summary, 'first', summaryRow)}
                          </td>
                          <td style={styles.summaryTd}>
                            {renderSummaryValue(summary, 'second', summaryRow)}
                          </td>
                          <td style={styles.summaryTotalTd}>
                            {renderSummaryValue(summary, 'total', summaryRow)}
                          </td>
                        </Fragment>
                      ))}

                      <td style={styles.summaryPeriodTotalTd}>-</td>
                    </tr>
                  ))}

                  <tr>
                    <td
                      style={styles.groupHeaderTd}
                      colSpan={months.length * 3 + 2}
                    >
                      従業員別
                    </td>
                  </tr>

                  {employeeRows.map((employee) => (
                    <tr key={employee.userId}>
                      <td style={styles.stickyTd}>
                        <div style={styles.employeeName}>
                          {employee.employeeName || '未登録'}
                        </div>
                        <div style={styles.employeeSub}>{employee.staffCode}</div>
                        {employee.employmentStatus === 'retired' && (
                          <div style={styles.retiredBadge}>
                            退職済み {formatDate(employee.resignedAt)}
                          </div>
                        )}
                      </td>

                      {months.map((month) => {
                        const firstCell = getCell(employee, month.key, 'first')
                        const secondCell = getCell(employee, month.key, 'second')
                        const monthAttendance =
                          Number(firstCell?.attendance_count || 0) +
                          Number(secondCell?.attendance_count || 0)
                        const monthCalculatedPay =
                          Number(firstCell?.calculated_pay_amount || 0) +
                          Number(secondCell?.calculated_pay_amount || 0)
                        const monthTransfer =
                          Number(firstCell?.transfer_amount || 0) +
                          Number(secondCell?.transfer_amount || 0)

                        return (
                          <Fragment key={`${employee.userId}-${month.key}`}>
                            <td style={styles.td}>{renderPayrollCell(firstCell)}</td>
                            <td style={styles.td}>{renderPayrollCell(secondCell)}</td>
                            <td style={styles.monthTotalTd}>
                              <div style={styles.payrollCell}>
                                <div style={styles.cellMain}>{formatMoney(monthAttendance)}回</div>
                                <div style={styles.cellLine}>支給 {formatMoney(monthCalculatedPay)}</div>
                                <div style={styles.cellLine}>振込 {formatMoney(monthTransfer)}</div>
                              </div>
                            </td>
                          </Fragment>
                        )
                      })}

                      <td style={styles.totalTd}>
                        <div style={styles.totalCell}>
                          <div style={styles.cellMain}>{formatMoney(employee.totalAttendance)}回</div>
                          <div style={styles.cellLine}>支給 {formatMoney(employee.totalCalculatedPay)}</div>
                          <div style={styles.cellLine}>振込 {formatMoney(employee.totalTransfer)}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
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
  pale2: '#edf4e8',
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
    maxWidth: '1780px',
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
    fontSize: '25px',
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
    gridTemplateColumns: '120px 100px 120px 100px 190px 170px',
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minHeight: '45px',
    fontSize: '14px',
    fontWeight: 900,
    color: theme.deep,
  },
  checkbox: {
    width: '18px',
    height: '18px',
  },
  primaryButton: {
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
    justifyContent: 'center',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  unifiedTableWrap: {
    overflowX: 'auto',
    overflowY: 'visible',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    cursor: 'grab',
    userSelect: 'none',
  },
  unifiedTableWrapDragging: {
    cursor: 'grabbing',
  },
  unifiedTable: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    minWidth: '1180px',
  },
  stickyTh: {
    position: 'sticky',
    left: 0,
    top: 0,
    zIndex: 5,
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '13px 14px',
    borderRight: `1px solid ${theme.border2}`,
    borderBottom: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 950,
    minWidth: '210px',
  },
  monthTh: {
    position: 'sticky',
    top: 0,
    zIndex: 4,
    background: theme.pale,
    color: theme.deep,
    textAlign: 'center',
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    fontWeight: 950,
  },
  totalTh: {
    position: 'sticky',
    top: 0,
    zIndex: 4,
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 950,
    minWidth: '150px',
  },
  th: {
    position: 'sticky',
    top: '46px',
    zIndex: 4,
    background: theme.pale2,
    color: theme.deep,
    textAlign: 'left',
    padding: '11px 12px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '12px',
    fontWeight: 950,
    minWidth: '138px',
  },
  groupHeaderTd: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    background: theme.green,
    color: theme.white,
    padding: '10px 14px',
    borderBottom: `1px solid ${theme.border2}`,
    fontSize: '14px',
    fontWeight: 950,
    letterSpacing: '0.04em',
  },
  summaryStickyTd: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    background: theme.white,
    padding: '12px 14px',
    borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
    minWidth: '210px',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 950,
  },
  summaryTd: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    textAlign: 'right',
    fontWeight: 800,
    background: theme.white,
    minWidth: '145px',
  },
  summaryTotalTd: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    textAlign: 'right',
    fontWeight: 950,
    background: theme.pale2,
    minWidth: '145px',
  },
  summaryPeriodTotalTd: {
    padding: '12px 14px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.muted,
    textAlign: 'center',
    fontWeight: 950,
    background: theme.pale,
    minWidth: '145px',
  },
  stickyTd: {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: theme.white,
    padding: '12px 14px',
    borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
    minWidth: '210px',
    verticalAlign: 'top',
  },
  td: {
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    color: theme.text,
    verticalAlign: 'top',
    background: theme.white,
  },
  monthTotalTd: {
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    color: theme.text,
    verticalAlign: 'top',
    background: theme.pale2,
  },
  totalTd: {
    padding: '10px 12px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    color: theme.text,
    verticalAlign: 'top',
    background: theme.pale,
  },
  employeeName: {
    fontSize: '15px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1.5,
  },
  employeeSub: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginTop: '3px',
  },
  retiredBadge: {
    display: 'inline-flex',
    marginTop: '8px',
    padding: '4px 8px',
    borderRadius: '999px',
    background: theme.dangerPale,
    color: theme.danger,
    fontSize: '11px',
    fontWeight: 900,
  },
  payrollCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  emptyCell: {
    color: theme.muted,
    fontSize: '13px',
    fontWeight: 800,
  },
  totalCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cellMain: {
    fontSize: '15px',
    color: theme.deep,
    fontWeight: 950,
  },
  cellLine: {
    fontSize: '12px',
    color: theme.text,
    fontWeight: 800,
  },
  cellAdjust: {
    fontSize: '12px',
    color: theme.danger,
    fontWeight: 900,
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