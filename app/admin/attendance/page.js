import Link from 'next/link'

export default function AdminAttendancePage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <section style={styles.panel}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>🕒</div>
            <div>
              <h1 style={styles.title}>-Bistro-Bambi</h1>
              <p style={styles.subtitle}>出退勤管理</p>
            </div>
          </div>

          <div style={styles.noticeBox}>
            <div style={styles.noticeBadge}>COMING SOON</div>
            <h2 style={styles.noticeTitle}>この画面はこれから実装します</h2>
            <p style={styles.noticeText}>
              次の段階で、出勤・退勤・勤務状況確認の機能を追加します。
              現在の従業員出勤数は、Discordの従業員カード操作と給与管理画面で管理します。
            </p>
          </div>

          <div style={styles.actionRow}>
            <Link href="/admin" style={styles.navButton}>
              管理メニューへ戻る
            </Link>

            <Link href="/admin/staff" style={styles.navButton}>
              従業員管理へ
            </Link>

            <Link href="/admin/staff/payroll" style={styles.primaryButton}>
              給与管理へ
            </Link>
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
    maxWidth: '1100px',
    margin: '0 auto',
  },
  panel: {
    background: theme.panel,
    border: `1px solid ${theme.border}`,
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 12px 30px rgba(47, 74, 52, 0.08)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  brandMark: {
    width: '58px',
    height: '58px',
    borderRadius: '18px',
    background: theme.pale,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '30px',
    border: `1px solid ${theme.border2}`,
  },
  title: {
    fontSize: '38px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '8px 0 0',
    fontSize: '20px',
    color: theme.deep,
    fontWeight: 900,
  },
  noticeBox: {
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: '18px',
    padding: '22px',
  },
  noticeBadge: {
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
  noticeTitle: {
    fontSize: '26px',
    fontWeight: 950,
    color: theme.deep,
    margin: 0,
  },
  noticeText: {
    fontSize: '16px',
    lineHeight: 1.8,
    color: theme.muted,
    margin: '12px 0 0',
  },
  actionRow: {
    marginTop: '20px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  navButton: {
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
  },
  primaryButton: {
    padding: '13px 17px',
    fontSize: '15px',
    fontWeight: 900,
    borderRadius: '12px',
    border: 'none',
    background: theme.green,
    color: theme.white,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    boxShadow: '0 8px 18px rgba(82, 120, 90, 0.22)',
  },
}