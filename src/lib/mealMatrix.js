import { daysInMonth, toDateStr } from './utils.js'
import { mealDormOf } from './constants.js'

// -------------------------------------------------------------
// 月間食数マトリクス（縦軸=名前、横軸=日付）を組み立てるロジック
// -------------------------------------------------------------
// 指定寮・指定年月について、在籍寮生（+この寮で1度でも食べた
// 他寮所属者）を行、日付を列とした一覧表データを生成する。
// -------------------------------------------------------------

export function buildMonthlyMealMatrix({
  members,
  mealLogs,
  dorm,
  year,
  month,
  filterGroup = 'all',
  filterRank = 'all',
}) {
  const totalDays = daysInMonth(year, month)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  const activeMembers = members.filter((m) => m.active)

  // この寮で当月1度でも食べた「他寮所属」メンバーIDを収集
  const eaterIds = new Set()
  for (const log of mealLogs) {
    if ((log.dorm || '') !== dorm) continue
    if (!log.breakfast && !log.dinner) continue
    eaterIds.add(String(log.member_id))
  }

  let population = activeMembers.filter(
    (m) => mealDormOf(m) === dorm || eaterIds.has(String(m.id))
  )
  if (filterGroup !== 'all') {
    population = population.filter((m) => m.group === filterGroup)
  }
  if (filterRank !== 'all') {
    population = population.filter((m) => m.rank === filterRank)
  }

  // member_id -> date -> { breakfast, dinner }
  const lookup = new Map()
  for (const log of mealLogs) {
    if ((log.dorm || '') !== dorm) continue
    const key = String(log.member_id)
    if (!lookup.has(key)) lookup.set(key, new Map())
    lookup.get(key).set(log.date, {
      breakfast: !!log.breakfast,
      dinner: !!log.dinner,
    })
  }

  const rows = population
    .map((m) => {
      const dayMap = lookup.get(String(m.id)) || new Map()
      let totalBreakfast = 0
      let totalDinner = 0
      const cells = days.map((d) => {
        const date = toDateStr(year, month, d)
        const v = dayMap.get(date) || { breakfast: false, dinner: false }
        if (v.breakfast) totalBreakfast += 1
        if (v.dinner) totalDinner += 1
        return { day: d, date, breakfast: v.breakfast, dinner: v.dinner }
      })
      return {
        memberId: m.id,
        name: m.name,
        group: m.group,
        rank: m.rank,
        isCrossDorm: mealDormOf(m) !== dorm,
        cells,
        totalBreakfast,
        totalDinner,
      }
    })
    // 所属寮のメンバーを先に、氏名順ではなく元の並び（ID順）を維持
    .sort((a, b) => Number(a.isCrossDorm) - Number(b.isCrossDorm))

  const columnTotals = days.map((d, idx) => {
    let breakfast = 0
    let dinner = 0
    for (const row of rows) {
      if (row.cells[idx].breakfast) breakfast += 1
      if (row.cells[idx].dinner) dinner += 1
    }
    return { day: d, breakfast, dinner }
  })

  const grandBreakfast = rows.reduce((a, r) => a + r.totalBreakfast, 0)
  const grandDinner = rows.reduce((a, r) => a + r.totalDinner, 0)

  return { days, rows, columnTotals, grandBreakfast, grandDinner }
}
