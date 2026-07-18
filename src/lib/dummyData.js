import { RANKS, GROUPS, DEFAULT_CONFIG } from './constants.js'
import { daysInMonth, toDateStr, toYearMonth } from './utils.js'

// -------------------------------------------------------------
// ローカル開発用ダミーデータ（40名）
// GAS 未接続時のフォールバックとしても使用します。
// -------------------------------------------------------------

const FAMILY_NAMES = [
  '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村',
  '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上',
  '木村', '林', '斎藤', '清水', '山崎', '森', '池田', '橋本',
  '阿部', '石川', '前田', '藤田', '後藤', '岡田', '長谷川', '村上',
  '近藤', '石井', '坂本', '遠藤', '青木', '藤井', '西村', '福田',
]

const GIVEN_NAMES = [
  '大輝', '翔太', '陽菜', '悠斗', '結衣', '蓮', '美咲', '颯太',
  '葵', '拓海', '真央', '大和', '莉子', '航平', '彩花', '駿',
  '琴音', '涼介', '七海', '亮太', '奈々', '健太', '花音', '雄大',
  '愛美', '直樹', '優花', '智也', '澪', '啓介', '香織', '慎一',
  '未来', '和也', '沙耶', '隆之', '楓', '哲平', '桃子', '亜美',
]

// ランクとグループをバランスよく分散して40名を生成
function generateMembers() {
  const members = []
  for (let i = 0; i < 40; i++) {
    const id = i + 1
    // ランク: マネージャーは少数（4名）、残りはローテーション
    let rank
    if (i % 10 === 9) {
      rank = 'マネージャー'
    } else {
      const nonManagerRanks = RANKS.filter((r) => r !== 'マネージャー')
      rank = nonManagerRanks[i % nonManagerRanks.length]
    }
    const group = GROUPS[i % GROUPS.length]
    members.push({
      id,
      name: `${FAMILY_NAMES[i]} ${GIVEN_NAMES[i]}`,
      rank,
      group,
      active: true,
    })
  }
  // 1名だけ退寮済みのサンプル
  members[39].active = false
  return members
}

// 指定年月分の食数ログを生成（メンバーごとに現実的なばらつき）
function generateMealLogs(members, year, month) {
  const logs = []
  const totalDays = daysInMonth(year, month)
  const today = new Date()
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1
  const lastDay = isCurrentMonth ? today.getDate() : totalDays

  for (const m of members) {
    if (!m.active) continue
    // メンバーごとに擬似ランダムな喫食率
    const seed = m.id * 7
    for (let d = 1; d <= lastDay; d++) {
      const date = toDateStr(year, month, d)
      const dow = new Date(year, month - 1, d).getDay()
      // 週末は喫食率を下げる
      const weekend = dow === 0 || dow === 6
      const breakfast = ((seed + d) % (weekend ? 3 : 2)) === 0
      const dinner = ((seed + d * 3) % (weekend ? 3 : 2)) !== 0
      // 全部×の日は行を作らない（データ量削減）
      if (breakfast || dinner) {
        logs.push({ date, member_id: m.id, breakfast, dinner })
      }
    }
  }
  return logs
}

// 指定年月分の月次経費を生成（一部メンバーのみ値を持つ）
function generateExpenses(members, year, month) {
  const yearMonth = toYearMonth(year, month)
  const expenses = []
  for (const m of members) {
    if (!m.active) continue
    const s = m.id
    expenses.push({
      year_month: yearMonth,
      member_id: m.id,
      // 3人に1人が大会参加
      tournament_fee: s % 3 === 0 ? 5000 : 0,
      tournament_support_rate: s % 3 === 0 ? 50 : 0,
      // 4人に1人が合宿参加
      camp_fee_per_night: s % 4 === 0 ? 2700 : 0,
      camp_nights: s % 4 === 0 ? 2 : 0,
      // 5人に1人が治療費
      medical_actual: s % 5 === 0 ? 3000 : 0,
      medical_subsidy: s % 5 === 0 ? 1000 : 0,
      // 佐川・ウエアはランダム少額
      sagawa_fee: s % 6 === 0 ? 800 : 0,
      wear_fee: s % 7 === 0 ? 4500 : 0,
    })
  }
  return expenses
}

// getInitialData 相当のダミーデータ一式を生成
export function buildDummyInitialData(year, month) {
  const members = generateMembers()
  return {
    members,
    config: { ...DEFAULT_CONFIG },
    mealLogs: generateMealLogs(members, year, month),
    expenses: generateExpenses(members, year, month),
  }
}

// メンバーだけは年月に依存しないので個別に取得可能
export function buildDummyMembers() {
  return generateMembers()
}
