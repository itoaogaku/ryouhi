import { num } from './utils.js'

// -------------------------------------------------------------
// 清算計算ロジック
// -------------------------------------------------------------
//
// 合計請求額 =
//     部費(一律 base_club_fee)
//   + 大会費 × (1 - 補助率/100)
//   + 合宿単価 × 泊数
//   + (治療費実費 - 治療費補助金)
//   + 佐川代
//   + ウエア代
//   + 食費(朝食数 × 朝食単価 + 夕食数 × 夕食単価)
// -------------------------------------------------------------

// 指定メンバー・年月の食数を meal_logs から集計
export function countMeals(mealLogs, memberId, yearMonth) {
  let breakfast = 0
  let dinner = 0
  for (const log of mealLogs) {
    if (String(log.member_id) !== String(memberId)) continue
    if (!String(log.date || '').startsWith(yearMonth)) continue
    if (log.breakfast) breakfast += 1
    if (log.dinner) dinner += 1
  }
  return { breakfast, dinner }
}

// 治療費の請求差額（マイナスにはしない）
export function medicalNet(expense) {
  return Math.max(0, num(expense.medical_actual) - num(expense.medical_subsidy))
}

// 1メンバー分の清算内訳を計算して返す
export function computeSettlement({ member, expense, meals, config }) {
  const clubFee = num(config.base_club_fee)

  const tournamentGross = num(expense?.tournament_fee)
  const supportRate = num(expense?.tournament_support_rate)
  const tournament = Math.round(tournamentGross * (1 - supportRate / 100))

  const camp = num(expense?.camp_fee_per_night) * num(expense?.camp_nights)

  const medical = medicalNet(expense || {})

  const sagawa = num(expense?.sagawa_fee)
  const wear = num(expense?.wear_fee)

  const breakfastCount = num(meals?.breakfast)
  const dinnerCount = num(meals?.dinner)
  const breakfastFee = breakfastCount * num(config.breakfast_price)
  const dinnerFee = dinnerCount * num(config.dinner_price)
  const mealFee = breakfastFee + dinnerFee

  const total =
    clubFee + tournament + camp + medical + sagawa + wear + mealFee

  return {
    memberId: member.id,
    name: member.name,
    rank: member.rank,
    group: member.group,
    // 内訳
    clubFee,
    tournament,
    tournamentGross,
    supportRate,
    camp,
    campPerNight: num(expense?.camp_fee_per_night),
    campNights: num(expense?.camp_nights),
    medical,
    medicalActual: num(expense?.medical_actual),
    medicalSubsidy: num(expense?.medical_subsidy),
    sagawa,
    wear,
    breakfastCount,
    dinnerCount,
    breakfastFee,
    dinnerFee,
    mealFee,
    total,
  }
}

// 全（在籍）メンバーの清算行を作成
export function buildSettlementRows({ members, expenses, mealLogs, config, yearMonth }) {
  const expenseByMember = new Map()
  for (const e of expenses) {
    if (e.year_month === yearMonth) {
      expenseByMember.set(String(e.member_id), e)
    }
  }

  return members
    .filter((m) => m.active)
    .map((member) => {
      const expense = expenseByMember.get(String(member.id))
      const meals = countMeals(mealLogs, member.id, yearMonth)
      return computeSettlement({ member, expense, meals, config })
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
