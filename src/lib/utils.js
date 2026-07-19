// 汎用ユーティリティ

// className を結合する簡易 helper（shadcn の cn 相当）
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// 数値を「¥1,234」形式にフォーマット
export function formatYen(value) {
  const n = Number(value) || 0
  return '¥' + Math.round(n).toLocaleString('ja-JP')
}

// 数値をカンマ区切りに（記号なし）
export function formatNumber(value) {
  const n = Number(value) || 0
  return Math.round(n).toLocaleString('ja-JP')
}

// YYYY-MM 文字列を生成
export function toYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

// YYYY-MM-DD 文字列を生成
export function toDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// 「2026年7月」形式の表示
export function formatYearMonthJa(year, month) {
  return `${year}年${month}月`
}

// 指定年月の日数を取得
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

// 曜日ラベル（0=日）
export const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土']

// 指定日の曜日インデックスを取得
export function weekdayOf(year, month, day) {
  return new Date(year, month - 1, day).getDay()
}

// 空の月次経費レコードを生成
export function emptyExpense(memberId, yearMonth) {
  return {
    year_month: yearMonth,
    member_id: memberId,
    tournament_fee: 0,
    tournament_support_rate: 0,
    camp_fee_per_night: 0,
    camp_nights: 0,
    medical_actual: 0,
    medical_subsidy: 0,
    sagawa_fee: 0,
    wear_fee: 0,
  }
}

// 安全に数値化
export function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// クライアント側の一意ID（React key / 明細行の識別用）
let _uidSeq = 0
export function uid() {
  _uidSeq += 1
  return 'x' + Date.now().toString(36) + _uidSeq.toString(36)
}

// 空の大会明細（参加費 − 補助 = 請求）
export function emptyTournamentItem() {
  return { uid: uid(), name: '', fee: 0, subsidy: 0 }
}

// 空の合宿明細（1泊単価 × 泊数 = 費用）
export function emptyCampItem() {
  return { uid: uid(), name: '', fee_per_night: 2700, nights: 0 }
}

// 空のその他費用明細（名前を自由に付けられる追加項目。例: 教材費・保険料など）
export function emptyOtherItem() {
  return { uid: uid(), name: '', amount: 0 }
}
