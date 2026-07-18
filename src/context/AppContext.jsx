import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import * as api from '../lib/api.js'
import { toYearMonth } from '../lib/utils.js'
import { DEFAULT_CONFIG } from '../lib/constants.js'

const AppContext = createContext(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp は AppProvider の内側で使用してください')
  return ctx
}

export function AppProvider({ children }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [members, setMembers] = useState([])
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [mealLogs, setMealLogs] = useState([])
  const [expenses, setExpenses] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const yearMonth = toYearMonth(year, month)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getInitialData(year, month, yearMonth)
      setMembers(data.members || [])
      setConfig({ ...DEFAULT_CONFIG, ...(data.config || {}) })
      setMealLogs(data.mealLogs || [])
      setExpenses(data.expenses || [])
    } catch (e) {
      console.error(e)
      setError(e.message || 'データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [year, month, yearMonth])

  useEffect(() => {
    reload()
  }, [reload])

  // 保存系アクション
  const saveMembers = useCallback(
    async (next) => {
      await api.saveMembers(next)
      setMembers(next)
      showToast('寮生マスターを保存しました')
    },
    [showToast]
  )

  const saveMealLogs = useCallback(
    async (logs) => {
      await api.saveMealLogs(yearMonth, logs)
      // ローカル state を UPSERT 更新
      setMealLogs((prev) => {
        const key = (l) => `${l.date}__${l.member_id}`
        const map = new Map(prev.map((l) => [key(l), l]))
        for (const l of logs) {
          if (l.breakfast || l.dinner) map.set(key(l), l)
          else map.delete(key(l))
        }
        return Array.from(map.values())
      })
      showToast('食数データを保存しました')
    },
    [yearMonth, showToast]
  )

  const saveExpenses = useCallback(
    async (next) => {
      await api.saveExpenses(yearMonth, next)
      setExpenses((prev) => {
        const others = prev.filter((e) => e.year_month !== yearMonth)
        return [...others, ...next]
      })
      showToast('月次経費を保存しました')
    },
    [yearMonth, showToast]
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
    expenses,
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
