import React, { useMemo } from 'react'
import { Coffee, UtensilsCrossed } from 'lucide-react'
import { Card, CardContent, Badge } from './ui/index.jsx'
import { buildMonthlyMealMatrix } from '../lib/mealMatrix.js'
import { weekdayOf, WEEKDAY_JA, formatNumber, cn } from '../lib/utils.js'

// 月間食数一覧表（縦軸=名前、横軸=日付）。閲覧専用。
// 各セルは上段=朝食／下段=夕食の小さな四角で表示する。
export default function MonthlyMealMatrix({
  dorm,
  year,
  month,
  members,
  mealLogs,
  guestMeals = [],
}) {
  const matrix = useMemo(
    () =>
      buildMonthlyMealMatrix({
        members,
        mealLogs,
        guestMeals,
        dorm,
        year,
        month,
      }),
    [members, mealLogs, guestMeals, dorm, year, month]
  )

  const { days, rows, columnTotals, grandBreakfast, grandDinner } = matrix

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" className="gap-1">
          <Coffee className="h-3.5 w-3.5" /> 月間朝食 {formatNumber(grandBreakfast)}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <UtensilsCrossed className="h-3.5 w-3.5" /> 月間夕食{' '}
          {formatNumber(grandDinner)}
        </Badge>
        <Badge variant="secondary">{rows.length}名</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[70vh] overflow-auto">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    className="sticky left-0 top-0 z-20 min-w-[160px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium text-slate-500"
                  >
                    氏名
                  </th>
                  {days.map((d) => {
                    const dow = weekdayOf(year, month, d)
                    const weekend = dow === 0 || dow === 6
                    return (
                      <th
                        key={d}
                        className={cn(
                          'sticky top-0 z-10 w-9 border-b border-slate-200 px-0.5 py-1.5 text-center font-medium',
                          weekend
                            ? dow === 0
                              ? 'bg-red-50 text-red-500'
                              : 'bg-blue-50 text-blue-500'
                            : 'bg-slate-50 text-slate-500'
                        )}
                      >
                        <div>{d}</div>
                        <div className="text-[9px]">{WEEKDAY_JA[dow]}</div>
                      </th>
                    )
                  })}
                  <th className="sticky top-0 right-0 z-20 min-w-[64px] border-b border-l border-slate-200 bg-slate-50 px-2 py-2 text-right font-medium text-slate-500">
                    合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 && (
                  <tr className="border-b border-slate-200 bg-slate-100 font-semibold">
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-700">
                      日別合計
                    </td>
                    {columnTotals.map((c) => (
                      <td
                        key={c.day}
                        className="px-0.5 py-1 text-center"
                      >
                        <div className="mx-auto flex w-fit flex-col items-center gap-0.5 text-[9px] leading-tight">
                          <span className="text-blue-600">{c.breakfast}</span>
                          <span className="text-emerald-600">{c.dinner}</span>
                        </div>
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 border-l border-slate-200 bg-slate-100 px-2 py-1.5 text-right">
                      <span className="text-blue-600">{grandBreakfast}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-emerald-600">{grandDinner}</span>
                    </td>
                  </tr>
                )}
                {rows.map((row, idx) => (
                  <tr
                    key={row.memberId}
                    className={cn(
                      'hover:bg-slate-50/60',
                      row.isCrossDorm
                        ? 'bg-amber-50/40'
                        : row.isGuest
                        ? 'bg-indigo-50/40'
                        : idx % 2 === 1 && 'bg-slate-50/30'
                    )}
                  >
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-r border-slate-200 px-3 py-1.5 font-medium text-slate-800',
                        row.isCrossDorm
                          ? 'bg-amber-50'
                          : row.isGuest
                          ? 'bg-indigo-50'
                          : idx % 2 === 1
                          ? 'bg-slate-50'
                          : 'bg-white'
                      )}
                    >
                      <div className="whitespace-nowrap">{row.name}</div>
                      {row.isCrossDorm && (
                        <div className="text-[10px] font-normal text-amber-600">
                          寮間移動
                        </div>
                      )}
                      {row.isGuest && (
                        <div className="text-[10px] font-normal text-indigo-600">
                          {row.category}
                        </div>
                      )}
                    </td>
                    {row.cells.map((cell) => {
                      const dow = weekdayOf(year, month, cell.day)
                      const weekend = dow === 0 || dow === 6
                      return (
                        <td
                          key={cell.date}
                          className={cn(
                            'px-0.5 py-1 text-center',
                            weekend && 'bg-slate-50/60'
                          )}
                        >
                          <div className="mx-auto flex w-fit flex-col items-center gap-0.5">
                            <span
                              title={`${cell.day}日 朝食: ${cell.breakfast ? '食べた' : '—'}`}
                              className={cn(
                                'h-2 w-5 rounded-sm',
                                cell.breakfast ? 'bg-blue-500' : 'bg-slate-200'
                              )}
                            />
                            <span
                              title={`${cell.day}日 夕食: ${cell.dinner ? '食べた' : '—'}`}
                              className={cn(
                                'h-2 w-5 rounded-sm',
                                cell.dinner ? 'bg-emerald-500' : 'bg-slate-200'
                              )}
                            />
                          </div>
                        </td>
                      )
                    })}
                    <td
                      className={cn(
                        'sticky right-0 z-10 border-l border-slate-200 px-2 py-1.5 text-right tabular-nums',
                        row.isCrossDorm ? 'bg-amber-50' : idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                      )}
                    >
                      <span className="font-semibold text-blue-600">
                        {row.totalBreakfast}
                      </span>
                      <span className="text-slate-300">/</span>
                      <span className="font-semibold text-emerald-600">
                        {row.totalDinner}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={days.length + 2}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      該当するメンバーがいません
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-semibold">
                    <td className="sticky left-0 z-10 border-t border-r border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-700">
                      日別合計
                    </td>
                    {columnTotals.map((c) => (
                      <td
                        key={c.day}
                        className="border-t border-slate-200 px-0.5 py-1 text-center"
                      >
                        <div className="mx-auto flex w-fit flex-col items-center gap-0.5 text-[9px] leading-tight">
                          <span className="text-blue-600">{c.breakfast}</span>
                          <span className="text-emerald-600">{c.dinner}</span>
                        </div>
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 border-l border-t border-slate-200 bg-slate-100 px-2 py-1.5 text-right">
                      <span className="text-blue-600">{grandBreakfast}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-emerald-600">{grandDinner}</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-5 rounded-sm bg-blue-500" /> 朝食（上段）
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-5 rounded-sm bg-emerald-500" /> 夕食（下段）
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-5 rounded-sm bg-slate-200" /> 食べていない
        </span>
        <span>各セルにマウスを乗せると日付が確認できます</span>
      </div>
      <p className="text-xs text-muted-foreground">
        ※ この一覧表は閲覧専用です。編集は「日別入力」表示から行ってください。
      </p>
    </div>
  )
}
