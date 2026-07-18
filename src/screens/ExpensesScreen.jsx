import React, { useState, useEffect, useMemo } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { GROUPS, CAMP_PRICE_PRESETS } from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Badge,
  Skeleton,
} from '../components/ui/index.jsx'
import { emptyExpense, formatYen, num, cn } from '../lib/utils.js'
import { medicalNet } from '../lib/calc.js'

// 画面C：月次経費入力（スプレッドシート風）
export default function ExpensesScreen() {
  const { members, expenses, yearMonth, loading, saveExpenses } = useApp()
  const [rows, setRows] = useState({}) // member_id -> expense
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')

  const activeMembers = useMemo(
    () => members.filter((m) => m.active),
    [members]
  )

  useEffect(() => {
    const byMember = new Map(
      expenses
        .filter((e) => e.year_month === yearMonth)
        .map((e) => [String(e.member_id), e])
    )
    const map = {}
    for (const m of activeMembers) {
      const existing = byMember.get(String(m.id))
      map[String(m.id)] = existing
        ? { ...existing }
        : emptyExpense(m.id, yearMonth)
    }
    setRows(map)
    setDirty(false)
  }, [expenses, yearMonth, activeMembers])

  const update = (id, field, value) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], [field]: value },
    }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const list = activeMembers.map((m) => rows[String(m.id)])
      await saveExpenses(list)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    const byMember = new Map(
      expenses
        .filter((e) => e.year_month === yearMonth)
        .map((e) => [String(e.member_id), e])
    )
    const map = {}
    for (const m of activeMembers) {
      const existing = byMember.get(String(m.id))
      map[String(m.id)] = existing
        ? { ...existing }
        : emptyExpense(m.id, yearMonth)
    }
    setRows(map)
    setDirty(false)
  }

  const filtered = activeMembers.filter(
    (m) => filterGroup === 'all' || m.group === filterGroup
  )

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
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
          <Badge variant="secondary">{filtered.length}名</Badge>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              取消
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="sticky left-0 z-10 min-w-[150px] bg-slate-50 px-3 py-2 text-left">
                    氏名
                  </th>
                  <th className="px-2 py-2 text-right">大会費</th>
                  <th className="px-2 py-2 text-right">補助率(%)</th>
                  <th className="px-2 py-2 text-right">合宿単価</th>
                  <th className="px-2 py-2 text-right">泊数</th>
                  <th className="px-2 py-2 text-right">治療費実費</th>
                  <th className="px-2 py-2 text-right">治療補助金</th>
                  <th className="px-2 py-2 text-right text-primary">治療差額</th>
                  <th className="px-2 py-2 text-right">佐川代</th>
                  <th className="px-2 py-2 text-right">ウエア代</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const e = rows[String(m.id)] || emptyExpense(m.id, yearMonth)
                  const net = medicalNet(e)
                  const campPreset = CAMP_PRICE_PRESETS.some(
                    (p) => p.value === num(e.camp_fee_per_night)
                  )
                    ? num(e.camp_fee_per_night)
                    : 'custom'
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        'border-b border-slate-100',
                        idx % 2 === 1 && 'bg-slate-50/40'
                      )}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5">
                        <div className="font-medium text-slate-800">
                          {m.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {m.group} · {m.rank}
                        </div>
                      </td>
                      {/* 大会費 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.tournament_fee}
                          onChange={(v) => update(m.id, 'tournament_fee', v)}
                        />
                      </td>
                      {/* 補助率 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.tournament_support_rate}
                          max={100}
                          onChange={(v) =>
                            update(
                              m.id,
                              'tournament_support_rate',
                              Math.min(100, Math.max(0, v))
                            )
                          }
                        />
                      </td>
                      {/* 合宿単価（プリセット + カスタム） */}
                      <td className="px-1 py-1">
                        <div className="flex flex-col gap-1">
                          <Select
                            value={campPreset}
                            className="h-8 text-xs"
                            onChange={(ev) => {
                              const val = ev.target.value
                              if (val === 'custom') {
                                update(m.id, 'camp_fee_per_night', 0)
                              } else {
                                update(m.id, 'camp_fee_per_night', Number(val))
                              }
                            }}
                          >
                            {CAMP_PRICE_PRESETS.map((p) => (
                              <option key={p.label} value={p.value}>
                                {p.label}
                              </option>
                            ))}
                          </Select>
                          {campPreset === 'custom' && (
                            <NumCell
                              value={e.camp_fee_per_night}
                              onChange={(v) =>
                                update(m.id, 'camp_fee_per_night', v)
                              }
                            />
                          )}
                        </div>
                      </td>
                      {/* 泊数 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.camp_nights}
                          onChange={(v) => update(m.id, 'camp_nights', v)}
                        />
                      </td>
                      {/* 治療費実費 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.medical_actual}
                          onChange={(v) => update(m.id, 'medical_actual', v)}
                        />
                      </td>
                      {/* 治療補助金 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.medical_subsidy}
                          onChange={(v) => update(m.id, 'medical_subsidy', v)}
                        />
                      </td>
                      {/* 治療差額（自動プレビュー） */}
                      <td className="px-2 py-1 text-right">
                        <span
                          className={cn(
                            'inline-block rounded px-2 py-0.5 text-xs font-semibold tabular-nums',
                            net > 0
                              ? 'bg-primary/10 text-primary'
                              : 'text-slate-400'
                          )}
                        >
                          {formatYen(net)}
                        </span>
                      </td>
                      {/* 佐川代 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.sagawa_fee}
                          onChange={(v) => update(m.id, 'sagawa_fee', v)}
                        />
                      </td>
                      {/* ウエア代 */}
                      <td className="px-1 py-1">
                        <NumCell
                          value={e.wear_fee}
                          onChange={(v) => update(m.id, 'wear_fee', v)}
                        />
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
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
        ※「治療差額」は 実費 − 補助金 を自動計算（0円未満は0円）。合宿費は
        単価 × 泊数 として清算に反映されます（GAS: saveExpenses / UPSERT）。
      </p>
    </div>
  )
}

// 数値入力セル
function NumCell({ value, onChange, max }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={max}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
      className="h-8 px-2 text-right text-xs tabular-nums"
    />
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
