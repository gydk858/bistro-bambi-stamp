'use client'

export default function AdminMenuClient() {
  const cardStyle = {
    background: '#fffaf8',
    border: '1px solid #f0d9d2',
    borderRadius: '20px',
    padding: '32px 36px',
    boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  }

  const titleStyle = {
    fontSize: '44px',
    fontWeight: 900,
    color: '#7a4b3a',
    margin: 0,
  }

  const sectionTitleStyle = {
    fontSize: '34px',
    fontWeight: 900,
    color: '#7a4b3a',
    margin: 0,
    lineHeight: 1.3,
  }

  const descriptionStyle = {
    fontSize: '22px',
    color: '#8a6457',
    lineHeight: 1.8,
    margin: '18px 0 0 0',
  }

  const primaryButtonStyle = {
    padding: '18px 28px',
    fontSize: '20px',
    fontWeight: 800,
    borderRadius: '16px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.25)',
    width: 'fit-content',
  }

  const subButtonStyle = {
    padding: '18px 28px',
    fontSize: '20px',
    fontWeight: 800,
    borderRadius: '16px',
    border: '1px solid #e6c6bb',
    background: '#fff',
    color: '#7a4b3a',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fff8f4 0%, #fffdfb 100%)',
        padding: '14px',
        color: '#5f4137',
      }}
    >
      <div
        style={{
          maxWidth: '1540px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: '#fff6f1',
            border: '1px solid #f2ddd5',
            borderRadius: '28px',
            padding: '32px 40px',
            marginBottom: '38px',
            boxShadow: '0 12px 30px rgba(201, 157, 145, 0.10)',
          }}
        >
          <h1 style={titleStyle}>-Bistro-Bambi</h1>
          <p
            style={{
              margin: '18px 0 0 0',
              fontSize: '26px',
              color: '#9a6b5b',
              lineHeight: 1.7,
            }}
          >
            管理メニューです。使用するカード管理画面を選んでください。
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '28px',
            alignItems: 'stretch',
          }}
        >
          <div style={cardStyle}>
            <div>
              <h2 style={sectionTitleStyle}>スタンプカード管理</h2>
              <p style={descriptionStyle}>
                新規発行、検索、氏名登録、スタンプ更新を行います。
              </p>
            </div>

            <a href="/admin/stamp" style={primaryButtonStyle}>
              スタンプカード管理を開く
            </a>
          </div>

          <div style={cardStyle}>
            <div>
              <h2 style={sectionTitleStyle}>ビンゴカード管理</h2>
              <p style={descriptionStyle}>
                新規発行、検索、氏名登録、番号開放、商品マッピングを行います。
              </p>
            </div>

            <a href="/admin/bingo" style={primaryButtonStyle}>
              ビンゴカード管理を開く
            </a>
          </div>

          <div style={cardStyle}>
            <div>
              <h2 style={sectionTitleStyle}>従業員管理</h2>
              <p style={descriptionStyle}>
                従業員カード管理や、今後追加する給与管理はこちらから進みます。
              </p>
            </div>

            <a href="/admin/staff" style={primaryButtonStyle}>
              従業員管理を開く
            </a>
          </div>
        </div>

        <div
          style={{
            marginTop: '38px',
            background: '#fffaf8',
            border: '1px solid #f0d9d2',
            borderRadius: '20px',
            padding: '32px 36px',
            boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
          }}
        >
          <h2
            style={{
              fontSize: '34px',
              fontWeight: 900,
              color: '#7a4b3a',
              margin: 0,
            }}
          >
            システム設定
          </h2>

          <p
            style={{
              fontSize: '22px',
              color: '#8a6457',
              lineHeight: 1.8,
              margin: '18px 0 28px 0',
            }}
          >
            システム全体の設定や初期化機能はこちらから進めます。
          </p>

          <a href="/admin/system" style={subButtonStyle}>
            システム設定へ
          </a>
        </div>
      </div>
    </div>
  )
}