'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function MonthlyPayrollClient() {
  const now = new Date()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [store, setStore] = useState(null)
  const [targetYear, setTargetYear] = useState(now.getFullYear())
  const [targetMonth, setTargetMonth] = useState(now.getMonth() + 1)

  const [periods, setPeriods] = useState([])
  const [runItems, setRunItems] = useState([])
  const [summaries, setSummaries] = useState([])
  const [inputs, setInputs] = useState([])

  const firstPeriod = useMemo(() => {
    return periods.find((period) => isFirstHalf(period.half_type)) || null
  }, [periods])

  const secondPeriod = useMemo(() => {
    return periods.find((period) => isSecondHalf(period.half_type)) || null
  }, [periods])

  const firstSummary = useMemo(() => {
    if (!firstPeriod) return null
    return summaries.find(
      (summary) => Number(summary.payroll_period_id) === Number(firstPeriod.payroll_period_id)
    )
  }, [firstPeriod, summaries])

  const secondSummary = useMemo(() => {
    if (!secondPeriod) return null
    return summaries.find(
      (summary) => Number(summary.payroll_period_id) === Number(secondPeriod.payroll_period_id)
    )
  }, [secondPeriod, summaries])

  const firstInput = useMemo(() => {
    if (!firstPeriod) return null
    return inputs.find(
      (input) => Number(input.payroll_period_id) === Number(firstPeriod.payroll_period_id)
    )
  }, [firstPeriod, inputs])

  const secondInput = useMemo(() => {
    if (!secondPeriod) return null
    return inputs.find(
      (input) => Number(input.payroll_period_id) === Number(secondPeriod.payroll_period_id)
    )
  }, [secondPeriod, inputs])

  const staffRows = useMemo(() => {
    const rowsByKey = {}

    runItems.forEach((item) => {
      const key = item.staff_code || String(item.user_id)

      if (!rowsByKey[key]) {
        rowsByKey[key] = {
          staff_code: item.staff_code,
          display_name: item.display_name,
          user_id: item.user_id,
          first: null,
          second: null,
        }
      }

      if (firstPeriod && Number(item.payroll_period_id) === Number(firstPeriod.payroll_period_id)) {
        rowsByKey[key].first = item
      }

      if (secondPeriod && Number(item.payroll_period_id) === Number(secondPeriod.payroll_period_id)) {
        rowsByKey[key].second = item
      }
    })

    return Object.values(rowsByKey).sort((a, b) => {
      return String(a.staff_code || '').localeCompare(String(b.staff_code || ''))
    })
  }, [runItems, firstPeriod, secondPeriod])

  const monthlyTotals = useMemo(() => {
    const firstPay = Number(firstSummary?.total_pay_amount || 0)
    const secondPay = Number(secondSummary?.total_pay_amount || 0)

    const firstTransfer = Number(firstSummary?.total_transfer_amount || 0)
    const secondTransfer = Number(secondSummary?.total_transfer_amount || 0)

    const firstAttendance = runItems
      .filter((item) => firstPeriod && Number(item.payroll_period_id) === Number(firstPeriod.payroll_period_id))
      .reduce((sum, item) => sum + Number(item.attendance_count || 0), 0)

    const secondAttendance = runItems
      .filter((item) => secondPeriod && Number(item.payroll_period_id) === Number(secondPeriod.payroll_period_id))
      .reduce((sum, item) => sum + Number(item.attendance_count || 0), 0)

    const firstProfit = Number(firstSummary?.total_profit_amount || 0)
    const secondProfit = Number(secondSummary?.total_profit_amount || 0)

    return {
      totalPay: firstPay + secondPay,
      totalTransfer: firstTransfer + secondTransfer,
      totalAttendance: firstAttendance + secondAttendance,
      totalProfit: firstProfit + secondProfit,
    }
  }, [firstSummary, secondSummary, firstPeriod, secondPeriod, runItems])

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setInitialLoading(true)
    setMessage('')

    try {
      const currentStore = await fetchCurrentStore()
      setStore(currentStore)
      await fetchMonthlyPayroll(currentStore.store_id, targetYear, targetMonth)
    } catch (error) {
      console.error(error)
      setMessage(`初期表示に失敗しました: ${error.message}`)
    } finally {
      setInitialLoading(false)
    }
  }

  const fetchCurrentStore = async () => {
    const { data: setting, error: settingError } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'current_store_code')
      .single()

    if (settingError) {
      throw settingError
    }

    const currentStoreCode = setting?.setting_value

    if (!currentStoreCode) {
      throw new Error('current_store_code が設定されていません')
    }

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('store_id, store_code, store_name')
      .eq('store_code', currentStoreCode)
      .single()

    if (storeError) {
      throw storeError
    }

    return storeData
  }

  const fetchMonthlyPayroll = async (
    storeId = store?.store_id,
    year = targetYear,
    month = targetMonth
  ) => {
    if (!storeId) {
      setMessage('店舗IDが取得できていないため、月次給与を取得できません')
      return
    }

    setLoading(true)
    setMessage('月次給与一覧を取得中です...')

    try {
      const { data: periodRows, error: periodError } = await supabase
        .from('payroll_periods')
        .select(`
          payroll_period_id,
          target_year,
          target_month,
          half_type,
          period_start,
          period_end,
          payday,
          status,
          store_id
        `)
        .eq('store_id', Number(storeId))
        .eq('target_year', Number(year))
        .eq('target_month', Number(month))
        .order('period_start', { ascending: true })

      if (periodError) {
        throw periodError
      }

      const nextPeriods = periodRows || []
      setPeriods(nextPeriods)

      if (nextPeriods.length === 0) {
        setRunItems([])
        setSummaries([])
        setInputs([])
        setMessage('この年月の給与期間はまだありません。給与管理画面で給与期間を作成してください。')
        return
      }

      const periodIds = nextPeriods.map((period) => period.payroll_period_id)

      const { data: itemRows, error: itemError } = await supabase
        .from('payroll_run_items')
        .select(`
          payroll_run_item_id,
          payroll_period_id,
          user_id,
          staff_code,
          display_name,
          attendance_count,
          stamp_count_at_close,
          applied_unit_pay,
          calculated_pay_amount,
          transfer_amount,
          adjustment_amount,
          note,
          is_locked,
          store_id
        `)
        .in('payroll_period_id', periodIds)
        .order('staff_code', { ascending: true })

      if (itemError) {
        throw itemError
      }

      const { data: summaryRows, error: summaryError } = await supabase
        .from('payroll_period_summaries')
        .select(`
          payroll_period_summary_id,
          payroll_period_id,
          total_pay_amount,
          total_transfer_amount,
          total_adjustment_amount,
          ranch_profit_amount,
          vault_before_amount,
          vault_plus_ranch_amount,
          vault_after_amount,
          store_profit_amount,
          total_profit_amount,
          memo,
          store_id
        `)
        .in('payroll_period_id', periodIds)
        .order('payroll_period_summary_id', { ascending: false })

      if (summaryError) {
        throw summaryError
      }

      const { data: inputRows, error: inputError } = await supabase
        .from('payroll_period_inputs')
        .select(`
          payroll_period_input_id,
          payroll_period_id,
          payroll_rate_rule_set_id,
          sales_amount,
          ranch_profit_amount,
          vault_before_amount,
          extra_income_amount,
          memo,
          store_id
        `)
        .in('payroll_period_id', periodIds)
        .order('payroll_period_input_id', { ascending: false })

      if (inputError) {
        throw inputError
      }

      setRunItems(itemRows || [])
      setSummaries(deduplicateByPeriodId(summaryRows || []))
      setInputs(deduplicateByPeriodId(inputRows || []))
      setMessage(`${year}年${month}月の月次給与一覧を取得しました。`)
    } catch (error) {
      console.error(error)
      setMessage(`月次給与一覧の取得に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const deduplicateByPeriodId = (rows) => {
    const map = {}

    rows.forEach((row) => {
      const key = String(row.payroll_period_id)
      if (!map[key]) {
        map[key] = row
      }
    })

    return Object.values(map)
  }

  const reloadMonthlyPayroll = async () => {
    if (!store?.store_id) {
      setMessage('店舗情報が取得できていません')
      return
    }

    await fetchMonthlyPayroll(store.store_id, targetYear, targetMonth)
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const formatDate = (value) => {
    if (!value) return '-'
    return String(value).slice(0, 10)
  }

  const formatMoney = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    return Number(value).toLocaleString()
  }

  const getPeriodTypeLabel = (halfType) => {
    if (isFirstHalf(halfType)) return '前半'
    if (isSecondHalf(halfType)) return '後半'
    return halfType || '-'
  }

  function isFirstHalf(halfType) {
    return ['first_half', 'first', '1', '前半'].includes(String(halfType))
  }

  function isSecondHalf(halfType) {
    return ['second_half', 'second', '2', '後半'].includes(String(halfType))
  }

  const getPeriodTitle = (period) => {
    if (!period) return '-'
    return `${getPeriodTypeLabel(period.half_type)} / ${formatDate(period.period_start)} ～ ${formatDate(period.period_end)}`
  }

  const getItemValue = (item, key) => {
    if (!item) return '-'
    return item[key] ?? '-'
  }

  const getItemMoney = (item, key) => {
    if (!item) return '-'
    return formatMoney(item[key])
  }

  if (initialLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.panel}>
            <p style={styles.loadingText}>読み込み中です...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.brandRow}>
              <div style={styles.brandMark}>🦌</div>
              <div>
                <h1 style={styles.title}>-Bistro-Bambi</h1>
                <p style={styles.subtitle}>
                  月次給与一覧 / {targetYear}年{targetMonth}月
                </p>
              </div>
            </div>
          </div>

          <nav style={styles.nav}>
            <Link href="/admin/staff/payroll" style={styles.navButton}>
              給与管理
            </Link>

            <Link href="/admin/staff/payroll/rate-rules" style={styles.navButton}>
              単価ルール
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
          <div style={styles.message}>
            {message}
          </div>
        )}

        <section style={styles.toolbar}>
          <div>
            <div style={styles.toolbarTitle}>対象年月</div>
            <div style={styles.toolbarSub}>
              {store ? `${store.store_name} (${store.store_code})` : '店舗情報未取得'}
            </div>
          </div>

          <div style={styles.toolbarControls}>
            <label>
              <div style={styles.inputLabel}>年</div>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                style={styles.input}
              />
            </label>

            <label>
              <div style={styles.inputLabel}>月</div>
              <input
                type="number"
                min="1"
                max="12"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                style={{ ...styles.input, width: '100px' }}
              />
            </label>

            <button
              type="button"
              onClick={reloadMonthlyPayroll}
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? '取得中...' : '再読み込み'}
            </button>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard
            label="月合計出勤数"
            value={monthlyTotals.totalAttendance}
            sub="前半・後半の出勤数合計"
          />

          <SummaryCard
            label="月合計支給額"
            value={formatMoney(monthlyTotals.totalPay)}
            sub="前半・後半の総支払額合計"
          />

          <SummaryCard
            label="月合計振込額"
            value={formatMoney(monthlyTotals.totalTransfer)}
            sub="実際に支払う金額の合計"
          />

          <SummaryCard
            label="月合計経常利益"
            value={formatMoney(monthlyTotals.totalProfit)}
            sub="前半・後半の経常利益合計"
          />
        </section>

        <section style={styles.periodGrid}>
          <PeriodCard
            label="前半"
            period={firstPeriod}
            summary={firstSummary}
            formatDate={formatDate}
            formatMoney={formatMoney}
            getPeriodTitle={getPeriodTitle}
          />

          <PeriodCard
            label="後半"
            period={secondPeriod}
            summary={secondSummary}
            formatDate={formatDate}
            formatMoney={formatMoney}
            getPeriodTitle={getPeriodTitle}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>従業員別 前半 / 後半 一覧</h2>
              <p style={styles.sectionDescription}>
                前半・後半の出勤数、累積スタンプ、単価、支給額、振込額を横並びで確認します。
              </p>
            </div>
          </div>

          {staffRows.length === 0 ? (
            <div style={styles.emptyBox}>
              給与プレビューがまだありません。
              <br />
              給与管理画面で前半・後半の給与プレビューを生成してください。
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thSticky} rowSpan={2}>従業員コード</th>
                    <th style={styles.thStickyName} rowSpan={2}>氏名</th>
                    <th style={styles.thGroupFirst} colSpan={5}>前半</th>
                    <th style={styles.thGroupSecond} colSpan={5}>後半</th>
                    <th style={styles.thGroupTotal} colSpan={2}>月合計</th>
                  </tr>
                  <tr>
                    <th style={styles.th}>出勤</th>
                    <th style={styles.th}>スタンプ</th>
                    <th style={styles.th}>単価</th>
                    <th style={styles.th}>支給額</th>
                    <th style={styles.th}>振込額</th>

                    <th style={styles.th}>出勤</th>
                    <th style={styles.th}>スタンプ</th>
                    <th style={styles.th}>単価</th>
                    <th style={styles.th}>支給額</th>
                    <th style={styles.th}>振込額</th>

                    <th style={styles.th}>支給額</th>
                    <th style={styles.th}>振込額</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row) => {
                    const monthlyPay =
                      Number(row.first?.calculated_pay_amount || 0) +
                      Number(row.second?.calculated_pay_amount || 0)

                    const monthlyTransfer =
                      Number(row.first?.transfer_amount || 0) +
                      Number(row.second?.transfer_amount || 0)

                    return (
                      <tr key={`${row.staff_code}-${row.user_id}`}>
                        <td style={styles.tdSticky}>{row.staff_code}</td>
                        <td style={styles.tdStickyName}>{row.display_name}</td>

                        <td style={styles.tdCenter}>{getItemValue(row.first, 'attendance_count')}</td>
                        <td style={styles.tdCenter}>{getItemValue(row.first, 'stamp_count_at_close')}</td>
                        <td style={styles.td}>{getItemMoney(row.first, 'applied_unit_pay')}</td>
                        <td style={styles.tdStrong}>{getItemMoney(row.first, 'calculated_pay_amount')}</td>
                        <td style={styles.tdStrong}>{getItemMoney(row.first, 'transfer_amount')}</td>

                        <td style={styles.tdCenter}>{getItemValue(row.second, 'attendance_count')}</td>
                        <td style={styles.tdCenter}>{getItemValue(row.second, 'stamp_count_at_close')}</td>
                        <td style={styles.td}>{getItemMoney(row.second, 'applied_unit_pay')}</td>
                        <td style={styles.tdStrong}>{getItemMoney(row.second, 'calculated_pay_amount')}</td>
                        <td style={styles.tdStrong}>{getItemMoney(row.second, 'transfer_amount')}</td>

                        <td style={styles.tdTotal}>{formatMoney(monthlyPay)}</td>
                        <td style={styles.tdTotal}>{formatMoney(monthlyTransfer)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={styles.bottomGrid}>
          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>月次集計</h2>
                <p style={styles.sectionDescription}>
                  給与期間ごとの集計を、前半・後半・月合計で比較します。
                </p>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.compactTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>項目</th>
                    <th style={styles.th}>前半</th>
                    <th style={styles.th}>後半</th>
                    <th style={styles.th}>月合計</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['総支払額', 'total_pay_amount'],
                    ['振込額合計', 'total_transfer_amount'],
                    ['調整額合計', 'total_adjustment_amount'],
                    ['牧場利益', 'ranch_profit_amount'],
                    ['支払い前金庫額', 'vault_before_amount'],
                    ['金庫 + 牧場', 'vault_plus_ranch_amount'],
                    ['支払い後金額', 'vault_after_amount'],
                    ['営業利益', 'store_profit_amount'],
                    ['経常利益', 'total_profit_amount'],
                  ].map(([label, key]) => {
                    const firstValue = Number(firstSummary?.[key] || 0)
                    const secondValue = Number(secondSummary?.[key] || 0)

                    return (
                      <tr key={key}>
                        <td style={styles.tdLabel}>{label}</td>
                        <td style={styles.td}>{firstSummary ? formatMoney(firstValue) : '-'}</td>
                        <td style={styles.td}>{secondSummary ? formatMoney(secondValue) : '-'}</td>
                        <td style={styles.tdTotal}>
                          {firstSummary || secondSummary
                            ? formatMoney(firstValue + secondValue)
                            : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>備考</h2>
                <p style={styles.sectionDescription}>
                  給与期間ごとに保存したイベントや支払いメモです。
                </p>
              </div>
            </div>

            <div style={styles.memoGrid}>
              <div style={styles.memoCard}>
                <div style={styles.memoLabel}>前半備考</div>
                <div style={styles.memoText}>{firstInput?.memo || firstSummary?.memo || 'なし'}</div>
              </div>

              <div style={styles.memoCard}>
                <div style={styles.memoLabel}>後半備考</div>
                <div style={styles.memoText}>{secondInput?.memo || secondSummary?.memo || 'なし'}</div>
              </div>
            </div>
          </section>
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

function PeriodCard({ label, period, summary, formatDate, formatMoney, getPeriodTitle }) {
  return (
    <section style={styles.periodPanel}>
      <div style={styles.periodTop}>
        <div>
          <div style={styles.periodBadge}>{label}</div>
          <div style={styles.periodMain}>{period ? getPeriodTitle(period) : '-'}</div>
        </div>
        <div style={styles.periodStatus}>{period?.status || '-'}</div>
      </div>

      <div style={styles.periodMetaGrid}>
        <div>
          <div style={styles.miniLabel}>支払日</div>
          <div style={styles.miniValue}>{period ? formatDate(period.payday) : '-'}</div>
        </div>

        <div>
          <div style={styles.miniLabel}>総支払額</div>
          <div style={styles.miniValue}>{summary ? formatMoney(summary.total_pay_amount) : '-'}</div>
        </div>

        <div>
          <div style={styles.miniLabel}>振込額合計</div>
          <div style={styles.miniValue}>{summary ? formatMoney(summary.total_transfer_amount) : '-'}</div>
        </div>

        <div>
          <div style={styles.miniLabel}>経常利益</div>
          <div style={styles.miniValue}>{summary ? formatMoney(summary.total_profit_amount) : '-'}</div>
        </div>
      </div>
    </section>
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
  green2: '#6f9272',
  pale: '#e6efe1',
  pale2: '#edf4e8',
  white: '#ffffff',
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
    marginBottom: '20px',
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
    fontWeight: 900,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: '18px',
    color: theme.muted,
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
  message: {
    marginBottom: '18px',
    fontSize: '16px',
    fontWeight: 800,
    color: theme.deep,
    background: theme.white,
    padding: '14px 16px',
    borderRadius: '14px',
    border: `1px solid ${theme.border}`,
    whiteSpace: 'pre-wrap',
  },
  toolbar: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '18px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  toolbarTitle: {
    fontSize: '22px',
    fontWeight: 900,
    color: theme.deep,
  },
  toolbarSub: {
    fontSize: '14px',
    color: theme.muted,
    marginTop: '6px',
  },
  toolbarControls: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
  },
  inputLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '6px',
  },
  input: {
    width: '140px',
    boxSizing: 'border-box',
    padding: '12px 13px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  primaryButton: {
    padding: '13px 18px',
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
    minHeight: '46px',
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
    fontSize: '27px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1.2,
  },
  summarySub: {
    fontSize: '12px',
    color: theme.muted,
    marginTop: '8px',
    lineHeight: 1.5,
  },
  periodGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '18px',
  },
  periodPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  periodTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  periodBadge: {
    display: 'inline-flex',
    padding: '5px 10px',
    borderRadius: '999px',
    background: theme.green,
    color: theme.white,
    fontSize: '13px',
    fontWeight: 900,
    marginBottom: '10px',
  },
  periodMain: {
    fontSize: '18px',
    fontWeight: 900,
    color: theme.deep,
    lineHeight: 1.5,
  },
  periodStatus: {
    padding: '7px 10px',
    borderRadius: '999px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.muted,
    fontSize: '12px',
    fontWeight: 900,
  },
  periodMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '10px',
  },
  miniLabel: {
    fontSize: '11px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '6px',
  },
  miniValue: {
    fontSize: '15px',
    color: theme.deep,
    fontWeight: 900,
    lineHeight: 1.4,
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: 900,
    color: theme.deep,
    margin: 0,
  },
  sectionDescription: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
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
  tableWrap: {
    overflowX: 'auto',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    minWidth: '1500px',
  },
  compactTable: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '760px',
  },
  th: {
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  thSticky: {
    position: 'sticky',
    left: 0,
    zIndex: 4,
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  thStickyName: {
    position: 'sticky',
    left: '128px',
    zIndex: 4,
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  thGroupFirst: {
    background: '#dfe9d9',
    color: theme.deep,
    textAlign: 'center',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  thGroupSecond: {
    background: '#e9f0e4',
    color: theme.deep,
    textAlign: 'center',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  thGroupTotal: {
    background: '#cfddc8',
    color: theme.deep,
    textAlign: 'center',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border2}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  td: {
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    background: theme.white,
  },
  tdStrong: {
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 900,
    background: theme.white,
  },
  tdCenter: {
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    textAlign: 'center',
    background: theme.white,
  },
  tdLabel: {
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 900,
    background: theme.white,
  },
  tdTotal: {
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 950,
    background: theme.pale2,
  },
  tdSticky: {
    position: 'sticky',
    left: 0,
    zIndex: 3,
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 900,
    background: theme.white,
    minWidth: '128px',
  },
  tdStickyName: {
    position: 'sticky',
    left: '128px',
    zIndex: 3,
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    borderRight: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    background: theme.white,
    minWidth: '150px',
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1.25fr 0.75fr',
    gap: '18px',
    alignItems: 'start',
  },
  memoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  memoCard: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  memoLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '8px',
  },
  memoText: {
    fontSize: '15px',
    color: theme.text,
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
  },
  loadingText: {
    fontSize: '18px',
    margin: 0,
    color: theme.muted,
  },
}