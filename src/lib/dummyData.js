import { RANKS, GROUPS, GRADES, DORMS, DEFAULT_CONFIG, mealDormOf } from './constants.js'
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

// 読み仮名（学年・読み仮名順ソートのダミーデータ用）
const FAMILY_NAMES_KANA = [
  'さとう', 'すずき', 'たかはし', 'たなか', 'いとう', 'わたなべ', 'やまもと', 'なかむら',
  'こばやし', 'かとう', 'よしだ', 'やまだ', 'ささき', 'やまぐち', 'まつもと', 'いのうえ',
  'きむら', 'はやし', 'さいとう', 'しみず', 'やまざき', 'もり', 'いけだ', 'はしもと',
  'あべ', 'いしかわ', 'まえだ', 'ふじた', 'ごとう', 'おかだ', 'はせがわ', 'むらかみ',
  'こんどう', 'いしい', 'さかもと', 'えんどう', 'あおき', 'ふじい', 'にしむら', 'ふくだ',
]

const GIVEN_NAMES_KANA = [
  'だいき', 'しょうた', 'ひな', 'ゆうと', 'ゆい', 'れん', 'みさき', 'そうた',
  'あおい', 'たくみ', 'まお', 'やまと', 'りこ', 'こうへい', 'あやか', 'しゅん',
  'ことね', 'りょうすけ', 'ななみ', 'りょうた', 'なな', 'けんた', 'かのん', 'ゆうだい',
  'まなみ', 'なおき', 'ゆうか', 'ともや', 'みお', 'けいすけ', 'かおり', 'しんいち',
  'みらい', 'かずや', 'さや', 'たかゆき', 'かえで', 'てっぺい', 'ももこ', 'あみ',
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
      name_kana: `${FAMILY_NAMES_KANA[i]} ${GIVEN_NAMES_KANA[i]}`,
      rank,
      grade: GRADES[i % GRADES.length],
      group,
      dorm: DORMS[i % DORMS.length],
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

  const otherDorm = (d) => (d === '1寮' ? '2寮' : '1寮')

  for (const m of members) {
    if (!m.active) continue
    // メンバーごとに擬似ランダムな喫食率
    const seed = m.id * 7
    const homeDorm = mealDormOf(m) || '1寮'
    for (let d = 1; d <= lastDay; d++) {
      const date = toDateStr(year, month, d)
      const dow = new Date(year, month - 1, d).getDay()
      // 週末は喫食率を下げる
      const weekend = dow === 0 || dow === 6
      const breakfast = ((seed + d) % (weekend ? 3 : 2)) === 0
      const dinner = ((seed + d * 3) % (weekend ? 3 : 2)) !== 0
      // 全部×の日は行を作らない（データ量削減）
      if (breakfast || dinner) {
        logs.push({ date, member_id: m.id, breakfast, dinner, dorm: homeDorm })
      }
      // 一部メンバーは月末付近に他寮でも喫食（寮入れ替えの過渡期を再現）
      if (m.id % 9 === 0 && d >= 25 && dinner) {
        logs.push({
          date,
          member_id: m.id,
          breakfast: false,
          dinner: true,
          dorm: otherDorm(homeDorm),
        })
      }
    }
  }
  return logs
}

const GUEST_LIST = [
  { school: '青葉高校', name: '田村 蓮' },
  { school: '青葉高校', name: '森田 大和' },
  { school: '桜丘高校', name: '岡本 悠真' },
  { school: '桜丘高校', name: '西村 陽向' },
]

// 寮外生（クラブ所属だが寮には住んでいない生徒）のサンプル
const EXTERNAL_STUDENTS = [
  { name: '外部 拓真', dorm: '1寮' },
  { name: '外部 美月', dorm: '2寮' },
]

// 寮管（寮の管理人）のサンプル
const DORM_MANAGERS = [
  { name: '寮母 田中', dorm: '1寮' },
  { name: '寮父 佐々木', dorm: '2寮' },
]

// 寮生以外の食数（見学高校生・寮外生・寮管）を生成
function generateGuestMeals(year, month) {
  const guests = []
  const totalDays = daysInMonth(year, month)
  const today = new Date()
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1
  const lastDay = isCurrentMonth ? today.getDate() : totalDays

  // 見学高校生：1寮のみ、数日おきに1〜2名が見学に来る想定
  for (let d = 5; d <= lastDay; d += 7) {
    const date = toDateStr(year, month, d)
    const a = GUEST_LIST[d % GUEST_LIST.length]
    guests.push({
      date,
      dorm: '1寮',
      category: '見学高校生',
      school: a.school,
      name: a.name,
      breakfast: false,
      dinner: true,
    })
    if (d % 2 === 0) {
      const b = GUEST_LIST[(d + 1) % GUEST_LIST.length]
      guests.push({
        date,
        dorm: '1寮',
        category: '見学高校生',
        school: b.school,
        name: b.name,
        breakfast: true,
        dinner: true,
      })
    }
  }

  // 寮外生：平日の夕食のみ、それぞれの所属寮で
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow === 0 || dow === 6) continue
    const date = toDateStr(year, month, d)
    for (const s of EXTERNAL_STUDENTS) {
      guests.push({
        date,
        dorm: s.dorm,
        category: '寮外生',
        school: '',
        name: s.name,
        breakfast: false,
        dinner: true,
      })
    }
  }

  // 寮管：ほぼ毎日、朝夕ともに食事
  for (let d = 1; d <= lastDay; d++) {
    const date = toDateStr(year, month, d)
    for (const m of DORM_MANAGERS) {
      guests.push({
        date,
        dorm: m.dorm,
        category: '寮管',
        school: '',
        name: m.name,
        breakfast: true,
        dinner: true,
      })
    }
  }

  return guests
}

// 指定年月分の月次経費（治療・配達代・モチベーション費補助）を生成
function generateExpenses(members, year, month) {
  const yearMonth = toYearMonth(year, month)
  const expenses = []
  for (const m of members) {
    if (!m.active) continue
    const s = m.id
    expenses.push({
      year_month: yearMonth,
      member_id: m.id,
      // 大会/合宿は明細シートで管理するためここでは 0
      tournament_fee: 0,
      tournament_support_rate: 0,
      camp_fee_per_night: 0,
      camp_nights: 0,
      // 5人に1人が治療費
      medical_actual: s % 5 === 0 ? 3000 : 0,
      medical_subsidy: s % 5 === 0 ? 1000 : 0,
      // 配達代はランダム少額
      sagawa_fee: s % 6 === 0 ? 800 : 0,
      // モチベーション費補助（回数）は一部メンバーのみ
      motivation_count: s % 7 === 0 ? 2 : 0,
    })
  }
  return expenses
}

const TOURNAMENT_NAMES = ['春季リーグ', '関東大会', '全国選手権', '交流戦', '秋季トーナメント']
const CAMP_NAMES = ['強化合宿', '夏季合宿', '菅平合宿', '直前合宿']

// 大会明細（一部メンバーに 1〜2 件）を生成
function generateTournamentItems(members, year, month) {
  const yearMonth = toYearMonth(year, month)
  const items = []
  for (const m of members) {
    if (!m.active) continue
    if (m.id % 3 !== 0) continue // 3人に1人
    const count = m.id % 6 === 0 ? 2 : 1
    for (let i = 0; i < count; i++) {
      const name = TOURNAMENT_NAMES[(m.id + i) % TOURNAMENT_NAMES.length]
      const fee = 5000 + ((m.id + i) % 3) * 1000
      const subsidy = Math.round(fee * 0.5)
      items.push({
        year_month: yearMonth,
        member_id: m.id,
        name,
        fee,
        subsidy,
      })
    }
  }
  return items
}

// 合宿明細（一部メンバーに 1 件）を生成
function generateCampItems(members, year, month) {
  const yearMonth = toYearMonth(year, month)
  const items = []
  for (const m of members) {
    if (!m.active) continue
    if (m.id % 4 !== 0) continue // 4人に1人
    const name = CAMP_NAMES[m.id % CAMP_NAMES.length]
    items.push({
      year_month: yearMonth,
      member_id: m.id,
      name,
      fee_per_night: 2700,
      nights: 2 + (m.id % 2),
    })
  }
  return items
}

const OTHER_ITEM_NAMES = ['教材費', '保険料', '寮内備品代']

// その他費用（自由記名の追加項目）を一部メンバーに生成
// （一部はチーム補助ありのケースも混ぜる）
function generateOtherItems(members, year, month) {
  const yearMonth = toYearMonth(year, month)
  const items = []
  for (const m of members) {
    if (!m.active) continue
    if (m.id % 8 !== 0) continue // 8人に1人
    const name = OTHER_ITEM_NAMES[m.id % OTHER_ITEM_NAMES.length]
    const amount = 1000 + (m.id % 3) * 500
    items.push({
      year_month: yearMonth,
      member_id: m.id,
      name,
      amount,
      subsidy: m.id % 16 === 0 ? Math.round(amount / 2) : 0,
    })
  }
  return items
}

// getInitialData 相当のダミーデータ一式を生成
export function buildDummyInitialData(year, month) {
  const members = generateMembers()
  return {
    members,
    config: { ...DEFAULT_CONFIG },
    mealLogs: generateMealLogs(members, year, month),
    guestMeals: generateGuestMeals(year, month),
    expenses: generateExpenses(members, year, month),
    tournamentItems: generateTournamentItems(members, year, month),
    campItems: generateCampItems(members, year, month),
    otherItems: generateOtherItems(members, year, month),
    dormTransfers: [],
  }
}

// メンバーだけは年月に依存しないので個別に取得可能
export function buildDummyMembers() {
  return generateMembers()
}
