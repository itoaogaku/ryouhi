import { num, compareMembersByGradeKana } from './utils.js'
import { MEAL_TRACKING_DORMS } from './constants.js'

// -------------------------------------------------------------
// 清算計算ロジック
// -------------------------------------------------------------
//
// 合計請求額 =
//     部費(一律 base_club_fee)
//   + 大会費合計   … 各大会（参加費 − 補助）の合計 ※0円未満は0円
//   + 合宿費合計   … 各合宿（1泊単価 × 泊数）の合計
//   + (治療費実費 − 治療費補助金)
//   + 佐川代
//   + その他費用合計 … 自由に名前を付けて追加できる項目（教材費・保険料など、
//     各項目 金額−補助 の合計。0円未満は0円）
//   + 食費 … 食べた寮ごとの単価（1寮/2寮で別設定）× 朝食数・夕食数の合計
// -------------------------------------------------------------

// 指定寮・食事の単価を config から取得する。
// 寮ごとの単価（例: breakfast_price_1寮）が未設定の場合は、
// 従来の共通単価（breakfast_price / dinner_price）にフォールバックする
export function mealPriceFor(config, dorm, meal) {
  const perDormKey = `${meal}_price_${dorm}`
  const v = config?.[perDormKey]
  if (v !== undefined && v !== null && v !== '') return num(v)
  return num(config?.[`${meal}_price`])
}

// 指定メンバー・年月の食数を meal_logs から集計（寮ごとの内訳つき）
export function countMeals(mealLogs, memberId, yearMonth) {
  let breakfast = 0
  let dinner = 0
  const byDorm = {}
  for (const log of mealLogs) {
    if (String(log.member_id) !== String(memberId)) continue
    if (!String(log.date || '').startsWith(yearMonth)) continue
    const dorm = log.dorm || ''
    if (!byDorm[dorm]) byDorm[dorm] = { breakfast: 0, dinner: 0 }
    if (log.breakfast) {
      breakfast += 1
      byDorm[dorm].breakfast += 1
    }
    if (log.dinner) {
      dinner += 1
      byDorm[dorm].dinner += 1
    }
  }
  return { breakfast, dinner, byDorm }
}

// 治療費の請求差額（マイナスにはしない）
export function medicalNet(expense) {
  return Math.max(0, num(expense.medical_actual) - num(expense.medical_subsidy))
}

// 大会1件の請求額（参加費 − 補助、0円未満は0円）
export function tournamentItemNet(item) {
  return Math.max(0, num(item.fee) - num(item.subsidy))
}

// 合宿1件の費用（1泊単価 × 泊数）
export function campItemCost(item) {
  return num(item.fee_per_night) * num(item.nights)
}

// その他費用1件の請求額（金額 − チーム補助、0円未満は0円）
export function otherItemNet(item) {
  return Math.max(0, num(item.amount) - num(item.subsidy))
}

// 1メンバー分の清算内訳を計算して返す
export function computeSettlement({
  member,
  expense,
  tournaments,
  camps,
  others,
  meals,
  config,
}) {
  const clubFee = num(config.base_club_fee)

  // 大会明細
  const tournamentRows = (tournaments || []).map((t) => ({
    name: t.name || '大会',
    fee: num(t.fee),
    subsidy: num(t.subsidy),
    net: tournamentItemNet(t),
  }))
  const tournamentGross = tournamentRows.reduce((a, r) => a + r.fee, 0)
  const tournamentSubsidy = tournamentRows.reduce((a, r) => a + r.subsidy, 0)
  const tournament = tournamentRows.reduce((a, r) => a + r.net, 0)

  // 合宿明細
  const campRows = (camps || []).map((c) => ({
    name: c.name || '合宿',
    perNight: num(c.fee_per_night),
    nights: num(c.nights),
    cost: campItemCost(c),
  }))
  const camp = campRows.reduce((a, r) => a + r.cost, 0)

  const medical = medicalNet(expense || {})
  const sagawa = num(expense?.sagawa_fee)

  // その他費用明細（自由記名の追加項目、チーム補助ありのケースにも対応）
  const otherRows = (others || []).map((o) => ({
    name: o.name || 'その他',
    amount: num(o.amount),
    subsidy: num(o.subsidy),
    net: otherItemNet(o),
  }))
  const otherGross = otherRows.reduce((a, r) => a + r.amount, 0)
  const otherSubsidy = otherRows.reduce((a, r) => a + r.subsidy, 0)
  const other = otherRows.reduce((a, r) => a + r.net, 0)

  const breakfastCount = num(meals?.breakfast)
  const dinnerCount = num(meals?.dinner)

  // 食べた寮ごとに単価をかけて合計する（1寮/2寮で単価が異なる場合に対応）
  const byDorm = meals?.byDorm || {}
  const recognizedDorms = new Set(MEAL_TRACKING_DORMS)
  let breakfastFee = 0
  let dinnerFee = 0
  for (const dorm of MEAL_TRACKING_DORMS) {
    const counts = byDorm[dorm] || { breakfast: 0, dinner: 0 }
    breakfastFee += counts.breakfast * mealPriceFor(config, dorm, 'breakfast')
    dinnerFee += counts.dinner * mealPriceFor(config, dorm, 'dinner')
  }
  // 寮が未設定・不明な古いデータは共通単価にフォールバックする
  for (const [dorm, counts] of Object.entries(byDorm)) {
    if (recognizedDorms.has(dorm)) continue
    breakfastFee += counts.breakfast * num(config.breakfast_price)
    dinnerFee += counts.dinner * num(config.dinner_price)
  }
  const mealFee = breakfastFee + dinnerFee

  const total =
    clubFee + tournament + camp + medical + sagawa + other + mealFee

  return {
    memberId: member.id,
    name: member.name,
    rank: member.rank,
    group: member.group,
    // 大会
    tournamentRows,
    tournamentGross,
    tournamentSubsidy,
    tournament,
    // 合宿
    campRows,
    camp,
    // 治療
    medical,
    medicalActual: num(expense?.medical_actual),
    medicalSubsidy: num(expense?.medical_subsidy),
    // その他（自由記名の追加項目）
    otherRows,
    otherGross,
    otherSubsidy,
    other,
    // 固定項目
    clubFee,
    sagawa,
    // 食費
    breakfastCount,
    dinnerCount,
    breakfastFee,
    dinnerFee,
    mealFee,
    total,
  }
}

// member_id ごとに明細アイテムをまとめる helper
function groupByMember(items, yearMonth) {
  const map = new Map()
  for (const it of items || []) {
    if (yearMonth && it.year_month && it.year_month !== yearMonth) continue
    const key = String(it.member_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(it)
  }
  return map
}

// 全（在籍）メンバーの清算行を作成
export function buildSettlementRows({
  members,
  expenses,
  tournamentItems,
  campItems,
  otherItems,
  mealLogs,
  config,
  yearMonth,
}) {
  const expenseByMember = new Map()
  for (const e of expenses) {
    if (e.year_month === yearMonth) {
      expenseByMember.set(String(e.member_id), e)
    }
  }
  const tournamentsByMember = groupByMember(tournamentItems, yearMonth)
  const campsByMember = groupByMember(campItems, yearMonth)
  const othersByMember = groupByMember(otherItems, yearMonth)

  return members
    .filter((m) => m.active)
    .slice()
    .sort(compareMembersByGradeKana)
    .map((member) => {
      const expense = expenseByMember.get(String(member.id))
      const tournaments = tournamentsByMember.get(String(member.id)) || []
      const camps = campsByMember.get(String(member.id)) || []
      const others = othersByMember.get(String(member.id)) || []
      const meals = countMeals(mealLogs, member.id, yearMonth)
      return computeSettlement({
        member,
        expense,
        tournaments,
        camps,
        others,
        meals,
        config,
      })
    })
}

// グループごとに清算行をまとめる（PDF改ページ用）
export function groupSettlementRows(rows, groups) {
  return groups
    .map((group) => ({
      group,
      rows: rows.filter((r) => r.group === group),
    }))
    .filter((g) => g.rows.length > 0)
}

// 合計を集計
export function sumTotals(rows) {
  return rows.reduce((acc, r) => acc + r.total, 0)
}
