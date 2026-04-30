'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RateRulesClient() {
  const today = new Date().toISOString().slice(0, 10)

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [store, setStore] = useState(null)
  const [ruleSets, setRuleSets] = useState([])

  const [editingRuleSetId, setEditingRuleSetId] = useState(null)
  const [ruleName, setRuleName] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [effectiveTo, setEffectiveTo] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [note, setNote] = useState('')
  const [unitPay05, setUnitPay05] = useState('3000000')
  const [unitPay610, setUnitPay610] = useState('6000000')
  const [unitPay11Plus, setUnitPay11Plus] = useState('10000000')

  const editingRuleSet = useMemo(() => {
    if (!editingRuleSetId) return null
    return ruleSets.find(
      (ruleSet) =>
        String(ruleSet.payroll_rate_rule_set_id) === String(editingRuleSetId)
    )
  }, [editingRuleSetId, ruleSets])

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
    setInitialLoading(true)
    setMessage('')

    try {
      const currentStore = await fetchCurrentStore()
      setStore(currentStore)
      await fetchRateRuleSets(currentStore.store_id)
      resetForm()
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

  const fetchRateRuleSets = async (storeId = store?.store_id) => {
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
        note,
        created_at,
        updated_at
      `)
      .eq('store_id', storeId)
      .order('is_active', { ascending: false })
      .order('effective_from', { ascending: false })
      .order('payroll_rate_rule_set_id', { ascending: false })

    if (ruleSetError) {
      console.error(ruleSetError)
      setMessage(`単価ルールセットの取得に失敗しました: ${ruleSetError.message}`)
      return []
    }

    const ruleSetsOnly = ruleSetRows || []
    const ruleSetIds = ruleSetsOnly.map((ruleSet) => ruleSet.payroll_rate_rule_set_id)

    let ruleRows = []

    if (ruleSetIds.length > 0) {
      const { data: rulesData, error: rulesError } = await supabase
        .from('payroll_rate_rules')
        .select(`
          payroll_rate_rule_id,
          payroll_rate_rule_set_id,
          min_stamp_count,
          max_stamp_count,
          unit_pay,
          created_at
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

    const merged = ruleSetsOnly.map((ruleSet) => ({
      ...ruleSet,
      rules: rulesBySetId[String(ruleSet.payroll_rate_rule_set_id)] || [],
    }))

    setRuleSets(merged)
    return merged
  }

  const resetForm = () => {
    setEditingRuleSetId(null)
    setRuleName('Bistro-Bambi 給与ルール')
    setEffectiveFrom(today)
    setEffectiveTo('')
    setIsActive(true)
    setNote('')
    setUnitPay05('3000000')
    setUnitPay610('6000000')
    setUnitPay11Plus('10000000')
  }

  const getRuleByRange = (ruleSet, min, max) => {
    return ruleSet?.rules?.find((rule) => {
      const sameMin = Number(rule.min_stamp_count) === Number(min)

      if (max === null) {
        return sameMin && (rule.max_stamp_count === null || rule.max_stamp_count === undefined)
      }

      return sameMin && Number(rule.max_stamp_count) === Number(max)
    })
  }

  const startEdit = (ruleSet) => {
    const rule05 = getRuleByRange(ruleSet, 0, 5)
    const rule610 = getRuleByRange(ruleSet, 6, 10)
    const rule11Plus = getRuleByRange(ruleSet, 11, null)

    setEditingRuleSetId(ruleSet.payroll_rate_rule_set_id)
    setRuleName(ruleSet.rule_name || '')
    setEffectiveFrom(formatDate(ruleSet.effective_from))
    setEffectiveTo(ruleSet.effective_to ? formatDate(ruleSet.effective_to) : '')
    setIsActive(Boolean(ruleSet.is_active))
    setNote(ruleSet.note || '')
    setUnitPay05(String(rule05?.unit_pay ?? 3000000))
    setUnitPay610(String(rule610?.unit_pay ?? 6000000))
    setUnitPay11Plus(String(rule11Plus?.unit_pay ?? 10000000))
    setMessage(`${ruleSet.rule_name} を編集中です`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const saveRuleSet = async () => {
    if (!store?.store_id) {
      setMessage('店舗情報が取得できていません')
      return
    }

    setLoading(true)
    setMessage('単価ルールを保存中です...')

    try {
      const trimmedName = ruleName.trim()

      if (!trimmedName) {
        throw new Error('ルール名を入力してください')
      }

      if (!effectiveFrom) {
        throw new Error('適用開始日を入力してください')
      }

      const { error } = await supabase.rpc('save_payroll_rate_rule_set_basic', {
        p_payroll_rate_rule_set_id: editingRuleSetId
          ? Number(editingRuleSetId)
          : null,
        p_store_id: Number(store.store_id),
        p_rule_name: trimmedName,
        p_effective_from: effectiveFrom,
        p_effective_to: effectiveTo ? effectiveTo : null,
        p_is_active: Boolean(isActive),
        p_note: note.trim() === '' ? null : note.trim(),
        p_unit_pay_0_5: toAmountNumber(unitPay05),
        p_unit_pay_6_10: toAmountNumber(unitPay610),
        p_unit_pay_11_plus: toAmountNumber(unitPay11Plus),
      })

      if (error) {
        throw error
      }

      await fetchRateRuleSets(store.store_id)
      resetForm()
      setMessage('単価ルールを保存しました')
    } catch (error) {
      console.error(error)
      setMessage(`単価ルールの保存に失敗しました: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  const formatDate = (value) => {
    if (!value) return ''
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
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const textareaStyle = {
    ...inputStyle,
    minHeight: '100px',
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
    justifyContent: 'center',
    opacity: loading ? 0.7 : 1,
  }

  const inputLabelStyle = {
    fontSize: '16px',
    color: '#9a6b5b',
    fontWeight: 700,
    marginBottom: '8px',
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
              単価ルール管理
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '0.95fr 1.45fr',
            gap: '28px',
            alignItems: 'start',
          }}
        >
          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>
              {editingRuleSetId ? '単価ルール編集' : '単価ルール新規作成'}
            </div>

            {editingRuleSet && (
              <p
                style={{
                  fontSize: '18px',
                  color: '#8a6457',
                  marginTop: 0,
                  marginBottom: '18px',
                  lineHeight: 1.7,
                }}
              >
                編集中: {editingRuleSet.rule_name}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label>
                <div style={inputLabelStyle}>ルール名</div>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  style={inputStyle}
                  placeholder="例：Bistro-Bambi 4月後半ルール"
                />
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}
              >
                <label>
                  <div style={inputLabelStyle}>適用開始日</div>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    style={inputStyle}
                  />
                </label>

                <label>
                  <div style={inputLabelStyle}>適用終了日</div>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    style={inputStyle}
                  />
                </label>
              </div>

              <label
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#7a4b3a',
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: '20px', height: '20px' }}
                />
                有効にする
              </label>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #f0d9d2',
                  borderRadius: '18px',
                  padding: '18px',
                }}
              >
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: '#7a4b3a',
                    marginBottom: '14px',
                  }}
                >
                  スタンプ数別単価
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label>
                    <div style={inputLabelStyle}>0〜5個</div>
                    <input
                      type="text"
                      value={unitPay05}
                      onChange={handleAmountChange(setUnitPay05)}
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={inputLabelStyle}>6〜10個</div>
                    <input
                      type="text"
                      value={unitPay610}
                      onChange={handleAmountChange(setUnitPay610)}
                      style={inputStyle}
                    />
                  </label>

                  <label>
                    <div style={inputLabelStyle}>11個以上</div>
                    <input
                      type="text"
                      value={unitPay11Plus}
                      onChange={handleAmountChange(setUnitPay11Plus)}
                      style={inputStyle}
                    />
                  </label>
                </div>
              </div>

              <label>
                <div style={inputLabelStyle}>メモ</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={textareaStyle}
                  placeholder="売上に応じたルール、イベント時用など"
                />
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap',
                  marginTop: '4px',
                }}
              >
                <button
                  type="button"
                  onClick={saveRuleSet}
                  disabled={loading}
                  style={primaryButtonStyle}
                >
                  {loading ? '保存中...' : editingRuleSetId ? '変更を保存' : '新規作成'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  style={subButtonStyle}
                >
                  新規入力に戻す
                </button>
              </div>
            </div>
          </div>

          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>単価ルール一覧</div>

            {ruleSets.length === 0 ? (
              <p
                style={{
                  fontSize: '22px',
                  color: '#9a6b5b',
                  margin: 0,
                  lineHeight: 1.8,
                }}
              >
                単価ルールがまだありません。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {ruleSets.map((ruleSet) => (
                  <div
                    key={ruleSet.payroll_rate_rule_set_id}
                    style={{
                      background: '#fff',
                      border: editingRuleSetId === ruleSet.payroll_rate_rule_set_id
                        ? '2px solid #d98b7b'
                        : '1px solid #f0d9d2',
                      borderRadius: '18px',
                      padding: '18px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '24px',
                            fontWeight: 900,
                            color: '#7a4b3a',
                            marginBottom: '8px',
                          }}
                        >
                          {ruleSet.rule_name}
                        </div>

                        <div
                          style={{
                            fontSize: '16px',
                            color: '#8a6457',
                            lineHeight: 1.7,
                          }}
                        >
                          ID: {ruleSet.payroll_rate_rule_set_id}
                          <br />
                          適用開始: {formatDate(ruleSet.effective_from)}
                          {ruleSet.effective_to
                            ? ` / 適用終了: ${formatDate(ruleSet.effective_to)}`
                            : ' / 適用終了: なし'}
                          <br />
                          状態: {ruleSet.is_active ? '有効' : '無効'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(ruleSet)}
                        disabled={loading}
                        style={subButtonStyle}
                      >
                        編集
                      </button>
                    </div>

                    {ruleSet.note && (
                      <div
                        style={{
                          marginTop: '12px',
                          fontSize: '16px',
                          color: '#8a6457',
                          background: '#fffaf8',
                          border: '1px solid #f4ded7',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          lineHeight: 1.6,
                        }}
                      >
                        {ruleSet.note}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: '14px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '10px',
                      }}
                    >
                      {ruleSet.rules.map((rule) => (
                        <div
                          key={rule.payroll_rate_rule_id}
                          style={{
                            background: '#fffaf8',
                            border: '1px solid #f2ddd5',
                            borderRadius: '14px',
                            padding: '12px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '15px',
                              color: '#9a6b5b',
                              marginBottom: '6px',
                              fontWeight: 700,
                            }}
                          >
                            {formatRuleRange(rule)}
                          </div>
                          <div
                            style={{
                              fontSize: '22px',
                              color: '#7a4b3a',
                              fontWeight: 900,
                            }}
                          >
                            {formatMoney(rule.unit_pay)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}