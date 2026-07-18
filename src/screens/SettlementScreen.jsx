import React, { useState, useMemo, useRef } from 'react'
import { FileDown, Loader2, TrendingUp, Users, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { GROUPS } from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Select,
  Badge,
  Skeleton,
} from '../components/ui/index.jsx'
import { formatYen, formatYearMonthJa, cn } from '../lib/utils.js'
import {
  buildSettlementRows,
  groupSettlementRows,
  sumTotals,
} from '../lib/calc.js'
import { generateGroupPdf } from '../lib/pdf.js'
import CollectionSheet from '../components/CollectionSheet.jsx'

// 画面D：清算一覧・集金用PDF出力
export default function SettlementScreen() {
  const {
    members,
    expenses,
    mealLogs,
    config,
    year,
    month,
    yearMonth,
    loading,
    showToast,
  } = useApp()
  const [filterGroup, setFilterGroup] = useState('all')
  const [generating, setGenerating] = useState(false)
  const sheetsRef = useRef(null)

  const rows = useMemo(
    () =>
      buildSettlementRows({
        members,
        expenses,
        mealLogs,
        config,
        yearMonth,
      }),
    [members, expenses, mealLogs, config, yearMonth]
  )

  const grouped = useMemo(
    () => groupSettlementRows(rows, GROUPS),
    [rows]
  )

  const displayRows =
    filterGroup === 'all'
      ? rows
      : rows.filter((r) => r.group === filterGroup)

  const grandTotal = sumTotals(rows)
  const avg = rows.length ? Math.round(grandTotal / rows.length) : 0

  const handleDownloadPdf = async () => {
    setGenerating(true)
    try {
      // 少し待ってオフスクリーン描画を確実に反映
      await new Promise((r) => setTimeout(r, 50))
      const container = sheetsRef.current
      const pages = Array.from(container.querySelectorAll('[data-pdf-page]'))
      if (pages.length === 0) {
        showToast('出力対象のデータがありません', 'error')
        return
      }
      await generateGroupPdf(
        pages,
        `集金一覧_${formatYearMonthJa(year, month)}.pdf`
      )
      showToast('PDFをダウンロードしました')
    } catch (e) {
      console.error(e)
      showToast('PDF生成に失敗しました', 'error')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* サマリーカード */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Users}
          label="対象人数"
          value={`${rows.length}名`}
          tone="blue"
        />
        <SummaryCard
          icon={Wallet}
          label="請求合計"
          value={formatYen(grandTotal)}
          tone="green"
        />
        <SummaryCard
          icon={TrendingUp}
          label="1人あたり平均"
          value={formatYen(avg)}
          tone="violet"
        />
      </div>

      {/* ツールバー */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
          <Badge variant="secondary">{displayRows.length}名</Badge>
        </div>
        <Button onClick={handleDownloadPdf} disabled={generating || rows.length === 0}>
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {generating ? 'PDF生成中...' : '集金用PDFダウンロード'}
        </Button>
      </div>

      {/* グループごとの合計バッジ */}
      <div className="flex flex-wrap gap-2">
        {grouped.map((g) => (
          <div
            key={g.group}
            className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
          >
            <span className="font-medium text-slate-700">{g.group}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500">{g.rows.length}名</span>
            <span className="font-semibold tabular-nums text-primary">
              {formatYen(sumTotals(g.rows))}
            </span>
          </div>
        ))}
      </div>

      {/* 清算一覧テーブル */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="px-3 py-2.5 text-left">氏名</th>
                  <th className="px-3 py-2.5 text-left">グループ</th>
                  <th className="px-3 py-2.5 text-left">ランク</th>
                  <th className="px-3 py-2.5 text-right">部費</th>
                  <th className="px-3 py-2.5 text-right">食費</th>
                  <th className="px-3 py-2.5 text-right">大会費</th>
                  <th className="px-3 py-2.5 text-right">合宿費</th>
                  <th className="px-3 py-2.5 text-right">治療費</th>
                  <th className="px-3 py-2.5 text-right">佐川</th>
                  <th className="px-3 py-2.5 text-right">ウエア</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-slate-700">
                    合計請求額
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr
                    key={r.memberId}
                    className={cn(
                      'border-b border-slate-100 hover:bg-slate-50/60',
                      i % 2 === 1 && 'bg-slate-50/30'
                    )}
                  >
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r.group}</td>
                    <td className="px-3 py-2 text-slate-500">{r.rank}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatYen(r.clubFee)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span>{formatYen(r.mealFee)}</span>
                      <span className="ml-1 text-[11px] text-slate-400">
                        (朝{r.breakfastCount}/夕{r.dinnerCount})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.tournament ? formatYen(r.tournament) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.camp ? formatYen(r.camp) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.medical ? formatYen(r.medical) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.sagawa ? formatYen(r.sagawa) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.wear ? formatYen(r.wear) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">
                      {formatYen(r.total)}
                    </td>
                  </tr>
                ))}
                {displayRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      対象データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        合計請求額 = 部費 + 大会費×(1−補助率) + 合宿単価×泊数 + (治療費実費−補助金) +
        佐川代 + ウエア代 + 食費(朝×{formatYen(config.breakfast_price)} + 夕×
        {formatYen(config.dinner_price)})
      </p>

      {/* PDF描画用オフスクリーン要素（グループごと1ページ） */}
      <div className="pdf-offscreen" ref={sheetsRef} aria-hidden>
        {grouped.map((g) => (
          <div key={g.group} data-pdf-page>
            <CollectionSheet
              group={g.group}
              rows={g.rows}
              year={year}
              month={month}
              config={config}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg',
            tones[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold tabular-nums text-slate-900">
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
