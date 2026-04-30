'use client'

import Link from 'next/link'

export default function StaffMenuClient() {
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

  const subButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  }

  const menuCardStyle = {
    ...cardBoxStyle,
    display: 'block',
    textDecoration: 'none',
    color: '#5f4137',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }

  const menuDescriptionStyle = {
    fontSize: '20px',
    color: '#8a6457',
    marginTop: 0,
    marginBottom: 0,
    lineHeight: 1.7,
  }

  const iconStyle = {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    background: '#fff1e9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    marginBottom: '18px',
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.14)',
  }

  const cardButtonStyle = {
    marginTop: '24px',
    padding: '14px 18px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    display: 'inline-flex',
    alignItems: 'center',
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
              従業員管理画面
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
            <Link href="/admin" style={subButtonStyle}>
              管理メニュー
            </Link>

            <button onClick={logout} style={subButtonStyle}>
              ログアウト
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '28px',
            alignItems: 'stretch',
          }}
        >
          <Link href="/admin/staff/card" style={menuCardStyle}>
            <div style={iconStyle}>📇</div>

            <div style={sectionTitleStyle}>従業員カード管理</div>

            <p style={menuDescriptionStyle}>
              従業員カードの新規発行、従業員コード検索、氏名登録、出勤数の更新を行います。
              月末一括リセットもこの画面から行います。
            </p>

            <div style={cardButtonStyle}>
              従業員カード管理へ
            </div>
          </Link>

          <Link href="/admin/staff/payroll" style={menuCardStyle}>
            <div style={iconStyle}>💰</div>

            <div style={sectionTitleStyle}>給与管理</div>

            <p style={menuDescriptionStyle}>
              出勤履歴と締め日時点スタンプ数をもとに、給与期間の作成、給与プレビュー、金庫・牧場利益の入力を行います。
            </p>

            <div style={cardButtonStyle}>
              給与管理へ
            </div>
          </Link>

          <Link href="/admin/staff/payroll/monthly" style={menuCardStyle}>
            <div style={iconStyle}>📊</div>

            <div style={sectionTitleStyle}>月次給与一覧</div>

            <p style={menuDescriptionStyle}>
              月ごとの前半・後半給与を横並びで確認します。
              従業員別支給額、月次集計、備考を一覧で確認できます。
            </p>

            <div style={cardButtonStyle}>
              月次給与一覧へ
            </div>
          </Link>

          <Link href="/admin/staff/payroll/rate-rules" style={menuCardStyle}>
            <div style={iconStyle}>⚙️</div>

            <div style={sectionTitleStyle}>単価ルール管理</div>

            <p style={menuDescriptionStyle}>
              スタンプ数に応じた給与単価ルールを作成・編集します。
              売上や運用状況に応じて単価を変更できます。
            </p>

            <div style={cardButtonStyle}>
              単価ルール管理へ
            </div>
          </Link>
        </div>

        <div
          style={{
            ...cardBoxStyle,
            marginTop: '28px',
          }}
        >
          <div style={sectionTitleStyle}>運用メモ</div>

          <p
            style={{
              fontSize: '20px',
              color: '#8a6457',
              marginTop: 0,
              marginBottom: 0,
              lineHeight: 1.7,
            }}
          >
            従業員カードは通常スタンプカードとは別管理です。出勤数は最大15までを想定しています。
            給与管理では、前半は1日〜15日、後半は16日〜月末を対象に集計します。
            1日の区切りはAM4:00基準です。
          </p>
        </div>
      </div>
    </div>
  )
}