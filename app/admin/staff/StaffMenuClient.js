'use client'

export default function StaffMenuClient() {
  const menuItems = [
    {
      title: '従業員一覧・退職管理',
      icon: '👥',
      description: '従業員名、在籍状況、退職日、メモを管理します。',
      href: '/admin/staff/employees',
      buttonLabel: '従業員一覧を開く',
    },
    {
      title: '従業員カード管理',
      icon: '📇',
      description: '従業員カードの発行、検索、氏名変更、出勤数の確認・調整を行います。',
      href: '/admin/staff/card',
      buttonLabel: '従業員カード管理を開く',
    },
    {
      title: '給与管理',
      icon: '💰',
      description: '給与期間作成、履歴からの給与プレビュー、金庫・牧場情報の保存を行います。',
      href: '/admin/staff/payroll',
      buttonLabel: '給与管理を開く',
    },
    {
      title: '給与履歴一覧',
      icon: '📚',
      description: 'スプレッドシート形式で、従業員別・前半/後半別の出勤数と給与履歴を確認します。',
      href: '/admin/staff/payroll/history',
      buttonLabel: '給与履歴一覧を開く',
    },
    {
      title: '月次給与一覧',
      icon: '📊',
      description: '月ごとの給与期間、支払額、金庫・利益情報を確認します。',
      href: '/admin/staff/payroll/monthly',
      buttonLabel: '月次給与一覧を開く',
    },
    {
      title: '単価ルール管理',
      icon: '🧾',
      description: 'スタンプ数に応じた給与単価ルールを作成・編集・削除します。',
      href: '/admin/staff/payroll/rate-rules',
      buttonLabel: '単価ルール管理を開く',
    },
    {
      title: '月末一括リセット',
      icon: '↺',
      description: '給与確認後、翌月運用開始前に従業員カードの現在出勤数を一括で0に戻します。',
      href: '/admin/staff/manage',
      buttonLabel: '一括リセット画面を開く',
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
              <p style={styles.subtitle}>従業員管理メニュー</p>
              <p style={styles.headerDescription}>
                従業員情報、出勤カード、給与計算、給与履歴、月末リセットを管理します。
              </p>
            </div>
          </div>

          <nav style={styles.nav}>
            <a href="/admin" style={styles.navButton}>
              管理メニュー
            </a>
          </nav>
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

        <section style={styles.memoPanel}>
          <div style={styles.memoBadge}>OPERATION</div>
          <h2 style={styles.memoTitle}>現在の運用</h2>

          <div style={styles.memoGrid}>
            <div style={styles.memoItem}>
              <div style={styles.memoLabel}>出勤操作</div>
              <p style={styles.memoText}>
                従業員の出勤スタンプは、基本的にDiscord側で操作します。
              </p>
            </div>

            <div style={styles.memoItem}>
              <div style={styles.memoLabel}>給与計算</div>
              <p style={styles.memoText}>
                給与は出勤履歴とスタンプ履歴をもとに、前半・後半で集計します。
              </p>
            </div>

            <div style={styles.memoItem}>
              <div style={styles.memoLabel}>給与履歴</div>
              <p style={styles.memoText}>
                給与履歴一覧では、従業員別・月前半/後半別に出勤数と給与額を確認できます。
              </p>
            </div>

            <div style={styles.memoItem}>
              <div style={styles.memoLabel}>退職者管理</div>
              <p style={styles.memoText}>
                退職済みにした従業員は、通常一覧では非表示にできます。過去の給与履歴は削除されません。
              </p>
            </div>

            <div style={styles.memoItem}>
              <div style={styles.memoLabel}>月末処理</div>
              <p style={styles.memoText}>
                給与確認後、翌月開始前に月末一括リセットでカード上の現在出勤数を0に戻します。
              </p>
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '18px',
    flexWrap: 'wrap',
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
    fontSize: '22px',
    color: theme.deep,
    lineHeight: 1.5,
    fontWeight: 900,
  },
  headerDescription: {
    margin: '6px 0 0',
    fontSize: '15px',
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
    borderRadius: '12px',
    border: `1px solid ${theme.border2}`,
    background: theme.white,
    color: theme.deep,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
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
    fontSize: '27px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    lineHeight: 1.35,
  },
  cardDescription: {
    fontSize: '16px',
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
  memoPanel: {
    marginTop: '20px',
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '22px',
    padding: '24px',
    boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
  },
  memoBadge: {
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
  memoTitle: {
    fontSize: '28px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  memoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '14px',
    marginTop: '16px',
  },
  memoItem: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '16px',
    padding: '16px',
  },
  memoLabel: {
    fontSize: '14px',
    color: theme.deep,
    fontWeight: 950,
    marginBottom: '8px',
  },
  memoText: {
    fontSize: '14px',
    color: theme.muted,
    lineHeight: 1.75,
    margin: 0,
  },
}