// アプリ全体で共有する定数定義

// チームランク
export const RANKS = [
  '1軍A',
  '1軍B',
  '2軍A',
  '2軍B',
  '育成A',
  '育成B',
  'マネージャー',
]

// 集金グループ（PDFの改ページ単位もこの順）
export const GROUPS = ['1階3階', '2階', '2寮', '女子寮']

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
}

// 経費項目のラベル（PDF/一覧の内訳表示用）
export const EXPENSE_LABELS = {
  clubFee: '部費',
  mealFee: '食費',
  tournament: '大会費',
  camp: '合宿費',
  medical: '治療費',
  sagawa: '佐川代',
  wear: 'ウエア代',
}
