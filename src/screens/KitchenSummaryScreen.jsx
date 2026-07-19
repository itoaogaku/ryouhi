import React, { useState, useMemo } from 'react'
import {
  ChefHat,
  Coffee,
  UtensilsCrossed,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Card, CardContent, Select, Badge, Skeleton } from '../components/ui/index.jsx'
import {
  daysInMonth,
  toDateStr,
  weekdayOf,
  WEEKDAY_JA,
  formatNumber,
  cn,
} from '../lib/utils.js'
import { buildKitchenSummary } from '../lib/kitchen.js'

// 画面：調理人向け食数集計
// 寮生・見学高校生・寮外生・寮管の食数を、寮ごとに取りまとめて表示する
// 読み取り専用の一覧。編集はできません（記録は各寮の食数管理画面で行う）。
export default function KitchenSummaryScreen() {
  const { year, month, members, mealLogs, guestMeals, loading } = useApp()

  const today = new Date()
  const defaultDay =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : 1
  const [day, setDay] = useState(defaultDay)
  const [expandedDorms, setExpandedDorms] = useState(() => new Set())

  const totalDays = daysInMonth(year, month)
  const dateStr = toDateStr(year, month, day)
  const dow = weekdayOf(year, month, day)
  const isWeekend = dow === 0 || dow === 6

  const summary = useMemo(
    () => buildKitchenSummary({ members, mealLogs, guestMeals, date: dateStr }),
    [members, mealLogs, guestMeals, dateStr]
  )

  const toggleDorm = (dorm) => {
    setExpandedDorms((prev) => {
      const next = new Set(prev)
      if (next.has(dorm)) next.delete(dorm)
      else next.add(dorm)
      return next
    })
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* 説明バナー */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
        <ChefHat className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          調理人向け食数集計
        </span>
        <span className="text-xs text-muted-foreground">
          （寮生・見学高校生・寮外生・寮管の食数を寮ごとに取りまとめた一覧です。閲覧専用）
        </span>
      </div>

      {/* 日付選択 */}
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
      </div>

      {/* 大きな合計カード */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BigCount
          icon={Coffee}
          label="本日の朝食 合計"
          value={summary.grandBreakfast}
          tone="blue"
        />
        <BigCount
          icon={UtensilsCrossed}
          label="本日の夕食 合計"
          value={summary.grandDinner}
          tone="green"
        />
      </div>

      {/* 寮ごとの内訳 */}
      <div className="space-y-3">
        {summary.dormRows.map((row) => {
          const isOpen = expandedDorms.has(row.dorm)
          const hasNames =
            row.member.names.length > 0 ||
            row.categories.some((c) => c.names.length > 0)
          return (
            <Card key={row.dorm}>
              <CardContent className="p-0">
                <button
                  onClick={() => toggleDorm(row.dorm)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    {hasNames ? (
                      isOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="text-base font-semibold text-slate-800">
                      {row.dorm}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="gap-1">
                      <Coffee className="h-3.5 w-3.5" /> 朝{' '}
                      {formatNumber(row.breakfast)}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <UtensilsCrossed className="h-3.5 w-3.5" /> 夕{' '}
                      {formatNumber(row.dinner)}
                    </Badge>
                  </div>
                </button>

                {/* 種別ごとの内訳テーブル */}
                <div className="border-t border-slate-100 px-4 py-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-slate-400">
                        <th className="py-1 text-left">区分</th>
                        <th className="py-1 text-right">朝食</th>
                        <th className="py-1 text-right">夕食</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100">
                        <td className="py-1.5 font-medium text-slate-700">
                          寮生
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatNumber(row.member.breakfast)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatNumber(row.member.dinner)}
                        </td>
                      </tr>
                      {row.categories.map((c) => (
                        <tr key={c.category} className="border-t border-slate-100">
                          <td className="py-1.5 text-slate-600">
                            {c.category}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {formatNumber(c.breakfast)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {formatNumber(c.dinner)}
                          </td>
                        </tr>
                      ))}
                      {row.categories.length === 0 && (
                        <tr className="border-t border-slate-100">
                          <td colSpan={3} className="py-1.5 text-xs text-slate-400">
                            寮生以外の記録はありません
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 展開: 氏名リスト（確認用） */}
                {isOpen && hasNames && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                    <NameList title="寮生" items={row.member.names} />
                    {row.categories.map(
                      (c) =>
                        c.names.length > 0 && (
                          <NameList
                            key={c.category}
                            title={c.category}
                            items={c.names}
                          />
                        )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        ※ この画面は閲覧専用です。食数の記録・修正は「1寮 食数」「2寮 食数」画面で行ってください。
      </p>
    </div>
  )
}

function NameList({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-xs font-semibold text-slate-500">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600"
          >
            {it.name}
            <span className="text-slate-400">
              {it.breakfast && it.dinner
                ? '(朝夕)'
                : it.breakfast
                ? '(朝)'
                : '(夕)'}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function BigCount({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-xl',
            tones[tone]
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold tabular-nums text-slate-900">
            {formatNumber(value)}
            <span className="ml-1 text-base font-medium text-slate-400">
              食
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  )
}
