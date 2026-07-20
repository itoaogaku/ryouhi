import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import * as api from '../lib/api.js'
import { toYearMonth, normalizeGroup } from '../lib/utils.js'
import { DEFAULT_CONFIG, GROUP_ALIASES } from '../lib/constants.js'

const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp は AppProvider の内側で使用してください')
  return ctx
}

// onAuthError: セッション切れ（auth_required）を検知したときに呼ばれる。
// ログイン画面へ戻すために AuthContext の logout を渡す想定。
export function AppProvider({ children, onAuthError }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [members, setMembers] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [mealLogs, setMealLogs] = useState([])
  const [guestMeals, setGuestMeals] = useState([])
  const [expenses, setExpenses] = useState([])
  const [tournamentItems, setTournamentItems] = useState([])
  const [campItems, setCampItems] = useState([])
  const [otherItems, setOtherItems] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const yearMonth = toYearMonth(year, month)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // セッション切れを検知したら、呼び出し元にログイン画面へ戻すよう通知する
  const checkAuthError = useCallback(
    (e) => {
      if (e && e.code === 'auth_required' && onAuthError) onAuthError()
    },
    [onAuthError]
  )

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getInitialData(year, month, yearMonth)
      setMembers(
        (data.members || []).map((m) => ({
          ...m,
          group: normalizeGroup(m.group, GROUP_ALIASES),
        }))
      )
      setConfig({ ...DEFAULT_CONFIG, ...(data.config || {}) })
      setMealLogs(data.mealLogs || [])
      setGuestMeals(data.guestMeals || [])
      setExpenses(data.expenses || [])
      setTournamentItems(data.tournamentItems || [])
      setCampItems(data.campItems || [])
      setOtherItems(data.otherItems || [])
    } catch (e) {
      console.error(e)
      checkAuthError(e)
      setError(e.message || 'データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [year, month, yearMonth, checkAuthError])

  useEffect(() => {
    reload()
  }, [reload])

  // 保存系アクション
  const saveMembers = useCallback(
    async (next) => {
      try {
        await api.saveMembers(next)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      setMembers(next)
      showToast('寮生マスターを保存しました')
    },
    [showToast, checkAuthError]
  )

  // logs: メンバー食数（当日×寮）, guests: 見学高校生（当日×寮）, date: 対象日, dorm: 対象寮
  const saveMealLogs = useCallback(
    async (logs, guests = [], date = null, dorm = '') => {
      try {
        await api.saveMealLogs(yearMonth, logs, guests, date, dorm)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      // メンバー食数を UPSERT 更新（key: date+member+dorm）
      setMealLogs((prev) => {
        const key = (l) => `${l.date}__${l.member_id}__${l.dorm || ''}`
        const map = new Map(prev.map((l) => [key(l), l]))
        for (const l of logs) {
          if (l.breakfast || l.dinner) map.set(key(l), l)
          else map.delete(key(l))
        }
        return Array.from(map.values())
      })
      // 寮生以外（見学高校生・寮外生・寮管）は当日×寮を総入れ替え
      if (date) {
        const d = dorm || ''
        const valid = guests
          .filter(
            (g) => (g.name || '').trim() !== '' || (g.school || '').trim() !== ''
          )
          .map((g) => ({
            date,
            dorm: d,
            category: g.category || '見学高校生',
            school: (g.school || '').trim(),
            name: (g.name || '').trim(),
            breakfast: !!g.breakfast,
            dinner: !!g.dinner,
          }))
        setGuestMeals((prev) => [
          ...prev.filter((g) => !(g.date === date && (g.dorm || '') === d)),
          ...valid,
        ])
      }
      showToast('食数データを保存しました')
    },
    [yearMonth, showToast, checkAuthError]
  )

  // payload: { expenses, tournamentItems, campItems, otherItems }
  const saveExpenses = useCallback(
    async (payload) => {
      try {
        await api.saveExpenses(yearMonth, payload)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      const {
        expenses: nextExpenses = [],
        tournamentItems: nextTournaments = [],
        campItems: nextCamps = [],
        otherItems: nextOthers = [],
      } = payload
      setExpenses((prev) => [
        ...prev.filter((e) => e.year_month !== yearMonth),
        ...nextExpenses,
      ])
      setTournamentItems((prev) => [
        ...prev.filter((i) => i.year_month !== yearMonth),
        ...nextTournaments,
      ])
      setCampItems((prev) => [
        ...prev.filter((i) => i.year_month !== yearMonth),
        ...nextCamps,
      ])
      setOtherItems((prev) => [
        ...prev.filter((i) => i.year_month !== yearMonth),
        ...nextOthers,
      ])
      showToast('月次経費を保存しました')
    },
    [yearMonth, showToast, checkAuthError]
  )

  const value = {
    year,
    month,
    yearMonth,
    setYear,
    setMonth,
    members,
    config,
    mealLogs,
    guestMeals,
    expenses,
    tournamentItems,
    campItems,
    otherItems,
    loading,
    error,
    toast,
    showToast,
    reload,
    saveMembers,
    saveMealLogs,
    saveExpenses,
    usingDummy: api.USE_DUMMY,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
