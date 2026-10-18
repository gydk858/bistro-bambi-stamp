export function formatStaffTime(value) {
  if (value === null || value === undefined) return '未登録'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '時刻を確認できません'
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}

export function staffFixDescription(operatorName, details) {
  const title = `${operatorName} さんが勤務時間を修正しました。`
  if (!details?.work_date || !details?.after) return `${title}\n変更内容を取得できませんでした。勤務記録を確認してください。`
  return [
    title,
    `対象日：${details.work_date}（時刻は日本時間）`,
    `出勤：${formatStaffTime(details.before?.clock_in_at)} → ${formatStaffTime(details.after.clock_in_at)}`,
    `退勤：${formatStaffTime(details.before?.clock_out_at)} → ${formatStaffTime(details.after.clock_out_at)}`,
  ].join('\n')
}
