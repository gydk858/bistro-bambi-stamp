'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function PayrollClient() {
  const now = new Date()

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [store, setStore] = useState(null)
  const [targetYear, setTargetYear] = useState(now.getFullYear())
  const [targetMonth, setTargetMonth] = useState(now.getMonth() + 1)

  const [periods, setPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [runItems, setRunItems] = useState([])
  const [itemEdits, setItemEdits] = useState({})

  const [rateRuleSets, setRateRuleSets] = useState([])
  const [selectedRateRuleSetId, setSelectedRateRuleSetId] = useState('')

  const [salesAmount, setSalesAmount] = useState('0')
  const [ranchProfitAmount, setRanchProfitAmount] = useState('0')
  const [vaultBeforeAmount, setVaultBeforeAmount] = useState('0')
  const [extraIncomeAmount, setExtraIncomeAmount] = useState('0')
  const [periodMemo, setPeriodMemo] = useState('')
  const [periodSummary, setPeriodSummary] = useState(null)

  const selectedPeriod = useMemo(() => {
    return periods.find((p) => String(p.payroll_period_id) === String(selectedPeriodId))
  }, [periods, selectedPeriodId])

  const selectedRateRuleSet = useMemo(() => {
    return rateRuleSets.find(
      (ruleSet) => String(ruleSet.payroll_rate_rule_set_id) === String(selectedRateRuleSetId)
    )
  }, [rateRuleSets, selectedRateRuleSetId])

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setInitialLoading(true)
    setMessage('')

    try {
      const currentStore = await fetchCurrentStore()
      setStore(currentStore)

      await fetchPayrollRateRuleSets(currentStore.store_id)
      await fetchPayrollPeriods(currentStore.store_id, targetYear, targetMonth)
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

    if (settingError) throw settingError

    const currentStoreCode = setting?.setting_value
    if (!currentStoreCode) throw new Error('current_store_code が設定されていません')

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .select('store_id, store_code, store_name')
      .eq('store_code', currentStoreCode)
      .single()

    if (storeError) throw storeError

    return storeData
  }

  const fetchPayrollRateRuleSets = async (storeId = store?.store_id) => {
    if (!storeId) return []

    const { data: ruleSetRows, error: ruleSetError } = await supabase
      .from('payroll_rate_rule_sets')
      .select(`
        payroll_rate_rule_set_id,
        store_id,
        rule_name,
        effective_from,
        effective_to,
        is_active,
        note
      `)
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .order('payroll_rate_rule_set_id', { ascending: false })

    if (ruleSetError) {
      console.error(ruleSetError)
      setMessage(`単価ルールセットの取得に失敗しました: ${ruleSetError.message}`)
      return []
    }

    const ruleSets = ruleSetRows || []
    const ruleSetIds = ruleSets.map((ruleSet) => ruleSet.payroll_rate_rule_set_id)

    let ruleRows = []

    if (ruleSetIds.length > 0) {
      const { data: rulesData, error: rulesError } = await supabase
        .from('payroll_rate_rules')
        .select(`
          payroll_rate_rule_id,
          payroll_rate_rule_set_id,
          min_stamp_count,
          max_stamp_count,
          unit_pay
        `)
        .in('payroll_rate_rule_set_id', ruleSetIds)
        .order('min_stamp_count', { ascending: true })

      if (rulesError) {
        console.error(rulesError)
        setMessage(`単価ルールの取得に失敗しました: ${rulesError.message}`)
        return []
      }

      ruleRows = rulesData || []
    }

    const ruleRowsBySetId = ruleRows.reduce((map, rule) => {
      const key = String(rule.payroll_rate_rule_set_id)
      if (!map[key]) map[key] = []
      map[key].push(rule)
      return map
    }, {})

    const mergedRuleSets = ruleSets.map((ruleSet) => ({
      ...ruleSet,
      rules: ruleRowsBySetId[String(ruleSet.payroll_rate_rule_set_id)] || [],
    }))

    setRateRuleSets(mergedRuleSets)

    if (!selectedRateRuleSetId && mergedRuleSets.length > 0) {
      setSelectedRateRuleSetId(String(mergedRuleSets[0].payroll_rate_rule_set_id))
    }

    return mergedRuleSets
  }

  const fetchPayrollPeriods = async (
    storeId = store?.store_id,
    year = targetYear,
    month = targetMonth
  ) => {
    if (!storeId) {
      setMessage('店舗IDが取得できていないため、給与期間を取得できません')
      return []
    }

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

    if (error) {
      console.error(error)
      setMessage(`給与期間の取得に失敗しました: ${error.message}`)
      return []
    }

    const nextPeriods = data || []

    setPeriods(nextPeriods)

    if (nextPeriods.length > 0) {
      const firstPeriodId = String(nextPeriods[0].payroll_period_id)
      setSelectedPeriodId(firstPeriodId)
      await fetchPayrollRunItems(firstPeriodId)
      await fetchPayrollInputsAndSummary(firstPeriodId)
    } else {
      setSelectedPeriodId('')
      setRunItems([])
      setItemEdits({})
      resetPayrollInputsAndSummary()
    }

    return nextPeriods
  }

  const fetchPayrollRunItems = async (periodId = selectedPeriodId) => {
    if (!periodId) return []

    const { data, error } = await supabase
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
      .eq('payroll_period_id', Number(periodId))
      .order('staff_code', { ascending: true })

    if (error) {
      console.error(error)
      setMessage(`給与明細の取得に失敗しました: ${error.message}`)
      return []
    }

    const nextItems = data || []
    setRunItems(nextItems)

    const nextEdits = {}
    nextItems.forEach((item) => {
      nextEdits[item.payroll_run_item_id] = {
        adjustmentAmount: String(item.adjustment_amount ?? 0),
        note: item.note || '',
      }
    })
    setItemEdits(nextEdits)

    return nextItems
  }

  const fetchPayrollInputsAndSummary = async (periodId = selectedPeriodId) => {
    if (!periodId) {
      resetPayrollInputsAndSummary()
      return
    }

    const { data: inputData, error: inputError } = await supabase
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
      .eq('payroll_period_id', Number(periodId))
      .order('payroll_period_input_id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (inputError) {
      console.error(inputError)
      setMessage(`給与入力情報の取得に失敗しました: ${inputError.message}`)
      return
    }

    const { data: summaryData, error: summaryError } = await supabase
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
      .eq('payroll_period_id', Number(periodId))
      .order('payroll_period_summary_id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (summaryError) {
      console.error(summaryError)
      setMessage(`給与集計情報の取得に失敗しました: ${summaryError.message}`)
      return
    }

    if (inputData) {
      setSalesAmount(String(inputData.sales_amount ?? 0))
      setRanchProfitAmount(String(inputData.ranch_profit_amount ?? 0))
      setVaultBeforeAmount(String(inputData.vault_before_amount ?? 0))
      setExtraIncomeAmount(String(inputData.extra_income_amount ?? 0))
      setPeriodMemo(inputData.memo || '')

      if (inputData.payroll_rate_rule_set_id) {
        setSelectedRateRuleSetId(String(inputData.payroll_rate_rule_set_id))
      }
    } else {
      setSalesAmount('0')
      setRanchProfitAmount('0')
      setVaultBeforeAmount('0')
      setExtraIncomeAmount('0')
      setPeriodMemo('')
    }

    setPeriodSummary(summaryData || null)
  }

  const resetPayrollInputsAndSummary = () => {
    setSalesAmount('0')
    setRanchProfitAmount('0')
    setVaultBeforeAmount('0')
    setExtraIncomeAmount('0')
    setPeriodMemo('')
    setPeriodSummary(null)
  }

  const getDateString = (year, month, day) => {
    const y = Number(year)
    const m = String(Number(month)).padStart(2, '0')
    const d = String(Number(day)).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const getLastDateString = (year, month) => {
    const lastDay = new Date(Number(year), Number(month), 0).getDate()
    return getDateString(year, month, lastDay)
  }

  const toAmountNumber = (value) => {
    const normalized = String(value ?? '')
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/,/g, '')
      .replace(/[^\d-]/g, '')

    if (normalized === '' || normalized === '-') return 0
    return Number(normalized)
  }

  const handleAmountChange = (setter) => (event) => {
    const value = event.target.value
      .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/,/g, '')
      .replace(/[^\d-]/g, '')

    setter(value)
  }

  const getSelectedRateRuleSetIdForRpc = () => {
    if (!selectedRateRuleSetId) return null
    return Number(selectedRateRuleSetId)
  }

  const createPayrollPeriods = async () => {
    if (!store?.store_code || !store?.store_id) {
      setMessage('店舗情報が取得できていません')
      return
    }

    setLoading(true)
    setMessage('給与期間を作成中です...')

    try {
      const firstPayday = getDateString(targetYear, targetMonth, 15)
      const secondPayday = getLastDateString(targetYear, targetMonth)

      const { error } = await supabase.rpc('create_payroll_periods_for_month', {
        p_store_code: store.store_code,
        p_target_year: Number(targetYear),
        p_target_month: Number(targetMonth),
        p_first_payday: firstPayday,
        p_second_payday: secondPayday,
      })

      if (error) throw error

      const refreshedPeriods = await fetchPayrollPeriods(
        store.store_id,
        targetYear,
        targetMonth
      )

      setMessage(`給与期間を作成しました。${refreshedPeriods.length}件の給与期間を取得しました。`)
    } catch (error) {
      console.error(error)
      setMessage(`給与期間の作成に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const buildPreviewForSelectedPeriod = async () => {
    if (!selectedPeriodId) {
      setMessage('給与期間を選択してください')
      return
    }

    setLoading(true)
    setMessage('履歴から給与プレビューを生成中です...')

    try {
      const { error } = await supabase.rpc('build_payroll_run_preview_from_history', {
        p_payroll_period_id: Number(selectedPeriodId),
        p_payroll_rate_rule_set_id: getSelectedRateRuleSetIdForRpc(),
      })

      if (error) throw error

      await fetchPayrollRunItems(selectedPeriodId)
      await fetchPayrollInputsAndSummary(selectedPeriodId)
      setMessage('履歴から給与プレビューを生成しました')
    } catch (error) {
      console.error(error)
      setMessage(`給与プレビュー生成に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const savePayrollInputs = async () => {
    if (!selectedPeriodId) {
      setMessage('給与期間を選択してください')
      return
    }

    setLoading(true)
    setMessage('給与期間の入力内容を保存中です...')

    try {
      const { error } = await supabase.rpc('save_payroll_period_inputs_and_summary', {
        p_payroll_period_id: Number(selectedPeriodId),
        p_payroll_rate_rule_set_id: getSelectedRateRuleSetIdForRpc(),
        p_sales_amount: toAmountNumber(salesAmount),
        p_ranch_profit_amount: toAmountNumber(ranchProfitAmount),
        p_vault_before_amount: toAmountNumber(vaultBeforeAmount),
        p_extra_income_amount: toAmountNumber(extraIncomeAmount),
        p_memo: periodMemo.trim() === '' ? null : periodMemo.trim(),
      })

      if (error) throw error

      await fetchPayrollInputsAndSummary(selectedPeriodId)
      await fetchPayrollRunItems(selectedPeriodId)

      setMessage('給与期間の入力内容を保存しました')
    } catch (error) {
      console.error(error)
      setMessage(`給与期間の入力内容の保存に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveRunItemAdjustment = async (item) => {
    const edit = itemEdits[item.payroll_run_item_id]
    if (!edit) return

    setLoading(true)
    setMessage(`${item.staff_code} の調整内容を保存中です...`)

    try {
      const { error } = await supabase.rpc('update_payroll_run_item_adjustment', {
        p_payroll_run_item_id: Number(item.payroll_run_item_id),
        p_adjustment_amount: toAmountNumber(edit.adjustmentAmount),
        p_note: edit.note.trim() === '' ? null : edit.note.trim(),
      })

      if (error) throw error

      await fetchPayrollRunItems(selectedPeriodId)
      await fetchPayrollInputsAndSummary(selectedPeriodId)

      setMessage(`${item.staff_code} の調整内容を保存しました`)
    } catch (error) {
      console.error(error)
      setMessage(`調整内容の保存に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const updateItemEdit = (itemId, field, value) => {
    setItemEdits((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { adjustmentAmount: '0', note: '' }),
        [field]: value,
      },
    }))
  }

  const handlePeriodChange = async (value) => {
    setSelectedPeriodId(value)
    await fetchPayrollRunItems(value)
    await fetchPayrollInputsAndSummary(value)
  }

  const reloadCurrentMonth = async () => {
    if (!store?.store_id) {
      setMessage('店舗情報が取得できていません')
      return
    }

    setLoading(true)
    setMessage('給与期間を再読み込み中です...')

    try {
      await fetchPayrollRateRuleSets(store.store_id)

      const refreshedPeriods = await fetchPayrollPeriods(
        store.store_id,
        targetYear,
        targetMonth
      )

      setMessage(`${refreshedPeriods.length}件の給与期間を取得しました。`)
    } catch (error) {
      console.error(error)
      setMessage(`再読み込みに失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
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

  const formatRuleRange = (rule) => {
    if (rule.max_stamp_count === null || rule.max_stamp_count === undefined) {
      return `${rule.min_stamp_count}個以上`
    }

    return `${rule.min_stamp_count}〜${rule.max_stamp_count}個`
  }

  const getPeriodTypeLabel = (halfType) => {
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

  const totalAttendanceCount = runItems.reduce((sum, item) => {
    return sum + Number(item.attendance_count || 0)
  }, 0)

  const totalCalculatedPayAmount = runItems.reduce((sum, item) => {
    return sum + Number(item.calculated_pay_amount || 0)
  }, 0)

  const totalTransferAmount = runItems.reduce((sum, item) => {
    return sum + Number(item.transfer_amount || 0)
  }, 0)

  const totalAdjustmentAmount = runItems.reduce((sum, item) => {
    return sum + Number(item.adjustment_amount || 0)
  }, 0)

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
    minWidth: '150px',
    outline: 'none',
  }

  const smallInputStyle = {
    padding: '10px 12px',
    fontSize: '16px',
    borderRadius: '10px',
    border: '1px solid #dcbeb2',
    background: '#fff',
    color: '#6b4235',
    width: '130px',
    outline: 'none',
  }

  const noteInputStyle = {
    ...smallInputStyle,
    width: '220px',
  }

  const textareaStyle = {
    ...inputStyle,
    minWidth: '100%',
    minHeight: '110px',
    resize: 'vertical',
    lineHeight: 1.6,
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

  const miniButtonStyle = {
    padding: '10px 14px',
    fontSize: '15px',
    fontWeight: 700,
    borderRadius: '10px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    whiteSpace: 'nowrap',
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

  const infoRowStyle = {
    fontSize: '22px',
    lineHeight: 1.8,
    color: '#5f4137',
    margin: 0,
  }

  const periodButtonBaseStyle = {
    textAlign: 'left',
    border: '1px solid #f0d9d2',
    borderRadius: '18px',
    background: '#fff',
    padding: '20px',
    cursor: loading ? 'not-allowed' : 'pointer',
    boxShadow: '0 6px 16px rgba(194, 144, 128, 0.08)',
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
        <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
          <div style={cardBoxStyle}>
            <p style={infoRowStyle}>読み込み中です...</p>
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
      <div style={{ maxWidth: '1500px', margin: '0 auto' }}>
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
              給与管理画面
            </p>
          </div>

          <div
            style={{
              marginBottom: '16px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <Link href="/admin/staff/payroll/monthly" style={subButtonStyle}>
              月次一覧
            </Link>

            <Link href="/admin" style={subButtonStyle}>
              管理メニュー
            </Link>

            <Link href="/admin/staff" style={subButtonStyle}>
              従業員管理
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '0.95fr 1.45fr',
            gap: '28px',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>① 対象店舗</div>

              {store ? (
                <>
                  <p style={infoRowStyle}>
                    <strong>店舗コード：</strong> {store.store_code}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>店舗名：</strong> {store.store_name}
                  </p>
                </>
              ) : (
                <p style={infoRowStyle}>店舗情報を取得できませんでした。</p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>② 対象年月</div>

              <p
                style={{
                  fontSize: '20px',
                  color: '#8a6457',
                  marginTop: 0,
                  marginBottom: '18px',
                  lineHeight: 1.7,
                }}
              >
                給与期間を作成・確認したい年月を指定します。
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
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
                  style={{ ...inputStyle, minWidth: '110px' }}
                />

                <button type="button" onClick={reloadCurrentMonth} disabled={loading} style={subButtonStyle}>
                  再読み込み
                </button>
              </div>

              <div style={{ marginTop: '18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <button type="button" onClick={createPayrollPeriods} disabled={loading} style={primaryButtonStyle}>
                  {loading ? '処理中...' : '給与期間を作成'}
                </button>
              </div>

              <p
                style={{
                  fontSize: '18px',
                  color: '#9a6b5b',
                  marginTop: '14px',
                  marginBottom: 0,
                  lineHeight: 1.7,
                }}
              >
                前半の支払日は15日、後半の支払日は月末として作成します。
              </p>
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>③ 給与期間</div>

              {periods.length === 0 ? (
                <p style={{ fontSize: '22px', color: '#9a6b5b', margin: 0, lineHeight: 1.8 }}>
                  この年月の給与期間はまだありません。
                  <br />
                  「給与期間を作成」を押してください。
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {periods.map((period) => {
                      const isActive = String(selectedPeriodId) === String(period.payroll_period_id)

                      return (
                        <button
                          key={period.payroll_period_id}
                          type="button"
                          disabled={loading}
                          onClick={() => handlePeriodChange(String(period.payroll_period_id))}
                          style={{
                            ...periodButtonBaseStyle,
                            border: isActive ? '2px solid #d98b7b' : '1px solid #f0d9d2',
                            background: isActive ? '#fff1e9' : '#fff',
                          }}
                        >
                          <div style={{ fontSize: '24px', fontWeight: 800, color: '#7a4b3a', marginBottom: '8px' }}>
                            {getPeriodTypeLabel(period.half_type)}
                          </div>

                          <div style={{ fontSize: '18px', color: '#8a6457', lineHeight: 1.7 }}>
                            期間: {formatDate(period.period_start)} ～ {formatDate(period.period_end)}
                            <br />
                            支払日: {formatDate(period.payday)}
                            <br />
                            状態: {period.status || '-'}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {selectedPeriod && (
                    <div
                      style={{
                        marginTop: '18px',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#7a4b3a',
                        background: '#fff',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        border: '1px solid #f0d9d2',
                      }}
                    >
                      選択中: {getPeriodTypeLabel(selectedPeriod.half_type)} /{' '}
                      {formatDate(selectedPeriod.period_start)} ～ {formatDate(selectedPeriod.period_end)}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>④ 単価ルール</div>

              <p
                style={{
                  fontSize: '20px',
                  color: '#8a6457',
                  marginTop: 0,
                  marginBottom: '18px',
                  lineHeight: 1.7,
                }}
              >
                この給与期間で使用する単価ルールを選択します。
                給与プレビュー生成時に、このルールで適用単価を判定します。
              </p>

              {rateRuleSets.length === 0 ? (
                <p style={{ fontSize: '20px', color: '#9a6b5b', margin: 0 }}>
                  有効な単価ルールがありません。
                </p>
              ) : (
                <>
                  <select
                    value={selectedRateRuleSetId}
                    onChange={(e) => setSelectedRateRuleSetId(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                    disabled={loading}
                  >
                    {rateRuleSets.map((ruleSet) => (
                      <option
                        key={ruleSet.payroll_rate_rule_set_id}
                        value={String(ruleSet.payroll_rate_rule_set_id)}
                      >
                        {ruleSet.rule_name}
                      </option>
                    ))}
                  </select>

                  {selectedRateRuleSet && (
                    <div
                      style={{
                        marginTop: '16px',
                        background: '#fff',
                        border: '1px solid #f0d9d2',
                        borderRadius: '16px',
                        padding: '16px',
                      }}
                    >
                      <p style={{ fontSize: '18px', color: '#7a4b3a', fontWeight: 800, margin: '0 0 10px' }}>
                        {selectedRateRuleSet.rule_name}
                      </p>

                      <p style={{ fontSize: '16px', color: '#8a6457', margin: '0 0 12px', lineHeight: 1.6 }}>
                        適用開始: {formatDate(selectedRateRuleSet.effective_from)}
                        {selectedRateRuleSet.effective_to
                          ? ` / 適用終了: ${formatDate(selectedRateRuleSet.effective_to)}`
                          : ' / 適用終了: なし'}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedRateRuleSet.rules.map((rule) => (
                          <div
                            key={rule.payroll_rate_rule_id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '12px',
                              fontSize: '18px',
                              color: '#5f4137',
                              borderTop: '1px solid #f5dfd8',
                              paddingTop: '8px',
                            }}
                          >
                            <span>{formatRuleRange(rule)}</span>
                            <strong>{formatMoney(rule.unit_pay)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: '18px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <Link href="/admin/staff/payroll/rate-rules" style={subButtonStyle}>
                      単価ルール管理
                    </Link>

                    <button
                      type="button"
                      onClick={buildPreviewForSelectedPeriod}
                      disabled={loading || !selectedPeriodId}
                      style={primaryButtonStyle}
                    >
                      {loading ? '処理中...' : '履歴から給与プレビュー生成'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>⑤ 金庫・牧場・備考</div>

              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                支払い前に確認した金庫額、牧場利益、イベント等の備考を入力します。
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <label>
                  <div style={inputLabelStyle}>店舗売上</div>
                  <input type="text" value={salesAmount} onChange={handleAmountChange(setSalesAmount)} style={inputStyle} />
                </label>

                <label>
                  <div style={inputLabelStyle}>牧場利益</div>
                  <input type="text" value={ranchProfitAmount} onChange={handleAmountChange(setRanchProfitAmount)} style={inputStyle} />
                </label>

                <label>
                  <div style={inputLabelStyle}>支払い前金庫額</div>
                  <input type="text" value={vaultBeforeAmount} onChange={handleAmountChange(setVaultBeforeAmount)} style={inputStyle} />
                </label>

                <label>
                  <div style={inputLabelStyle}>その他収入</div>
                  <input type="text" value={extraIncomeAmount} onChange={handleAmountChange(setExtraIncomeAmount)} style={inputStyle} />
                </label>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label>
                  <div style={inputLabelStyle}>備考</div>
                  <textarea
                    value={periodMemo}
                    onChange={(e) => setPeriodMemo(e.target.value)}
                    style={textareaStyle}
                    placeholder="イベント、特記事項、支払いメモなど"
                  />
                </label>
              </div>

              <div style={{ marginTop: '18px' }}>
                <button type="button" onClick={savePayrollInputs} disabled={loading || !selectedPeriodId} style={primaryButtonStyle}>
                  {loading ? '処理中...' : '入力内容を保存'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>給与プレビュー</div>

              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: '18px', lineHeight: 1.7 }}>
                選択中の給与期間について、出勤数・締め日時点スタンプ数・適用単価・支給額を確認します。
              </p>

              {runItems.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>総出勤数</div>
                    <div style={summaryValueStyle}>{totalAttendanceCount}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>総支給額</div>
                    <div style={summaryValueStyle}>{formatMoney(totalCalculatedPayAmount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>振込額合計</div>
                    <div style={summaryValueStyle}>{formatMoney(totalTransferAmount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>調整額合計</div>
                    <div style={summaryValueStyle}>{formatMoney(totalAdjustmentAmount)}</div>
                  </div>
                </div>
              )}

              {runItems.length === 0 ? (
                <div
                  style={{
                    background: '#fff',
                    border: '1px dashed #e0beb3',
                    borderRadius: '18px',
                    padding: '42px 24px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: '24px', color: '#9a6b5b', margin: 0, lineHeight: 1.8 }}>
                    給与プレビューはまだありません。
                    <br />
                    給与期間を選択して「履歴から給与プレビュー生成」を押してください。
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #efd8d0', borderRadius: '18px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1280px' }}>
                    <thead>
                      <tr>
                        <th style={tableHeadStyle}>従業員コード</th>
                        <th style={tableHeadStyle}>氏名</th>
                        <th style={tableHeadStyle}>出勤数</th>
                        <th style={tableHeadStyle}>締め日時点スタンプ数</th>
                        <th style={tableHeadStyle}>適用単価</th>
                        <th style={tableHeadStyle}>計算支給額</th>
                        <th style={tableHeadStyle}>調整額</th>
                        <th style={tableHeadStyle}>振込額</th>
                        <th style={tableHeadStyle}>個別備考</th>
                        <th style={tableHeadStyle}>保存</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runItems.map((item) => {
                        const edit = itemEdits[item.payroll_run_item_id] || {
                          adjustmentAmount: String(item.adjustment_amount ?? 0),
                          note: item.note || '',
                        }

                        return (
                          <tr key={item.payroll_run_item_id}>
                            <td style={tableCellStyle}>{item.staff_code}</td>
                            <td style={tableCellStyle}>{item.display_name}</td>
                            <td style={tableCellStyle}>{item.attendance_count}</td>
                            <td style={tableCellStyle}>{item.stamp_count_at_close}</td>
                            <td style={tableCellStyle}>{formatMoney(item.applied_unit_pay)}</td>
                            <td style={tableCellStyle}>{formatMoney(item.calculated_pay_amount)}</td>
                            <td style={tableCellStyle}>
                              <input
                                type="text"
                                value={edit.adjustmentAmount}
                                onChange={(e) => {
                                  const value = e.target.value
                                    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
                                    .replace(/,/g, '')
                                    .replace(/[^\d-]/g, '')
                                  updateItemEdit(item.payroll_run_item_id, 'adjustmentAmount', value)
                                }}
                                style={smallInputStyle}
                              />
                            </td>
                            <td style={tableCellStyle}>{formatMoney(item.transfer_amount)}</td>
                            <td style={tableCellStyle}>
                              <input
                                type="text"
                                value={edit.note}
                                onChange={(e) => updateItemEdit(item.payroll_run_item_id, 'note', e.target.value)}
                                style={noteInputStyle}
                                placeholder="個別メモ"
                              />
                            </td>
                            <td style={tableCellStyle}>
                              <button
                                type="button"
                                onClick={() => saveRunItemAdjustment(item)}
                                disabled={loading || item.is_locked}
                                style={miniButtonStyle}
                              >
                                保存
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>給与期間集計</div>

              {periodSummary ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>総支払額</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.total_pay_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>振込額合計</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.total_transfer_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>牧場利益</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.ranch_profit_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>支払い前金庫額</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.vault_before_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>金庫 + 牧場</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.vault_plus_ranch_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>支払い後金額</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.vault_after_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>営業利益</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.store_profit_amount)}</div>
                  </div>

                  <div style={summaryBoxStyle}>
                    <div style={summaryLabelStyle}>経常利益</div>
                    <div style={summaryValueStyle}>{formatMoney(periodSummary.total_profit_amount)}</div>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '22px', color: '#9a6b5b', margin: 0, lineHeight: 1.8 }}>
                  金庫・牧場・備考を入力して保存すると、ここに集計結果が表示されます。
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>運用メモ</div>

              <p style={{ fontSize: '20px', color: '#8a6457', marginTop: 0, marginBottom: 0, lineHeight: 1.7 }}>
                給与プレビュー生成では、出勤履歴とスタンプ履歴から自動集計します。
                選択中の単価ルールを使って適用単価を判定します。
              </p>
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
  padding: '16px',
  borderBottom: '1px solid #efd8d0',
  whiteSpace: 'nowrap',
  fontSize: '18px',
}

const tableCellStyle = {
  padding: '16px',
  borderBottom: '1px solid #f0d9d2',
  whiteSpace: 'nowrap',
  fontSize: '18px',
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
}

const summaryValueStyle = {
  fontSize: '24px',
  fontWeight: 800,
  color: '#7a4b3a',
}

const inputLabelStyle = {
  fontSize: '16px',
  color: '#9a6b5b',
  fontWeight: 700,
  marginBottom: '8px',
}