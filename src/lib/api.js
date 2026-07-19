import { buildDummyInitialData } from './dummyData.js'

// -------------------------------------------------------------
// GAS Web App API クライアント
// -------------------------------------------------------------
// CORS プリフライトを避けるため、POST は Content-Type を
// text/plain として送信します（GAS 側で JSON.parse します）。
// VITE_GAS_API_URL が未設定、または VITE_USE_DUMMY_DATA=true の場合は
// ローカルのダミーデータで動作します。
// -------------------------------------------------------------

const API_URL = import.meta.env.VITE_GAS_API_URL || ''
const FORCE_DUMMY = import.meta.env.VITE_USE_DUMMY_DATA === 'true'

export const USE_DUMMY = FORCE_DUMMY || !API_URL

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
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) throw new Error(`API GET ${action} 失敗: ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(json.message || 'API エラー')
  return json.data
}

// POST リクエスト（action + payload）
async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    // text/plain にすることで CORS プリフライトを回避
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!res.ok) throw new Error(`API POST ${action} 失敗: ${res.status}`)
  const json = await res.json()
  if (json.status === 'error') throw new Error(json.message || 'API エラー')
  return json.data
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
// payload: { expenses, tournamentItems, campItems }
export async function saveExpenses(yearMonth, payload) {
  const expenses = payload.expenses || []
  const tournamentItems = payload.tournamentItems || []
  const campItems = payload.campItems || []
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
    }
    return { saved: expenses.length }
  }
  return apiPost('saveExpenses', {
    year_month: yearMonth,
    expenses,
    tournamentItems,
    campItems,
  })
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
