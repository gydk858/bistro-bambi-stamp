
import theme from '@/lib/ui-theme'
export default function AdminSystemPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>⚙️</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>システム設定</p>
              <p style={styles.headerDescription}>
                システム全体の設定や初期化を行う管理者向け画面です。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>
          </nav>
        </header>

        <section style={styles.warningPanel}>
          <div style={styles.warningBadge}>SYSTEM</div>
          <h2 style={styles.warningTitle}>システム操作について</h2>
          <p style={styles.warningText}>
            通常のイベント切替や月末処理ではなく、システムを完全にやり直したい場合に使う画面です。
            実行前に削除対象を必ず確認してください。
          </p>
        </section>

        <section style={styles.panel}>
          <div style={styles.iconBox}>!</div>

          <h2 style={styles.sectionTitle}>システム初期化</h2>

          <p style={styles.description}>
            利用者データを全削除し、ID を 1 から再開したい場合に使用します。
            通常のイベント切替ではなく、完全にやり直したいとき向けの機能です。
          </p>

          <a href="/admin/system/manage" style={styles.dangerButton}>
            システム初期化を開く
          </a>
        </section>
      </div>
    </div>
  )
}



const styles = {
  page: {
    minHeight: '65vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    color: theme.text,
    padding: '24px',
  },
  container: {
    maxWidth: '1180px',
    margin: '0 auto',
  },
  header: {
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    padding: '24px 28px',
    marginBottom: '18px',
    boxShadow: 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  brandMark: {
    width: '58px',
    height: '58px',
    borderRadius: '4px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    border: `1px solid ${theme.border2}`,
  },
  title: {
    fontFamily: 'var(--font-heading)',
    fontSize: '38px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontFamily: 'var(--font-heading)',
    margin: '8px 0 0',
    fontSize: '20px',
    color: theme.deep,
    fontWeight: 900,
  },
  headerDescription: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.6,
  },
  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  navButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 800,
    borderRadius: '4px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  warningPanel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    padding: '20px',
    boxShadow: 'none',
    marginBottom: '18px',
  },
  warningBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '4px',
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    color: theme.deep,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  warningTitle: {
    fontSize: '24px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  warningText: {
    fontSize: '15px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '10px 0 0',
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '4px',
    padding: '24px',
    boxShadow: 'none',
  },
  iconBox: {
    width: '58px',
    height: '58px',
    borderRadius: '4px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    fontWeight: 950,
    color: theme.danger,
    border: `1px solid ${theme.border2}`,
    marginBottom: '18px',
  },
  sectionTitle: {
    fontSize: '26px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    lineHeight: 1.35,
  },
  description: {
    fontSize: '16px',
    color: theme.muted,
    lineHeight: 1.8,
    margin: '14px 0 20px',
  },
  dangerButton: {
    padding: '14px 18px',
    fontSize: '16px',
    fontWeight: 950,
    borderRadius: '4px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.danger,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}