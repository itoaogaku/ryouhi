import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  const [dormTransfers, setDormTransfers] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  const yearMonth = toYearMonth(year, month)

  // 年月ごとの初期データキャッシュ（体感ロード時間短縮用）。
  // 一度読み込んだ年月に戻ったときは、まずキャッシュを即表示してから
  // 裏で最新データを取得して静かに差し替える（stale-while-revalidate）。
  const cacheRef = useRef({})

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

  const applyData = useCallback((data) => {
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
    setDormTransfers(data.dormTransfers || [])
  }, [])

  const reload = useCallback(async () => {
    const cached = cacheRef.current[yearMonth]
    if (cached) {
      // 訪問済みの年月はキャッシュを即表示（ローディング画面を出さない）
      applyData(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await api.getInitialData(year, month, yearMonth)
      cacheRef.current[yearMonth] = data
      applyData(data)
    } catch (e) {
      console.error(e)
      checkAuthError(e)
      // キャッシュを即表示できていた場合は、裏更新の失敗でエラー画面にはしない
      if (!cached) setError(e.message || 'データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [year, month, yearMonth, checkAuthError, applyData])

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
      // 寮生マスターは全年月に影響するため、キャッシュ済みの全年月へ反映する
      for (const ym of Object.keys(cacheRef.current)) {
        cacheRef.current[ym] = { ...cacheRef.current[ym], members: next }
      }
      showToast('寮生マスターを保存しました')
    },
    [showToast, checkAuthError]
  )

  // 規定（食費単価・部費・清算ルールメモ）保存。全年月で共通の設定
  const saveConfig = useCallback(
    async (next) => {
      try {
        await api.saveConfig(next)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      const merged = { ...DEFAULT_CONFIG, ...next }
      setConfig(merged)
      // config は全年月共通のため、キャッシュ済みの全年月へ反映する
      for (const ym of Object.keys(cacheRef.current)) {
        cacheRef.current[ym] = { ...cacheRef.current[ym], config: merged }
      }
      showToast('規定を保存しました')
    },
    [showToast, checkAuthError]
  )

  // logs: メンバー食数（当日×寮）, guests: 見学高校生（当日×寮）, date: 対象日, dorm: 対象寮
  // options.silent: true の場合、成功トーストを出さない（自動保存用）
  // options.toastMessage: 成功トーストの文言を差し替える
  const saveMealLogs = useCallback(
    async (logs, guests = [], date = null, dorm = '', options = {}) => {
      try {
        await api.saveMealLogs(yearMonth, logs, guests, date, dorm)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      // メンバー食数を UPSERT 更新（key: date+member+dorm）
      const key = (l) => `${l.date}__${l.member_id}__${l.dorm || ''}`
      const map = new Map(mealLogs.map((l) => [key(l), l]))
      for (const l of logs) {
        if (l.breakfast || l.dinner) map.set(key(l), l)
        else map.delete(key(l))
      }
      const nextMealLogs = Array.from(map.values())
      setMealLogs(nextMealLogs)

      // 寮生以外（見学高校生・寮外生・寮管）は当日×寮を総入れ替え
      let nextGuestMeals = guestMeals
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
        nextGuestMeals = [
          ...guestMeals.filter((g) => !(g.date === date && (g.dorm || '') === d)),
          ...valid,
        ]
        setGuestMeals(nextGuestMeals)
      }

      // この年月をキャッシュ済みなら、保存内容をそのまま反映しておく
      const entry = cacheRef.current[yearMonth]
      if (entry) {
        cacheRef.current[yearMonth] = {
          ...entry,
          mealLogs: nextMealLogs,
          guestMeals: nextGuestMeals,
        }
      }

      if (!options.silent) {
        showToast(options.toastMessage || '食数データを保存しました')
      }
    },
    [yearMonth, mealLogs, guestMeals, showToast, checkAuthError]
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
      const mergedExpenses = [
        ...expenses.filter((e) => e.year_month !== yearMonth),
        ...nextExpenses,
      ]
      const mergedTournaments = [
        ...tournamentItems.filter((i) => i.year_month !== yearMonth),
        ...nextTournaments,
      ]
      const mergedCamps = [
        ...campItems.filter((i) => i.year_month !== yearMonth),
        ...nextCamps,
      ]
      const mergedOthers = [
        ...otherItems.filter((i) => i.year_month !== yearMonth),
        ...nextOthers,
      ]
      setExpenses(mergedExpenses)
      setTournamentItems(mergedTournaments)
      setCampItems(mergedCamps)
      setOtherItems(mergedOthers)

      const entry = cacheRef.current[yearMonth]
      if (entry) {
        cacheRef.current[yearMonth] = {
          ...entry,
          expenses: mergedExpenses,
          tournamentItems: mergedTournaments,
          campItems: mergedCamps,
          otherItems: mergedOthers,
        }
      }
      showToast('月次経費を保存しました')
    },
    [
      yearMonth,
      expenses,
      tournamentItems,
      campItems,
      otherItems,
      showToast,
      checkAuthError,
    ]
  )

  // 寮間移動の登録直後に、取り消し用メタデータをシートへ永続化する
  // （画面のstateではなくシートに保存するため、後日でも取り消せる）
  // record: { dorm, memberNames, previousMembers, createdLogs }
  const registerDormTransfer = useCallback(
    async (record) => {
      let saved
      try {
        saved = await api.saveDormTransferRecord(yearMonth, record)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      setDormTransfers((prev) => [...prev, saved])
      const entry = cacheRef.current[yearMonth]
      if (entry) {
        cacheRef.current[yearMonth] = {
          ...entry,
          dormTransfers: [...(entry.dormTransfers || []), saved],
        }
      }
      return saved
    },
    [yearMonth, checkAuthError]
  )

  // 取り消さずに、この移動登録の通知だけを消す（登録内容が正しかった場合など）
  const dismissDormTransfer = useCallback(
    async (record) => {
      try {
        await api.deleteDormTransferRecord(record.id)
      } catch (e) {
        checkAuthError(e)
        throw e
      }
      setDormTransfers((prev) => prev.filter((r) => r.id !== record.id))
      for (const ym of Object.keys(cacheRef.current)) {
        const entry = cacheRef.current[ym]
        if (!entry) continue
        cacheRef.current[ym] = {
          ...entry,
          dormTransfers: (entry.dormTransfers || []).filter(
            (r) => r.id !== record.id
          ),
        }
      }
    },
    [checkAuthError]
  )

  // 寮間移動を取り消す: 対象選手の寮・集金グループを元に戻し、
  // この移動で新規作成した食数ログだけを削除する
  // （移動前から存在した記録には一切触れない。日をまたいでも取り消せるよう
  //   record はシートに永続化されたメタデータから渡される）
  const undoDormTransfer = useCallback(
    async (record) => {
      try {
        const prevById = new Map(
          record.previousMembers.map((pm) => [pm.id, pm])
        )
        const revertedMembers = members.map((m) => {
          const pm = prevById.get(m.id)
          if (!pm) return m
          return { ...m, dorm: pm.dorm, group: pm.group }
        })
        await api.saveMembers(revertedMembers)
        setMembers(revertedMembers)
        for (const ym of Object.keys(cacheRef.current)) {
          cacheRef.current[ym] = {
            ...cacheRef.current[ym],
            members: revertedMembers,
          }
        }

        if (record.createdLogs.length > 0) {
          const deleteLogs = record.createdLogs.map((l) => ({
            date: l.date,
            member_id: l.member_id,
            dorm: l.dorm,
            breakfast: false,
            dinner: false,
          }))
          await api.saveMealLogs(
            record.yearMonth,
            deleteLogs,
            [],
            null,
            record.dorm
          )
          const key = (l) => `${l.date}__${l.member_id}__${l.dorm || ''}`
          const deleteKeys = new Set(deleteLogs.map(key))
          if (record.yearMonth === yearMonth) {
            const nextMealLogs = mealLogs.filter((l) => !deleteKeys.has(key(l)))
            setMealLogs(nextMealLogs)
            const entry = cacheRef.current[yearMonth]
            if (entry) {
              cacheRef.current[yearMonth] = { ...entry, mealLogs: nextMealLogs }
            }
          } else {
            const entry = cacheRef.current[record.yearMonth]
            if (entry) {
              cacheRef.current[record.yearMonth] = {
                ...entry,
                mealLogs: (entry.mealLogs || []).filter(
                  (l) => !deleteKeys.has(key(l))
                ),
              }
            }
          }
        }

        await api.deleteDormTransferRecord(record.id)
        setDormTransfers((prev) => prev.filter((r) => r.id !== record.id))
        for (const ym of Object.keys(cacheRef.current)) {
          const entry = cacheRef.current[ym]
          if (!entry) continue
          cacheRef.current[ym] = {
            ...entry,
            dormTransfers: (entry.dormTransfers || []).filter(
              (r) => r.id !== record.id
            ),
          }
        }
        showToast(
          `${record.memberNames.length}名の${record.dorm}への移動登録を取り消しました`
        )
      } catch (e) {
        console.error(e)
        checkAuthError(e)
        showToast('移動登録の取り消しに失敗しました', 'error')
        throw e
      }
    },
    [members, mealLogs, yearMonth, showToast, checkAuthError]
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
    dormTransfers,
    loading,
    error,
    toast,
    showToast,
    reload,
    saveMembers,
    saveConfig,
    saveMealLogs,
    saveExpenses,
    registerDormTransfer,
    undoDormTransfer,
    dismissDormTransfer,
    usingDummy: api.USE_DUMMY,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
