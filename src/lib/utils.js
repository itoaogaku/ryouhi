// 汎用ユーティリティ

import { GRADES, isFemaleMember } from './constants.js'

// className を結合する簡易 helper（shadcn の cn 相当）
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

// 一覧・PDFの基本の並び順: 男子→女子、各グループ内は学年が上（4年）から下（1年）、
// 同学年内は読み仮名（無ければ氏名）の五十音順
export function compareMembersByGradeKana(a, b) {
  const fa = isFemaleMember(a) ? 1 : 0
  const fb = isFemaleMember(b) ? 1 : 0
  if (fa !== fb) return fa - fb
  const gi = (m) => {
    const idx = GRADES.indexOf(m?.grade)
    // 学年が高い方を先に（不明な学年は最後）
    return idx === -1 ? GRADES.length : GRADES.length - 1 - idx
  }
  const ga = gi(a)
  const gb = gi(b)
  if (ga !== gb) return ga - gb
  const ka = a?.name_kana || a?.name || ''
  const kb = b?.name_kana || b?.name || ''
  return ka.localeCompare(kb, 'ja')
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
    motivation_count: 0,
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

// 空のその他費用明細（名前を自由に付けられる追加項目。例: 教材費・保険料など。
// 金額 − 補助 = 請求額で、チームが一部負担するケースにも対応）
export function emptyOtherItem() {
  return { uid: uid(), name: '', amount: 0, subsidy: 0 }
}

// 旧グループ名（例: 1階3階）を現在の名称（3階）に正規化する
export function normalizeGroup(group, aliases) {
  return (aliases && aliases[group]) || group
}
