export default function AdminMenuPage() {
  const cardStyle = {
    background: '#fffaf8',
    border: '1px solid #f0d9d2',
    borderRadius: '20px',
    padding: '28px',
    color: '#7a4b3a',
    boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
  }

  const primaryMenuButtonStyle = {
    display: 'inline-block',
    padding: '16px 24px',
    borderRadius: '14px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    textDecoration: 'none',
    fontSize: '20px',
    fontWeight: 800,
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.25)',
  }

  const secondaryMenuButtonStyle = {
    display: 'inline-block',
    padding: '16px 24px',
    borderRadius: '14px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    textDecoration: 'none',
    fontSize: '20px',
    fontWeight: 800,
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
          maxWidth: '1100px',
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
            -Bistro-Bambi
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.8,
            }}
          >
            管理メニューです。使用するカード管理画面を選んでください。
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '24px',
            marginBottom: '28px',
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
                marginBottom: '12px',
              }}
            >
              スタンプカード管理
            </div>

            <div
              style={{
                fontSize: '20px',
                lineHeight: 1.8,
                color: '#8a6457',
                marginBottom: '20px',
              }}
            >
              新規発行、検索、氏名登録、スタンプ更新を行います。
            </div>

            <a href="/admin/stamp" style={primaryMenuButtonStyle}>
              スタンプカード管理を開く
            </a>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 800,
                marginBottom: '12px',
              }}
            >
              ビンゴカード管理
            </div>

            <div
              style={{
                fontSize: '20px',
                lineHeight: 1.8,
                color: '#8a6457',
                marginBottom: '20px',
              }}
            >
              新規発行、検索、氏名登録、番号開放、商品マッピングを行います。
            </div>

            <a href="/admin/bingo" style={primaryMenuButtonStyle}>
              ビンゴカード管理を開く
            </a>
          </div>
        </div>

        <div
          style={{
            background: '#fffaf8',
            border: '1px solid #f0d9d2',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
          }}
        >
          <div
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: '#7a4b3a',
              marginBottom: '14px',
            }}
          >
            システム設定
          </div>

          <p
            style={{
              margin: '0 0 18px 0',
              fontSize: '20px',
              lineHeight: 1.8,
              color: '#8a6457',
            }}
          >
            システム全体の設定や初期化機能はこちらから進めます。
          </p>

          <a href="/admin/system" style={secondaryMenuButtonStyle}>
            システム設定へ
          </a>
        </div>
      </div>
    </div>
  )
}