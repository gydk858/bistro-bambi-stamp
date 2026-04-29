'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StaffManageClient() {
  const [message, setMessage] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const resetAllStaffCards = async () => {
    if (isResetting) return

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
          maxWidth: '1400px',
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
          }}
        >
          <h1
            style={{
              fontSize: '42px',
              fontWeight: 900,
              color: '#7a4b3a',
              margin: 0,
            }}
          >
            従業員管理
          </h1>
          <p
            style={{
              margin: '10px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.7,
            }}
          >
            従業員カードの月末リセットなど、運用用の一括処理をここで行います。
          </p>
        </div>

        <div style={cardBoxStyle}>
          <div style={sectionTitleStyle}>従業員カード一括リセット</div>
          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              marginTop: 0,
              marginBottom: '18px',
              lineHeight: 1.8,
            }}
          >
            すべての従業員カードの出勤数を 0 に戻します。
          </p>
          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              marginTop: 0,
              marginBottom: '24px',
              lineHeight: 1.8,
            }}
          >
            月末の締め処理後に、翌月ぶんを開始するときに使います。
          </p>

          <button
            onClick={resetAllStaffCards}
            disabled={isResetting}
            style={{
              ...primaryButtonStyle,
              opacity: isResetting ? 0.7 : 1,
              cursor: isResetting ? 'default' : 'pointer',
            }}
          >
            {isResetting ? 'リセット中...' : '全従業員カードをリセット'}
          </button>

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

        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <a href="/admin/staff/card" style={subButtonStyle}>
            従業員カード画面に戻る
          </a>

          <a href="/admin/staff" style={subButtonStyle}>
            従業員管理へ戻る
          </a>

          <a href="/admin" style={subButtonStyle}>
            管理メニュー
          </a>
        </div>
      </div>
    </div>
  )
}