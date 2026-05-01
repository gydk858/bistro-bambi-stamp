'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StaffManageClient() {
  const now = new Date()

  const [targetYear, setTargetYear] = useState(now.getFullYear())
  const [targetMonth, setTargetMonth] = useState(now.getMonth() + 1)

  const [message, setMessage] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const [checkLoading, setCheckLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState(null)

  const fetchResetStatus = async (
    year = targetYear,
    month = targetMonth,
    options = { showMessage: false }
  ) => {
    setCheckLoading(true)

    if (options.showMessage) {
      setMessage('リセット前チェックを実行中です...')
    }

    try {
      const { data, error } = await supabase.rpc('check_staff_monthly_reset_status', {
        p_target_year: Number(year),
        p_target_month: Number(month),
      })

      if (error) throw error

      const status = Array.isArray(data) && data.length > 0 ? data[0] : null
      setResetStatus(status)

      if (options.showMessage) {
        setMessage(status ? 'リセット前チェックを更新しました' : '確認結果を取得できませんでした')
      }

      return status
    } catch (error) {
      console.error(error)
      setResetStatus(null)
      setMessage(
        error instanceof Error
          ? `リセット前チェックに失敗しました: ${error.message}`
          : 'リセット前チェックに失敗しました'
      )
      return null
    } finally {
      setCheckLoading(false)
    }
  }

  useEffect(() => {
    fetchResetStatus(targetYear, targetMonth)
  }, [])

  const handleYearChange = (value) => {
    setTargetYear(value)
    if (value && targetMonth) {
      fetchResetStatus(value, targetMonth)
    }
  }

  const handleMonthChange = (value) => {
    setTargetMonth(value)
    if (targetYear && value) {
      fetchResetStatus(targetYear, value)
    }
  }

  const resetAllStaffCards = async () => {
    if (isResetting) return

    const latestStatus = await fetchResetStatus(targetYear, targetMonth)

    if (!latestStatus) {
      setMessage('リセット前チェックを取得できないため、リセットを中止しました')
      return
    }

    const warnings = latestStatus.warning_messages || []

    if (!latestStatus.can_reset) {
      const okDespiteWarnings = window.confirm(
        [
          'リセット前チェックで未完了項目があります。',
          '',
          ...warnings.map((warning) => `・${warning}`),
          '',
          'このままリセットすると、給与確認前のデータを見落とす可能性があります。',
          'それでもリセットしますか？',
        ].join('\n')
      )

      if (!okDespiteWarnings) return
    }

    const finalOk = window.confirm(
      [
        '本当に全従業員カードの出勤数を 0 に戻しますか？',
        '',
        `対象: ${latestStatus.target_year}年${latestStatus.target_month}月`,
        `店舗: ${latestStatus.store_name}`,
        `従業員カード: ${latestStatus.staff_card_count}件`,
        `現在スタンプ合計: ${latestStatus.current_stamp_total}`,
        '',
        'この操作でカード上の現在スタンプ数は0になります。',
        '出勤履歴・給与明細・給与集計は削除されません。',
      ].join('\n')
    )

    if (!finalOk) return

    setMessage('')
    setIsResetting(true)

    try {
      const { data: activeCards, error: fetchError } = await supabase
        .from('v_staff_stamp_cards_current')
        .select('card_id, staff_code')
        .eq('program_code', 'stamp_staff_attendance')
        .eq('card_status', 'active')

      if (fetchError) {
        throw new Error(`従業員カード一覧の取得に失敗しました: ${fetchError.message}`)
      }

      if (!activeCards || activeCards.length === 0) {
        setMessage('リセット対象の従業員カードはありません')
        return
      }

      let resetCount = 0

      for (const card of activeCards) {
        const { data, error } = await supabase.rpc('reset_stamp_card', {
          p_card_id: card.card_id,
          p_acted_by: 'admin_staff_manage_ui',
          p_reason: '管理画面から全従業員カード一括リセット',
        })

        if (error || !data || data.length === 0) {
          throw new Error(
            `従業員カード ${card.staff_code} のリセットに失敗しました`
          )
        }

        resetCount += 1
      }

      setMessage(`全従業員カードをリセットしました（${resetCount}件）`)
      await fetchResetStatus(targetYear, targetMonth)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '全従業員カードのリセットに失敗しました'
      )
    } finally {
      setIsResetting(false)
    }
  }

  const formatDate = (value) => {
    if (!value) return '-'
    return String(value).slice(0, 10)
  }

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '0'
    return Number(value).toLocaleString()
  }

  const getStatusBadgeStyle = (ok) => {
    return ok ? styles.okBadge : styles.ngBadge
  }

  const getStatusLabel = (ok) => {
    return ok ? 'OK' : '未完了'
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>↺</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>従業員一括管理</p>
              <p style={styles.headerDescription}>
                従業員カードの月末リセット前に、給与プレビュー・金庫情報の保存状況を確認します。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin/staff/card" style={styles.navButton}>
              従業員カード画面
            </a>

            <a href="/admin/staff/payroll" style={styles.navButton}>
              給与管理
            </a>

            <a href="/admin/staff" style={styles.navButton}>
              従業員管理
            </a>

            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>
          </nav>
        </header>

        {message && (
          <div style={styles.messageBoxTop}>
            {message}
          </div>
        )}

        <section style={styles.warningPanel}>
          <div style={styles.warningBadge}>RESET CHECK</div>
          <h2 style={styles.warningTitle}>リセット前チェック</h2>
          <p style={styles.warningText}>
            月末リセット前に、対象月の給与期間・給与プレビュー・金庫情報が保存済みか確認します。
            リセットしても出勤履歴や給与明細は削除されませんが、カード上の現在スタンプ数は0になります。
          </p>
        </section>

        <section style={styles.panel}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>対象年月</h2>
              <p style={styles.description}>
                通常は、今からリセットしたい月を指定してください。
              </p>
            </div>
          </div>

          <div style={styles.formGrid}>
            <label>
              <div style={styles.inputLabel}>年</div>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => handleYearChange(e.target.value)}
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
                onChange={(e) => handleMonthChange(e.target.value)}
                style={styles.input}
              />
            </label>

            <button
              type="button"
              onClick={() => fetchResetStatus(targetYear, targetMonth, { showMessage: true })}
              disabled={checkLoading}
              style={styles.secondaryButton}
            >
              {checkLoading ? '確認中...' : 'チェック更新'}
            </button>
          </div>
        </section>

        {resetStatus ? (
          <>
            <section style={styles.summaryGrid}>
              <SummaryCard
                label="対象店舗"
                value={resetStatus.store_name}
                sub={resetStatus.store_code}
              />

              <SummaryCard
                label="対象期間"
                value={`${resetStatus.target_year}年${resetStatus.target_month}月`}
                sub={`${formatDate(resetStatus.period_start)} ～ ${formatDate(resetStatus.period_end)}`}
              />

              <SummaryCard
                label="従業員カード"
                value={`${formatNumber(resetStatus.staff_card_count)}件`}
                sub={`現在スタンプ合計 ${formatNumber(resetStatus.current_stamp_total)}`}
              />

              <SummaryCard
                label="出勤履歴"
                value={`${formatNumber(resetStatus.attendance_event_count)}件`}
                sub={`出勤数合計 ${formatNumber(resetStatus.attendance_total)}`}
              />
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>給与保存状況</h2>
                  <p style={styles.description}>
                    前半・後半の給与プレビューと金庫情報が保存されているか確認します。
                  </p>
                </div>
              </div>

              <div style={styles.checkGrid}>
                <CheckCard
                  title="前半給与期間"
                  ok={resetStatus.first_period_exists}
                  detail={resetStatus.first_period_exists ? `ID: ${resetStatus.first_period_id}` : '未作成'}
                />

                <CheckCard
                  title="前半給与プレビュー"
                  ok={Number(resetStatus.first_run_item_count || 0) > 0}
                  detail={`${formatNumber(resetStatus.first_run_item_count)}件`}
                />

                <CheckCard
                  title="前半金庫情報"
                  ok={resetStatus.first_summary_exists}
                  detail={resetStatus.first_summary_exists ? '保存済み' : '未保存'}
                />

                <CheckCard
                  title="後半給与期間"
                  ok={resetStatus.second_period_exists}
                  detail={resetStatus.second_period_exists ? `ID: ${resetStatus.second_period_id}` : '未作成'}
                />

                <CheckCard
                  title="後半給与プレビュー"
                  ok={Number(resetStatus.second_run_item_count || 0) > 0}
                  detail={`${formatNumber(resetStatus.second_run_item_count)}件`}
                />

                <CheckCard
                  title="後半金庫情報"
                  ok={resetStatus.second_summary_exists}
                  detail={resetStatus.second_summary_exists ? '保存済み' : '未保存'}
                />
              </div>
            </section>

            <section style={resetStatus.can_reset ? styles.readyPanel : styles.cautionPanel}>
              <div style={resetStatus.can_reset ? styles.readyBadge : styles.cautionBadge}>
                {resetStatus.can_reset ? 'RESET READY' : 'CHECK REQUIRED'}
              </div>

              <h2 style={resetStatus.can_reset ? styles.readyTitle : styles.cautionTitle}>
                {resetStatus.can_reset
                  ? 'リセット可能な状態です'
                  : '未完了の確認項目があります'}
              </h2>

              {resetStatus.can_reset ? (
                <p style={styles.statusText}>
                  給与期間・給与プレビュー・金庫情報が保存済みです。
                  内容を最終確認したうえで、月末リセットを実行してください。
                </p>
              ) : (
                <div>
                  <p style={styles.statusText}>
                    以下の項目を確認してください。
                  </p>

                  <ul style={styles.warningList}>
                    {(resetStatus.warning_messages || []).map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        ) : (
          <section style={styles.panel}>
            <div style={styles.emptyBox}>
              リセット前チェック結果がありません。
              <br />
              「チェック更新」を押してください。
            </div>
          </section>
        )}

        <section style={styles.panel}>
          <div style={styles.iconBox}>0</div>

          <h2 style={styles.sectionTitle}>従業員カード一括リセット</h2>

          <p style={styles.description}>
            すべての従業員カードの出勤数を 0 に戻します。
            Discordでの出勤スタンプ運用を翌月分として再開する前に使用します。
          </p>

          <button
            onClick={resetAllStaffCards}
            disabled={isResetting || checkLoading}
            style={{
              ...styles.primaryButton,
              ...((isResetting || checkLoading) ? styles.disabledButton : {}),
            }}
          >
            {isResetting ? 'リセット中...' : '全従業員カードをリセット'}
          </button>
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

function CheckCard({ title, ok, detail }) {
  return (
    <div style={styles.checkCard}>
      <div style={styles.checkTop}>
        <div style={styles.checkTitle}>{title}</div>
        <div style={ok ? styles.okBadge : styles.ngBadge}>
          {ok ? 'OK' : '未完了'}
        </div>
      </div>
      <div style={styles.checkDetail}>{detail}</div>
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
    maxWidth: '1320px',
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
    fontWeight: 950,
    color: theme.deep,
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
  messageBoxTop: {
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
  warningPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    marginBottom: '18px',
  },
  warningBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    color: theme.deep,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  warningTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  warningText: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '10px 0 0',
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    marginBottom: '18px',
  },
  sectionHeader: {
    marginBottom: '14px',
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    lineHeight: 1.35,
  },
  description: {
    fontSize: '16px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '10px 0 0',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '160px 160px auto',
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
    padding: '13px 14px',
    fontSize: '16px',
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.text,
    outline: 'none',
  },
  secondaryButton: {
    padding: '13px 16px',
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
  primaryButton: {
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 950,
    borderRadius: '13px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  disabledButton: {
    opacity: 0.65,
    cursor: 'default',
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
    fontSize: '22px',
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
  checkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
  },
  checkCard: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '15px',
  },
  checkTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    alignItems: 'flex-start',
    marginBottom: '10px',
  },
  checkTitle: {
    fontSize: '15px',
    fontWeight: 950,
    color: theme.deep,
    lineHeight: 1.5,
  },
  checkDetail: {
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.5,
  },
  okBadge: {
    padding: '5px 9px',
    borderRadius: '999px',
    background: theme.green,
    color: theme.white,
    fontSize: '12px',
    fontWeight: 950,
    whiteSpace: 'nowrap',
  },
  ngBadge: {
    padding: '5px 9px',
    borderRadius: '999px',
    background: theme.dangerPale,
    color: theme.danger,
    border: `1px solid ${theme.border2}`,
    fontSize: '12px',
    fontWeight: 950,
    whiteSpace: 'nowrap',
  },
  readyPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '22px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    marginBottom: '18px',
  },
  cautionPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '22px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    marginBottom: '18px',
  },
  readyBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    color: theme.deep,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  cautionBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.dangerPale,
    border: `1px solid ${theme.border2}`,
    color: theme.danger,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  readyTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  cautionTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.danger,
    margin: 0,
  },
  statusText: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '10px 0 0',
  },
  warningList: {
    margin: '12px 0 0',
    paddingLeft: '22px',
    color: theme.danger,
    fontSize: '15px',
    fontWeight: 800,
    lineHeight: 1.8,
  },
  iconBox: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 950,
    color: theme.deep,
    border: `1px solid ${theme.border2}`,
    marginBottom: '18px',
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
}