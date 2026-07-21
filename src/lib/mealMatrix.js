import { daysInMonth, toDateStr, compareMembersByGradeKana } from './utils.js'
import { mealDormOf } from './constants.js'

// -------------------------------------------------------------
// 月間食数マトリクス（縦軸=名前、横軸=日付）を組み立てるロジック
// -------------------------------------------------------------
// 指定寮・指定年月について、在籍寮生（+この寮で1度でも食べた
// 寮間移動者）を行、日付を列とした一覧表データを生成する。
// -------------------------------------------------------------

export function buildMonthlyMealMatrix({
  members,
  mealLogs,
  guestMeals = [],
  dorm,
  year,
  month,
}) {
  const totalDays = daysInMonth(year, month)
  const days = Array.from({ length: totalDays }, (_, i) => i + 1)

  const activeMembers = members.filter((m) => m.active)

  // この寮で当月1度でも食べた「寮間移動」メンバーIDを収集
  const eaterIds = new Set()
  for (const log of mealLogs) {
    if ((log.dorm || '') !== dorm) continue
    if (!log.breakfast && !log.dinner) continue
    eaterIds.add(String(log.member_id))
  }

  const population = activeMembers.filter(
    (m) => mealDormOf(m) === dorm || eaterIds.has(String(m.id))
  )

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
    .slice()
    .sort(compareMembersByGradeKana)
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
    // 所属寮のメンバーを先に（Array#sort は安定ソートのため、事前に適用した
    // 学年・読み仮名順を保ったまま「寮間移動」だけ下に回す）
    .sort((a, b) => Number(a.isCrossDorm) - Number(b.isCrossDorm))

  // 寮生以外（見学高校生・寮外生・寮管）も一覧の末尾に追加する。
  // 寮生と違い固定の名簿が無いため、種別＋氏名（学校名込み）を単位に集計する。
  const guestRows = buildGuestRows(guestMeals, dorm, year, month, days)
  const allRows = [...rows, ...guestRows]

  const columnTotals = days.map((d, idx) => {
    let breakfast = 0
    let dinner = 0
    for (const row of allRows) {
      if (row.cells[idx].breakfast) breakfast += 1
      if (row.cells[idx].dinner) dinner += 1
    }
    return { day: d, breakfast, dinner }
  })

  const grandBreakfast = allRows.reduce((a, r) => a + r.totalBreakfast, 0)
  const grandDinner = allRows.reduce((a, r) => a + r.totalDinner, 0)

  return { days, rows: allRows, columnTotals, grandBreakfast, grandDinner }
}

// 寮生以外（見学高校生・寮外生・寮管）の月間行を組み立てる
// （種別＋表示名を同一人物とみなして日ごとのセルに集計する）
function buildGuestRows(guestMeals, dorm, year, month, days) {
  const map = new Map()
  for (const g of guestMeals) {
    if ((g.dorm || '') !== dorm) continue
    const category = g.category || '見学高校生'
    const displayName = [g.school, g.name].filter(Boolean).join(' ') || g.name
    if (!displayName) continue
    const key = `${category}__${displayName}`
    if (!map.has(key)) {
      map.set(key, { category, name: displayName, byDate: new Map() })
    }
    map.get(key).byDate.set(g.date, {
      breakfast: !!g.breakfast,
      dinner: !!g.dinner,
    })
  }

  return Array.from(map.entries())
    .map(([key, entry]) => {
      let totalBreakfast = 0
      let totalDinner = 0
      const cells = days.map((d) => {
        const date = toDateStr(year, month, d)
        const v = entry.byDate.get(date) || { breakfast: false, dinner: false }
        if (v.breakfast) totalBreakfast += 1
        if (v.dinner) totalDinner += 1
        return { day: d, date, breakfast: v.breakfast, dinner: v.dinner }
      })
      return {
        memberId: `guest__${key}`,
        name: entry.name,
        group: entry.category,
        rank: entry.category,
        isCrossDorm: false,
        isGuest: true,
        category: entry.category,
        cells,
        totalBreakfast,
        totalDinner,
      }
    })
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category, 'ja')
      return a.name.localeCompare(b.name, 'ja')
    })
}
