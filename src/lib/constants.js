// アプリ全体で共有する定数定義

// チームランク
export const RANKS = [
  '1軍A',
  '1軍B',
  '2軍A',
  '2軍B',
  '育成A',
  '育成B',
  '女子選手',
  'マネージャー',
]

// 女子選手を判定するランク（並び順で「男子→女子」を分けるために使用）
export const FEMALE_RANK = '女子選手'
export function isFemaleMember(member) {
  return member?.rank === FEMALE_RANK
}

// 集金グループ（PDFの改ページ単位もこの順）
export const GROUPS = ['3階', '2階', '2寮', '女子寮']

// 所属寮を選ぶと自動で確定する集金グループ
// （キーに無い寮を選んだ場合は集金グループの値を変更しない）
export const GROUP_BY_DORM = {
  '2寮': '2寮',
  '女子寮': '女子寮',
}

// 旧グループ名からの移行用（表示・PDF出力から古い値が漏れないように）
export const GROUP_ALIASES = {
  '1階3階': '3階',
}

// 学年
export const GRADES = ['1年', '2年', '3年', '4年']

// 所属寮（寮生マスターの「寮」プルダウン用。居住区分）
export const DORMS = ['1寮', '2寮', '女子寮']

// 食数管理の入力タブ・調理人向け集計がある「食事をとる場所」としての寮
// （女子寮は専用の食堂タブを持たず、1寮で食事をするため対象外）
export const MEAL_TRACKING_DORMS = ['1寮', '2寮']

// 所属寮 → 実際に食事をとる寮 の対応
// （女子寮の選手は1寮で食事をするため、食数管理・調理人向け集計では
// 「1寮所属」と同じ扱いにする）
export const MEAL_DORM_OVERRIDES = {
  '女子寮': '1寮',
}

// メンバーの所属寮から、実際に食事をとる寮を求める
export function mealDormOf(member) {
  const dorm = member?.dorm || ''
  return MEAL_DORM_OVERRIDES[dorm] || dorm
}

// 寮生以外に食事をとる人の種別（食数管理の「追加の食数」欄で使用）
export const GUEST_CATEGORIES = ['見学高校生', '寮外生', '寮管']

// 寮ごとに記録を許可する追加食数の種別
// （2寮には高校生が泊まらないため見学高校生は対象外）
export const GUEST_CATEGORIES_BY_DORM = {
  '1寮': ['見学高校生', '寮外生', '寮管'],
  '2寮': ['寮外生', '寮管'],
}

// 標準の食事提供スケジュール（曜日ごと。0=日〜6=土）
// 火〜土曜: 朝食・夕食あり／日曜: 朝食のみ／月曜: 提供なし
export const STANDARD_MEAL_SCHEDULE = {
  0: { breakfast: true, dinner: false }, // 日
  1: { breakfast: false, dinner: false }, // 月
  2: { breakfast: true, dinner: true }, // 火
  3: { breakfast: true, dinner: true }, // 水
  4: { breakfast: true, dinner: true }, // 木
  5: { breakfast: true, dinner: true }, // 金
  6: { breakfast: true, dinner: true }, // 土
}

// 合宿1泊単価のプリセット
export const CAMP_PRICE_PRESETS = [
  { label: '2700円', value: 2700 },
  { label: '0円', value: 0 },
  { label: 'カスタム', value: 'custom' },
]

// config のデフォルト値（GAS未接続時のフォールバックにも使用）
export const DEFAULT_CONFIG = {
  breakfast_price: 400,
  dinner_price: 600,
  base_club_fee: 3000,
  notes: '',
}

// 経費項目のラベル（PDF/一覧の内訳表示用）
export const EXPENSE_LABELS = {
  clubFee: '部費',
  mealFee: '食費',
  tournament: '大会費',
  camp: '合宿費',
  medical: '治療費',
  motivation: 'モチベーション費補助',
  sagawa: '配達代',
}

// モチベーション費の単価（1回あたり）。補助回数 × この単価で補助額を計算する
export const MOTIVATION_FEE_PER_UNIT = 770
