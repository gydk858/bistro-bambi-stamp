import Link from 'next/link'

export default function AdminAttendancePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff8f4 0%, #fffdfb 100%)',
        padding: '32px',
        color: '#5f4137',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fffaf8',
            border: '1px solid #f0d9d2',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
          }}
        >
          <h1
            style={{
              fontSize: '40px',
              fontWeight: 900,
              color: '#7a4b3a',
              marginTop: 0,
              marginBottom: '12px',
            }}
          >
            出退勤管理
          </h1>

          <p
            style={{
              fontSize: '20px',
              lineHeight: 1.8,
              color: '#8a6457',
              marginTop: 0,
              marginBottom: '24px',
            }}
          >
            この画面はこれから実装します。次の段階で、出勤・退勤・勤務状況確認の機能を追加します。
          </p>

          <Link
            href="/admin"
            style={{
              padding: '16px 24px',
              fontSize: '18px',
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
            管理メニューへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}