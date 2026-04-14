export default function AdminSystemPage() {
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
          maxWidth: '980px',
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
            システム設定
          </h1>

          <p
            style={{
              margin: '14px 0 0 0',
              fontSize: '22px',
              color: '#9a6b5b',
              lineHeight: 1.8,
            }}
          >
            システム全体の設定や初期化を行う画面です。
          </p>
        </div>

        <div
          style={{
            background: '#fffaf8',
            border: '1px solid #f0d9d2',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(194, 144, 128, 0.10)',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              fontSize: '30px',
              fontWeight: 800,
              color: '#7a4b3a',
              marginBottom: '14px',
            }}
          >
            システム初期化
          </div>

          <p
            style={{
              margin: '0 0 18px 0',
              fontSize: '20px',
              lineHeight: 1.8,
              color: '#8a6457',
            }}
          >
            利用者データを全削除し、ID を 1 から再開したい場合に使用します。
            <br />
            通常のイベント切替ではなく、完全にやり直したいとき向けの機能です。
          </p>

          <a
            href="/admin/system/manage"
            style={{
              display: 'inline-block',
              padding: '16px 24px',
              borderRadius: '14px',
              border: '1px solid #e7b8aa',
              background: '#fff',
              color: '#8a4e3d',
              textDecoration: 'none',
              fontSize: '20px',
              fontWeight: 800,
            }}
          >
            システム初期化を開く
          </a>
        </div>

        <a
          href="/admin"
          style={{
            display: 'inline-block',
            padding: '14px 22px',
            fontSize: '20px',
            fontWeight: 700,
            borderRadius: '14px',
            border: '1px solid #e6c6bb',
            background: '#fff',
            color: '#7a4b3a',
            textDecoration: 'none',
          }}
        >
          管理メニューに戻る
        </a>
      </div>
    </div>
  )
}