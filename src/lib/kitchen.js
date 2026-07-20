import { MEAL_TRACKING_DORMS, GUEST_CATEGORIES } from './constants.js'
import { compareMembersByGradeKana } from './utils.js'

// -------------------------------------------------------------
// 調理人向け食数集計ロジック
// -------------------------------------------------------------
// 指定日の食数を「寮 × 種別（寮生／見学高校生／寮外生／寮管）」で
// 取りまとめ、調理人が仕込む数を一目で確認できる形に整形します。
// -------------------------------------------------------------

// 指定日・指定寮の在籍寮生食数を集計
function summarizeMembersForDorm(members, mealLogs, date, dorm) {
  let breakfast = 0
  let dinner = 0
  const entries = []
  for (const log of mealLogs) {
    if (log.date !== date) continue
    if ((log.dorm || '') !== dorm) continue
    if (!log.breakfast && !log.dinner) continue
    const member = members.find((m) => String(m.id) === String(log.member_id))
    if (!member) continue
    if (log.breakfast) breakfast += 1
    if (log.dinner) dinner += 1
    entries.push({
      member,
      name: member.name,
      breakfast: !!log.breakfast,
      dinner: !!log.dinner,
    })
  }
  entries.sort((a, b) => compareMembersByGradeKana(a.member, b.member))
  const names = entries.map(({ name, breakfast, dinner }) => ({ name, breakfast, dinner }))
  return { breakfast, dinner, names }
}

// 指定日・指定寮・指定種別の寮生以外食数を集計
function summarizeGuestsForDormCategory(guestMeals, date, dorm, category) {
  let breakfast = 0
  let dinner = 0
  const names = []
  for (const g of guestMeals) {
    if (g.date !== date) continue
    if ((g.dorm || '') !== dorm) continue
    if ((g.category || '見学高校生') !== category) continue
    if (!g.breakfast && !g.dinner) continue
    if (g.breakfast) breakfast += 1
    if (g.dinner) dinner += 1
    names.push({
      name: [g.school, g.name].filter(Boolean).join(' ') || g.name,
      breakfast: !!g.breakfast,
      dinner: !!g.dinner,
    })
  }
  return { breakfast, dinner, names }
}

// 指定日の食数を寮×種別で取りまとめる
export function buildKitchenSummary({ members, mealLogs, guestMeals, date }) {
  const activeMembers = members.filter((m) => m.active)
  const dormRows = MEAL_TRACKING_DORMS.map((dorm) => {
    const memberRow = summarizeMembersForDorm(
      activeMembers,
      mealLogs,
      date,
      dorm
    )
    const categoryRows = GUEST_CATEGORIES.map((category) => ({
      category,
      ...summarizeGuestsForDormCategory(guestMeals || [], date, dorm, category),
    })).filter((r) => r.breakfast > 0 || r.dinner > 0 || r.names.length > 0)

    const dormBreakfast =
      memberRow.breakfast + categoryRows.reduce((a, r) => a + r.breakfast, 0)
    const dormDinner =
      memberRow.dinner + categoryRows.reduce((a, r) => a + r.dinner, 0)

    return {
      dorm,
      member: memberRow,
      categories: categoryRows,
      breakfast: dormBreakfast,
      dinner: dormDinner,
    }
  })

  const grandBreakfast = dormRows.reduce((a, r) => a + r.breakfast, 0)
  const grandDinner = dormRows.reduce((a, r) => a + r.dinner, 0)

  return { dormRows, grandBreakfast, grandDinner }
}
