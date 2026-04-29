'use client'

export default function StaffMenuClient() {
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

  const linkButtonStyle = {
    padding: '16px 24px',
    fontSize: '20px',
    fontWeight: 700,
    borderRadius: '14px',
    border: 'none',
    background: '#d98b7b',
    color: '#fff',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(217, 139, 123, 0.25)',
  }

  const subLinkButtonStyle = {
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
              従業員管理
            </h1>
            <p
              style={{
                margin: '10px 0 0 0',
                fontSize: '22px',
                color: '#9a6b5b',
              }}
            >
              従業員カード管理や、今後追加する給与管理はこちらから進みます。
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <a href="/admin" style={subLinkButtonStyle}>
              管理メニューへ戻る
            </a>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '28px',
            alignItems: 'start',
          }}
        >
          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>① 従業員カード管理</div>
            <p
              style={{
                fontSize: '20px',
                color: '#8a6457',
                marginTop: 0,
                marginBottom: '18px',
                lineHeight: 1.7,
              }}
            >
              従業員コードの発行、検索、氏名登録、出勤数更新を行います。
              月末の一括リセットなどの運用処理は、この先の従業員カード管理画面から進めます。
            </p>

            <a href="/admin/staff/card" style={linkButtonStyle}>
              従業員カード管理を開く
            </a>
          </div>

          <div style={cardBoxStyle}>
            <div style={sectionTitleStyle}>② 給与管理</div>
            <p
              style={{
                fontSize: '20px',
                color: '#8a6457',
                marginTop: 0,
                marginBottom: '18px',
                lineHeight: 1.7,
              }}
            >
              将来的に、従業員カードの出勤数を参照して給与計算や確認に使う予定です。
            </p>

            <div
              style={{
                ...subLinkButtonStyle,
                cursor: 'default',
                opacity: 0.8,
              }}
            >
              準備中
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}