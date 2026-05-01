'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT = '2019102555'

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

  const [previousVaultAfterAmount, setPreviousVaultAfterAmount] = useState(DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT)
  const [previousVaultSourceText, setPreviousVaultSourceText] = useState('初月用の初期値を表示しています')
  const [ranchProfitAmount, setRanchProfitAmount] = useState('0')
  const [vaultBeforeAmount, setVaultBeforeAmount] = useState('0')
  const [extraIncomeAmount, setExtraIncomeAmount] = useState('0')
  const [periodMemo, setPeriodMemo] = useState('')
  const [periodSummary, setPeriodSummary] = useState(null)

  const selectedPeriod = useMemo(() => {
    return periods.find((p) => String(p.payroll_period_id) === String(selectedPeriodId))
  }, [periods, selectedPeriodId])

  const isSelectedPeriodLocked = selectedPeriod?.status === 'locked'

  const canLockSelectedPeriod =
    Boolean(selectedPeriodId) &&
    !isSelectedPeriodLocked &&
    runItems.length > 0 &&
    Boolean(periodSummary)

  const lockBlockedReason = !selectedPeriodId
    ? '給与期間を選択してください'
    : isSelectedPeriodLocked
    ? 'この給与期間はすでに確定済みです'
    : runItems.length === 0
    ? '先に給与プレビューを生成してください'
    : !periodSummary
    ? '先に金庫・牧場・備考の「入力内容を保存」をしてください'
    : ''

  const selectedRateRuleSet = useMemo(() => {
    return rateRuleSets.find(
      (ruleSet) => String(ruleSet.payroll_rate_rule_set_id) === String(selectedRateRuleSetId)
    )
  }, [rateRuleSets, selectedRateRuleSetId])

  const totalAttendanceCount = runItems.reduce((sum, item) => sum + Number(item.attendance_count || 0), 0)
  const totalCalculatedPayAmount = runItems.reduce((sum, item) => sum + Number(item.calculated_pay_amount || 0), 0)
  const totalTransferAmount = runItems.reduce((sum, item) => sum + Number(item.transfer_amount || 0), 0)
  const totalAdjustmentAmount = runItems.reduce((sum, item) => sum + Number(item.adjustment_amount || 0), 0)

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

    const rulesBySetId = ruleRows.reduce((map, rule) => {
      const key = String(rule.payroll_rate_rule_set_id)
      if (!map[key]) map[key] = []
      map[key].push(rule)
      return map
    }, {})

    const mergedRuleSets = ruleSets.map((ruleSet) => ({
      ...ruleSet,
      rules: rulesBySetId[String(ruleSet.payroll_rate_rule_set_id)] || [],
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
      const currentStillExists = selectedPeriodId
        ? nextPeriods.some((period) => String(period.payroll_period_id) === String(selectedPeriodId))
        : false

      const nextSelectedPeriodId = currentStillExists
        ? String(selectedPeriodId)
        : String(nextPeriods[0].payroll_period_id)

      setSelectedPeriodId(nextSelectedPeriodId)
      await fetchPayrollRunItems(nextSelectedPeriodId)
      await fetchPayrollInputsAndSummary(nextSelectedPeriodId)
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

  const fetchPreviousVaultAfterAmount = async (periodId) => {
    if (!periodId) {
      setPreviousVaultAfterAmount(DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT)
      setPreviousVaultSourceText('初月用の初期値を表示しています')
      return DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT
    }

    const { data, error } = await supabase.rpc('get_previous_payroll_vault_after', {
      p_payroll_period_id: Number(periodId),
    })

    if (error) {
      console.error(error)
      setPreviousVaultAfterAmount(DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT)
      setPreviousVaultSourceText('前回給与期間を取得できなかったため、初月用の初期値を表示しています')
      return DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT
    }

    const previous = Array.isArray(data) && data.length > 0 ? data[0] : null

    if (previous?.previous_vault_after_amount !== null && previous?.previous_vault_after_amount !== undefined) {
      const previousAmount = String(previous.previous_vault_after_amount)

      setPreviousVaultAfterAmount(previousAmount)
      setPreviousVaultSourceText(
        `前回給与期間 ${formatDate(previous.previous_period_start)} ～ ${formatDate(previous.previous_period_end)} の支払い後金額を自動表示しています`
      )

      return previousAmount
    }

    setPreviousVaultAfterAmount(DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT)
    setPreviousVaultSourceText('前回給与期間がないため、初月用の初期値を表示しています')
    return DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT
  }

  const fetchPayrollInputsAndSummary = async (periodId = selectedPeriodId) => {
    if (!periodId) {
      resetPayrollInputsAndSummary()
      return
    }

    const autoPreviousVaultAfterAmount = await fetchPreviousVaultAfterAmount(periodId)

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

    setPreviousVaultAfterAmount(autoPreviousVaultAfterAmount)

    if (inputData) {
      setRanchProfitAmount(String(inputData.ranch_profit_amount ?? 0))
      setVaultBeforeAmount(String(inputData.vault_before_amount ?? 0))
      setExtraIncomeAmount(String(inputData.extra_income_amount ?? 0))
      setPeriodMemo(inputData.memo || '')

      if (inputData.payroll_rate_rule_set_id) {
        setSelectedRateRuleSetId(String(inputData.payroll_rate_rule_set_id))
      }
    } else {
      setRanchProfitAmount('0')
      setVaultBeforeAmount('0')
      setExtraIncomeAmount('0')
      setPeriodMemo('')
    }

    setPeriodSummary(summaryData || null)
  }

  const resetPayrollInputsAndSummary = () => {
    setPreviousVaultAfterAmount(DEFAULT_PREVIOUS_VAULT_AFTER_AMOUNT)
    setPreviousVaultSourceText('初月用の初期値を表示しています')
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

    if (isSelectedPeriodLocked) {
      setMessage('この給与期間は確定済みのため、給与プレビューを再生成できません。修正する場合は先にロック解除してください。')
      return
    }

    if (!selectedRateRuleSetId) {
      setMessage('単価ルールを選択してください')
      return
    }

    setLoading(true)
    setMessage('履歴から給与プレビューを生成中です...')

    try {
      const selectedRuleSetId = Number(selectedRateRuleSetId)

      const { error: saveRuleError } = await supabase.rpc(
        'save_payroll_period_rate_rule_selection',
        {
          p_payroll_period_id: Number(selectedPeriodId),
          p_payroll_rate_rule_set_id: selectedRuleSetId,
        }
      )

      if (saveRuleError) throw saveRuleError

      const { error } = await supabase.rpc('build_payroll_run_preview_from_history', {
        p_payroll_period_id: Number(selectedPeriodId),
        p_payroll_rate_rule_set_id: selectedRuleSetId,
      })

      if (error) throw error

      setSelectedRateRuleSetId(String(selectedRuleSetId))

      await fetchPayrollRunItems(selectedPeriodId)
      await fetchPayrollInputsAndSummary(selectedPeriodId)

      setMessage('履歴から給与プレビューを生成しました。選択した単価ルールもこの給与期間に保存しました。')
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

    if (isSelectedPeriodLocked) {
      setMessage('この給与期間は確定済みのため、金庫・牧場・備考を保存できません。修正する場合は先にロック解除してください。')
      return
    }

    setLoading(true)
    setMessage('金庫・牧場・備考を保存中です...')

    try {
      const { error } = await supabase.rpc('save_payroll_period_inputs_and_summary', {
        p_payroll_period_id: Number(selectedPeriodId),
        p_payroll_rate_rule_set_id: getSelectedRateRuleSetIdForRpc(),
        p_sales_amount: toAmountNumber(previousVaultAfterAmount),
        p_ranch_profit_amount: toAmountNumber(ranchProfitAmount),
        p_vault_before_amount: toAmountNumber(vaultBeforeAmount),
        p_extra_income_amount: toAmountNumber(extraIncomeAmount),
        p_memo: periodMemo.trim() === '' ? null : periodMemo.trim(),
      })

      if (error) throw error

      await fetchPayrollInputsAndSummary(selectedPeriodId)
      await fetchPayrollRunItems(selectedPeriodId)

      setMessage('金庫・牧場・備考を保存しました')
    } catch (error) {
      console.error(error)
      setMessage(`保存に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveRunItemAdjustment = async (item) => {
    if (isSelectedPeriodLocked || item.is_locked) {
      setMessage('この給与期間は確定済みのため、個別調整を保存できません。修正する場合は先にロック解除してください。')
      return
    }

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

  const lockSelectedPayrollPeriod = async () => {
    if (!selectedPeriodId) {
      setMessage('給与期間を選択してください')
      return
    }

    if (isSelectedPeriodLocked) {
      setMessage('この給与期間はすでに確定済みです')
      return
    }

    if (!canLockSelectedPeriod) {
      setMessage(lockBlockedReason || 'この給与期間はまだ確定できません')
      return
    }

    const ok = window.confirm(
      [
        'この給与期間を確定しますか？',
        '',
        '確定すると以下の操作ができなくなります。',
        '・給与プレビュー再生成',
        '・個別調整の保存',
        '・金庫・牧場・備考の保存',
        '',
        '修正が必要な場合は、後からロック解除できます。',
      ].join('\n')
    )

    if (!ok) return

    setLoading(true)
    setMessage('給与期間を確定中です...')

    try {
      const { data, error } = await supabase.rpc('lock_payroll_period_admin', {
        p_payroll_period_id: Number(selectedPeriodId),
        p_locked_by: 'admin_payroll_ui',
      })

      if (error) throw error

      setPeriods((prev) =>
        prev.map((period) =>
          String(period.payroll_period_id) === String(selectedPeriodId)
            ? { ...period, status: 'locked' }
            : period
        )
      )

      await fetchPayrollRunItems(selectedPeriodId)
      await fetchPayrollInputsAndSummary(selectedPeriodId)

      const result = Array.isArray(data) && data.length > 0 ? data[0] : null
      setMessage(
        result
          ? `給与期間を確定しました（ロック明細 ${result.locked_item_count}件）`
          : '給与期間を確定しました'
      )
    } catch (error) {
      console.error(error)
      setMessage(`給与期間の確定に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const unlockSelectedPayrollPeriod = async () => {
    if (!selectedPeriodId) {
      setMessage('給与期間を選択してください')
      return
    }

    if (!isSelectedPeriodLocked) {
      setMessage('この給与期間はロックされていません')
      return
    }

    const ok = window.confirm(
      [
        'この給与期間のロックを解除しますか？',
        '',
        '解除すると給与プレビュー再生成、個別調整、金庫・牧場・備考の保存が再度可能になります。',
        '支払い済み期間の場合は、操作ミスに注意してください。',
      ].join('\n')
    )

    if (!ok) return

    setLoading(true)
    setMessage('給与期間のロックを解除中です...')

    try {
      const { data, error } = await supabase.rpc('unlock_payroll_period_admin', {
        p_payroll_period_id: Number(selectedPeriodId),
        p_unlocked_by: 'admin_payroll_ui',
      })

      if (error) throw error

      setPeriods((prev) =>
        prev.map((period) =>
          String(period.payroll_period_id) === String(selectedPeriodId)
            ? { ...period, status: 'open' }
            : period
        )
      )

      await fetchPayrollRunItems(selectedPeriodId)
      await fetchPayrollInputsAndSummary(selectedPeriodId)

      const result = Array.isArray(data) && data.length > 0 ? data[0] : null
      setMessage(
        result
          ? `給与期間のロックを解除しました（解除明細 ${result.unlocked_item_count}件）`
          : '給与期間のロックを解除しました'
      )
    } catch (error) {
      console.error(error)
      setMessage(`ロック解除に失敗しました: ${error.message}`)
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

  const getPeriodStatusLabel = (status) => {
    if (status === 'locked') return '確定済み'
    if (status === 'open') return '編集中'
    return status || '-'
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
                <p style={styles.subtitle}>給与管理ダッシュボード</p>
              </div>
            </div>
          </div>

          <nav style={styles.nav}>
            <Link href="/admin/staff/payroll/history" style={styles.navButton}>
              給与履歴一覧
            </Link>
            <Link href="/admin/staff/payroll/monthly" style={styles.navButton}>
              月次一覧
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

        <div style={styles.dashboard}>
          <aside style={styles.sidebar}>
            <section style={styles.panel}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionNumber}>01</span>
                <h2 style={styles.sectionTitle}>対象店舗</h2>
              </div>

              {store ? (
                <div style={styles.infoList}>
                  <div>
                    <div style={styles.infoLabel}>店舗コード</div>
                    <div style={styles.infoValue}>{store.store_code}</div>
                  </div>
                  <div>
                    <div style={styles.infoLabel}>店舗名</div>
                    <div style={styles.infoValue}>{store.store_name}</div>
                  </div>
                </div>
              ) : (
                <p style={styles.note}>店舗情報を取得できませんでした。</p>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionNumber}>02</span>
                <h2 style={styles.sectionTitle}>対象年月</h2>
              </div>

              <div style={styles.formGridTwo}>
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
              </div>

              <div style={styles.actionStack}>
                <button type="button" onClick={reloadCurrentMonth} disabled={loading} style={styles.secondaryButton}>
                  再読み込み
                </button>
                <button type="button" onClick={createPayrollPeriods} disabled={loading} style={styles.primaryButton}>
                  給与期間を作成
                </button>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionNumber}>03</span>
                <h2 style={styles.sectionTitle}>給与期間</h2>
              </div>

              {periods.length === 0 ? (
                <p style={styles.note}>この年月の給与期間はまだありません。</p>
              ) : (
                <div style={styles.periodList}>
                  {periods.map((period) => {
                    const isActive = String(selectedPeriodId) === String(period.payroll_period_id)
                    const isLocked = period.status === 'locked'

                    return (
                      <button
                        key={period.payroll_period_id}
                        type="button"
                        disabled={loading}
                        onClick={() => handlePeriodChange(String(period.payroll_period_id))}
                        style={{
                          ...styles.periodCard,
                          ...(isActive ? styles.periodCardActive : {}),
                          ...(isLocked ? styles.periodCardLocked : {}),
                        }}
                      >
                        <div style={styles.periodTitleRow}>
                          <div style={styles.periodTitle}>
                            {getPeriodTypeLabel(period.half_type)}
                          </div>
                          <span style={isLocked ? styles.lockedBadge : styles.openBadge}>
                            {getPeriodStatusLabel(period.status)}
                          </span>
                        </div>
                        <div style={styles.periodMeta}>
                          {formatDate(period.period_start)} ～ {formatDate(period.period_end)}
                          <br />
                          支払日: {formatDate(period.payday)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionNumber}>04</span>
                <h2 style={styles.sectionTitle}>単価ルール</h2>
              </div>

              {rateRuleSets.length === 0 ? (
                <p style={styles.note}>有効な単価ルールがありません。</p>
              ) : (
                <>
                  <select
                    value={selectedRateRuleSetId}
                    onChange={(e) => setSelectedRateRuleSetId(e.target.value)}
                    style={styles.select}
                    disabled={loading || isSelectedPeriodLocked}
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
                    <div style={styles.ruleBox}>
                      <div style={styles.ruleName}>{selectedRateRuleSet.rule_name}</div>
                      <div style={styles.ruleDate}>
                        適用開始: {formatDate(selectedRateRuleSet.effective_from)}
                        {selectedRateRuleSet.effective_to
                          ? ` / 適用終了: ${formatDate(selectedRateRuleSet.effective_to)}`
                          : ' / 適用終了: なし'}
                      </div>

                      <div style={styles.ruleList}>
                        {selectedRateRuleSet.rules.map((rule) => (
                          <div key={rule.payroll_rate_rule_id} style={styles.ruleRow}>
                            <span>{formatRuleRange(rule)}</span>
                            <strong>{formatMoney(rule.unit_pay)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={styles.actionStack}>
                    <Link href="/admin/staff/payroll/rate-rules" style={styles.secondaryButton}>
                      単価ルール管理
                    </Link>
                    <button
                      type="button"
                      onClick={buildPreviewForSelectedPeriod}
                      disabled={loading || !selectedPeriodId || isSelectedPeriodLocked}
                      style={{
                        ...styles.primaryButton,
                        ...((loading || !selectedPeriodId || isSelectedPeriodLocked) ? styles.disabledButton : {}),
                      }}
                    >
                      履歴からプレビュー生成
                    </button>
                  </div>
                </>
              )}
            </section>
          </aside>

          <main style={styles.main}>
            <section style={styles.summaryGrid}>
              <SummaryCard label="選択期間" value={selectedPeriod ? getPeriodTypeLabel(selectedPeriod.half_type) : '-'} sub={selectedPeriod ? `${formatDate(selectedPeriod.period_start)} ～ ${formatDate(selectedPeriod.period_end)}` : '給与期間を選択してください'} />
              <SummaryCard label="状態" value={selectedPeriod ? getPeriodStatusLabel(selectedPeriod.status) : '-'} sub={isSelectedPeriodLocked ? '支払い確認済み・編集不可' : '編集中・保存可能'} />
              <SummaryCard label="総支給額" value={formatMoney(totalCalculatedPayAmount)} sub={`総出勤数 ${totalAttendanceCount}`} />
              <SummaryCard label="振込額合計" value={formatMoney(totalTransferAmount)} sub={`調整額 ${formatMoney(totalAdjustmentAmount)}`} />
            </section>

            <section style={isSelectedPeriodLocked ? styles.lockPanel : styles.panel}>
              <div style={styles.mainSectionHeader}>
                <div>
                  <h2 style={styles.mainTitle}>給与期間の確定</h2>
                  <p style={styles.mainDescription}>
                    支払い内容を確認後、給与期間を確定すると再生成・調整・金庫保存を防止できます。
                  </p>
                </div>
              </div>

              <div style={styles.lockActionGrid}>
                <div>
                  <div style={isSelectedPeriodLocked ? styles.lockStatusBadge : styles.openStatusBadge}>
                    {isSelectedPeriodLocked ? '確定済み' : '編集中'}
                  </div>
                  <p style={styles.lockDescription}>
                    {isSelectedPeriodLocked
                      ? 'この給与期間は確定済みです。修正が必要な場合のみロック解除してください。'
                      : canLockSelectedPeriod
                      ? 'この給与期間は確定できます。支払い確認後に確定してください。'
                      : lockBlockedReason}
                  </p>
                </div>

                <div style={styles.lockButtonGroup}>
                  {isSelectedPeriodLocked ? (
                    <button
                      type="button"
                      onClick={unlockSelectedPayrollPeriod}
                      disabled={loading || !selectedPeriodId}
                      style={styles.dangerButton}
                    >
                      ロック解除
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={lockSelectedPayrollPeriod}
                      disabled={loading || !canLockSelectedPeriod}
                      style={{
                        ...styles.primaryButton,
                        ...((loading || !canLockSelectedPeriod) ? styles.disabledButton : {}),
                      }}
                    >
                      給与期間を確定
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHeader}>
                <div>
                  <h2 style={styles.mainTitle}>給与プレビュー</h2>
                  <p style={styles.mainDescription}>
                    Discordまたは管理画面の出勤履歴とスタンプ履歴から、支給額を確認します。
                  </p>
                </div>
              </div>

              {runItems.length === 0 ? (
                <div style={styles.emptyBox}>
                  給与プレビューはまだありません。
                  <br />
                  左側で給与期間と単価ルールを選択し、「履歴からプレビュー生成」を押してください。
                </div>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>従業員コード</th>
                        <th style={styles.th}>氏名</th>
                        <th style={styles.th}>出勤数</th>
                        <th style={styles.th}>締め日時点スタンプ数</th>
                        <th style={styles.th}>適用単価</th>
                        <th style={styles.th}>計算支給額</th>
                        <th style={styles.th}>調整額</th>
                        <th style={styles.th}>振込額</th>
                        <th style={styles.th}>個別備考</th>
                        <th style={styles.th}>保存</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runItems.map((item) => {
                        const edit = itemEdits[item.payroll_run_item_id] || {
                          adjustmentAmount: String(item.adjustment_amount ?? 0),
                          note: item.note || '',
                        }

                        const rowLocked = isSelectedPeriodLocked || item.is_locked

                        return (
                          <tr key={item.payroll_run_item_id}>
                            <td style={styles.tdStrong}>{item.staff_code}</td>
                            <td style={styles.td}>{item.display_name}</td>
                            <td style={styles.tdCenter}>{item.attendance_count}</td>
                            <td style={styles.tdCenter}>{item.stamp_count_at_close}</td>
                            <td style={styles.td}>{formatMoney(item.applied_unit_pay)}</td>
                            <td style={styles.tdStrong}>{formatMoney(item.calculated_pay_amount)}</td>
                            <td style={styles.td}>
                              <input
                                type="text"
                                value={edit.adjustmentAmount}
                                disabled={rowLocked}
                                onChange={(e) => {
                                  const value = e.target.value
                                    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
                                    .replace(/,/g, '')
                                    .replace(/[^\d-]/g, '')
                                  updateItemEdit(item.payroll_run_item_id, 'adjustmentAmount', value)
                                }}
                                style={{
                                  ...styles.smallInput,
                                  ...(rowLocked ? styles.disabledInput : {}),
                                }}
                              />
                            </td>
                            <td style={styles.tdStrong}>{formatMoney(item.transfer_amount)}</td>
                            <td style={styles.td}>
                              <input
                                type="text"
                                value={edit.note}
                                disabled={rowLocked}
                                onChange={(e) => updateItemEdit(item.payroll_run_item_id, 'note', e.target.value)}
                                style={{
                                  ...styles.noteInput,
                                  ...(rowLocked ? styles.disabledInput : {}),
                                }}
                                placeholder="個別メモ"
                              />
                            </td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                onClick={() => saveRunItemAdjustment(item)}
                                disabled={loading || rowLocked}
                                style={{
                                  ...styles.miniButton,
                                  ...((loading || rowLocked) ? styles.disabledButton : {}),
                                }}
                              >
                                {rowLocked ? '確定済' : '保存'}
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

            <div style={styles.bottomGrid}>
              <section style={styles.panel}>
                <div style={styles.mainSectionHeader}>
                  <div>
                    <h2 style={styles.mainTitle}>金庫・牧場・備考</h2>
                    <p style={styles.mainDescription}>
                      前回支払い後の金庫額、今回支払い前の金庫額、牧場利益、イベント等のメモを保存します。
                    </p>
                  </div>
                </div>

                <div style={styles.formGridTwo}>
                  <label>
                    <div style={styles.inputLabel}>前回支払い後金庫額</div>
                    <input
                      type="text"
                      value={formatMoney(previousVaultAfterAmount)}
                      readOnly
                      style={styles.readOnlyInput}
                    />
                    <p style={styles.autoNote}>{previousVaultSourceText}</p>
                  </label>

                  <label>
                    <div style={styles.inputLabel}>牧場利益</div>
                    <input
                      type="text"
                      value={ranchProfitAmount}
                      onChange={handleAmountChange(setRanchProfitAmount)}
                      disabled={isSelectedPeriodLocked}
                      style={{
                        ...styles.input,
                        ...(isSelectedPeriodLocked ? styles.disabledInput : {}),
                      }}
                    />
                  </label>

                  <label>
                    <div style={styles.inputLabel}>今回の支払い前金庫額</div>
                    <input
                      type="text"
                      value={vaultBeforeAmount}
                      onChange={handleAmountChange(setVaultBeforeAmount)}
                      disabled={isSelectedPeriodLocked}
                      style={{
                        ...styles.input,
                        ...(isSelectedPeriodLocked ? styles.disabledInput : {}),
                      }}
                    />
                  </label>

                  <label>
                    <div style={styles.inputLabel}>その他収入</div>
                    <input
                      type="text"
                      value={extraIncomeAmount}
                      onChange={handleAmountChange(setExtraIncomeAmount)}
                      disabled={isSelectedPeriodLocked}
                      style={{
                        ...styles.input,
                        ...(isSelectedPeriodLocked ? styles.disabledInput : {}),
                      }}
                    />
                  </label>
                </div>

                <div style={styles.calcNoteBox}>
                  営業利益 = 今回の支払い前金庫額 - 前回支払い後金庫額 + その他収入
                  <br />
                  経常利益 = 営業利益 + 牧場利益
                </div>

                <label style={{ display: 'block', marginTop: '14px' }}>
                  <div style={styles.inputLabel}>備考</div>
                  <textarea
                    value={periodMemo}
                    onChange={(e) => setPeriodMemo(e.target.value)}
                    disabled={isSelectedPeriodLocked}
                    style={{
                      ...styles.textarea,
                      ...(isSelectedPeriodLocked ? styles.disabledInput : {}),
                    }}
                    placeholder="イベント、特記事項、支払いメモなど"
                  />
                </label>

                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={savePayrollInputs}
                    disabled={loading || !selectedPeriodId || isSelectedPeriodLocked}
                    style={{
                      ...styles.primaryButton,
                      ...((loading || !selectedPeriodId || isSelectedPeriodLocked) ? styles.disabledButton : {}),
                    }}
                  >
                    {isSelectedPeriodLocked ? '確定済み' : '入力内容を保存'}
                  </button>
                </div>
              </section>

              <section style={styles.panel}>
                <div style={styles.mainSectionHeader}>
                  <div>
                    <h2 style={styles.mainTitle}>給与期間集計</h2>
                    <p style={styles.mainDescription}>
                      保存済みの金庫・牧場情報と給与額から自動計算します。
                    </p>
                  </div>
                </div>

                {periodSummary ? (
                  <div style={styles.summaryList}>
                    <SummaryLine label="総支払額" value={formatMoney(periodSummary.total_pay_amount)} />
                    <SummaryLine label="振込額合計" value={formatMoney(periodSummary.total_transfer_amount)} />
                    <SummaryLine label="牧場利益" value={formatMoney(periodSummary.ranch_profit_amount)} />
                    <SummaryLine label="今回の支払い前金庫額" value={formatMoney(periodSummary.vault_before_amount)} />
                    <SummaryLine label="金庫 + 牧場" value={formatMoney(periodSummary.vault_plus_ranch_amount)} />
                    <SummaryLine label="支払い後金額" value={formatMoney(periodSummary.vault_after_amount)} />
                    <SummaryLine label="営業利益" value={formatMoney(periodSummary.store_profit_amount)} />
                    <SummaryLine label="経常利益" value={formatMoney(periodSummary.total_profit_amount)} />
                  </div>
                ) : (
                  <div style={styles.emptyMini}>
                    金庫・牧場・備考を保存すると、ここに集計結果が表示されます。
                  </div>
                )}
              </section>
            </div>
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
  green2: '#6f9272',
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
    maxWidth: '1760px',
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
  dashboard: {
    display: 'grid',
    gridTemplateColumns: '360px minmax(0, 1fr)',
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
  lockPanel: {
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  sectionHeader: {
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
  mainSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '16px',
  },
  mainTitle: {
    fontSize: '24px',
    fontWeight: 900,
    color: theme.deep,
    margin: 0,
  },
  mainDescription: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoLabel: {
    fontSize: '12px',
    fontWeight: 900,
    color: theme.muted,
    marginBottom: '4px',
  },
  infoValue: {
    fontSize: '18px',
    fontWeight: 900,
    color: theme.text,
  },
  note: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: 0,
  },
  formGridTwo: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
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
  disabledInput: {
    background: theme.panel2,
    color: theme.muted,
    cursor: 'not-allowed',
  },
  readOnlyInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 13px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border}`,
    background: theme.pale,
    color: theme.deep,
    outline: 'none',
    fontWeight: 900,
  },
  autoNote: {
    margin: '7px 0 0',
    fontSize: '12px',
    color: theme.muted,
    lineHeight: 1.5,
    fontWeight: 800,
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
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 13px',
    fontSize: '15px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical',
    lineHeight: 1.7,
  },
  actionStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '14px',
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
    width: '100%',
    justifyContent: 'center',
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
  dangerButton: {
    width: '100%',
    justifyContent: 'center',
    padding: '13px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.62,
    cursor: 'not-allowed',
  },
  periodList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  periodCard: {
    textAlign: 'left',
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    background: theme.white,
    padding: '14px',
    cursor: 'pointer',
  },
  periodCardActive: {
    border: `2px solid ${theme.green}`,
    background: theme.pale,
  },
  periodCardLocked: {
    background: theme.panel2,
  },
  periodTitleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '6px',
  },
  periodTitle: {
    fontSize: '18px',
    fontWeight: 900,
    color: theme.deep,
  },
  periodMeta: {
    fontSize: '13px',
    color: theme.muted,
    lineHeight: 1.6,
  },
  openBadge: {
    padding: '4px 8px',
    borderRadius: '999px',
    background: theme.white,
    border: `1px solid ${theme.border2}`,
    color: theme.deep,
    fontSize: '11px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  lockedBadge: {
    padding: '4px 8px',
    borderRadius: '999px',
    background: theme.green,
    color: theme.white,
    fontSize: '11px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  ruleBox: {
    marginTop: '12px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  ruleName: {
    fontSize: '16px',
    fontWeight: 900,
    color: theme.deep,
    lineHeight: 1.5,
  },
  ruleDate: {
    fontSize: '12px',
    color: theme.muted,
    marginTop: '6px',
    lineHeight: 1.6,
  },
  ruleList: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
  },
  ruleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 0',
    borderTop: `1px solid ${theme.border}`,
    fontSize: '14px',
    color: theme.text,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
  lockActionGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 220px',
    gap: '16px',
    alignItems: 'center',
  },
  lockStatusBadge: {
    display: 'inline-flex',
    padding: '6px 11px',
    borderRadius: '999px',
    background: theme.green,
    color: theme.white,
    fontSize: '13px',
    fontWeight: 950,
    marginBottom: '8px',
  },
  openStatusBadge: {
    display: 'inline-flex',
    padding: '6px 11px',
    borderRadius: '999px',
    background: theme.white,
    color: theme.deep,
    border: `1px solid ${theme.border2}`,
    fontSize: '13px',
    fontWeight: 950,
    marginBottom: '8px',
  },
  lockDescription: {
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: 0,
  },
  lockButtonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
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
  emptyMini: {
    background: theme.white,
    border: `1px dashed ${theme.border2}`,
    borderRadius: '14px',
    padding: '24px',
    color: theme.muted,
    fontSize: '15px',
    lineHeight: 1.7,
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
    minWidth: '1250px',
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
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
  },
  tdStrong: {
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 900,
  },
  tdCenter: {
    padding: '13px 14px',
    borderBottom: `1px solid ${theme.border}`,
    whiteSpace: 'nowrap',
    fontSize: '14px',
    color: theme.text,
    textAlign: 'center',
  },
  smallInput: {
    width: '110px',
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
  miniButton: {
    padding: '9px 12px',
    fontSize: '13px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    gap: '18px',
    alignItems: 'start',
  },
  calcNoteBox: {
    marginTop: '14px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '12px 14px',
    color: theme.muted,
    fontSize: '13px',
    fontWeight: 800,
    lineHeight: 1.8,
  },
  summaryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
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
  loadingText: {
    fontSize: '18px',
    margin: 0,
    color: theme.muted,
  },
}