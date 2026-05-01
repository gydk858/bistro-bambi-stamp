'use client'

export default function AdminMenuClient() {
  const menuItems = [
    {
      title: 'スタンプカード管理',
      icon: '🌿',
      description: '新規発行、検索、氏名登録、スタンプ更新を行います。',
      href: '/admin/stamp',
      buttonLabel: 'スタンプカード管理を開く',
    },
    {
      title: 'ビンゴカード管理',
      icon: '🎯',
      description: '新規発行、検索、氏名登録、番号開放、商品マッピングを行います。',
      href: '/admin/bingo',
      buttonLabel: 'ビンゴカード管理を開く',
    },
    {
      title: '従業員管理',
      icon: '📇',
      description: '従業員カード管理、Discord出勤履歴、給与管理はこちらから進みます。',
      href: '/admin/staff',
      buttonLabel: '従業員管理を開く',
    },
  ]

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🦌</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>
                管理メニューです。使用する管理画面を選んでください。
              </p>
            </div>
          </div>
        </header>

        <section style={styles.menuGrid}>
          {menuItems.map((item) => (
            <a key={item.href} href={item.href} style={styles.menuCard}>
              <div>
                <div style={styles.iconBox}>{item.icon}</div>
                <h2 style={styles.cardTitle}>{item.title}</h2>
                <p style={styles.cardDescription}>{item.description}</p>
              </div>

              <div style={styles.cardButtonPrimary}>
                {item.buttonLabel}
              </div>
            </a>
          ))}
        </section>

        <section style={styles.widePanel}>
          <div style={styles.panelContent}>
            <div>
              <div style={styles.panelBadge}>SYSTEM</div>
              <h2 style={styles.panelTitle}>システム設定</h2>
              <p style={styles.panelDescription}>
                システム全体の設定、店舗設定、初期化機能はこちらから進めます。
              </p>
            </div>

            <div style={styles.buttonGroup}>
              <a href="/admin/system" style={styles.secondaryButton}>
                システム設定へ
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

const theme = {
  bg: '#eef2ec',
  bg2: '#f7faf5',
  panel: '#fbfdf9',
  panel2: '#f3f7ef',
  border: '#d8e3d2',
  border2: '#c4d3bd',
  text: '#263427',
  muted: '#6c7b67',
  deep: '#2f4a34',
  green: '#52785a',
  pale: '#e6efe1',
  white: '#ffffff',
}

const styles = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bg2} 100%)`,
    padding: '24px',
    color: theme.text,
  },
  container: {
    maxWidth: '1540px',
    margin: '0 auto',
  },
  header: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '24px',
    padding: '28px 32px',
    marginBottom: '24px',
    boxShadow: '0 12px 30px rgba(47, 74, 52, 0.08)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
  },
  brandMark: {
    width: '64px',
    height: '64px',
    borderRadius: '20px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '34px',
    border: `1px solid ${theme.border2}`,
  },
  title: {
    fontSize: '42px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '10px 0 0',
    fontSize: '20px',
    color: theme.muted,
    lineHeight: 1.6,
  },
  menuGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '20px',
    alignItems: 'stretch',
  },
  menuCard: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '22px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textDecoration: 'none',
    color: theme.text,
  },
  iconBox: {
    width: '62px',
    height: '62px',
    borderRadius: '18px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '31px',
    border: `1px solid ${theme.border2}`,
    marginBottom: '18px',
  },
  cardTitle: {
    fontSize: '28px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    lineHeight: 1.35,
  },
  cardDescription: {
    fontSize: '17px',
    color: theme.muted,
    lineHeight: 1.75,
    margin: '14px 0 0',
  },
  cardButtonPrimary: {
    marginTop: '24px',
    padding: '13px 17px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 'fit-content',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
  widePanel: {
    marginTop: '20px',
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '22px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  panelContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '24px',
    flexWrap: 'wrap',
  },
  panelBadge: {
    display: 'inline-flex',
    padding: '6px 10px',
    borderRadius: '999px',
    background: theme.pale,
    border: `1px solid ${theme.border2}`,
    color: theme.deep,
    fontSize: '12px',
    fontWeight: 950,
    marginBottom: '10px',
    letterSpacing: '0.08em',
  },
  panelTitle: {
    fontSize: '30px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  panelDescription: {
    fontSize: '17px',
    color: theme.muted,
    lineHeight: 1.75,
    margin: '12px 0 0',
    maxWidth: '920px',
  },
  buttonGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  secondaryButton: {
    padding: '12px 16px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}