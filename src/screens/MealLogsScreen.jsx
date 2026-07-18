import React, { useState, useEffect, useMemo } from 'react'
import { Save, Coffee, UtensilsCrossed, CheckCheck, X } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { RANKS, GROUPS } from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Select,
  Checkbox,
  Badge,
  Skeleton,
} from '../components/ui/index.jsx'
import {
  daysInMonth,
  toDateStr,
  weekdayOf,
  WEEKDAY_JA,
  cn,
} from '../lib/utils.js'

// 画面B：日別・月別 食数管理
export default function MealLogsScreen() {
  const { year, month, members, mealLogs, loading, saveMealLogs } = useApp()

  const today = new Date()
  const defaultDay =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : 1
  const [day, setDay] = useState(defaultDay)
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterRank, setFilterRank] = useState('all')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // date -> member_id -> { breakfast, dinner } の編集バッファ（当日のみ）
  const [draft, setDraft] = useState({})

  const dateStr = toDateStr(year, month, day)
  const totalDays = daysInMonth(year, month)

  // 選択日が月の日数を超えたら丸める
  useEffect(() => {
    if (day > totalDays) setDay(totalDays)
  }, [totalDays, day])

  // mealLogs から当日の状態を初期化
  useEffect(() => {
    const map = {}
    for (const log of mealLogs) {
      if (log.date === dateStr) {
        map[String(log.member_id)] = {
          breakfast: !!log.breakfast,
          dinner: !!log.dinner,
        }
      }
    }
    setDraft(map)
    setDirty(false)
  }, [mealLogs, dateStr])

  const activeMembers = useMemo(
    () => members.filter((m) => m.active),
    [members]
  )

  const filtered = activeMembers.filter((m) => {
    if (filterGroup !== 'all' && m.group !== filterGroup) return false
    if (filterRank !== 'all' && m.rank !== filterRank) return false
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

  const handleSave = async () => {
    setSaving(true)
    try {
      // 全在籍メンバー分を当日分として UPSERT（未チェックは削除扱い）
      const logs = activeMembers.map((m) => {
        const v = getVal(m.id)
        return {
          date: dateStr,
          member_id: m.id,
          breakfast: !!v.breakfast,
          dinner: !!v.dinner,
        }
      })
      await saveMealLogs(logs)
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

  const dow = weekdayOf(year, month, day)
  const isWeekend = dow === 0 || dow === 6

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
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
                  <th className="w-28 px-4 py-3">ランク</th>
                  <th className="w-28 px-4 py-3">グループ</th>
                  <th className="w-24 px-4 py-3 text-center">朝食</th>
                  <th className="w-24 px-4 py-3 text-center">夕食</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const v = getVal(m.id)
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 tabular-nums text-slate-400">
                        {m.id}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {m.name}
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
                      colSpan={6}
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

      <p className="text-xs text-muted-foreground">
        ※チェックの有無を当日の食数として一括保存します（GAS: saveMealLogs / UPSERT）。
      </p>
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
