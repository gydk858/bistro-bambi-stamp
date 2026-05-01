'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STAFF_PROGRAM_CODE = 'stamp_staff_attendance'
const STAFF_MAX_COUNT = 15
const STAFF_PUBLIC_CARD_BASE =
  'https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live-staff'

export default function StaffCardClient() {
  const searchParams = useSearchParams()

  const [staffCode, setStaffCode] = useState('')
  const [createStaffCode, setCreateStaffCode] = useState('')
  const [createStaffName, setCreateStaffName] = useState('')

  const [cardRecord, setCardRecord] = useState(null)
  const [message, setMessage] = useState('')
  const [createMessage, setCreateMessage] = useState('')
  const [editName, setEditName] = useState('')
  const [nameMessage, setNameMessage] = useState('')
  const [copiedFixed, setCopiedFixed] = useState(false)
  const [previewKey, setPreviewKey] = useState(Date.now())

  const [currentStore, setCurrentStore] = useState(null)
  const [storeError, setStoreError] = useState('')
  const [isStoreLoading, setIsStoreLoading] = useState(true)
  const [autoSearchDone, setAutoSearchDone] = useState(false)

  const normalizeStaffCode = (value) => {
    return String(value || '').replace(/\s+/g, '').trim()
  }

  const refreshPreview = () => {
    setPreviewKey(Date.now())
  }

  const getFixedCardUrl = (targetUserId) => {
    return `${STAFF_PUBLIC_CARD_BASE}/${targetUserId}.png`
  }

  const getPreviewUrl = (targetRecord) => {
    if (!targetRecord) return ''
    const fixedUrl = getFixedCardUrl(targetRecord.user_id)
    return `${fixedUrl}?preview=${previewKey}`
  }

  const getJstBusinessDateForPayroll = () => {
    const now = new Date()

    const jstFormatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    const parts = jstFormatter.formatToParts(now)
    const getPart = (type) => parts.find((part) => part.type === type)?.value

    const year = Number(getPart('year'))
    const month = Number(getPart('month'))
    const day = Number(getPart('day'))
    const hour = Number(getPart('hour'))

    const jstDate = new Date(Date.UTC(year, month - 1, day))

    if (hour < 4) {
      jstDate.setUTCDate(jstDate.getUTCDate() - 1)
    }

    const businessYear = jstDate.getUTCFullYear()
    const businessMonth = String(jstDate.getUTCMonth() + 1).padStart(2, '0')
    const businessDay = String(jstDate.getUTCDate()).padStart(2, '0')

    return `${businessYear}-${businessMonth}-${businessDay}`
  }

  const syncStaffCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-staff-card/${targetUserId}`, {
      method: 'POST',
      cache: 'no-store',
    })

    const syncJson = await syncRes.json()

    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(
        syncJson.error || syncJson.message || '従業員カード画像の同期に失敗しました'
      )
    }

    return syncJson
  }

  const loadCurrentStore = async () => {
    setIsStoreLoading(true)
    setStoreError('')

    try {
      const { data: setting, error: settingError } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', 'current_store_code')
        .maybeSingle()

      if (settingError) {
        throw new Error(`店舗設定の取得に失敗しました: ${settingError.message}`)
      }

      if (!setting?.setting_value) {
        throw new Error('current_store_code が設定されていません')
      }

      const { data: store, error: storeErrorRes } = await supabase
        .from('stores')
        .select('store_id, store_code, store_name, status')
        .eq('store_code', setting.setting_value)
        .eq('status', 'active')
        .maybeSingle()

      if (storeErrorRes) {
        throw new Error(`店舗情報の取得に失敗しました: ${storeErrorRes.message}`)
      }

      if (!store) {
        throw new Error('現在の店舗設定に対応する店舗が見つかりません')
      }

      setCurrentStore(store)
    } catch (error) {
      setCurrentStore(null)
      setStoreError(
        error instanceof Error ? error.message : '店舗設定の読み込みに失敗しました'
      )
    } finally {
      setIsStoreLoading(false)
    }
  }

  useEffect(() => {
    loadCurrentStore()
  }, [])

  useEffect(() => {
    const queryStaffCode = normalizeStaffCode(searchParams.get('staff_code'))

    if (!queryStaffCode) return
    if (autoSearchDone) return
    if (isStoreLoading) return
    if (!currentStore) return

    setStaffCode(queryStaffCode)
    setAutoSearchDone(true)
    searchStaffCardByCode(queryStaffCode, true)
  }, [searchParams, autoSearchDone, isStoreLoading, currentStore])

  const requireCurrentStore = () => {
    if (!currentStore?.store_id || !currentStore?.store_code) {
      throw new Error(storeError || '現在の店舗設定が読み込まれていません')
    }

    return currentStore
  }

  const fetchStaffCardByCode = async (targetStaffCode) => {
    const normalized = normalizeStaffCode(targetStaffCode)
    const store = requireCurrentStore()

    const { data: profile, error: profileError } = await supabase
      .from('employee_profiles')
      .select('user_id, staff_code, employee_name, store_id, employment_status')
      .eq('store_id', store.store_id)
      .eq('staff_code', normalized)
      .maybeSingle()

    if (profileError) {
      throw new Error('従業員プロフィールの取得に失敗しました')
    }

    if (!profile) {
      throw new Error('この従業員カードは見つかりません')
    }

    const { data, error } = await supabase
      .from('v_staff_stamp_cards_current')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('program_code', STAFF_PROGRAM_CODE)
      .eq('card_status', 'active')
      .maybeSingle()

    if (error) {
      throw new Error('従業員カード情報の取得に失敗しました')
    }

    if (!data) {
      throw new Error('この従業員カードは見つかりません')
    }

    return {
      ...data,
      employment_status: profile.employment_status || 'active',
    }
  }

  const recordAttendanceEvent = async ({
    userId,
    amount,
    eventType,
    source,
    note,
    actedBy,
  }) => {
    const workDate = getJstBusinessDateForPayroll()

    const { data, error } = await supabase.rpc('record_staff_attendance_event', {
      p_user_id: userId,
      p_work_date: workDate,
      p_amount: amount,
      p_event_type: eventType,
      p_source: source,
      p_note: note,
      p_acted_by: actedBy,
    })

    if (error) {
      throw new Error(`出勤履歴の保存に失敗しました: ${error.message}`)
    }

    return data
  }

  const searchStaffCardByCode = async (targetStaffCode, fromAutoSearch = false) => {
    setMessage('')
    setNameMessage('')
    setCopiedFixed(false)

    const normalized = normalizeStaffCode(targetStaffCode)

    if (!normalized) {
      setCardRecord(null)
      setEditName('')
      setMessage('従業員コードを入力してください')
      return
    }

    try {
      const data = await fetchStaffCardByCode(normalized)
      await syncStaffCardImage(data.user_id)
      const refreshedData = await fetchStaffCardByCode(normalized)

      setCardRecord(refreshedData)
      setEditName(refreshedData.display_name || '')
      setMessage(
        fromAutoSearch
          ? `従業員一覧から ${normalized} を表示しました（${currentStore?.store_name ?? ''}）`
          : `従業員カードを表示しました（${currentStore?.store_name ?? ''}）`
      )
      refreshPreview()
    } catch (error) {
      setCardRecord(null)
      setEditName('')
      setMessage(
        error instanceof Error ? error.message : '従業員カード情報の取得に失敗しました'
      )
    }
  }

  const searchStaffCard = async () => {
    await searchStaffCardByCode(staffCode, false)
  }

  const createStaffCard = async () => {
    setCreateMessage('')
    setMessage('')
    setNameMessage('')
    setCopiedFixed(false)

    const normalizedCode = normalizeStaffCode(createStaffCode)
    const trimmedName = createStaffName.trim()

    if (!normalizedCode) {
      setCreateMessage('従業員コードを入力してください')
      return
    }

    try {
      const store = requireCurrentStore()

      const { data: createdRows, error: createError } = await supabase.rpc(
        'create_staff_card_for_store',
        {
          p_store_code: store.store_code,
          p_staff_code: normalizedCode,
          p_display_name: trimmedName === '' ? null : trimmedName,
          p_max_count: STAFF_MAX_COUNT,
          p_note: `管理画面から従業員カード新規発行 (${store.store_code})`,
        }
      )

      if (createError) {
        if (String(createError.message).includes('staff_code already exists in store')) {
          throw new Error('その従業員コードはこの店舗ですでに使用されています')
        }

        throw new Error(`従業員カード発行に失敗しました: ${createError.message}`)
      }

      if (!createdRows || createdRows.length === 0) {
        throw new Error('従業員カード発行結果を取得できませんでした')
      }

      const created = createdRows[0]

      await syncStaffCardImage(created.user_id)

      const fetchedCard = await fetchStaffCardByCode(normalizedCode)

      setCreateMessage(
        `従業員コード ${normalizedCode} を発行しました（${store.store_name}）`
      )
      setMessage('従業員カードを新規発行しました')
      setStaffCode(normalizedCode)
      setCardRecord(fetchedCard)
      setEditName(fetchedCard.display_name || '')
      setCreateStaffCode('')
      setCreateStaffName('')
      refreshPreview()
    } catch (error) {
      setCreateMessage(
        error instanceof Error ? error.message : '従業員カード発行に失敗しました'
      )
    }
  }

  const saveName = async () => {
    setNameMessage('')
    setCopiedFixed(false)

    if (!cardRecord) {
      setNameMessage('先に従業員カードを検索してください')
      return
    }

    const trimmedName = editName.trim()
    const displayName = trimmedName === '' ? '未登録' : trimmedName

    const { data: updatedUser, error: updateUserError } = await supabase
      .from('users')
      .update({
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cardRecord.user_id)
      .select()
      .maybeSingle()

    if (updateUserError || !updatedUser) {
      setNameMessage('氏名の保存に失敗しました')
      return
    }

    const { error: updateProfileError } = await supabase
      .from('employee_profiles')
      .update({
        employee_name: trimmedName === '' ? null : trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cardRecord.user_id)

    if (updateProfileError) {
      setNameMessage('従業員プロフィールの更新に失敗しました')
      return
    }

    try {
      await syncStaffCardImage(cardRecord.user_id)
    } catch (error) {
      setNameMessage(
        error instanceof Error
          ? error.message
          : '従業員カード画像の同期に失敗しました'
      )
      return
    }

    const refreshedData = await fetchStaffCardByCode(cardRecord.staff_code)

    setCardRecord(refreshedData)
    setEditName(refreshedData.display_name || '')
    setNameMessage('氏名を保存しました')
    refreshPreview()
  }

  const updateAttendanceCount = async (diff) => {
    if (!cardRecord) return

    const { data, error } = await supabase.rpc('increment_stamp_card', {
      p_card_id: cardRecord.card_id,
      p_amount: diff,
      p_acted_by: 'admin_staff_ui',
      p_reason: diff > 0 ? '管理画面から出勤数追加' : '管理画面から出勤数減算',
    })

    if (error || !data || data.length === 0) {
      setMessage('出勤数更新に失敗しました')
      return
    }

    try {
      await recordAttendanceEvent({
        userId: cardRecord.user_id,
        amount: diff,
        eventType: diff > 0 ? 'work' : 'adjust_minus',
        source: 'admin_staff_ui',
        note: diff > 0 ? '管理画面から出勤数追加' : '管理画面から出勤数減算',
        actedBy: 'admin_staff_ui',
      })

      await syncStaffCardImage(cardRecord.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '出勤履歴またはカード画像の同期に失敗しました'
      )
      return
    }

    const refreshedData = await fetchStaffCardByCode(cardRecord.staff_code)

    setCardRecord(refreshedData)
    setMessage(`出勤数を ${refreshedData.current_count} に更新しました`)
    setCopiedFixed(false)
    refreshPreview()
  }

  const resetStaffCard = async () => {
    if (!cardRecord) return

    const { data, error } = await supabase.rpc('reset_stamp_card', {
      p_card_id: cardRecord.card_id,
      p_acted_by: 'admin_staff_ui',
      p_reason: '管理画面から従業員カードリセット',
    })

    if (error || !data || data.length === 0) {
      setMessage('出勤数のリセットに失敗しました')
      return
    }

    try {
      await recordAttendanceEvent({
        userId: cardRecord.user_id,
        amount: 0,
        eventType: 'reset_adjust',
        source: 'admin_staff_ui',
        note: '管理画面から従業員カードリセット',
        actedBy: 'admin_staff_ui',
      })

      await syncStaffCardImage(cardRecord.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '出勤履歴またはカード画像の同期に失敗しました'
      )
      return
    }

    const refreshedData = await fetchStaffCardByCode(cardRecord.staff_code)

    setCardRecord(refreshedData)
    setMessage('出勤数をリセットしました')
    setCopiedFixed(false)
    refreshPreview()
  }

  const copyFixedCardUrl = async () => {
    if (!cardRecord) return

    const fullUrl = getFixedCardUrl(cardRecord.user_id)

    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedFixed(true)
      setTimeout(() => setCopiedFixed(false), 2000)
    } catch {
      setCopiedFixed(false)
      setMessage('固定URLのコピーに失敗しました')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>📇</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>従業員カード管理</p>
              <p style={styles.headerDescription}>
                従業員カードの発行・検索・氏名変更・出勤数の確認と管理者調整を行います。
              </p>
              <p style={styles.storeText}>
                現在の対象店舗：
                {isStoreLoading
                  ? ' 読み込み中...'
                  : currentStore
                  ? ` ${currentStore.store_name} (${currentStore.store_code})`
                  : ' 未設定'}
              </p>
              {storeError && <p style={styles.errorText}>{storeError}</p>}
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin/staff/employees" style={styles.navButton}>
              従業員一覧
            </a>
            <a href="/admin/staff/manage" style={styles.navButton}>
              月末一括リセット
            </a>
            <a href="/admin/staff" style={styles.navButton}>
              従業員管理
            </a>
            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>
          </nav>
        </header>

        {(createMessage || message || nameMessage) && (
          <div style={styles.messageArea}>
            {createMessage && <div style={styles.message}>{createMessage}</div>}
            {message && <div style={styles.message}>{message}</div>}
            {nameMessage && <div style={styles.message}>{nameMessage}</div>}
          </div>
        )}

        <div style={styles.layout}>
          <aside style={styles.sidebar}>
            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>01</span>
                <h2 style={styles.sectionTitle}>従業員カード新規発行</h2>
              </div>

              <p style={styles.description}>
                従業員コードと氏名を登録して、出勤管理用カードを発行します。
              </p>

              <div style={styles.formStack}>
                <input
                  type="text"
                  placeholder="従業員コードを入力（例: Bambi01）"
                  value={createStaffCode}
                  onChange={(e) => setCreateStaffCode(normalizeStaffCode(e.target.value))}
                  style={styles.input}
                />

                <input
                  type="text"
                  placeholder="氏名を入力（省略可）"
                  value={createStaffName}
                  onChange={(e) => setCreateStaffName(e.target.value)}
                  style={styles.input}
                />

                <button
                  onClick={createStaffCard}
                  style={{
                    ...styles.primaryButton,
                    ...((isStoreLoading || !currentStore) ? styles.disabledButton : {}),
                  }}
                  disabled={isStoreLoading || !currentStore}
                >
                  従業員カード新規発行
                </button>
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.sectionHead}>
                <span style={styles.sectionNumber}>02</span>
                <h2 style={styles.sectionTitle}>従業員カード検索</h2>
              </div>

              <p style={styles.description}>
                従業員コードでカード情報と現在の出勤数を確認します。
              </p>

              <div style={styles.formStack}>
                <input
                  type="text"
                  placeholder="従業員コードを入力"
                  value={staffCode}
                  onChange={(e) => setStaffCode(normalizeStaffCode(e.target.value))}
                  style={styles.input}
                />

                <button
                  onClick={searchStaffCard}
                  style={{
                    ...styles.primaryButton,
                    ...((isStoreLoading || !currentStore) ? styles.disabledButton : {}),
                  }}
                  disabled={isStoreLoading || !currentStore}
                >
                  検索
                </button>
              </div>
            </section>

            {cardRecord && (
              <>
                <section style={styles.panel}>
                  <div style={styles.sectionHead}>
                    <span style={styles.sectionNumber}>03</span>
                    <h2 style={styles.sectionTitle}>氏名登録・修正</h2>
                  </div>

                  <div style={styles.formStack}>
                    <input
                      type="text"
                      placeholder="氏名を入力"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={styles.input}
                    />

                    <button onClick={saveName} style={styles.primaryButton}>
                      氏名を保存
                    </button>
                  </div>

                  <p style={styles.smallNote}>
                    空欄で保存すると、氏名未登録に戻せます。
                  </p>
                </section>

                <section style={styles.panel}>
                  <div style={styles.sectionHead}>
                    <span style={styles.sectionNumber}>04</span>
                    <h2 style={styles.sectionTitle}>出勤数の管理者調整</h2>
                  </div>

                  <p style={styles.description}>
                    通常の出勤操作はDiscordで行います。この操作はミス修正や確認用の管理者調整として使います。
                    給与集計用の出勤履歴はAM4:00基準の日付で保存されます。
                  </p>

                  <div style={styles.attendanceActions}>
                    <button onClick={() => updateAttendanceCount(-1)} style={styles.attendanceButton}>
                      -1
                    </button>
                    <button onClick={() => updateAttendanceCount(1)} style={styles.attendanceButton}>
                      +1
                    </button>
                    <button onClick={resetStaffCard} style={styles.dangerButton}>
                      リセット
                    </button>
                  </div>
                </section>
              </>
            )}
          </aside>

          <main style={styles.main}>
            <section style={styles.summaryGrid}>
              <SummaryCard
                label="従業員コード"
                value={cardRecord ? cardRecord.staff_code : '-'}
                sub="検索後に表示"
              />
              <SummaryCard
                label="氏名"
                value={cardRecord ? cardRecord.display_name || '未登録' : '-'}
                sub="従業員カード表示名"
              />
              <SummaryCard
                label="現在の出勤数"
                value={cardRecord ? cardRecord.current_count : '-'}
                sub="Discord操作・管理者調整後の現在値"
              />
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>従業員カード情報</h2>
                  <p style={styles.mainDescription}>
                    店舗、従業員コード、氏名、現在の出勤数、固定URLを確認します。
                  </p>
                </div>
              </div>

              {cardRecord ? (
                <>
                  {cardRecord.employment_status === 'retired' && (
                    <div style={styles.retiredNotice}>
                      この従業員は退職済みに設定されています。
                    </div>
                  )}

                  <div style={styles.infoGrid}>
                    <InfoItem label="店舗" value={currentStore?.store_name ?? '未設定'} />
                    <InfoItem label="従業員コード" value={cardRecord.staff_code} />
                    <InfoItem label="番号" value={cardRecord.user_id} />
                    <InfoItem label="カードID" value={cardRecord.card_id} />
                    <InfoItem label="氏名" value={cardRecord.display_name || '未登録'} />
                    <InfoItem label="現在の出勤数" value={cardRecord.current_count} />
                    <InfoItem
                      label="在籍状態"
                      value={cardRecord.employment_status === 'retired' ? '退職済み' : '在籍中'}
                    />
                    <InfoItem label="カード状態" value={cardRecord.card_status || 'active'} />
                  </div>

                  <div style={styles.urlBox}>
                    <div style={styles.inputLabel}>固定カードURL</div>

                    <div style={styles.urlRow}>
                      <a
                        href={getFixedCardUrl(cardRecord.user_id)}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.link}
                      >
                        {getFixedCardUrl(cardRecord.user_id)}
                      </a>

                      <button
                        onClick={copyFixedCardUrl}
                        style={copiedFixed ? styles.copyButtonActive : styles.copyButton}
                      >
                        {copiedFixed ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>

                    <p style={styles.smallNote}>
                      従業員カードの固定URLです。カード画像上のマス数は表示上限であり、給与計算上の出勤上限ではありません。
                    </p>
                  </div>
                </>
              ) : (
                <div style={styles.emptyBox}>
                  従業員カードを検索すると、ここに従業員コード、氏名、現在の出勤数などが表示されます。
                </div>
              )}
            </section>

            <section style={styles.panel}>
              <div style={styles.mainSectionHead}>
                <div>
                  <h2 style={styles.mainTitle}>従業員カード画像プレビュー</h2>
                  <p style={styles.mainDescription}>
                    氏名保存や出勤数更新後は自動で画像を同期します。
                  </p>
                </div>
              </div>

              {cardRecord ? (
                <>
                  <div style={styles.previewFrame}>
                    <img
                      src={getPreviewUrl(cardRecord)}
                      alt={`従業員カード ${cardRecord.staff_code}`}
                      style={styles.previewImage}
                    />
                  </div>

                  <div style={{ marginTop: '16px' }}>
                    <button onClick={refreshPreview} style={styles.secondaryButton}>
                      プレビュー再読み込み
                    </button>
                  </div>
                </>
              ) : (
                <div style={styles.emptyBox}>
                  従業員カード検索後に、ここへ大きくプレビュー表示されます。
                </div>
              )}
            </section>

            <section style={styles.memoPanel}>
              <div style={styles.memoBadge}>OPERATION MEMO</div>
              <h2 style={styles.memoTitle}>運用メモ</h2>
              <div style={styles.memoGrid}>
                <div style={styles.memoItem}>
                  <div style={styles.memoLabel}>通常操作</div>
                  <p style={styles.memoText}>
                    従業員の出勤スタンプはDiscord側で押す運用です。
                  </p>
                </div>
                <div style={styles.memoItem}>
                  <div style={styles.memoLabel}>管理画面操作</div>
                  <p style={styles.memoText}>
                    この画面の +1 / -1 は、ミス修正や管理者確認用の調整として使用します。
                  </p>
                </div>
                <div style={styles.memoItem}>
                  <div style={styles.memoLabel}>給与集計</div>
                  <p style={styles.memoText}>
                    出勤履歴はAM4:00基準の work_date で保存され、給与計算に使われます。出勤回数に上限は設けません。
                  </p>
                </div>
              </div>
            </section>
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

function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
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
  errorText: {
    margin: '8px 0 0',
    fontSize: '14px',
    color: theme.danger,
    fontWeight: 900,
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
  messageArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '18px',
  },
  message: {
    fontSize: '15px',
    fontWeight: 800,
    color: theme.deep,
    background: theme.white,
    padding: '13px 15px',
    borderRadius: '14px',
    border: `1px solid ${theme.border}`,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '390px minmax(0, 1fr)',
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
  sectionHead: {
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
  description: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '0 0 14px',
  },
  smallNote: {
    fontSize: '13px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '10px 0 0',
  },
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  inputLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '6px',
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
  disabledButton: {
    opacity: 0.65,
    cursor: 'default',
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
  },
  attendanceActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  attendanceButton: {
    padding: '17px 18px',
    fontSize: '26px',
    fontWeight: 950,
    borderRadius: '14px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  dangerButton: {
    gridColumn: '1 / -1',
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 900,
    borderRadius: '14px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
  mainSectionHead: {
    marginBottom: '16px',
  },
  mainTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  mainDescription: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.7,
    margin: '6px 0 0',
  },
  retiredNotice: {
    marginBottom: '14px',
    background: theme.dangerPale,
    border: `1px solid ${theme.border2}`,
    borderRadius: '14px',
    padding: '12px 14px',
    color: theme.danger,
    fontSize: '14px',
    fontWeight: 900,
    lineHeight: 1.7,
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
  },
  infoItem: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  infoLabel: {
    fontSize: '12px',
    color: theme.muted,
    fontWeight: 900,
    marginBottom: '8px',
  },
  infoValue: {
    fontSize: '18px',
    color: theme.deep,
    fontWeight: 900,
    wordBreak: 'break-word',
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
  urlBox: {
    marginTop: '16px',
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  urlRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  link: {
    color: theme.green,
    fontWeight: 900,
    textDecoration: 'none',
    wordBreak: 'break-all',
  },
  copyButton: {
    padding: '10px 13px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
  },
  copyButtonActive: {
    padding: '10px 13px',
    fontSize: '14px',
    fontWeight: 900,
    borderRadius: '10px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    cursor: 'pointer',
  },
  previewFrame: {
    background: theme.white,
    padding: '16px',
    borderRadius: '18px',
    border: `1px solid ${theme.border}`,
  },
  previewImage: {
    width: '100%',
    maxWidth: '100%',
    borderRadius: '16px',
    border: `1px solid ${theme.border2}`,
    display: 'block',
    background: theme.white,
  },
  memoPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  memoBadge: {
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
  memoTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  memoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginTop: '16px',
  },
  memoItem: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '14px',
    padding: '14px',
  },
  memoLabel: {
    fontSize: '13px',
    color: theme.deep,
    fontWeight: 950,
    marginBottom: '8px',
  },
  memoText: {
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.75,
    margin: 0,
  },
}