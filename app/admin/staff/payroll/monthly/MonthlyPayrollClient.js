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

  const cardBoxStyle = {
    background: '#fffaf8',
    border: '1px solid #f0d9d2',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
  }

  const sectionTitleStyle = {
    fontSize: '28px',
    fontWeight: 800,
    color: '#7a4b3a',
    marginBottom: '14px',
  }

  const inputStyle = {
    padding: '16px 18px',
    fontSize: '20px',
    borderRadius: '14px',
    border: '1px solid #dcbeb2',
    background: '#fff',
    color: '#6b4235',
    minWidth: '120px',
    outline: 'none',
  }

  const primaryButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    cursor: loading ? 'not-allowed' : 'pointer',
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.25)',
    opacity: loading ? 0.7 : 1,
  }

  const subButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    cursor: loading ? 'not-allowed' : 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    opacity: loading ? 0.7 : 1,
  }

  if (initialLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(180deg, #fff8f4 0%, #fffdfb 100%)',
          padding: '32px',
          color: '#5f4137',
        }}
      >
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
          <div style={cardBoxStyle}>
            <p style={{ fontSize: '22px', margin: 0 }}>読み込み中です...</p>
          </div>
        </div>
      </div>
    )
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
      <div style={{ maxWidth: '1700px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fff6f1',
            border: '1px solid #f2ddd5',
            borderRadius: '28px',
            padding: '28px 32px',
            marginBottom: '28px',
            boxShadow: '0 12px 30px rgba(201, 157, 145, 0.10)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '42px',
                fontWeight: 900,
                color: '#7a4b3a',
                margin: 0,
              }}
            >
              -Bistro-Bambi
            </h1>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '22px',
                color: '#9a6b5b',
              }}
            >
              月次給与一覧
            </p>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '18px',
                color: '#8a6457',
              }}
            >
              現在の対象店舗：
              {store ? `${store.store_name} (${store.store_code})` : '未取得'}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/admin/staff/payroll" style={subButtonStyle}>
              給与管理へ戻る
            </Link>

            <Link href="/admin/staff/payroll/rate-rules" style={subButtonStyle}>
              単価ルール管理
            </Link>

            <Link href="/admin/staff" style={subButtonStyle}>
              従業員管理
            </Link>

            <Link href="/admin" style={subButtonStyle}>
              管理メニュー
            </Link>

            <button onClick={logout} style={subButtonStyle}>
              ログアウト
            </button>
          </div>
        </div>

        {message && (
          <div
            style={{
              marginBottom: '24px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#7a4b3a',
              background: '#fff',
              padding: '14px 16px',
              borderRadius: '14px',
              border: '1px solid #f0d9d2',
              whiteSpace: 'pre-wrap',
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>対象年月</div>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                min="1"
                max="12"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                style={{ ...inputStyle, minWidth: '90px' }}
              />

              <button
                type="button"
                onClick={reloadMonthlyPayroll}
                disabled={loading}
                style={primaryButtonStyle}
              >
                {loading ? '取得中...' : '月次一覧を再読み込み'}
              </button>
            </div>
          </div>

          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>給与期間</div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={summaryBoxStyle}>
                <div style={summaryLabelStyle}>前半</div>
                <div style={summaryValueSmallStyle}>{getPeriodTitle(firstPeriod)}</div>
                <div style={summarySubStyle}>
                  支払日: {firstPeriod ? formatDate(firstPeriod.payday) : '-'}
                </div>
              </div>

              <div style={summaryBoxStyle}>
                <div style={summaryLabelStyle}>後半</div>
                <div style={summaryValueSmallStyle}>{getPeriodTitle(secondPeriod)}</div>
                <div style={summarySubStyle}>
                  支払日: {secondPeriod ? formatDate(secondPeriod.payday) : '-'}
                </div>
              </div>
            </div>
          </div>

          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>従業員別 前半 / 後半 一覧</div>

            {staffRows.length === 0 ? (
              <p
                style={{
                  fontSize: '22px',
                  color: '#9a6b5b',
                  margin: 0,
                  lineHeight: 1.8,
                }}
              >
                給与プレビューがまだありません。
                <br />
                給与管理画面で前半・後半の給与プレビューを生成してください。
              </p>
            ) : (
              <div
                style={{
                  overflowX: 'auto',
                  background: '#fff',
                  border: '1px solid #efd8d0',
                  borderRadius: '18px',
                }}
              >
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    minWidth: '1400px',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={tableHeadStyle} rowSpan={2}>従業員コード</th>
                      <th style={tableHeadStyle} rowSpan={2}>氏名</th>
                      <th style={tableHeadStyle} colSpan={5}>前半</th>
                      <th style={tableHeadStyle} colSpan={5}>後半</th>
                      <th style={tableHeadStyle} rowSpan={2}>月合計支給額</th>
                      <th style={tableHeadStyle} rowSpan={2}>月合計振込額</th>
                    </tr>
                    <tr>
                      <th style={tableHeadStyle}>出勤数</th>
                      <th style={tableHeadStyle}>累積スタンプ</th>
                      <th style={tableHeadStyle}>単価</th>
                      <th style={tableHeadStyle}>支給額</th>
                      <th style={tableHeadStyle}>振込額</th>
                      <th style={tableHeadStyle}>出勤数</th>
                      <th style={tableHeadStyle}>累積スタンプ</th>
                      <th style={tableHeadStyle}>単価</th>
                      <th style={tableHeadStyle}>支給額</th>
                      <th style={tableHeadStyle}>振込額</th>
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
                          <td style={tableCellStyle}>{row.staff_code}</td>
                          <td style={tableCellStyle}>{row.display_name}</td>

                          <td style={tableCellStyle}>{getItemValue(row.first, 'attendance_count')}</td>
                          <td style={tableCellStyle}>{getItemValue(row.first, 'stamp_count_at_close')}</td>
                          <td style={tableCellStyle}>{getItemMoney(row.first, 'applied_unit_pay')}</td>
                          <td style={tableCellStyle}>{getItemMoney(row.first, 'calculated_pay_amount')}</td>
                          <td style={tableCellStyle}>{getItemMoney(row.first, 'transfer_amount')}</td>

                          <td style={tableCellStyle}>{getItemValue(row.second, 'attendance_count')}</td>
                          <td style={tableCellStyle}>{getItemValue(row.second, 'stamp_count_at_close')}</td>
                          <td style={tableCellStyle}>{getItemMoney(row.second, 'applied_unit_pay')}</td>
                          <td style={tableCellStyle}>{getItemMoney(row.second, 'calculated_pay_amount')}</td>
                          <td style={tableCellStyle}>{getItemMoney(row.second, 'transfer_amount')}</td>

                          <td style={tableCellStyle}>{formatMoney(monthlyPay)}</td>
                          <td style={tableCellStyle}>{formatMoney(monthlyTransfer)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>月次集計</div>

            <div
              style={{
                overflowX: 'auto',
                background: '#fff',
                border: '1px solid #efd8d0',
                borderRadius: '18px',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '900px',
                }}
              >
                <thead>
                  <tr>
                    <th style={tableHeadStyle}>項目</th>
                    <th style={tableHeadStyle}>前半</th>
                    <th style={tableHeadStyle}>後半</th>
                    <th style={tableHeadStyle}>月合計</th>
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
                        <td style={tableCellStyle}>{label}</td>
                        <td style={tableCellStyle}>{firstSummary ? formatMoney(firstValue) : '-'}</td>
                        <td style={tableCellStyle}>{secondSummary ? formatMoney(secondValue) : '-'}</td>
                        <td style={tableCellStyle}>
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
          </div>

          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>備考</div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '16px',
              }}
            >
              <div style={summaryBoxStyle}>
                <div style={summaryLabelStyle}>前半備考</div>
                <div style={memoBoxStyle}>{firstInput?.memo || firstSummary?.memo || 'なし'}</div>
              </div>

              <div style={summaryBoxStyle}>
                <div style={summaryLabelStyle}>後半備考</div>
                <div style={memoBoxStyle}>{secondInput?.memo || secondSummary?.memo || 'なし'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const tableHeadStyle = {
  background: '#fff1e9',
  color: '#7a4b3a',
  textAlign: 'left',
  padding: '14px',
  borderBottom: '1px solid #efd8d0',
  borderRight: '1px solid #efd8d0',
  whiteSpace: 'nowrap',
  fontSize: '16px',
}

const tableCellStyle = {
  padding: '14px',
  borderBottom: '1px solid #f0d9d2',
  borderRight: '1px solid #f7e7e1',
  whiteSpace: 'nowrap',
  fontSize: '16px',
  color: '#5f4137',
}

const summaryBoxStyle = {
  background: '#fff',
  border: '1px solid #f0d9d2',
  borderRadius: '16px',
  padding: '16px',
}

const summaryLabelStyle = {
  fontSize: '16px',
  color: '#9a6b5b',
  marginBottom: '8px',
  fontWeight: 700,
}

const summaryValueSmallStyle = {
  fontSize: '20px',
  fontWeight: 800,
  color: '#7a4b3a',
  lineHeight: 1.5,
}

const summarySubStyle = {
  fontSize: '16px',
  color: '#8a6457',
  marginTop: '8px',
}

const memoBoxStyle = {
  fontSize: '18px',
  color: '#5f4137',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
}