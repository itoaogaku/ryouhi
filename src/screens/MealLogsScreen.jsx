import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Save,
  Coffee,
  UtensilsCrossed,
  CheckCheck,
  X,
  Plus,
  Trash2,
  GraduationCap,
  Home,
  CalendarDays,
  Table2,
  Wand2,
  Printer,
  Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  RANKS,
  GROUPS,
  GUEST_CATEGORIES,
  STANDARD_MEAL_SCHEDULE,
  mealDormOf,
} from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Checkbox,
  Badge,
  Skeleton,
  Modal,
} from '../components/ui/index.jsx'
import {
  daysInMonth,
  toDateStr,
  weekdayOf,
  WEEKDAY_JA,
  formatYearMonthJa,
  uid,
  cn,
} from '../lib/utils.js'
import MonthlyMealMatrix from '../components/MonthlyMealMatrix.jsx'
import MealListSheet from '../components/MealListSheet.jsx'
import { buildMonthlyMealMatrix } from '../lib/mealMatrix.js'
import { generateMealListPdf } from '../lib/pdf.js'

// 画面B：日別・月別 食数管理（寮ごと）
// dorm: '1寮' | '2寮' — その寮の食数を管理
// guestCategories: この寮で記録を許可する「寮生以外」の種別
//   （2寮には高校生が泊まらないため見学高校生は対象外にできる）
export default function MealLogsScreen({ dorm, guestCategories = GUEST_CATEGORIES }) {
  const {
    year,
    month,
    members,
    mealLogs,
    guestMeals,
    loading,
    saveMealLogs,
    showToast,
  } = useApp()

  const today = new Date()
  const defaultDay =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : 1
  const [day, setDay] = useState(defaultDay)
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterRank, setFilterRank] = useState('all')
  // 表示範囲: 'home' = この寮の所属＋喫食者 / 'all' = 全寮生
  const [scope, setScope] = useState('home')
  // 表示モード: 'daily' = 日別入力 / 'monthly' = 月間一覧表（名前×日付）
  const [viewMode, setViewMode] = useState('daily')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)
  const [applyingSchedule, setApplyingSchedule] = useState(false)
  const [generatingList, setGeneratingList] = useState(false)
  const mealListRef = useRef(null)

  // member_id -> { breakfast, dinner } の編集バッファ（当日×この寮）
  const [draft, setDraft] = useState({})
  // 寮生以外（見学高校生・寮外生・寮管）の当日バッファ:
  // [{ uid, category, school, name, breakfast, dinner }]
  const [guestDraft, setGuestDraft] = useState([])

  const dateStr = toDateStr(year, month, day)
  const totalDays = daysInMonth(year, month)

  // 選択日が月の日数を超えたら丸める
  useEffect(() => {
    if (day > totalDays) setDay(totalDays)
  }, [totalDays, day])

  // mealLogs / guestMeals から当日×この寮の状態を初期化
  useEffect(() => {
    const map = {}
    for (const log of mealLogs) {
      if (log.date === dateStr && (log.dorm || '') === dorm) {
        map[String(log.member_id)] = {
          breakfast: !!log.breakfast,
          dinner: !!log.dinner,
        }
      }
    }
    setDraft(map)
    setGuestDraft(
      guestMeals
        .filter((g) => g.date === dateStr && (g.dorm || '') === dorm)
        .map((g) => ({
          uid: uid(),
          category: g.category || '見学高校生',
          school: g.school || '',
          name: g.name || '',
          breakfast: !!g.breakfast,
          dinner: !!g.dinner,
        }))
    )
    setDirty(false)
  }, [mealLogs, guestMeals, dateStr, dorm])

  const activeMembers = useMemo(
    () => members.filter((m) => m.active),
    [members]
  )

  // 標準スケジュール一括反映の対象（この寮で食事をする人。表示中の絞り込みを反映）
  const schedulePopulation = useMemo(() => {
    let pop = activeMembers.filter((m) => mealDormOf(m) === dorm)
    if (filterGroup !== 'all') pop = pop.filter((m) => m.group === filterGroup)
    if (filterRank !== 'all') pop = pop.filter((m) => m.rank === filterRank)
    return pop
  }, [activeMembers, dorm, filterGroup, filterRank])

  // 既に何らかの記録（朝食・夕食いずれかにチェック）がある「日付×メンバー」の組み合わせ
  const existingLogKeys = useMemo(() => {
    const set = new Set()
    for (const log of mealLogs) {
      if ((log.dorm || '') !== dorm) continue
      if (!log.breakfast && !log.dinner) continue
      set.add(`${log.date}__${log.member_id}`)
    }
    return set
  }, [mealLogs, dorm])

  // 火〜土曜=朝夕、日曜=朝のみ、月曜=提供なし の標準スケジュールのうち、
  // まだ記録の無い「日付×メンバー」だけを対象にした一覧（安全のため上書きしない）
  const pendingScheduleLogs = useMemo(() => {
    const logs = []
    for (const m of schedulePopulation) {
      for (let d = 1; d <= totalDays; d++) {
        const date = toDateStr(year, month, d)
        if (existingLogKeys.has(`${date}__${m.id}`)) continue
        const dow = weekdayOf(year, month, d)
        const sched = STANDARD_MEAL_SCHEDULE[dow]
        // 朝夕とも提供なしの日（月曜）は記録自体が残らないため対象外
        if (!sched.breakfast && !sched.dinner) continue
        logs.push({
          date,
          member_id: m.id,
          dorm,
          breakfast: sched.breakfast,
          dinner: sched.dinner,
        })
      }
    }
    return logs
  }, [schedulePopulation, existingLogKeys, dorm, totalDays, year, month])

  // 未入力の日付×メンバーにだけ標準スケジュールを一括反映する
  // （既に入力済みの日は一切変更しない。guests にも触れない）
  const applyStandardSchedule = async () => {
    if (pendingScheduleLogs.length === 0) {
      setShowScheduleConfirm(false)
      return
    }
    setApplyingSchedule(true)
    try {
      await saveMealLogs(pendingScheduleLogs, [], null, dorm)
      setShowScheduleConfirm(false)
    } finally {
      setApplyingSchedule(false)
    }
  }

  // 食堂掲示用PDFの元データ（表示中の絞り込みに関係なく、この寮の対象者全員）
  const printMatrix = useMemo(
    () =>
      buildMonthlyMealMatrix({
        members,
        mealLogs,
        dorm,
        year,
        month,
        filterGroup: 'all',
        filterRank: 'all',
      }),
    [members, mealLogs, dorm, year, month]
  )

  const handleDownloadMealListPdf = async () => {
    setGeneratingList(true)
    try {
      await new Promise((r) => setTimeout(r, 50))
      const container = mealListRef.current
      const pages = Array.from(container.querySelectorAll('[data-pdf-page]'))
      if (pages.length === 0) {
        showToast('出力対象のデータがありません', 'error')
        return
      }
      await generateMealListPdf(
        pages,
        `${dorm}_食数一覧表_${formatYearMonthJa(year, month)}.pdf`
      )
      showToast('食堂掲示用PDFをダウンロードしました')
    } catch (e) {
      console.error(e)
      showToast('PDF生成に失敗しました', 'error')
    } finally {
      setGeneratingList(false)
    }
  }

  // この寮で当日すでに喫食記録があるメンバー（他寮所属でも表示する）
  const ateHereIds = useMemo(() => {
    const set = new Set()
    for (const log of mealLogs) {
      if (
        log.date === dateStr &&
        (log.dorm || '') === dorm &&
        (log.breakfast || log.dinner)
      ) {
        set.add(String(log.member_id))
      }
    }
    return set
  }, [mealLogs, dateStr, dorm])

  const filtered = activeMembers.filter((m) => {
    if (filterGroup !== 'all' && m.group !== filterGroup) return false
    if (filterRank !== 'all' && m.rank !== filterRank) return false
    // 表示範囲: home = この寮で食事をする人 or この寮での喫食者、all = 全寮生
    // （女子寮所属は1寮で食事をするため、1寮では「所属」として扱う）
    if (scope === 'home') {
      const isHome = mealDormOf(m) === dorm
      if (!isHome && !ateHereIds.has(String(m.id))) return false
    }
    return true
  })

  const getVal = (id) =>
    draft[String(id)] || { breakfast: false, dinner: false }

  const setVal = (id, field, value) => {
    setDraft((prev) => ({
      ...prev,
      [String(id)]: { ...getVal(id), [field]: value },
    }))
    setDirty(true)
  }

  // 表示中メンバーに対する一括操作
  const bulkSet = (field, value) => {
    setDraft((prev) => {
      const next = { ...prev }
      for (const m of filtered) {
        next[String(m.id)] = { ...getVal(m.id), [field]: value }
      }
      return next
    })
    setDirty(true)
  }

  // ---- 寮生以外（見学高校生・寮外生・寮管）の操作 ----
  const addGuest = () => {
    setGuestDraft((prev) => [
      ...prev,
      {
        uid: uid(),
        category: guestCategories[0] || '見学高校生',
        school: '',
        name: '',
        breakfast: false,
        dinner: true,
      },
    ])
    setDirty(true)
  }
  const updateGuest = (uidKey, field, value) => {
    setGuestDraft((prev) =>
      prev.map((g) => (g.uid === uidKey ? { ...g, [field]: value } : g))
    )
    setDirty(true)
  }
  const removeGuest = (uidKey) => {
    setGuestDraft((prev) => prev.filter((g) => g.uid !== uidKey))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 全在籍メンバー分を当日×この寮として UPSERT（未チェックは削除扱い）
      const logs = activeMembers.map((m) => {
        const v = getVal(m.id)
        return {
          date: dateStr,
          member_id: m.id,
          dorm,
          breakfast: !!v.breakfast,
          dinner: !!v.dinner,
        }
      })
      // 寮生以外（学校名または氏名ありのみ保存）
      const guests = guestDraft
        .filter(
          (g) => (g.name || '').trim() !== '' || (g.school || '').trim() !== ''
        )
        .map((g) => ({
          date: dateStr,
          dorm,
          category: g.category || '見学高校生',
          school: (g.school || '').trim(),
          name: (g.name || '').trim(),
          breakfast: !!g.breakfast,
          dinner: !!g.dinner,
        }))
      await saveMealLogs(logs, guests, dateStr, dorm)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  // 当日の集計
  const counts = filtered.reduce(
    (acc, m) => {
      const v = getVal(m.id)
      if (v.breakfast) acc.breakfast += 1
      if (v.dinner) acc.dinner += 1
      return acc
    },
    { breakfast: 0, dinner: 0 }
  )
  const guestCounts = guestDraft.reduce(
    (acc, g) => {
      if (g.breakfast) acc.breakfast += 1
      if (g.dinner) acc.dinner += 1
      return acc
    },
    { breakfast: 0, dinner: 0 }
  )

  const dow = weekdayOf(year, month, day)
  const isWeekend = dow === 0 || dow === 6

  // セレクトの選択肢: この寮で許可された種別 + 既存データに残る種別（データ欠落防止）
  const availableCategories = Array.from(
    new Set([...guestCategories, ...guestDraft.map((g) => g.category)])
  )

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* 寮バナー */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
        <Home className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          {dorm} の食数管理
        </span>
        <span className="text-xs text-muted-foreground">
          （この寮で食べた人を記録。他寮の人が食べた場合は「全寮生」表示で追加できます）
        </span>
      </div>

      {/* 表示モード切替 & 一括反映 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'daily'
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <CalendarDays className="h-4 w-4" />
            日別入力
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'monthly'
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Table2 className="h-4 w-4" />
            月間一覧表（名前×日付）
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleDownloadMealListPdf}
            disabled={generatingList}
          >
            {generatingList ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {generatingList ? '生成中...' : '食堂掲示用PDF出力'}
          </Button>
          <Button variant="secondary" onClick={() => setShowScheduleConfirm(true)}>
            <Wand2 className="h-4 w-4" />
            標準スケジュールを一括反映
          </Button>
        </div>
      </div>

      {showScheduleConfirm && (
        <Modal
          open
          onClose={() => setShowScheduleConfirm(false)}
          title="標準スケジュールを一括反映"
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowScheduleConfirm(false)}
                disabled={applyingSchedule}
              >
                キャンセル
              </Button>
              <Button
                onClick={applyStandardSchedule}
                disabled={applyingSchedule || pendingScheduleLogs.length === 0}
              >
                {applyingSchedule
                  ? '反映中...'
                  : pendingScheduleLogs.length === 0
                  ? '未入力の日はありません'
                  : `反映する（未入力 ${pendingScheduleLogs.length}件）`}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              {formatYearMonthJa(year, month)}の {dorm}
              （対象 {schedulePopulation.length}名）について、
              <strong>まだ記録の無い日にだけ</strong>
              以下の標準スケジュールを一括で入力します。
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>火曜〜土曜：朝食・夕食あり</li>
              <li>日曜：朝食のみ</li>
              <li>月曜：提供なし</li>
            </ul>
            <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-primary">
              安全のため、既に朝食・夕食のいずれかにチェックが入っている日は
              上書きしません。欠席や特別対応を反映済みの日はそのまま残ります。
            </p>
            <p className="text-xs text-slate-400">
              未入力の対象：{pendingScheduleLogs.length}件（{schedulePopulation.length}
              名 ×最大{totalDays}日のうち）
            </p>
          </div>
        </Modal>
      )}

      {viewMode === 'monthly' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-36"
            >
              <option value="all">全グループ</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
            <Select
              value={filterRank}
              onChange={(e) => setFilterRank(e.target.value)}
              className="w-36"
            >
              <option value="all">全ランク</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <MonthlyMealMatrix
            dorm={dorm}
            year={year}
            month={month}
            members={members}
            mealLogs={mealLogs}
            filterGroup={filterGroup}
            filterRank={filterRank}
          />
        </>
      ) : (
        <>
      {/* 日付選択 & 集計 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              日付
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-24"
              >
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </Select>
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-sm font-medium',
                  isWeekend
                    ? dow === 0
                      ? 'bg-red-50 text-red-600'
                      : 'bg-blue-50 text-blue-600'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                ({WEEKDAY_JA[dow]})
              </span>
            </div>
          </div>
          <Select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="w-36"
          >
            <option value="all">全グループ</option>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <Select
            value={filterRank}
            onChange={(e) => setFilterRank(e.target.value)}
            className="w-36"
          >
            <option value="all">全ランク</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-44"
            title="表示範囲"
          >
            <option value="home">{dorm}所属＋喫食者</option>
            <option value="all">全寮生（他寮を含む）</option>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Coffee className="h-3.5 w-3.5" /> 朝 {counts.breakfast}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <UtensilsCrossed className="h-3.5 w-3.5" /> 夕 {counts.dinner}
          </Badge>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '一括保存'}
          </Button>
        </div>
      </div>

      {/* 一括操作バー */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="font-medium text-slate-500">表示中を一括:</span>
        <Button size="sm" variant="secondary" onClick={() => bulkSet('breakfast', true)}>
          <CheckCheck className="h-3.5 w-3.5" /> 朝 全◯
        </Button>
        <Button size="sm" variant="ghost" onClick={() => bulkSet('breakfast', false)}>
          <X className="h-3.5 w-3.5" /> 朝 全×
        </Button>
        <span className="mx-1 text-slate-300">|</span>
        <Button size="sm" variant="secondary" onClick={() => bulkSet('dinner', true)}>
          <CheckCheck className="h-3.5 w-3.5" /> 夕 全◯
        </Button>
        <Button size="sm" variant="ghost" onClick={() => bulkSet('dinner', false)}>
          <X className="h-3.5 w-3.5" /> 夕 全×
        </Button>
      </div>

      {/* グリッド */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="w-12 px-4 py-3">ID</th>
                  <th className="px-4 py-3">氏名</th>
                  <th className="w-24 px-4 py-3">所属寮</th>
                  <th className="w-28 px-4 py-3">ランク</th>
                  <th className="w-28 px-4 py-3">グループ</th>
                  <th className="w-24 px-4 py-3 text-center">朝食</th>
                  <th className="w-24 px-4 py-3 text-center">夕食</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const v = getVal(m.id)
                  const isCrossDorm = mealDormOf(m) !== dorm
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        'border-b border-slate-100 hover:bg-slate-50/60',
                        isCrossDorm && 'bg-amber-50/50'
                      )}
                    >
                      <td className="px-4 py-2 tabular-nums text-slate-400">
                        {m.id}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {m.name}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs',
                            isCrossDorm
                              ? 'bg-amber-100 text-amber-700'
                              : 'text-slate-500'
                          )}
                        >
                          {m.dorm || '—'}
                          {isCrossDorm && '（他寮）'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{m.rank}</td>
                      <td className="px-4 py-2 text-slate-500">{m.group}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={v.breakfast}
                            onChange={(val) => setVal(m.id, 'breakfast', val)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={v.dinner}
                            onChange={(val) => setVal(m.id, 'dinner', val)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      該当するメンバーがいません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 寮生以外（見学高校生・寮外生・寮管）の食数 */}
      {guestCategories.length > 0 && (
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
              寮生以外の食数 · {dorm}（{month}月{day}日 {WEEKDAY_JA[dow]}）
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <Coffee className="h-3.5 w-3.5" /> 朝 {guestCounts.breakfast}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <UtensilsCrossed className="h-3.5 w-3.5" /> 夕 {guestCounts.dinner}
              </Badge>
              <Button size="sm" variant="secondary" onClick={addGuest}>
                <Plus className="h-3.5 w-3.5" />
                追加
              </Button>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            見学高校生・寮外生・寮管など、寮生以外で食事をとる人をここに記録します。
          </p>

          {guestDraft.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              この日は寮生以外の記録がありません。「追加」で種別・氏名・朝夕を記録できます。
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[100px_1fr_1fr_56px_56px_32px] gap-2 px-1 text-[11px] font-medium text-slate-400">
                <span>種別</span>
                <span>学校名・備考</span>
                <span>氏名</span>
                <span className="text-center">朝食</span>
                <span className="text-center">夕食</span>
                <span></span>
              </div>
              {guestDraft.map((g) => (
                <div
                  key={g.uid}
                  className="grid grid-cols-[100px_1fr_1fr_56px_56px_32px] items-center gap-2"
                >
                  <Select
                    value={g.category}
                    onChange={(e) => updateGuest(g.uid, 'category', e.target.value)}
                    className="h-9 text-xs"
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={g.school}
                    placeholder={
                      g.category === '見学高校生' ? '〇〇高校' : '備考（任意）'
                    }
                    onChange={(e) => updateGuest(g.uid, 'school', e.target.value)}
                  />
                  <Input
                    value={g.name}
                    placeholder="田中 太郎"
                    onChange={(e) => updateGuest(g.uid, 'name', e.target.value)}
                  />
                  <div className="flex justify-center">
                    <Checkbox
                      checked={g.breakfast}
                      onChange={(val) => updateGuest(g.uid, 'breakfast', val)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={g.dinner}
                      onChange={(val) => updateGuest(g.uid, 'dinner', val)}
                    />
                  </div>
                  <button
                    onClick={() => removeGuest(g.uid)}
                    className="flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-destructive"
                    aria-label="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <p className="text-xs text-muted-foreground">
        ※チェックの有無を当日の食数として一括保存します（メンバー: UPSERT
        {guestCategories.length > 0 && '、寮生以外: 当日分を入れ替え'}）。上部の「一括保存」ボタンで保存されます。
      </p>
        </>
      )}

      {/* PDF描画用オフスクリーン要素（食堂掲示用 月間食数一覧） */}
      <div className="pdf-offscreen" ref={mealListRef} aria-hidden>
        <MealListSheet
          dorm={dorm}
          year={year}
          month={month}
          days={printMatrix.days}
          rows={printMatrix.rows}
        />
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
