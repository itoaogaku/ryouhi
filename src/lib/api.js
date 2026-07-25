import { buildDummyInitialData } from './dummyData.js'

// -------------------------------------------------------------
// GAS Web App API クライアント
// -------------------------------------------------------------
// CORS プリフライトを避けるため、POST は Content-Type を
// text/plain として送信します（GAS 側で JSON.parse します）。
// VITE_GAS_API_URL が未設定、または VITE_USE_DUMMY_DATA=true の場合は
// ローカルのダミーデータで動作します。
//
// ログインが必要な action には、保存済みのセッショントークンを
// 自動的に付与します（ログイン自体は除く）。
// -------------------------------------------------------------

const API_URL = import.meta.env.VITE_GAS_API_URL || ''
const FORCE_DUMMY = import.meta.env.VITE_USE_DUMMY_DATA === 'true'

export const USE_DUMMY = FORCE_DUMMY || !API_URL

const TOKEN_STORAGE_KEY = 'ryouhi_auth_token'

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
  } catch (e) {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch (e) {
    // localStorage が使えない環境ではメモリのみ（リロードで消える）
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch (e) {
    // noop
  }
}

// API エラー（code 付き）。auth_required の場合、呼び出し側で
// セッション切れとして再ログインを促すために使用する。
export class ApiError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ApiError'
    this.code = code || ''
  }
}

// ローカルダミー用のインメモリストア（セッション内で編集を保持）
const dummyStore = {
  loaded: {}, // yearMonth -> data
}

function getDummy(year, month, yearMonth) {
  if (!dummyStore.loaded[yearMonth]) {
    dummyStore.loaded[yearMonth] = buildDummyInitialData(year, month)
  }
  return dummyStore.loaded[yearMonth]
}

// GET リクエスト（action + params）
async function apiGet(action, params = {}) {
  const url = new URL(API_URL)
  url.searchParams.set('action', action)
  const token = getStoredToken()
  if (token) url.searchParams.set('token', token)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) throw new ApiError(`API GET ${action} 失敗: ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') {
    throw new ApiError(json.message || 'API エラー', json.code)
  }
  return json.data
}

// POST リクエスト（action + payload）
async function apiPost(action, payload = {}) {
  const token = getStoredToken()
  const res = await fetch(API_URL, {
    method: 'POST',
    // text/plain にすることで CORS プリフライトを回避
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, ...payload }),
  })
  if (!res.ok) throw new ApiError(`API POST ${action} 失敗: ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') {
    throw new ApiError(json.message || 'API エラー', json.code)
  }
  return json.data
}

// -------------------------------------------------------------
// 認証 API
// -------------------------------------------------------------
// ダミーモードでは実際のログインを行わず、ローカル確認用の
// アカウント一覧をメモリ上で管理します。

const dummyAuthUser = { name: 'ローカル確認用ユーザー', email: 'local@example.com' }
let dummyAccounts = [
  { id: 1, name: 'ローカル確認用ユーザー', email: 'local@example.com', active: true, hasPin: true },
]

// ログイン（メールアドレス + PIN）
export async function login(email, pin) {
  if (USE_DUMMY) {
    await delay(200)
    return { token: 'dummy-token', name: dummyAuthUser.name, email: dummyAuthUser.email }
  }
  return apiPost('login', { email, pin })
}

// ログアウト
export async function logout() {
  if (USE_DUMMY) {
    await delay(100)
    return { ok: true }
  }
  return apiPost('logout', {})
}

// 現在のセッションに紐づくユーザー情報を取得（トークンの検証）
export async function whoami() {
  if (USE_DUMMY) {
    await delay(100)
    return { user: dummyAuthUser }
  }
  return apiGet('whoami')
}

// ログイン可能な人の一覧を取得
export async function getAccounts() {
  if (USE_DUMMY) {
    await delay(150)
    return structuredCloneSafe(dummyAccounts)
  }
  return apiGet('getAccounts')
}

// ログイン可能な人の一覧を全置換保存
export async function saveAccounts(accounts) {
  if (USE_DUMMY) {
    await delay(150)
    dummyAccounts = structuredCloneSafe(accounts).map((a) => ({
      ...a,
      hasPin: dummyAccounts.find((p) => p.id === a.id)?.hasPin || false,
    }))
    return { saved: accounts.length }
  }
  return apiPost('saveAccounts', { accounts })
}

// 指定メールアドレスの PIN を新規設定・再設定
export async function setAccountPin(email, pin) {
  if (USE_DUMMY) {
    await delay(150)
    const acc = dummyAccounts.find((a) => a.email === email)
    if (acc) acc.hasPin = true
    return { ok: true }
  }
  return apiPost('setAccountPin', { email, pin })
}

// -------------------------------------------------------------
// 公開 API
// -------------------------------------------------------------

// 初期データ一括取得（マスタ・設定・指定年月の食費/経費）
export async function getInitialData(year, month, yearMonth) {
  if (USE_DUMMY) {
    await delay(200)
    const d = getDummy(year, month, yearMonth)
    return structuredCloneSafe(d)
  }
  return apiGet('getInitialData', { year_month: yearMonth })
}

// メンバーマスタ保存
export async function saveMembers(members) {
  if (USE_DUMMY) {
    await delay(150)
    for (const ym of Object.keys(dummyStore.loaded)) {
      dummyStore.loaded[ym].members = structuredCloneSafe(members)
    }
    return { saved: members.length }
  }
  return apiPost('saveMembers', { members })
}

// 規定（食費単価・部費・清算ルールメモ）保存。全年月で共通の設定
export async function saveConfig(config) {
  if (USE_DUMMY) {
    await delay(150)
    for (const ym of Object.keys(dummyStore.loaded)) {
      dummyStore.loaded[ym].config = structuredCloneSafe(config)
    }
    return { saved: Object.keys(config || {}).length }
  }
  return apiPost('saveConfig', { config })
}

// 食数ログ一括保存（UPSERT: date+member+dorm）+ 見学高校生（当日×寮を総入れ替え）
export async function saveMealLogs(yearMonth, logs, guests, date, dorm) {
  guests = guests || []
  if (USE_DUMMY) {
    await delay(150)
    upsertDummyMealLogs(yearMonth, logs)
    if (date) replaceDummyGuestMeals(yearMonth, date, dorm, guests)
    return { saved: logs.length }
  }
  return apiPost('saveMealLogs', {
    year_month: yearMonth,
    date: date,
    dorm: dorm,
    logs: logs,
    guests: guests,
  })
}

// 月次経費一括保存（UPSERT）
// payload: { expenses, tournamentItems, campItems, otherItems }
export async function saveExpenses(yearMonth, payload) {
  const expenses = payload.expenses || []
  const tournamentItems = payload.tournamentItems || []
  const campItems = payload.campItems || []
  const otherItems = payload.otherItems || []
  if (USE_DUMMY) {
    await delay(150)
    const store = dummyStore.loaded[yearMonth]
    if (store) {
      store.expenses = structuredCloneSafe(expenses)
      // 明細は当月分を総入れ替え、他月分は温存
      store.tournamentItems = [
        ...(store.tournamentItems || []).filter((i) => i.year_month !== yearMonth),
        ...structuredCloneSafe(tournamentItems),
      ]
      store.campItems = [
        ...(store.campItems || []).filter((i) => i.year_month !== yearMonth),
        ...structuredCloneSafe(campItems),
      ]
      store.otherItems = [
        ...(store.otherItems || []).filter((i) => i.year_month !== yearMonth),
        ...structuredCloneSafe(otherItems),
      ]
    }
    return { saved: expenses.length }
  }
  return apiPost('saveExpenses', {
    year_month: yearMonth,
    expenses,
    tournamentItems,
    campItems,
    otherItems,
  })
}

// 寮間移動の「取り消し」用メタデータを1件追加する
// record: { dorm, memberNames, previousMembers, createdLogs }
export async function saveDormTransferRecord(yearMonth, record) {
  if (USE_DUMMY) {
    await delay(120)
    const saved = {
      id: `dummy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      yearMonth,
      dorm: record.dorm || '',
      createdAt: new Date().toISOString(),
      memberNames: record.memberNames || [],
      previousMembers: record.previousMembers || [],
      createdLogs: record.createdLogs || [],
    }
    const store = dummyStore.loaded[yearMonth]
    if (store) {
      store.dormTransfers = [...(store.dormTransfers || []), saved]
    }
    return saved
  }
  return apiPost('saveDormTransferRecord', { year_month: yearMonth, record })
}

// 寮間移動の「取り消し」用メタデータを1件削除する
// （取り消し実行後、または取り消さずに通知だけ消す操作の両方から呼ばれる）
export async function deleteDormTransferRecord(id) {
  if (USE_DUMMY) {
    await delay(100)
    for (const ym of Object.keys(dummyStore.loaded)) {
      const store = dummyStore.loaded[ym]
      store.dormTransfers = (store.dormTransfers || []).filter((r) => r.id !== id)
    }
    return { ok: true }
  }
  return apiPost('deleteDormTransferRecord', { id })
}

// 寮間移動の「取り消し」用メタデータのうち、対象者一覧だけを書き換える
// （複数人まとめて登録した移動から、特定の1人だけを取り消して除外する場合に使う）
export async function updateDormTransferRecord(id, record) {
  if (USE_DUMMY) {
    await delay(120)
    let updated = null
    for (const ym of Object.keys(dummyStore.loaded)) {
      const store = dummyStore.loaded[ym]
      store.dormTransfers = (store.dormTransfers || []).map((r) => {
        if (r.id !== id) return r
        updated = {
          ...r,
          memberNames: record.memberNames || [],
          previousMembers: record.previousMembers || [],
          createdLogs: record.createdLogs || [],
        }
        return updated
      })
    }
    return updated
  }
  return apiPost('updateDormTransferRecord', { id, record })
}

// タブを閉じる／リロードするなど、通常の fetch が完走を保証されない
// タイミングでのベストエフォート自動保存用（応答は待たない・エラーも検知しない）。
// sendBeacon は文字列を渡すと Content-Type: text/plain になるため、
// GAS 側の JSON.parse(e.postData.contents) にそのまま乗る。
export function saveMealLogsBeacon(yearMonth, logs, guests, date, dorm) {
  if (USE_DUMMY) return false
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false
  const token = getStoredToken()
  const body = JSON.stringify({
    action: 'saveMealLogs',
    token,
    year_month: yearMonth,
    date,
    dorm,
    logs,
    guests: guests || [],
  })
  try {
    return navigator.sendBeacon(API_URL, body)
  } catch (e) {
    return false
  }
}

// -------------------------------------------------------------
// helpers
// -------------------------------------------------------------

function upsertDummyMealLogs(yearMonth, logs) {
  const store = dummyStore.loaded[yearMonth]
  if (!store) return
  const key = (l) => `${l.date}__${l.member_id}__${l.dorm || ''}`
  const map = new Map(store.mealLogs.map((l) => [key(l), l]))
  for (const l of logs) {
    if (l.breakfast || l.dinner) {
      map.set(key(l), { ...l })
    } else {
      map.delete(key(l))
    }
  }
  store.mealLogs = Array.from(map.values())
}

function replaceDummyGuestMeals(yearMonth, date, dorm, guests) {
  const store = dummyStore.loaded[yearMonth]
  if (!store) return
  const d = dorm || ''
  const others = (store.guestMeals || []).filter(
    (g) => !(g.date === date && (g.dorm || '') === d)
  )
  const valid = guests
    .filter((g) => (g.name || '').trim() !== '' || (g.school || '').trim() !== '')
    .map((g) => ({
      date,
      dorm: d,
      category: g.category || '見学高校生',
      school: (g.school || '').trim(),
      name: (g.name || '').trim(),
      breakfast: !!g.breakfast,
      dinner: !!g.dinner,
    }))
  store.guestMeals = [...others, ...valid]
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function structuredCloneSafe(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj)
  return JSON.parse(JSON.stringify(obj))
}
