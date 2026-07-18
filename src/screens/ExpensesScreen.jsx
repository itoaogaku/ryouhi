import React, { useState, useEffect, useMemo } from 'react'
import {
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Trophy,
  Tent,
} from 'lucide-react'
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
import {
  emptyExpense,
  emptyTournamentItem,
  emptyCampItem,
  formatYen,
  num,
  uid,
  cn,
} from '../lib/utils.js'
import { medicalNet, tournamentItemNet, campItemCost } from '../lib/calc.js'

// 画面C：月次経費入力（大会・合宿は明細で複数登録）
export default function ExpensesScreen() {
  const {
    members,
    expenses,
    tournamentItems,
    campItems,
    yearMonth,
    loading,
    saveExpenses,
  } = useApp()
  const [rows, setRows] = useState({}) // member_id -> { ...expense, tournaments, camps }
  const [expanded, setExpanded] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')

  const activeMembers = useMemo(
    () => members.filter((m) => m.active),
    [members]
  )

  // context のデータから編集バッファを初期化
  const buildRows = useMemo(() => {
    return () => {
      const expByMember = new Map(
        expenses
          .filter((e) => e.year_month === yearMonth)
          .map((e) => [String(e.member_id), e])
      )
      const tourByMember = groupBy(tournamentItems, yearMonth)
      const campByMember = groupBy(campItems, yearMonth)

      const map = {}
      for (const m of activeMembers) {
        const key = String(m.id)
        const base = expByMember.get(key) || emptyExpense(m.id, yearMonth)
        map[key] = {
          medical_actual: num(base.medical_actual),
          medical_subsidy: num(base.medical_subsidy),
          sagawa_fee: num(base.sagawa_fee),
          wear_fee: num(base.wear_fee),
          tournaments: (tourByMember.get(key) || []).map((t) => ({
            uid: uid(),
            name: t.name || '',
            fee: num(t.fee),
            subsidy: num(t.subsidy),
          })),
          camps: (campByMember.get(key) || []).map((c) => ({
            uid: uid(),
            name: c.name || '',
            fee_per_night: num(c.fee_per_night),
            nights: num(c.nights),
          })),
        }
      }
      return map
    }
  }, [expenses, tournamentItems, campItems, yearMonth, activeMembers])

  useEffect(() => {
    setRows(buildRows())
    setDirty(false)
  }, [buildRows])

  const row = (id) => rows[String(id)]

  const updateField = (id, field, value) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: { ...prev[String(id)], [field]: value },
    }))
    setDirty(true)
  }

  // ---- 大会明細操作 ----
  const addTournament = (id) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        tournaments: [...prev[String(id)].tournaments, emptyTournamentItem()],
      },
    }))
    setDirty(true)
  }
  const updateTournament = (id, uidKey, field, value) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        tournaments: prev[String(id)].tournaments.map((t) =>
          t.uid === uidKey ? { ...t, [field]: value } : t
        ),
      },
    }))
    setDirty(true)
  }
  const removeTournament = (id, uidKey) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        tournaments: prev[String(id)].tournaments.filter(
          (t) => t.uid !== uidKey
        ),
      },
    }))
    setDirty(true)
  }

  // ---- 合宿明細操作 ----
  const addCamp = (id) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        camps: [...prev[String(id)].camps, emptyCampItem()],
      },
    }))
    setDirty(true)
  }
  const updateCamp = (id, uidKey, field, value) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        camps: prev[String(id)].camps.map((c) =>
          c.uid === uidKey ? { ...c, [field]: value } : c
        ),
      },
    }))
    setDirty(true)
  }
  const removeCamp = (id, uidKey) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        camps: prev[String(id)].camps.filter((c) => c.uid !== uidKey),
      },
    }))
    setDirty(true)
  }

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const expensesList = []
      const tournamentList = []
      const campList = []
      for (const m of activeMembers) {
        const r = row(m.id)
        expensesList.push({
          year_month: yearMonth,
          member_id: m.id,
          tournament_fee: 0,
          tournament_support_rate: 0,
          camp_fee_per_night: 0,
          camp_nights: 0,
          medical_actual: num(r.medical_actual),
          medical_subsidy: num(r.medical_subsidy),
          sagawa_fee: num(r.sagawa_fee),
          wear_fee: num(r.wear_fee),
        })
        for (const t of r.tournaments) {
          // 完全に空の行は保存しない
          if (!t.name && !num(t.fee) && !num(t.subsidy)) continue
          tournamentList.push({
            year_month: yearMonth,
            member_id: m.id,
            name: t.name || '大会',
            fee: num(t.fee),
            subsidy: num(t.subsidy),
          })
        }
        for (const c of r.camps) {
          if (!c.name && !num(c.fee_per_night) && !num(c.nights)) continue
          campList.push({
            year_month: yearMonth,
            member_id: m.id,
            name: c.name || '合宿',
            fee_per_night: num(c.fee_per_night),
            nights: num(c.nights),
          })
        }
      }
      await saveExpenses({
        expenses: expensesList,
        tournamentItems: tournamentList,
        campItems: campList,
      })
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setRows(buildRows())
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
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="px-3 py-2.5 text-left">氏名</th>
                  <th className="px-3 py-2.5 text-right">大会費</th>
                  <th className="px-3 py-2.5 text-right">合宿費</th>
                  <th className="px-2 py-2.5 text-right">治療実費</th>
                  <th className="px-2 py-2.5 text-right">治療補助</th>
                  <th className="px-2 py-2.5 text-right text-primary">治療差額</th>
                  <th className="px-2 py-2.5 text-right">佐川代</th>
                  <th className="px-2 py-2.5 text-right">ウエア代</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const r = row(m.id)
                  if (!r) return null
                  const isOpen = expanded.has(m.id)
                  const tourTotal = r.tournaments.reduce(
                    (a, t) => a + tournamentItemNet(t),
                    0
                  )
                  const campTotal = r.camps.reduce(
                    (a, c) => a + campItemCost(c),
                    0
                  )
                  const net = medicalNet(r)
                  return (
                    <React.Fragment key={m.id}>
                      <tr
                        className={cn(
                          'border-b border-slate-100 hover:bg-slate-50/60',
                          isOpen && 'bg-blue-50/40'
                        )}
                      >
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                            aria-label="明細を開閉"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-1.5">
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="text-left"
                          >
                            <div className="font-medium text-slate-800">
                              {m.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {m.group} · {m.rank}
                            </div>
                          </button>
                        </td>
                        {/* 大会費サマリ */}
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="inline-flex flex-col items-end"
                          >
                            <span className="font-semibold tabular-nums text-slate-800">
                              {formatYen(tourTotal)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {r.tournaments.length}件
                            </span>
                          </button>
                        </td>
                        {/* 合宿費サマリ */}
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="inline-flex flex-col items-end"
                          >
                            <span className="font-semibold tabular-nums text-slate-800">
                              {formatYen(campTotal)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {r.camps.length}件
                            </span>
                          </button>
                        </td>
                        {/* 治療実費 */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.medical_actual}
                            onChange={(v) =>
                              updateField(m.id, 'medical_actual', v)
                            }
                          />
                        </td>
                        {/* 治療補助 */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.medical_subsidy}
                            onChange={(v) =>
                              updateField(m.id, 'medical_subsidy', v)
                            }
                          />
                        </td>
                        {/* 治療差額 */}
                        <td className="px-2 py-1.5 text-right">
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
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.sagawa_fee}
                            onChange={(v) => updateField(m.id, 'sagawa_fee', v)}
                          />
                        </td>
                        {/* ウエア代 */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.wear_fee}
                            onChange={(v) => updateField(m.id, 'wear_fee', v)}
                          />
                        </td>
                      </tr>

                      {/* 展開: 大会・合宿の明細エディタ */}
                      {isOpen && (
                        <tr className="border-b border-slate-200 bg-slate-50/70">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              <TournamentEditor
                                items={r.tournaments}
                                onAdd={() => addTournament(m.id)}
                                onUpdate={(u, f, v) =>
                                  updateTournament(m.id, u, f, v)
                                }
                                onRemove={(u) => removeTournament(m.id, u)}
                              />
                              <CampEditor
                                items={r.camps}
                                onAdd={() => addCamp(m.id)}
                                onUpdate={(u, f, v) => updateCamp(m.id, u, f, v)}
                                onRemove={(u) => removeCamp(m.id, u)}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
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
        ※ 行の ▶ を開くと「〇〇大会」「〇〇合宿」を件数無制限で入力できます。大会は
        参加費 − 補助 = 請求額、合宿は 1泊単価 × 泊数 = 費用 を自動計算します。
      </p>
    </div>
  )
}

// ---- 大会明細エディタ ----
function TournamentEditor({ items, onAdd, onUpdate, onRemove }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Trophy className="h-4 w-4 text-amber-500" />
          大会明細
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          大会を追加
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">
          大会の参加費はまだありません
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_84px_84px_84px_28px] gap-1.5 px-1 text-[10px] font-medium text-slate-400">
            <span>大会名</span>
            <span className="text-right">参加費</span>
            <span className="text-right">補助</span>
            <span className="text-right">請求額</span>
            <span></span>
          </div>
          {items.map((t) => (
            <div
              key={t.uid}
              className="grid grid-cols-[1fr_84px_84px_84px_28px] items-center gap-1.5"
            >
              <Input
                value={t.name}
                placeholder="〇〇大会"
                onChange={(e) => onUpdate(t.uid, 'name', e.target.value)}
                className="h-8 text-xs"
              />
              <SmallNum
                value={t.fee}
                onChange={(v) => onUpdate(t.uid, 'fee', v)}
              />
              <SmallNum
                value={t.subsidy}
                onChange={(v) => onUpdate(t.uid, 'subsidy', v)}
              />
              <div className="text-right text-xs font-semibold tabular-nums text-primary">
                {formatYen(tournamentItemNet(t))}
              </div>
              <button
                onClick={() => onRemove(t.uid)}
                className="flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-destructive"
                aria-label="削除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- 合宿明細エディタ ----
function CampEditor({ items, onAdd, onUpdate, onRemove }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Tent className="h-4 w-4 text-emerald-500" />
          合宿明細
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          合宿を追加
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">
          合宿費はまだありません
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_92px_60px_84px_28px] gap-1.5 px-1 text-[10px] font-medium text-slate-400">
            <span>合宿名</span>
            <span className="text-right">1泊単価</span>
            <span className="text-right">泊数</span>
            <span className="text-right">費用</span>
            <span></span>
          </div>
          {items.map((c) => {
            const isPreset = CAMP_PRICE_PRESETS.some(
              (p) => p.value === num(c.fee_per_night)
            )
            return (
              <div
                key={c.uid}
                className="grid grid-cols-[1fr_92px_60px_84px_28px] items-start gap-1.5"
              >
                <Input
                  value={c.name}
                  placeholder="〇〇合宿"
                  onChange={(e) => onUpdate(c.uid, 'name', e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex flex-col gap-1">
                  <Select
                    value={isPreset ? num(c.fee_per_night) : 'custom'}
                    className="h-8 text-xs"
                    onChange={(e) => {
                      const v = e.target.value
                      onUpdate(
                        c.uid,
                        'fee_per_night',
                        v === 'custom' ? 0 : Number(v)
                      )
                    }}
                  >
                    {CAMP_PRICE_PRESETS.map((p) => (
                      <option key={p.label} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                  {!isPreset && (
                    <SmallNum
                      value={c.fee_per_night}
                      onChange={(v) => onUpdate(c.uid, 'fee_per_night', v)}
                    />
                  )}
                </div>
                <SmallNum
                  value={c.nights}
                  onChange={(v) => onUpdate(c.uid, 'nights', v)}
                />
                <div className="pt-1.5 text-right text-xs font-semibold tabular-nums text-emerald-600">
                  {formatYen(campItemCost(c))}
                </div>
                <button
                  onClick={() => onRemove(c.uid)}
                  className="mt-1 flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-destructive"
                  aria-label="削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NumCell({ value, onChange }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
      className="h-8 w-full px-2 text-right text-xs tabular-nums"
    />
  )
}

function SmallNum({ value, onChange }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(num(e.target.value))}
      className="h-8 px-2 text-right text-xs tabular-nums"
    />
  )
}

// member_id ごとに明細をまとめる
function groupBy(items, yearMonth) {
  const map = new Map()
  for (const it of items || []) {
    if (it.year_month && it.year_month !== yearMonth) continue
    const key = String(it.member_id)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(it)
  }
  return map
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
