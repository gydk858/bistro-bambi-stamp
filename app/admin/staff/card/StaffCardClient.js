'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const STAFF_PROGRAM_CODE = 'stamp_staff_attendance'
const STAFF_MAX_COUNT = 15
const STAFF_PUBLIC_CARD_BASE =
  'https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live-staff'

export default function StaffCardClient() {
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

  const normalizeStaffCode = (value) => {
    return value.replace(/\s+/g, '').trim()
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

  const fetchStaffCardByCode = async (targetStaffCode) => {
    const normalized = normalizeStaffCode(targetStaffCode)

    const { data, error } = await supabase
      .from('v_staff_stamp_cards_current')
      .select('*')
      .eq('staff_code', normalized)
      .eq('program_code', STAFF_PROGRAM_CODE)
      .eq('card_status', 'active')
      .maybeSingle()

    if (error) {
      throw new Error('従業員カード情報の取得に失敗しました')
    }

    if (!data) {
      throw new Error('この従業員カードは見つかりません')
    }

    return data
  }

  const searchStaffCard = async () => {
    setMessage('')
    setNameMessage('')
    setCopiedFixed(false)

    const normalized = normalizeStaffCode(staffCode)

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
      setMessage('従業員カードを表示しました')
      refreshPreview()
    } catch (error) {
      setCardRecord(null)
      setEditName('')
      setMessage(
        error instanceof Error ? error.message : '従業員カード情報の取得に失敗しました'
      )
    }
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
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('employee_profiles')
        .select('employee_id')
        .eq('staff_code', normalizedCode)
        .maybeSingle()

      if (existingProfileError) {
        throw new Error(`従業員コードの確認に失敗しました: ${existingProfileError.message}`)
      }

      if (existingProfile) {
        throw new Error('その従業員コードはすでに使用されています')
      }

      const now = new Date().toISOString()
      const displayName = trimmedName === '' ? '未登録' : trimmedName

      const { data: createdUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          display_name: displayName,
          status: 'active',
          updated_at: now,
        })
        .select('user_id, display_name')
        .maybeSingle()

      if (createUserError || !createdUser) {
        throw new Error('従業員ユーザーの作成に失敗しました')
      }

      const { error: createProfileError } = await supabase
        .from('employee_profiles')
        .insert({
          user_id: createdUser.user_id,
          staff_code: normalizedCode,
          employee_name: trimmedName === '' ? null : trimmedName,
          employment_status: 'active',
        })

      if (createProfileError) {
        throw new Error(
          `従業員プロフィールの作成に失敗しました: ${createProfileError.message}`
        )
      }

      const { data: createdCardRows, error: createCardError } = await supabase.rpc(
        'create_stamp_card_for_user',
        {
          p_user_id: createdUser.user_id,
          p_program_code: STAFF_PROGRAM_CODE,
          p_max_count: STAFF_MAX_COUNT,
          p_note: '管理画面から従業員カード新規発行',
        }
      )

      if (createCardError) {
        throw new Error(`従業員カード発行に失敗しました: ${createCardError.message}`)
      }

      if (!createdCardRows || createdCardRows.length === 0) {
        throw new Error('従業員カード発行結果を取得できませんでした')
      }

      await syncStaffCardImage(createdUser.user_id)

      const fetchedCard = await fetchStaffCardByCode(normalizedCode)

      setCreateMessage(`従業員コード ${normalizedCode} を発行しました`)
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
      await syncStaffCardImage(cardRecord.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '従業員カード画像の同期に失敗しました'
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
      await syncStaffCardImage(cardRecord.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '従業員カード画像の同期に失敗しました'
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
    minWidth: '280px',
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
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.25)',
  }

  const subButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const stampButtonStyle = {
    padding: '18px 28px',
    fontSize: '28px',
    fontWeight: 800,
    borderRadius: '18px',
    border: 'none',
    background: '#f3b6a6',
    color: '#6a3d2f',
    cursor: 'pointer',
    minWidth: '110px',
    boxShadow: '0 8px 20px rgba(243, 182, 166, 0.30)',
  }

  const dangerButtonStyle = {
    padding: '18px 28px',
    fontSize: '24px',
    fontWeight: 800,
    borderRadius: '18px',
    border: '1px solid #e7b8aa',
    background: '#fff',
    color: '#8a4e3d',
    cursor: 'pointer',
    minWidth: '140px',
  }

  const infoRowStyle = {
    fontSize: '22px',
    lineHeight: 1.8,
    color: '#5f4137',
    margin: 0,
  }

  const linkStyle = {
    color: '#c26f5a',
    fontWeight: 700,
    textDecoration: 'none',
    wordBreak: 'break-all',
  }

  const copyButtonBaseStyle = {
    padding: '12px 18px',
    fontSize: '18px',
    fontWeight: 700,
    borderRadius: '12px',
    border: '1px solid #e6c6bb',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  }

  const placeholderStyle = {
    fontSize: '22px',
    color: '#9a6b5b',
    lineHeight: 1.8,
    margin: 0,
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
      <div
        style={{
          maxWidth: '1500px',
          margin: '0 auto',
        }}
      >
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
              従業員カード管理
            </h1>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '22px',
                color: '#9a6b5b',
              }}
            >
              従業員コードの発行、検索、氏名登録、出勤数更新をここで管理します。
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <a href="/admin/staff/manage" style={subButtonStyle}>
              従業員管理
            </a>

            <a href="/admin/staff" style={subButtonStyle}>
              従業員管理へ戻る
            </a>

            <a href="/admin" style={subButtonStyle}>
              管理メニューへ戻る
            </a>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1.35fr',
            gap: '28px',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>① 従業員カード新規発行</div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <input
                  type="text"
                  placeholder="従業員コードを入力（例: Bambi01）"
                  value={createStaffCode}
                  onChange={(e) => setCreateStaffCode(normalizeStaffCode(e.target.value))}
                  style={inputStyle}
                />

                <input
                  type="text"
                  placeholder="氏名を入力（省略可）"
                  value={createStaffName}
                  onChange={(e) => setCreateStaffName(e.target.value)}
                  style={inputStyle}
                />

                <div>
                  <button onClick={createStaffCard} style={primaryButtonStyle}>
                    従業員カード新規発行
                  </button>
                </div>
              </div>

              {createMessage && (
                <p
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
                  {createMessage}
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>② 従業員カード検索</div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  placeholder="従業員コードを入力"
                  value={staffCode}
                  onChange={(e) => setStaffCode(normalizeStaffCode(e.target.value))}
                  style={inputStyle}
                />
                <button onClick={searchStaffCard} style={primaryButtonStyle}>
                  検索
                </button>
              </div>

              {message && (
                <p
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
                  {message}
                </p>
              )}
            </div>

            {cardRecord && (
              <>
                <div style={cardBoxStyle}>
                  <div style={sectionTitleStyle}>③ 氏名登録・修正</div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="text"
                      placeholder="氏名を入力"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ ...inputStyle, minWidth: '320px' }}
                    />
                    <button onClick={saveName} style={primaryButtonStyle}>
                      氏名を保存
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
                    空欄で保存すると、氏名未登録に戻せます。
                  </p>

                  {nameMessage && (
                    <p
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
                      {nameMessage}
                    </p>
                  )}
                </div>

                <div style={cardBoxStyle}>
                  <div style={sectionTitleStyle}>④ 出勤数更新</div>
                  <p
                    style={{
                      fontSize: '20px',
                      color: '#8a6457',
                      marginTop: 0,
                      marginBottom: '18px',
                    }}
                  >
                    出勤ごとに出勤数を調整します。
                  </p>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <button onClick={() => updateAttendanceCount(-1)} style={stampButtonStyle}>
                      -1
                    </button>
                    <button onClick={() => updateAttendanceCount(1)} style={stampButtonStyle}>
                      +1
                    </button>
                    <button onClick={resetStaffCard} style={dangerButtonStyle}>
                      リセット
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>従業員カード情報</div>

              {cardRecord ? (
                <>
                  <p style={infoRowStyle}>
                    <strong>従業員コード：</strong> {cardRecord.staff_code}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>番号：</strong> {cardRecord.user_id}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>カードID：</strong> {cardRecord.card_id}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>氏名：</strong> {cardRecord.display_name || '未登録'}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>現在の出勤数：</strong> {cardRecord.current_count}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>最大出勤数：</strong> {cardRecord.max_count}
                  </p>

                  <div style={{ marginTop: '18px' }}>
                    <p style={{ ...infoRowStyle, marginBottom: '8px' }}>
                      <strong>カードURL：</strong>
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <a
                        href={getFixedCardUrl(cardRecord.user_id)}
                        target="_blank"
                        rel="noreferrer"
                        style={linkStyle}
                      >
                        {getFixedCardUrl(cardRecord.user_id)}
                      </a>

                      <button
                        onClick={copyFixedCardUrl}
                        style={{
                          ...copyButtonBaseStyle,
                          background: copiedFixed ? '#d98b7b' : '#fff',
                          color: copiedFixed ? '#fff' : '#7a4b3a',
                        }}
                      >
                        {copiedFixed ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>

                    <p
                      style={{
                        fontSize: '16px',
                        color: '#9a6b5b',
                        marginTop: '8px',
                        marginBottom: 0,
                      }}
                    >
                      従業員カードの固定URLです。
                    </p>
                  </div>
                </>
              ) : (
                <p style={placeholderStyle}>
                  従業員カードを検索すると、ここに従業員コード、氏名、現在の出勤数、
                  最大出勤数などが表示されます。
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>従業員カード画像プレビュー</div>

              {cardRecord ? (
                <>
                  <div
                    style={{
                      marginTop: '8px',
                      background: '#fff',
                      padding: '18px',
                      borderRadius: '18px',
                      border: '1px solid #efd8d0',
                    }}
                  >
                    <img
                      src={getPreviewUrl(cardRecord)}
                      alt={`従業員カード ${cardRecord.staff_code}`}
                      style={{
                        width: '100%',
                        maxWidth: '100%',
                        borderRadius: '16px',
                        border: '1px solid #ead0c7',
                        display: 'block',
                        background: '#fff',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: '18px' }}>
                    <button onClick={refreshPreview} style={subButtonStyle}>
                      プレビュー再読み込み
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    background: '#fff',
                    border: '1px dashed #e0beb3',
                    borderRadius: '18px',
                    padding: '42px 24px',
                    textAlign: 'center',
                  }}
                >
                  <p style={placeholderStyle}>
                    従業員カード検索後に、ここへ大きくプレビュー表示されます。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}