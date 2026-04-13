import Link from 'next/link'

const menuItems = [
  {
    href: '/admin/stamp',
    title: 'スタンプカード管理',
    description: 'スタンプカードの新規発行、検索、氏名登録、スタンプ更新を行います。',
    accent: '#d98b7b',
  },
  {
    href: '/admin/bingo',
    title: 'ビンゴカード管理',
    description: 'ビンゴカードの発行、番号開放、進捗確認を行います。',
    accent: '#c68d7b',
  },
  {
    href: '/admin/attendance',
    title: '出退勤管理',
    description: '出勤・退勤の打刻や勤務状況の確認を行います。',
    accent: '#b9856f',
  },
  {
    href: '/admin/settings',
    title: '設定・管理者画面',
    description: '各種設定やメンテナンスを行います。',
    accent: '#a87563',
  },
]

export default function AdminMenuPage() {
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
              管理メニュー
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
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
            </Link>

            <form action="/api/admin-logout" method="POST">
              <button
                type="submit"
                style={{
                  padding: '16px 24px',
                  fontSize: '20px',
                  fontWeight: 700,
                  borderRadius: '14px',
                  border: '1px solid #e6c6bb',
                  background: '#fff',
                  color: '#7a4b3a',
                  cursor: 'pointer',
                }}
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#fffaf8',
                  border: '1px solid #f0d9d2',
                  borderRadius: '24px',
                  padding: '28px',
                  boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: item.accent,
                    marginBottom: '18px',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.08)',
                  }}
                />
                <h2
                  style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: '#7a4b3a',
                    margin: '0 0 12px 0',
                  }}
                >
                  {item.title}
                </h2>
                <p
                  style={{
                    fontSize: '19px',
                    lineHeight: 1.8,
                    color: '#8a6457',
                    margin: 0,
                  }}
                >
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}