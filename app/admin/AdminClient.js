'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const SUPABASE_PUBLIC_CARD_BASE =
  'https://arahjxdrmqqvzzmyxuot.supabase.co/storage/v1/object/public/stamp-images/live'

export default function AdminClient() {
  const [userId, setUserId] = useState('')
  const [user, setUser] = useState(null)
  const [message, setMessage] = useState('')

  const [createMessage, setCreateMessage] = useState('')
  const [editName, setEditName] = useState('')
  const [nameMessage, setNameMessage] = useState('')
  const [previewKey, setPreviewKey] = useState(0)
  const [copiedFixed, setCopiedFixed] = useState(false)

  const normalizeToHalfWidthNumber = (value) => {
    return value
      .replace(/[０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xfee0)
      )
      .replace(/[^0-9]/g, '')
  }

  const refreshPreview = () => {
    setPreviewKey((prev) => prev + 1)
  }

  const getFixedCardUrl = (targetUserId) => {
    return `${SUPABASE_PUBLIC_CARD_BASE}/${targetUserId}.png`
  }

  const getPreviewUrl = (targetUser) => {
    if (!targetUser) return ''
    const fixedUrl = getFixedCardUrl(targetUser.user_id)
    const version = targetUser.updated_at
      ? new Date(targetUser.updated_at).getTime()
      : Date.now()

    return `${fixedUrl}?v=${version}`
  }

  const syncCardImage = async (targetUserId) => {
    const syncRes = await fetch(`/api/sync-card/${targetUserId}`, {
      method: 'POST',
    })

    const syncJson = await syncRes.json()

    if (!syncRes.ok || !syncJson.ok) {
      throw new Error(syncJson.error || 'カード画像の同期に失敗しました')
    }

    return syncJson
  }

  const searchUser = async () => {
    setMessage('')
    setNameMessage('')
    setCopiedFixed(false)

    if (!userId) {
      setUser(null)
      setMessage('番号を入力してください')
      return
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', Number(userId))
      .maybeSingle()

    if (error || !data) {
      setUser(null)
      setEditName('')
      setMessage('カードが見つかりません')
      return
    }

    setUser(data)
    setEditName(data.name || '')
    setMessage('カードを表示しました')
    refreshPreview()
  }

  const createCard = async () => {
    setCreateMessage('')
    setCopiedFixed(false)

    const { data, error } = await supabase
      .from('users')
      .insert({
        name: null,
        stamp_count: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()

    if (error || !data) {
      setCreateMessage('カード発行に失敗しました')
      return
    }

    try {
      await syncCardImage(data.user_id)
    } catch (error) {
      setCreateMessage(
        error instanceof Error
          ? error.message
          : 'カード画像の初期作成に失敗しました'
      )
      return
    }

    setCreateMessage(`カード番号 ${data.user_id} を発行しました`)
    setUser(data)
    setUserId(String(data.user_id))
    setEditName(data.name || '')
    refreshPreview()
  }

  const saveName = async () => {
    setNameMessage('')
    setCopiedFixed(false)

    if (!user) {
      setNameMessage('先にカードを検索してください')
      return
    }

    const trimmedName = editName.trim()

    const { data, error } = await supabase
      .from('users')
      .update({
        name: trimmedName === '' ? null : trimmedName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
      .select()
      .maybeSingle()

    if (error || !data) {
      setNameMessage('氏名の保存に失敗しました')
      return
    }

    try {
      await syncCardImage(data.user_id)
    } catch (error) {
      setNameMessage(
        error instanceof Error
          ? error.message
          : 'カード画像の同期に失敗しました'
      )
      return
    }

    setUser(data)
    setEditName(data.name || '')
    setNameMessage('氏名を保存しました')
    refreshPreview()
  }

  const updateStampCount = async (diff) => {
    if (!user) return

    const newCount = Math.max(0, Math.min(10, user.stamp_count + diff))

    const { data, error } = await supabase
      .from('users')
      .update({
        stamp_count: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.user_id)
      .select()
      .maybeSingle()

    if (error || !data) {
      setMessage('スタンプ更新に失敗しました')
      return
    }

    try {
      await syncCardImage(data.user_id)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'カード画像の同期に失敗しました'
      )
      return
    }

    setUser(data)
    setMessage(`スタンプ数を ${data.stamp_count} に更新しました`)
    refreshPreview()
    setCopiedFixed(false)
  }

  const copyFixedCardUrl = async () => {
    if (!user) return

    const fullUrl = getFixedCardUrl(user.user_id)

    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedFixed(true)
      setTimeout(() => setCopiedFixed(false), 2000)
    } catch (error) {
      setCopiedFixed(false)
      setMessage('固定URLのコピーに失敗しました')
    }
  }

  const logout = async () => {
    await fetch('/api/admin-logout', { method: 'POST' })
    window.location.href = '/admin/login'
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
    cursor: 'pointer',
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
              -Bistro-Bambi
            </h1>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '22px',
                color: '#9a6b5b',
              }}
            >
              スタンプカード管理画面
            </p>
          </div>

          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="/admin/settings"
              style={{
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
              }}
            >
              管理者画面
            </a>

            <button onClick={logout} style={subButtonStyle}>
              ログアウト
            </button>
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
              <div style={sectionTitleStyle}>① カード新規発行</div>
              <p
                style={{
                  fontSize: '20px',
                  color: '#8a6457',
                  marginTop: 0,
                  marginBottom: '18px',
                  lineHeight: 1.7,
                }}
              >
                まずは名前未登録のカードを発行します。
              </p>

              <button onClick={createCard} style={primaryButtonStyle}>
                カード新規発行
              </button>

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
              <div style={sectionTitleStyle}>② カード検索</div>

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
                  inputMode="numeric"
                  placeholder="番号を入力"
                  value={userId}
                  onChange={(e) =>
                    setUserId(normalizeToHalfWidthNumber(e.target.value))
                  }
                  style={inputStyle}
                />
                <button onClick={searchUser} style={primaryButtonStyle}>
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

            {user && (
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
                  <div style={sectionTitleStyle}>④ スタンプ更新</div>
                  <p
                    style={{
                      fontSize: '20px',
                      color: '#8a6457',
                      marginTop: 0,
                      marginBottom: '18px',
                    }}
                  >
                    来店時にスタンプ数を調整します。
                  </p>

                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <button onClick={() => updateStampCount(-1)} style={stampButtonStyle}>
                      -1
                    </button>
                    <button onClick={() => updateStampCount(1)} style={stampButtonStyle}>
                      +1
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>カード情報</div>

              {user ? (
                <>
                  <p style={infoRowStyle}>
                    <strong>番号：</strong> {user.user_id}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>氏名：</strong> {user.name || '未登録'}
                  </p>
                  <p style={infoRowStyle}>
                    <strong>現在のスタンプ数：</strong> {user.stamp_count}
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
                        href={getFixedCardUrl(user.user_id)}
                        target="_blank"
                        rel="noreferrer"
                        style={linkStyle}
                      >
                        {getFixedCardUrl(user.user_id)}
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
                      コピー機や実運用で使う固定URLです。
                    </p>
                  </div>
                </>
              ) : (
                <p
                  style={{
                    fontSize: '22px',
                    color: '#9a6b5b',
                    margin: 0,
                    lineHeight: 1.8,
                  }}
                >
                  カードを検索すると、ここに情報が表示されます。
                </p>
              )}
            </div>

            <div style={cardBoxStyle}>
              <div style={sectionTitleStyle}>カード画像プレビュー</div>

              <p
                style={{
                  fontSize: '20px',
                  color: '#8a6457',
                  marginTop: 0,
                  marginBottom: '18px',
                  lineHeight: 1.7,
                }}
              >
                氏名保存やスタンプ更新後は自動で反映されます。
              </p>

              {user ? (
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
                      src={`${getPreviewUrl(user)}&preview=${previewKey}`}
                      alt={`カード ${user.user_id}`}
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
                  <p
                    style={{
                      fontSize: '24px',
                      color: '#9a6b5b',
                      margin: 0,
                      lineHeight: 1.8,
                    }}
                  >
                    カード検索後に、ここへ大きくプレビュー表示されます。
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