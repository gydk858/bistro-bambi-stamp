'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DEFAULT_UNIT_CARE_PAY = 3000000

function getLastDay(year, month) {
  return new Date(Number(year), Number(month), 0).getDate()
}

function getDateString(year, month, day) {
  const y = Number(year)
  const m = String(Number(month)).padStart(2, '0')
  const d = String(Number(day)).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeDateString(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function getPeriodTypeLabel(halfType) {
  if (halfType === 'first_half') return '前半'
  if (halfType === 'second_half') return '後半'
  if (halfType === 'first') return '前半'
  if (halfType === 'second') return '後半'
  if (halfType === '1') return '前半'
  if (halfType === '2') return '後半'
  if (halfType === '前半') return '前半'
  if (halfType === '後半') return '後半'
  return halfType || '-'
}

export default function RanchClient() {
  const now = new Date()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [store, setStore] = useState(null)
  const [targetYear, setTargetYear] = useState(now.getFullYear())
  const [targetMonth, setTargetMonth] = useState(now.getMonth() + 1)

  const [employees, setEmployees] = useState([])
  const [unitCarePay, setUnitCarePay] = useState(String(DEFAULT_UNIT_CARE_PAY))
  const [settingMemo, setSettingMemo] = useState('')

  const [careEvents, setCareEvents] = useState([])
  const [profitEntries, setProfitEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [payrollPeriods, setPayrollPeriods] = useState([])

  const [newProfitDate, setNewProfitDate] = useState('')
  const [newProfitAmount, setNewProfitAmount] = useState('')

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setLoading(true)
    setMessage('')

    try {
      const currentStore = await fetchCurrentStore()
      setStore(currentStore)
      await loadAll(currentStore.store_id, targetYear, targetMonth)
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

  const loadAll = async (
    storeId = store?.store_id,
    year = targetYear,
    month = targetMonth
  ) => {
    if (!storeId) return

    await Promise.all([
      fetchEmployees(storeId),
      fetchMonthSetting(storeId, year, month),
      fetchCareEvents(storeId, year, month),
      fetchProfitEntries(storeId, year, month),
      fetchSummary(storeId, year, month),
      fetchPayrollPeriods(storeId, year, month),
    ])

    setNewProfitDate(getDateString(year, month, 1))
  }

  const fetchEmployees = async (storeId) => {
    const { data, error } = await supabase
      .from('employee_profiles')
      .select(`
        user_id,
        store_id,
        staff_code,
        employee_name,
        employment_status,
        staff_grade,
        ranch_visible
      `)
      .eq('store_id', storeId)
      .eq('employment_status', 'active')
      .order('staff_code', { ascending: true })

    if (error) throw error

    setEmployees(data || [])
    return data || []
  }

  const fetchMonthSetting = async (storeId, year, month) => {
    const { data, error } = await supabase
      .from('ranch_month_settings')
      .select('*')
      .eq('store_id', storeId)
      .eq('target_year', Number(year))
      .eq('target_month', Number(month))
      .maybeSingle()

    if (error) throw error

    if (data) {
      setUnitCarePay(String(data.unit_care_pay ?? DEFAULT_UNIT_CARE_PAY))
      setSettingMemo(data.memo || '')
    } else {
      setUnitCarePay(String(DEFAULT_UNIT_CARE_PAY))
      setSettingMemo('')
    }

    return data
  }

  const fetchCareEvents = async (storeId, year, month) => {
    const { data, error } = await supabase
      .from('ranch_care_events')
      .select('*')
      .eq('store_id', storeId)
      .eq('target_year', Number(year))
      .eq('target_month', Number(month))
      .order('care_date', { ascending: true })

    if (error) throw error

    const normalizedRows = (data || []).map((row) => ({
      ...row,
      care_date: normalizeDateString(row.care_date),
    }))

    setCareEvents(normalizedRows)
    return normalizedRows
  }

  const fetchProfitEntries = async (storeId, year, month) => {
    const startDate = getDateString(year, month, 1)
    const endDate = getDateString(year, month, getLastDay(year, month))

    const { data, error } = await supabase
      .from('ranch_profit_entries')
      .select('*')
      .eq('store_id', storeId)
      .gte('profit_date', startDate)
      .lte('profit_date', endDate)
      .order('profit_date', { ascending: true })
      .order('ranch_profit_entry_id', { ascending: true })

    if (error) throw error

    setProfitEntries(data || [])
    return data || []
  }

  const fetchSummary = async (storeId, year, month) => {
    const { data, error } = await supabase.rpc('get_ranch_month_summary', {
      p_store_id: Number(storeId),
      p_target_year: Number(year),
      p_target_month: Number(month),
    })

    if (error) throw error

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null
    setSummary(row)
    return row
  }

  const fetchPayrollPeriods = async (storeId, year, month) => {
    const { data, error } = await supabase
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
      .eq('store_id', storeId)
      .eq('target_year', Number(year))
      .eq('target_month', Number(month))
      .order('period_start', { ascending: true })

    if (error) throw error

    setPayrollPeriods(data || [])
    return data || []
  }

  const reload = async () => {
    if (!store?.store_id) return

    setLoading(true)
    setMessage('再読み込み中です...')

    try {
      await loadAll(store.store_id, targetYear, targetMonth)
      setMessage('牧場管理データを再読み込みしました')
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

  const saveMonthSetting = async () => {
    if (!store?.store_id) {
      setMessage('店舗情報が取得できていません')
      return
    }

    setSaving(true)
    setMessage('お世話単価を保存中です...')

    try {
      const { error } = await supabase.rpc('upsert_ranch_month_setting', {
        p_store_id: Number(store.store_id),
        p_target_year: Number(targetYear),
        p_target_month: Number(targetMonth),
        p_unit_care_pay: toAmountNumber(unitCarePay),
        p_memo: settingMemo.trim() === '' ? null : settingMemo.trim(),
      })

      if (error) throw error

      await loadAll(store.store_id, targetYear, targetMonth)
      setMessage('お世話単価を保存しました')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `お世話単価の保存に失敗しました: ${error.message}`
          : 'お世話単価の保存に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const careMap = useMemo(() => {
    const map = {}

    careEvents.forEach((event) => {
      const normalizedDate = normalizeDateString(event.care_date)
      map[`${event.user_id}_${normalizedDate}`] = Number(event.care_count || 0)
    })

    return map
  }, [careEvents])

  const visibleEmployees = useMemo(() => {
    return employees.filter((employee) => employee.ranch_visible !== false)
  }, [employees])

  const hiddenEmployees = useMemo(() => {
    return employees.filter((employee) => employee.ranch_visible === false)
  }, [employees])

  const firstHalfDays = useMemo(() => {
    return Array.from({ length: 15 }, (_, index) => index + 1)
  }, [])

  const secondHalfDays = useMemo(() => {
    const lastDay = getLastDay(targetYear, targetMonth)
    return Array.from({ length: lastDay - 15 }, (_, index) => index + 16)
  }, [targetYear, targetMonth])

  const getCareCount = (userId, dateString) => {
    const normalizedDate = normalizeDateString(dateString)
    return careMap[`${userId}_${normalizedDate}`] || 0
  }

  const getEmployeeHalfCount = (employee, days) => {
    return days.reduce((sum, day) => {
      const dateString = getDateString(targetYear, targetMonth, day)
      return sum + getCareCount(employee.user_id, dateString)
    }, 0)
  }

  const toggleCare = async (employee, dateString) => {
    if (!store?.store_id) return

    const normalizedDate = normalizeDateString(dateString)
    const currentCount = getCareCount(employee.user_id, normalizedDate)
    const nextCount = currentCount > 0 ? 0 : 1

    const targetYearNumber = Number(normalizedDate.slice(0, 4))
    const targetMonthNumber = Number(normalizedDate.slice(5, 7))

    const previousEvents = careEvents

    setSaving(true)
    setMessage(`${employee.staff_code} / ${formatDateShort(normalizedDate)} を更新中です...`)

    try {
      setCareEvents((prev) => {
        const filtered = prev.filter((event) => {
          return !(
            Number(event.store_id) === Number(store.store_id) &&
            Number(event.user_id) === Number(employee.user_id) &&
            normalizeDateString(event.care_date) === normalizedDate
          )
        })

        if (nextCount <= 0) {
          return filtered
        }

        return [
          ...filtered,
          {
            ranch_care_event_id: `temp_${employee.user_id}_${normalizedDate}`,
            store_id: Number(store.store_id),
            user_id: Number(employee.user_id),
            target_year: targetYearNumber,
            target_month: targetMonthNumber,
            care_date: normalizedDate,
            care_count: nextCount,
            note: null,
            acted_by: 'admin_ranch_ui',
          },
        ]
      })

      if (nextCount <= 0) {
        const { error } = await supabase
          .from('ranch_care_events')
          .delete()
          .eq('store_id', Number(store.store_id))
          .eq('user_id', Number(employee.user_id))
          .eq('care_date', normalizedDate)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('ranch_care_events')
          .upsert(
            {
              store_id: Number(store.store_id),
              user_id: Number(employee.user_id),
              target_year: targetYearNumber,
              target_month: targetMonthNumber,
              care_date: normalizedDate,
              care_count: nextCount,
              note: null,
              acted_by: 'admin_ranch_ui',
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'store_id,user_id,care_date',
            }
          )

        if (error) throw error
      }

      const nextEvents = await fetchCareEvents(
        store.store_id,
        targetYear,
        targetMonth
      )

      setCareEvents(nextEvents)
      await fetchSummary(store.store_id, targetYear, targetMonth)

      setMessage(`${employee.staff_code} / ${formatDateShort(normalizedDate)} を更新しました`)
    } catch (error) {
      console.error(error)
      setCareEvents(previousEvents)
      setMessage(
        error instanceof Error
          ? `お世話記録の更新に失敗しました: ${error.message}`
          : 'お世話記録の更新に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const toggleRanchVisible = async (employee) => {
    const nextVisible = employee.ranch_visible === false

    setSaving(true)
    setMessage(`${employee.staff_code} の表示設定を更新中です...`)

    try {
      const { error } = await supabase.rpc('update_employee_ranch_visible_admin', {
        p_user_id: Number(employee.user_id),
        p_ranch_visible: nextVisible,
        p_updated_by: 'admin_ranch_ui',
      })

      if (error) throw error

      await fetchEmployees(store.store_id)

      setMessage(
        nextVisible
          ? `${employee.staff_code} を牧場管理に表示しました`
          : `${employee.staff_code} を牧場管理で非表示にしました`
      )
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `表示設定の更新に失敗しました: ${error.message}`
          : '表示設定の更新に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const addProfitEntry = async () => {
    if (!store?.store_id) {
      setMessage('店舗情報が取得できていません')
      return
    }

    if (!newProfitDate) {
      setMessage('利益日付を入力してください')
      return
    }

    setSaving(true)
    setMessage('牧場利益を追加中です...')

    try {
      const { error } = await supabase.rpc('add_ranch_profit_entry', {
        p_store_id: Number(store.store_id),
        p_profit_date: newProfitDate,
        p_profit_amount: toAmountNumber(newProfitAmount),
        p_memo: null,
        p_acted_by: 'admin_ranch_ui',
      })

      if (error) throw error

      setNewProfitAmount('')

      await fetchProfitEntries(store.store_id, targetYear, targetMonth)
      await fetchSummary(store.store_id, targetYear, targetMonth)

      setMessage('牧場利益を追加しました')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `牧場利益の追加に失敗しました: ${error.message}`
          : '牧場利益の追加に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const updateProfitEntry = async (entry, field, value) => {
    const nextEntry = {
      ...entry,
      [field]: value,
    }

    setProfitEntries((prev) =>
      prev.map((item) =>
        item.ranch_profit_entry_id === entry.ranch_profit_entry_id
          ? nextEntry
          : item
      )
    )
  }

  const saveProfitEntry = async (entry) => {
    setSaving(true)
    setMessage('牧場利益を保存中です...')

    try {
      const { error } = await supabase.rpc('update_ranch_profit_entry', {
        p_ranch_profit_entry_id: Number(entry.ranch_profit_entry_id),
        p_profit_date: normalizeDateString(entry.profit_date),
        p_profit_amount: toAmountNumber(entry.profit_amount),
        p_memo: null,
        p_acted_by: 'admin_ranch_ui',
      })

      if (error) throw error

      await fetchProfitEntries(store.store_id, targetYear, targetMonth)
      await fetchSummary(store.store_id, targetYear, targetMonth)

      setMessage('牧場利益を保存しました')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `牧場利益の保存に失敗しました: ${error.message}`
          : '牧場利益の保存に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteProfitEntry = async (entry) => {
    const ok = window.confirm(
      [
        'この牧場利益入力を削除しますか？',
        '',
        `日付: ${formatDateShort(entry.profit_date)}`,
        `金額: ${formatMoney(entry.profit_amount)}`,
      ].join('\n')
    )

    if (!ok) return

    setSaving(true)
    setMessage('牧場利益を削除中です...')

    try {
      const { error } = await supabase.rpc('delete_ranch_profit_entry', {
        p_ranch_profit_entry_id: Number(entry.ranch_profit_entry_id),
      })

      if (error) throw error

      await fetchProfitEntries(store.store_id, targetYear, targetMonth)
      await fetchSummary(store.store_id, targetYear, targetMonth)

      setMessage('牧場利益を削除しました')
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `牧場利益の削除に失敗しました: ${error.message}`
          : '牧場利益の削除に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const applyToPayroll = async (period) => {
    const ok = window.confirm(
      [
        'この給与期間へ牧場利益を反映しますか？',
        '',
        `${getPeriodTypeLabel(period.half_type)}: ${formatDate(period.period_start)} ～ ${formatDate(period.period_end)}`,
        '',
        'この期間内の牧場利益入力を合計し、給与管理の牧場利益に保存します。',
      ].join('\n')
    )

    if (!ok) return

    setSaving(true)
    setMessage('給与管理へ牧場利益を反映中です...')

    try {
      const { data, error } = await supabase.rpc('apply_ranch_profit_to_payroll_period', {
        p_payroll_period_id: Number(period.payroll_period_id),
        p_applied_by: 'admin_ranch_ui',
        p_memo: '牧場管理画面から反映',
      })

      if (error) throw error

      const result = Array.isArray(data) && data.length > 0 ? data[0] : null

      await fetchPayrollPeriods(store.store_id, targetYear, targetMonth)

      setMessage(
        result
          ? `給与管理へ反映しました（牧場利益 ${formatMoney(result.ranch_profit_amount)}）`
          : '給与管理へ反映しました'
      )
    } catch (error) {
      console.error(error)
      setMessage(
        error instanceof Error
          ? `給与管理への反映に失敗しました: ${error.message}`
          : '給与管理への反映に失敗しました'
      )
    } finally {
      setSaving(false)
    }
  }

  const firstHalfProfitEntries = profitEntries.filter((entry) => {
    const day = Number(normalizeDateString(entry.profit_date).slice(8, 10))
    return day >= 1 && day <= 15
  })

  const secondHalfProfitEntries = profitEntries.filter((entry) => {
    const day = Number(normalizeDateString(entry.profit_date).slice(8, 10))
    return day >= 16
  })

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const handleAmountInput = (setter) => (event) => {
    setter(
      String(event.target.value || '')
        .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
        .replace(/,/g, '')
        .replace(/[^\d-]/g, '')
    )
  }

  const toAmountNumber = (value) => {
    const normalized = String(value ?? '')
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/,/g, '')
      .replace(/[^\d-]/g, '')

    if (normalized === '' || normalized === '-') return 0
    return Number(normalized)
  }

  const formatMoney = (value) => {
    if (value === null || value === undefined || value === '') return '0'
    return Number(value).toLocaleString()
  }

  const formatDate = (value) => {
    if (!value) return '-'
    return normalizeDateString(value)
  }

  const formatDateShort = (value) => {
    if (!value) return '-'
    const text = normalizeDateString(value)
    return `${Number(text.slice(5, 7))}/${Number(text.slice(8, 10))}`
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
            <div style={styles.brandMark}>🌾</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>牧場管理</p>
              <p style={styles.headerDescription}>
                お世話回数、牧場利益入力、給与管理への牧場利益反映を行います。
              </p>
              <p style={styles.storeText}>
                現在の対象店舗：
                {store ? `${store.store_name} (${store.store_code})` : '未取得'}
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <Link href="/admin/staff/employees" style={styles.navButton}>
              従業員一覧
            </Link>

            <Link href="/admin/staff/card" style={styles.navButton}>
              従業員カード操作
            </Link>

            <Link href="/admin/staff/payroll" style={styles.navButton}>
              給与管理
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
            label="お世話単価"
            value={`¥${formatMoney(summary?.unit_care_pay ?? unitCarePay)}`}
            sub="1回あたり"
          />

          <SummaryCard
            label="前半お世話"
            value={`${formatMoney(summary?.first_half_care_count ?? 0)}回`}
            sub={`支給額 ¥${formatMoney(summary?.first_half_care_pay ?? 0)}`}
          />

          <SummaryCard
            label="後半お世話"
            value={`${formatMoney(summary?.second_half_care_count ?? 0)}回`}
            sub={`支給額 ¥${formatMoney(summary?.second_half_care_pay ?? 0)}`}
          />

          <SummaryCard
            label="牧場利益合計"
            value={`¥${formatMoney(summary?.total_profit_amount ?? 0)}`}
            sub={`前半 ¥${formatMoney(summary?.first_half_profit_amount ?? 0)} / 後半 ¥${formatMoney(summary?.second_half_profit_amount ?? 0)}`}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHead}>
            <div>
              <h2 style={styles.sectionTitle}>対象年月・お世話単価</h2>
              <p style={styles.description}>
                月ごとのお世話単価を保存します。チェック1つにつき、この金額でお世話報酬を計算します。
              </p>
            </div>
          </div>

          <div style={styles.settingGrid}>
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
                style={styles.input}
              />
            </label>

            <label>
              <div style={styles.inputLabel}>1回のお世話単価</div>
              <input
                type="text"
                value={unitCarePay}
                onChange={handleAmountInput(setUnitCarePay)}
                style={styles.input}
                placeholder="3000000"
              />
            </label>

            <label>
              <div style={styles.inputLabel}>メモ</div>
              <input
                type="text"
                value={settingMemo}
                onChange={(e) => setSettingMemo(e.target.value)}
                style={styles.input}
                placeholder="単価変更理由など"
              />
            </label>

            <button
              type="button"
              onClick={reload}
              disabled={saving}
              style={styles.secondaryButton}
            >
              再読み込み
            </button>

            <button
              type="button"
              onClick={saveMonthSetting}
              disabled={saving}
              style={styles.primaryButton}
            >
              単価を保存
            </button>
          </div>
        </section>

        <RanchVisibleSection
          employees={employees}
          visibleEmployees={visibleEmployees}
          hiddenEmployees={hiddenEmployees}
          toggleRanchVisible={toggleRanchVisible}
          saving={saving}
        />

        <CareTable
          title="前半 お世話チェック"
          description="1日〜15日のお世話回数を記録します。チェック1つで1回です。"
          employees={visibleEmployees}
          days={firstHalfDays}
          targetYear={targetYear}
          targetMonth={targetMonth}
          getDateString={getDateString}
          getCareCount={getCareCount}
          getEmployeeHalfCount={getEmployeeHalfCount}
          toggleCare={toggleCare}
          unitCarePay={toAmountNumber(unitCarePay)}
          saving={saving}
        />

        <CareTable
          title="後半 お世話チェック"
          description="16日〜月末のお世話回数を記録します。チェック1つで1回です。"
          employees={visibleEmployees}
          days={secondHalfDays}
          targetYear={targetYear}
          targetMonth={targetMonth}
          getDateString={getDateString}
          getCareCount={getCareCount}
          getEmployeeHalfCount={getEmployeeHalfCount}
          toggleCare={toggleCare}
          unitCarePay={toAmountNumber(unitCarePay)}
          saving={saving}
        />

        <div style={styles.bottomGrid}>
          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>牧場利益入力</h2>
                <p style={styles.description}>
                  合計値ではなく、日々の入力履歴を積み上げます。前半・後半の牧場利益は日付で自動集計します。
                </p>
              </div>
            </div>

            <div style={styles.profitAddGrid}>
              <label>
                <div style={styles.inputLabel}>日付</div>
                <input
                  type="date"
                  value={newProfitDate}
                  onChange={(e) => setNewProfitDate(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label>
                <div style={styles.inputLabel}>金額</div>
                <input
                  type="text"
                  value={newProfitAmount}
                  onChange={handleAmountInput(setNewProfitAmount)}
                  style={styles.input}
                  placeholder="牧場利益"
                />
              </label>

              <button
                type="button"
                onClick={addProfitEntry}
                disabled={saving}
                style={styles.primaryButton}
              >
                追加
              </button>
            </div>

            <ProfitEntryTable
              title="前半 牧場利益"
              entries={firstHalfProfitEntries}
              updateProfitEntry={updateProfitEntry}
              saveProfitEntry={saveProfitEntry}
              deleteProfitEntry={deleteProfitEntry}
              saving={saving}
            />

            <ProfitEntryTable
              title="後半 牧場利益"
              entries={secondHalfProfitEntries}
              updateProfitEntry={updateProfitEntry}
              saveProfitEntry={saveProfitEntry}
              deleteProfitEntry={deleteProfitEntry}
              saving={saving}
            />
          </section>

          <section style={styles.panel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>給与管理へ反映</h2>
                <p style={styles.description}>
                  給与期間の開始日〜終了日に含まれる牧場利益入力を合計し、給与管理の牧場利益に保存します。
                </p>
              </div>
            </div>

            {payrollPeriods.length === 0 ? (
              <div style={styles.emptyBox}>
                この年月の給与期間がまだありません。先に給与管理で給与期間を作成してください。
              </div>
            ) : (
              <div style={styles.payrollPeriodList}>
                {payrollPeriods.map((period) => {
                  const isLocked = ['locked', 'paid', 'closed'].includes(period.status)

                  return (
                    <div key={period.payroll_period_id} style={styles.payrollPeriodCard}>
                      <div>
                        <div style={styles.payrollPeriodTitle}>
                          {getPeriodTypeLabel(period.half_type)}
                        </div>
                        <div style={styles.payrollPeriodMeta}>
                          {formatDate(period.period_start)} ～ {formatDate(period.period_end)}
                          <br />
                          状態: {isLocked ? '確定済み' : '編集中'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => applyToPayroll(period)}
                        disabled={saving || isLocked}
                        style={{
                          ...styles.primaryMiniButton,
                          ...(isLocked || saving ? styles.disabledButton : {}),
                        }}
                      >
                        {isLocked ? '確定済み' : '反映'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={styles.summaryBox}>
              <SummaryLine label="前半 牧場利益" value={`¥${formatMoney(summary?.first_half_profit_amount ?? 0)}`} />
              <SummaryLine label="後半 牧場利益" value={`¥${formatMoney(summary?.second_half_profit_amount ?? 0)}`} />
              <SummaryLine label="合計 牧場利益" value={`¥${formatMoney(summary?.total_profit_amount ?? 0)}`} />
              <SummaryLine label="お世話報酬合計" value={`¥${formatMoney(summary?.total_care_pay ?? 0)}`} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function RanchVisibleSection({
  employees,
  visibleEmployees,
  hiddenEmployees,
  toggleRanchVisible,
  saving,
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.sectionHead}>
        <div>
          <h2 style={styles.sectionTitle}>表示対象従業員</h2>
          <p style={styles.description}>
            牧場のお世話に関わる従業員だけを表示できます。非表示にしても過去のお世話記録は削除されません。
          </p>
        </div>
      </div>

      <div style={styles.visibleSummary}>
        <div style={styles.visibleSummaryCard}>
          表示中: <strong>{visibleEmployees.length}</strong> 人
        </div>
        <div style={styles.visibleSummaryCard}>
          非表示: <strong>{hiddenEmployees.length}</strong> 人
        </div>
        <div style={styles.visibleSummaryCard}>
          在籍中合計: <strong>{employees.length}</strong> 人
        </div>
      </div>

      <div style={styles.employeeChipWrap}>
        {employees.map((employee) => {
          const visible = employee.ranch_visible !== false

          return (
            <button
              key={employee.user_id}
              type="button"
              disabled={saving}
              onClick={() => toggleRanchVisible(employee)}
              style={visible ? styles.visibleChip : styles.hiddenChip}
            >
              <span style={styles.chipName}>
                {employee.employee_name || '未登録'}
              </span>
              <span style={styles.chipSub}>
                {employee.staff_code} / {visible ? '表示中' : '非表示'}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CareTable({
  title,
  description,
  employees,
  days,
  targetYear,
  targetMonth,
  getDateString,
  getCareCount,
  getEmployeeHalfCount,
  toggleCare,
  unitCarePay,
  saving,
}) {
  return (
    <section style={styles.panel}>
      <div style={styles.sectionHead}>
        <div>
          <h2 style={styles.sectionTitle}>{title}</h2>
          <p style={styles.description}>{description}</p>
        </div>
      </div>

      {employees.length === 0 ? (
        <div style={styles.emptyBox}>
          表示対象の従業員がいません。
          <br />
          「表示対象従業員」で牧場管理に表示する従業員を選択してください。
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.careTable}>
            <thead>
              <tr>
                <th style={styles.thSticky}>従業員</th>
                <th style={styles.th}>グレード</th>
                {days.map((day) => (
                  <th key={day} style={styles.dayTh}>{day}日</th>
                ))}
                <th style={styles.th}>回数</th>
                <th style={styles.th}>支給額</th>
              </tr>
            </thead>

            <tbody>
              {employees.map((employee) => {
                const count = getEmployeeHalfCount(employee, days)
                const pay = count * unitCarePay

                return (
                  <tr key={employee.user_id}>
                    <td style={styles.tdSticky}>
                      <div style={styles.employeeName}>{employee.employee_name || '未登録'}</div>
                      <div style={styles.userSub}>{employee.staff_code}</div>
                    </td>

                    <td style={styles.tdCenter}>
                      {employee.staff_grade || 'Recruit'}
                    </td>

                    {days.map((day) => {
                      const dateString = getDateString(targetYear, targetMonth, day)
                      const checked = getCareCount(employee.user_id, dateString) > 0

                      return (
                        <td key={day} style={styles.dayTd}>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => toggleCare(employee, dateString)}
                            style={checked ? styles.checkedBox : styles.uncheckedBox}
                          >
                            {checked ? '✓' : ''}
                          </button>
                        </td>
                      )
                    })}

                    <td style={styles.tdCenter}>{count}</td>
                    <td style={styles.tdStrong}>¥{Number(pay).toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ProfitEntryTable({
  title,
  entries,
  updateProfitEntry,
  saveProfitEntry,
  deleteProfitEntry,
  saving,
}) {
  return (
    <div style={styles.profitBlock}>
      <h3 style={styles.subTitle}>{title}</h3>

      {entries.length === 0 ? (
        <div style={styles.emptyMini}>
          入力はまだありません。
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.profitTable}>
            <thead>
              <tr>
                <th style={styles.th}>日付</th>
                <th style={styles.th}>金額</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry) => (
                <tr key={entry.ranch_profit_entry_id}>
                  <td style={styles.td}>
                    <input
                      type="date"
                      value={normalizeDateString(entry.profit_date)}
                      onChange={(e) => updateProfitEntry(entry, 'profit_date', e.target.value)}
                      style={styles.dateInput}
                    />
                  </td>

                  <td style={styles.td}>
                    <input
                      type="text"
                      value={String(entry.profit_amount ?? '')}
                      onChange={(e) => {
                        const value = e.target.value
                          .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
                          .replace(/,/g, '')
                          .replace(/[^\d-]/g, '')
                        updateProfitEntry(entry, 'profit_amount', value)
                      }}
                      style={styles.amountInput}
                    />
                  </td>

                  <td style={styles.td}>
                    <div style={styles.actionGroup}>
                      <button
                        type="button"
                        onClick={() => saveProfitEntry(entry)}
                        disabled={saving}
                        style={styles.primaryMiniButton}
                      >
                        保存
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteProfitEntry(entry)}
                        disabled={saving}
                        style={styles.dangerMiniButton}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function SummaryLine({ label, value }) {
  return (
    <div style={styles.summaryLine}>
      <span>{label}</span>
      <strong>{value}</strong>
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
  gold: '#a88419',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    color: theme.text,
    padding: '24px',
  },
  container: {
    maxWidth: '1760px',
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
  subTitle: {
    fontSize: '18px',
    fontWeight: 950,
    color: theme.deep,
    margin: '18px 0 10px',
  },
  description: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
  },
  settingGrid: {
    display: 'grid',
    gridTemplateColumns: '120px 100px 220px minmax(220px, 1fr) 160px 160px',
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
  primaryButton: {
    padding: '12px 16px',
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
  visibleSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '14px',
  },
  visibleSummaryCard: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '12px',
    padding: '10px 12px',
    color: theme.deep,
    fontSize: '14px',
    fontWeight: 900,
  },
  employeeChipWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  visibleChip: {
    border: 'none',
    background: theme.green,
    color: theme.white,
    borderRadius: '14px',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
    minWidth: '160px',
  },
  hiddenChip: {
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.muted,
    borderRadius: '14px',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
    minWidth: '160px',
  },
  chipName: {
    fontSize: '14px',
    fontWeight: 950,
  },
  chipSub: {
    fontSize: '11px',
    fontWeight: 800,
    opacity: 0.9,
  },
  tableWrap: {
    overflowX: 'auto',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
  },
  careTable: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '1180px',
  },
  profitTable: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '560px',
  },
  th: {
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '12px 12px',
    borderBottom: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
  },
  thSticky: {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: theme.pale,
    color: theme.deep,
    textAlign: 'left',
    padding: '12px 12px',
    borderBottom: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '13px',
    fontWeight: 900,
    minWidth: '180px',
  },
  dayTh: {
    background: theme.pale,
    color: theme.deep,
    textAlign: 'center',
    padding: '12px 8px',
    borderBottom: `1px solid ${theme.border2}`,
    whiteSpace: 'nowrap',
    fontSize: '12px',
    fontWeight: 900,
    minWidth: '48px',
  },
  td: {
    padding: '11px 12px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    verticalAlign: 'middle',
  },
  tdSticky: {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    background: theme.white,
    padding: '11px 12px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    verticalAlign: 'middle',
    minWidth: '180px',
  },
  tdCenter: {
    padding: '11px 12px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    textAlign: 'center',
    fontWeight: 900,
    verticalAlign: 'middle',
  },
  tdStrong: {
    padding: '11px 12px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 950,
    verticalAlign: 'middle',
  },
  dayTd: {
    padding: '8px',
    borderBottom: `1px solid ${theme.border}`,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  employeeName: {
    color: theme.deep,
    fontWeight: 950,
  },
  userSub: {
    marginTop: '4px',
    fontSize: '11px',
    color: theme.muted,
    fontWeight: 800,
  },
  uncheckedBox: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    border: `2px solid ${theme.gold}`,
    background: theme.white,
    color: theme.gold,
    fontWeight: 950,
    cursor: 'pointer',
    lineHeight: 1,
  },
  checkedBox: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    border: `2px solid ${theme.gold}`,
    background: theme.gold,
    color: theme.white,
    fontWeight: 950,
    cursor: 'pointer',
    lineHeight: 1,
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.8fr',
    gap: '18px',
    alignItems: 'start',
  },
  profitAddGrid: {
    display: 'grid',
    gridTemplateColumns: '160px 200px 120px',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '12px',
  },
  profitBlock: {
    marginTop: '18px',
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
  amountInput: {
    width: '170px',
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
  disabledButton: {
    opacity: 0.65,
    cursor: 'default',
  },
  payrollPeriodList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  payrollPeriodCard: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'center',
  },
  payrollPeriodTitle: {
    fontSize: '18px',
    fontWeight: 950,
    color: theme.deep,
  },
  payrollPeriodMeta: {
    marginTop: '6px',
    fontSize: '13px',
    color: theme.muted,
    lineHeight: 1.6,
  },
  summaryBox: {
    marginTop: '16px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    overflow: 'hidden',
  },
  summaryLine: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border}`,
    fontSize: '14px',
    color: theme.text,
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
  emptyMini: {
    background: theme.white,
    border: `1px dashed ${theme.border2}`,
    borderRadius: '14px',
    padding: '22px',
    color: theme.muted,
    fontSize: '14px',
    lineHeight: 1.7,
  },
  loadingText: {
    fontSize: '18px',
    margin: 0,
    color: theme.muted,
  },
}