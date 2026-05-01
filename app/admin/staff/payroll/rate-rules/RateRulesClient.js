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

      if (error) throw error

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

  const deleteRuleSet = async (ruleSet) => {
    if (!ruleSet?.payroll_rate_rule_set_id) return

    const ok = window.confirm(
      `単価ルール「${ruleSet.rule_name}」を削除しますか？\n\n` +
        '給与期間で使用済みのルールは削除できません。\n' +
        '今後使わないだけの場合は、編集で「有効にする」のチェックを外してください。'
    )

    if (!ok) return

    setLoading(true)
    setMessage('単価ルールを削除中です...')

    try {
      const { data, error } = await supabase.rpc('delete_payroll_rate_rule_set_basic', {
        p_payroll_rate_rule_set_id: Number(ruleSet.payroll_rate_rule_set_id),
      })

      if (error) throw error

      if (String(editingRuleSetId) === String(ruleSet.payroll_rate_rule_set_id)) {
        resetForm()
      }

      await fetchRateRuleSets(store.store_id)

      const result = Array.isArray(data) && data.length > 0 ? data[0] : null
      const deletedRuleCount = result?.deleted_rule_count ?? 0

      setMessage(`単価ルールを削除しました（明細 ${deletedRuleCount} 件）`)
    } catch (error) {
      console.error(error)
      setMessage(`単価ルールの削除に失敗しました: ${error.message}`)
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
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🦌</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>単価ルール管理</p>
              <p style={styles.storeText}>
                {store ? `${store.store_name} (${store.store_code})` : '店舗情報未取得'}
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

        <section style={styles.summaryGrid}>
          <SummaryCard
            label="登録ルール数"
            value={ruleSets.length}
            sub="この店舗に登録済みの単価ルール"
          />

          <SummaryCard
            label="有効ルール"
            value={ruleSets.filter((ruleSet) => ruleSet.is_active).length}
            sub="給与計算で選択できるルール"
          />

          <SummaryCard
            label="編集中"
            value={editingRuleSet ? editingRuleSet.rule_name : '新規作成'}
            sub={editingRuleSet ? `ID: ${editingRuleSet.payroll_rate_rule_set_id}` : '新しい単価ルールを作成中'}
          />
        </section>

        <div style={styles.layout}>
          <aside style={styles.editorPanel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>
                  {editingRuleSetId ? '単価ルール編集' : '単価ルール新規作成'}
                </h2>
                <p style={styles.sectionDescription}>
                  スタンプ数に応じた給与単価を3段階で設定します。
                </p>
              </div>
            </div>

            {editingRuleSet && (
              <div style={styles.editingBox}>
                編集中: {editingRuleSet.rule_name}
              </div>
            )}

            <div style={styles.formStack}>
              <label>
                <div style={styles.inputLabel}>ルール名</div>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  style={styles.input}
                  placeholder="例：Bistro-Bambi 4月後半ルール"
                />
              </label>

              <div style={styles.formGridTwo}>
                <label>
                  <div style={styles.inputLabel}>適用開始日</div>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    style={styles.input}
                  />
                </label>

                <label>
                  <div style={styles.inputLabel}>適用終了日</div>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={styles.checkbox}
                />
                有効にする
              </label>

              <div style={styles.rateBox}>
                <div style={styles.rateTitle}>スタンプ数別単価</div>

                <div style={styles.formStack}>
                  <label>
                    <div style={styles.inputLabel}>0〜5個</div>
                    <input
                      type="text"
                      value={unitPay05}
                      onChange={handleAmountChange(setUnitPay05)}
                      style={styles.input}
                    />
                  </label>

                  <label>
                    <div style={styles.inputLabel}>6〜10個</div>
                    <input
                      type="text"
                      value={unitPay610}
                      onChange={handleAmountChange(setUnitPay610)}
                      style={styles.input}
                    />
                  </label>

                  <label>
                    <div style={styles.inputLabel}>11個以上</div>
                    <input
                      type="text"
                      value={unitPay11Plus}
                      onChange={handleAmountChange(setUnitPay11Plus)}
                      style={styles.input}
                    />
                  </label>
                </div>
              </div>

              <label>
                <div style={styles.inputLabel}>メモ</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={styles.textarea}
                  placeholder="売上に応じたルール、イベント時用など"
                />
              </label>

              <div style={styles.actionRow}>
                <button
                  type="button"
                  onClick={saveRuleSet}
                  disabled={loading}
                  style={styles.primaryButton}
                >
                  {loading ? '保存中...' : editingRuleSetId ? '変更を保存' : '新規作成'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={loading}
                  style={styles.secondaryButton}
                >
                  新規入力に戻す
                </button>
              </div>
            </div>
          </aside>

          <main style={styles.listPanel}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>単価ルール一覧</h2>
                <p style={styles.sectionDescription}>
                  給与期間ごとに選択できるルールです。売上や運用状況に応じて切り替えます。
                </p>
              </div>
            </div>

            {ruleSets.length === 0 ? (
              <div style={styles.emptyBox}>
                単価ルールがまだありません。
              </div>
            ) : (
              <div style={styles.ruleSetGrid}>
                {ruleSets.map((ruleSet) => (
                  <div
                    key={ruleSet.payroll_rate_rule_set_id}
                    style={{
                      ...styles.ruleSetCard,
                      ...(editingRuleSetId === ruleSet.payroll_rate_rule_set_id
                        ? styles.ruleSetCardActive
                        : {}),
                    }}
                  >
                    <div style={styles.ruleSetTop}>
                      <div>
                        <div style={styles.ruleSetName}>{ruleSet.rule_name}</div>

                        <div style={styles.ruleSetMeta}>
                          ID: {ruleSet.payroll_rate_rule_set_id}
                          <br />
                          適用開始: {formatDate(ruleSet.effective_from)}
                          {ruleSet.effective_to
                            ? ` / 適用終了: ${formatDate(ruleSet.effective_to)}`
                            : ' / 適用終了: なし'}
                        </div>
                      </div>

                      <div style={ruleSet.is_active ? styles.activeBadge : styles.inactiveBadge}>
                        {ruleSet.is_active ? '有効' : '無効'}
                      </div>
                    </div>

                    {ruleSet.note && (
                      <div style={styles.noteBox}>
                        {ruleSet.note}
                      </div>
                    )}

                    <div style={styles.ruleRows}>
                      {ruleSet.rules.map((rule) => (
                        <div
                          key={rule.payroll_rate_rule_id}
                          style={styles.ruleRow}
                        >
                          <span>{formatRuleRange(rule)}</span>
                          <strong>{formatMoney(rule.unit_pay)}</strong>
                        </div>
                      ))}
                    </div>

                    <div style={styles.cardFooter}>
                      <button
                        type="button"
                        onClick={() => startEdit(ruleSet)}
                        disabled={loading}
                        style={styles.editButton}
                      >
                        編集
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteRuleSet(ruleSet)}
                        disabled={loading}
                        style={styles.deleteButton}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
    maxWidth: '1720px',
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
  storeText: {
    margin: '6px 0 0',
    fontSize: '13px',
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
  layout: {
    display: 'grid',
    gridTemplateColumns: '420px minmax(0, 1fr)',
    gap: '20px',
    alignItems: 'start',
  },
  editorPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    position: 'sticky',
    top: '18px',
  },
  listPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
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
  editingBox: {
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    borderRadius: '14px',
    padding: '12px 14px',
    color: theme.deep,
    fontSize: '14px',
    fontWeight: 900,
    marginBottom: '16px',
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
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
  checkboxLabel: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    fontSize: '15px',
    fontWeight: 900,
    color: theme.deep,
  },
  checkbox: {
    width: '18px',
    height: '18px',
  },
  rateBox: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '16px',
  },
  rateTitle: {
    fontSize: '18px',
    fontWeight: 900,
    color: theme.deep,
    marginBottom: '12px',
  },
  actionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '2px',
  },
  primaryButton: {
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
  ruleSetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  ruleSetCard: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 8px 20px rgba(47, 74, 52, 0.05)',
  },
  ruleSetCardActive: {
    border: `2px solid ${theme.green}`,
    background: theme.pale2,
  },
  ruleSetTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  ruleSetName: {
    fontSize: '19px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1.45,
  },
  ruleSetMeta: {
    fontSize: '12px',
    color: theme.muted,
    marginTop: '8px',
    lineHeight: 1.6,
  },
  activeBadge: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.green,
    color: theme.white,
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  inactiveBadge: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.panel2,
    color: theme.muted,
    border: `1px solid ${theme.border}`,
    fontSize: '12px',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  noteBox: {
    marginTop: '10px',
    fontSize: '13px',
    color: theme.muted,
    background: theme.panel2,
    border: `1px solid ${theme.border}`,
    borderRadius: '12px',
    padding: '10px 12px',
    lineHeight: 1.6,
  },
  ruleRows: {
    marginTop: '12px',
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    overflow: 'hidden',
  },
  ruleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 13px',
    borderBottom: `1px solid ${theme.border}`,
    fontSize: '15px',
    color: theme.text,
    background: theme.white,
  },
  cardFooter: {
    marginTop: '14px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    flexWrap: 'wrap',
  },
  editButton: {
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '10px 14px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
  },
  loadingText: {
    fontSize: '18px',
    margin: 0,
    color: theme.muted,
  },
}