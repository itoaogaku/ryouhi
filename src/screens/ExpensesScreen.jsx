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
  Tag,
  Users,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { GROUPS, GRADES, CAMP_PRICE_PRESETS } from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Badge,
  Checkbox,
  Modal,
  Skeleton,
} from '../components/ui/index.jsx'
import {
  emptyExpense,
  emptyTournamentItem,
  emptyCampItem,
  emptyOtherItem,
  formatYen,
  num,
  uid,
  cn,
  compareMembersByGradeKana,
} from '../lib/utils.js'
import {
  medicalNet,
  motivationSubsidyAmount,
  tournamentItemNet,
  campItemCost,
  otherItemNet,
} from '../lib/calc.js'

// 画面C：月次経費入力（大会・合宿は明細で複数登録）
export default function ExpensesScreen() {
  const {
    members,
    expenses,
    tournamentItems,
    campItems,
    otherItems,
    yearMonth,
    loading,
    saveExpenses,
  } = useApp()
  const [rows, setRows] = useState({}) // member_id -> { ...expense, tournaments, camps, others }
  const [expanded, setExpanded] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')
  const [bulkType, setBulkType] = useState(null) // 'tournament' | 'camp' | 'other' | null

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
      const otherByMember = groupBy(otherItems, yearMonth)

      const map = {}
      for (const m of activeMembers) {
        const key = String(m.id)
        const base = expByMember.get(key) || emptyExpense(m.id, yearMonth)
        map[key] = {
          medical_actual: num(base.medical_actual),
          medical_subsidy: num(base.medical_subsidy),
          sagawa_fee: num(base.sagawa_fee),
          motivation_count: num(base.motivation_count),
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
          others: (otherByMember.get(key) || []).map((o) => ({
            uid: uid(),
            name: o.name || '',
            amount: num(o.amount),
            subsidy: num(o.subsidy),
          })),
        }
      }
      return map
    }
  }, [expenses, tournamentItems, campItems, otherItems, yearMonth, activeMembers])

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

  // ---- その他費用明細操作（配達代と同じイメージの自由追加項目） ----
  const addOther = (id) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        others: [...prev[String(id)].others, emptyOtherItem()],
      },
    }))
    setDirty(true)
  }
  const updateOther = (id, uidKey, field, value) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        others: prev[String(id)].others.map((o) =>
          o.uid === uidKey ? { ...o, [field]: value } : o
        ),
      },
    }))
    setDirty(true)
  }
  const removeOther = (id, uidKey) => {
    setRows((prev) => ({
      ...prev,
      [String(id)]: {
        ...prev[String(id)],
        others: prev[String(id)].others.filter((o) => o.uid !== uidKey),
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

  // ---- 一括登録：選択メンバーに同じ大会を追加（同名は上書き）----
  // 補助は参加者ごとに個別（全額補助／半額補助／その他補助）なので
  // event.subsidyByMember（member_id -> 補助額）を参照する
  const applyBulkTournament = (event, memberIds) => {
    setRows((prev) => {
      const next = { ...prev }
      for (const id of memberIds) {
        const key = String(id)
        const cur = next[key]
        if (!cur) continue
        const subsidy = event.subsidyByMember?.[id] ?? 0
        const found = cur.tournaments.find((t) => t.name === event.name)
        const tournaments = found
          ? cur.tournaments.map((t) =>
              t.name === event.name
                ? { ...t, fee: event.fee, subsidy }
                : t
            )
          : [
              ...cur.tournaments,
              {
                uid: uid(),
                name: event.name,
                fee: event.fee,
                subsidy,
              },
            ]
        next[key] = { ...cur, tournaments }
      }
      return next
    })
    setDirty(true)
    setBulkType(null)
  }

  // ---- 一括登録：選択メンバーに同じ合宿を追加（同名は上書き） ----
  const applyBulkCamp = (event, memberIds) => {
    setRows((prev) => {
      const next = { ...prev }
      for (const id of memberIds) {
        const key = String(id)
        const cur = next[key]
        if (!cur) continue
        const found = cur.camps.find((c) => c.name === event.name)
        const camps = found
          ? cur.camps.map((c) =>
              c.name === event.name
                ? {
                    ...c,
                    fee_per_night: event.fee_per_night,
                    nights: event.nights,
                  }
                : c
            )
          : [
              ...cur.camps,
              {
                uid: uid(),
                name: event.name,
                fee_per_night: event.fee_per_night,
                nights: event.nights,
              },
            ]
        next[key] = { ...cur, camps }
      }
      return next
    })
    setDirty(true)
    setBulkType(null)
  }

  // ---- 一括登録：選択メンバーに同じその他費用項目を追加（同名は上書き） ----
  const applyBulkOther = (event, memberIds) => {
    setRows((prev) => {
      const next = { ...prev }
      for (const id of memberIds) {
        const key = String(id)
        const cur = next[key]
        if (!cur) continue
        const found = cur.others.find((o) => o.name === event.name)
        const others = found
          ? cur.others.map((o) =>
              o.name === event.name
                ? { ...o, amount: event.amount, subsidy: event.subsidy }
                : o
            )
          : [
              ...cur.others,
              {
                uid: uid(),
                name: event.name,
                amount: event.amount,
                subsidy: event.subsidy,
              },
            ]
        next[key] = { ...cur, others }
      }
      return next
    })
    setDirty(true)
    setBulkType(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const expensesList = []
      const tournamentList = []
      const campList = []
      const otherList = []
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
          motivation_count: num(r.motivation_count),
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
        for (const o of r.others) {
          if (!o.name && !num(o.amount) && !num(o.subsidy)) continue
          otherList.push({
            year_month: yearMonth,
            member_id: m.id,
            name: o.name || 'その他',
            amount: num(o.amount),
            subsidy: num(o.subsidy),
          })
        }
      }
      await saveExpenses({
        expenses: expensesList,
        tournamentItems: tournamentList,
        campItems: campList,
        otherItems: otherList,
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

  const filtered = activeMembers
    .filter((m) => filterGroup === 'all' || m.group === filterGroup)
    .slice()
    .sort(compareMembersByGradeKana)

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <Button
            variant="secondary"
            onClick={() => setBulkType('tournament')}
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            大会を一括登録
          </Button>
          <Button variant="secondary" onClick={() => setBulkType('camp')}>
            <Tent className="h-4 w-4 text-emerald-500" />
            合宿を一括登録
          </Button>
          <Button variant="secondary" onClick={() => setBulkType('other')}>
            <Tag className="h-4 w-4 text-sky-500" />
            その他費用を一括登録
          </Button>
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

      {/* 一括登録ダイアログ */}
      {bulkType && (
        <BulkAddDialog
          type={bulkType}
          members={activeMembers}
          onClose={() => setBulkType(null)}
          onApplyTournament={applyBulkTournament}
          onApplyCamp={applyBulkCamp}
          onApplyOther={applyBulkOther}
        />
      )}

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
                  <th className="px-2 py-2.5 text-right">治療費実費</th>
                  <th className="px-2 py-2.5 text-right">治療費補助</th>
                  <th className="px-2 py-2.5 text-right">モチベーション費補助</th>
                  <th className="px-2 py-2.5 text-right text-primary">治療費差額</th>
                  <th className="px-2 py-2.5 text-right">配達代</th>
                  <th className="px-3 py-2.5 text-right">その他費用</th>
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
                  const otherTotal = r.others.reduce(
                    (a, o) => a + otherItemNet(o),
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
                        {/* 治療費実費 */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.medical_actual}
                            onChange={(v) =>
                              updateField(m.id, 'medical_actual', v)
                            }
                          />
                        </td>
                        {/* 治療費補助 */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.medical_subsidy}
                            onChange={(v) =>
                              updateField(m.id, 'medical_subsidy', v)
                            }
                          />
                        </td>
                        {/* モチベーション費補助（回数 × 単価770円） */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.motivation_count}
                            onChange={(v) =>
                              updateField(m.id, 'motivation_count', v)
                            }
                          />
                          <div className="mt-0.5 text-center text-[10px] text-slate-400">
                            {formatYen(motivationSubsidyAmount(r))}
                          </div>
                        </td>
                        {/* 治療費差額 */}
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
                        {/* 配達代 */}
                        <td className="px-1 py-1.5">
                          <NumCell
                            value={r.sagawa_fee}
                            onChange={(v) => updateField(m.id, 'sagawa_fee', v)}
                          />
                        </td>
                        {/* その他費用サマリ */}
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => toggleExpand(m.id)}
                            className="inline-flex flex-col items-end"
                          >
                            <span className="font-semibold tabular-nums text-slate-800">
                              {formatYen(otherTotal)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {r.others.length}件
                            </span>
                          </button>
                        </td>
                      </tr>

                      {/* 展開: 大会・合宿・その他費用の明細エディタ */}
                      {isOpen && (
                        <tr className="border-b border-slate-200 bg-slate-50/70">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                              <OtherEditor
                                items={r.others}
                                onAdd={() => addOther(m.id)}
                                onUpdate={(u, f, v) => updateOther(m.id, u, f, v)}
                                onRemove={(u) => removeOther(m.id, u)}
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
        ※ 行の ▶ を開くと「〇〇大会」「〇〇合宿」に加えて、配達代と同じ
        イメージで名前を自由に付けられる「その他費用」も件数無制限で追加できます。
        大会は参加費 − 補助 = 請求額、合宿は 1泊単価 × 泊数 = 費用、
        その他費用も金額 − 補助 = 請求額を自動計算するので、チームが一部
        負担するケースにも対応できます。
      </p>
    </div>
  )
}

// ---- 一括登録ダイアログ ----
function BulkAddDialog({
  type,
  members,
  onClose,
  onApplyTournament,
  onApplyCamp,
  onApplyOther,
}) {
  const isTournament = type === 'tournament'
  const isCamp = type === 'camp'
  const isOther = type === 'other'
  const [name, setName] = useState('')
  const [fee, setFee] = useState(0) // 大会:参加費 / 合宿:1泊単価 / その他:金額
  const [nights, setNights] = useState(0) // 合宿のみ
  const [selected, setSelected] = useState(
    () => new Set(members.map((m) => m.id))
  )

  // その他費用の補助: 半額補助／全額補助／その他（金額を直接入力）から選ぶ
  const [subsidyMode, setSubsidyMode] = useState('half') // 'half' | 'full' | 'custom'
  const [customSubsidy, setCustomSubsidy] = useState(0)
  const computedSubsidy =
    subsidyMode === 'half'
      ? Math.round(num(fee) / 2)
      : subsidyMode === 'full'
      ? num(fee)
      : num(customSubsidy)

  // 大会の補助: 参加者ごとに「全額自己負担／半額補助／全額補助／その他補助」を個別に選ぶ
  // memberId -> { mode: 'none' | 'half' | 'full' | 'custom', custom: number }
  const [tournamentSubsidy, setTournamentSubsidy] = useState({})
  const tournamentSubsidyFor = (memberId) => {
    const s = tournamentSubsidy[memberId] || { mode: 'half', custom: 0 }
    if (s.mode === 'none') return 0
    if (s.mode === 'full') return num(fee)
    if (s.mode === 'half') return Math.round(num(fee) / 2)
    return num(s.custom)
  }
  const setTournamentSubsidyMode = (memberId, mode) => {
    setTournamentSubsidy((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || { mode: 'half', custom: 0 }), mode },
    }))
  }
  const setTournamentSubsidyCustom = (memberId, value) => {
    setTournamentSubsidy((prev) => ({
      ...prev,
      [memberId]: { mode: 'custom', custom: value },
    }))
  }

  // 合宿の1泊単価: プリセット選択中は選択値を保持し、「カスタム」選択時のみ
  // 入力欄を表示する（fee の数値だけで判定すると 0円 プリセットと衝突するため
  // 選択モードを別ステートで管理する）
  const [campFeeMode, setCampFeeMode] = useState(() =>
    CAMP_PRICE_PRESETS.some((p) => p.value === fee) ? String(fee) : 'custom'
  )

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(members.map((m) => m.id)))
  const clearAll = () => setSelected(new Set())
  const toggleGrade = (grade) => {
    const ids = members.filter((m) => m.grade === grade).map((m) => m.id)
    const allOn = ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const preview = isCamp
    ? num(fee) * num(nights)
    : Math.max(0, num(fee) - computedSubsidy)

  // 大会は参加者ごとに補助額が異なるため、参加者全員分の請求額合計を出す
  const tournamentTotalNet = Array.from(selected).reduce(
    (a, id) => a + Math.max(0, num(fee) - tournamentSubsidyFor(id)),
    0
  )

  const canApply = name.trim() !== '' && selected.size > 0

  const handleApply = () => {
    if (!canApply) return
    const ids = Array.from(selected)
    if (isTournament) {
      const subsidyByMember = {}
      for (const id of ids) {
        subsidyByMember[id] = tournamentSubsidyFor(id)
      }
      onApplyTournament(
        { name: name.trim(), fee: num(fee), subsidyByMember },
        ids
      )
    } else if (isCamp) {
      onApplyCamp(
        { name: name.trim(), fee_per_night: num(fee), nights: num(nights) },
        ids
      )
    } else {
      onApplyOther(
        { name: name.trim(), amount: num(fee), subsidy: computedSubsidy },
        ids
      )
    }
  }

  // 参加者選択は学年順にグルーピングする（学年ごとに読み仮名順で表示）
  const membersByGrade = GRADES.map((grade) => ({
    grade,
    list: members
      .filter((m) => m.grade === grade)
      .slice()
      .sort(compareMembersByGradeKana),
  })).filter((g) => g.list.length > 0)

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={
        isTournament
          ? '大会を一括登録'
          : isCamp
          ? '合宿を一括登録'
          : 'その他費用を一括登録'
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            {isTournament ? (
              <>
                <span className="font-semibold text-slate-700">
                  {selected.size}名
                </span>{' '}
                が参加 · 請求額合計{' '}
                <span className="font-semibold text-primary">
                  {formatYen(tournamentTotalNet)}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-700">
                  {selected.size}名
                </span>{' '}
                を選択中 · 1人あたり{' '}
                <span className="font-semibold text-primary">
                  {formatYen(preview)}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleApply} disabled={!canApply}>
              <Users className="h-4 w-4" />
              {selected.size}名に登録
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* イベント情報 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            {isTournament ? (
              <Trophy className="h-4 w-4 text-amber-500" />
            ) : isCamp ? (
              <Tent className="h-4 w-4 text-emerald-500" />
            ) : (
              <Tag className="h-4 w-4 text-sky-500" />
            )}
            {isTournament ? '大会情報' : isCamp ? '合宿情報' : 'その他費用情報'}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {isTournament ? '大会名' : isCamp ? '合宿名' : '項目名'}
              </label>
              <Input
                value={name}
                autoFocus
                placeholder={
                  isTournament ? '〇〇大会' : isCamp ? '〇〇合宿' : '教材費など'
                }
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {isTournament ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  参加費
                </label>
                <Input
                  type="number"
                  min={0}
                  value={fee === 0 ? '' : fee}
                  placeholder="0"
                  onChange={(e) => setFee(num(e.target.value))}
                  className="text-right tabular-nums"
                />
              </div>
            ) : isOther ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    金額
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={fee === 0 ? '' : fee}
                    placeholder="0"
                    onChange={(e) => setFee(num(e.target.value))}
                    className="text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    補助
                  </label>
                  <Select
                    value={subsidyMode}
                    onChange={(e) => setSubsidyMode(e.target.value)}
                  >
                    <option value="half">半額補助</option>
                    <option value="full">全額補助</option>
                    <option value="custom">その他</option>
                  </Select>
                  {subsidyMode === 'custom' ? (
                    <Input
                      type="number"
                      min={0}
                      value={customSubsidy === 0 ? '' : customSubsidy}
                      placeholder="0"
                      onChange={(e) => setCustomSubsidy(num(e.target.value))}
                      className="mt-1 text-right tabular-nums"
                    />
                  ) : (
                    <div className="mt-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-right text-sm tabular-nums text-slate-500">
                      {formatYen(computedSubsidy)}
                    </div>
                  )}
                </div>
              </>
            ) : isCamp ? (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    1泊単価
                  </label>
                  <Select
                    value={campFeeMode}
                    onChange={(e) => {
                      const v = e.target.value
                      setCampFeeMode(v)
                      if (v !== 'custom') setFee(Number(v))
                    }}
                  >
                    {CAMP_PRICE_PRESETS.map((p) => (
                      <option key={p.label} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                  {campFeeMode === 'custom' && (
                    <Input
                      type="number"
                      min={0}
                      value={fee === 0 ? '' : fee}
                      placeholder="単価を入力"
                      onChange={(e) => setFee(num(e.target.value))}
                      className="mt-1 text-right tabular-nums"
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    泊数
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={nights === 0 ? '' : nights}
                    placeholder="0"
                    onChange={(e) => setNights(num(e.target.value))}
                    className="text-right tabular-nums"
                  />
                </div>
              </>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {isTournament
              ? '請求額 = 参加費 − 補助（0円未満は0円）。補助は下の参加者一覧で選手ごとに選べます'
              : isCamp
              ? '1人あたり費用 = 1泊単価 × 泊数'
              : '1人あたり請求額 = 金額 − 補助（0円未満は0円）。チームが一部負担する場合も対応できます'}
            。登録後も各メンバーの行で個別に修正・削除できます。
          </p>
        </div>

        {/* 参加者選択 */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-700">
              参加者を選択
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {GRADES.map((g) => {
                const ids = members
                  .filter((m) => m.grade === g)
                  .map((m) => m.id)
                const allOn =
                  ids.length > 0 && ids.every((id) => selected.has(id))
                return (
                  <button
                    key={g}
                    onClick={() => toggleGrade(g)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      allOn
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    )}
                  >
                    {g}
                  </button>
                )
              })}
              <span className="mx-1 h-4 w-px bg-slate-200" />
              <Button size="sm" variant="ghost" onClick={selectAll}>
                全選択
              </Button>
              <Button size="sm" variant="ghost" onClick={clearAll}>
                全解除
              </Button>
            </div>
          </div>

          {isTournament ? (
            <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {membersByGrade.map(({ grade, list }) => (
                <div key={grade}>
                  <div className="mb-1 text-xs font-semibold text-slate-400">
                    {grade}
                  </div>
                  <div className="space-y-1">
                    {list.map((m) => {
                      const on = selected.has(m.id)
                      const s = tournamentSubsidy[m.id] || {
                        mode: 'half',
                        custom: 0,
                      }
                      const subsidyAmount = tournamentSubsidyFor(m.id)
                      const net = Math.max(0, num(fee) - subsidyAmount)
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5',
                            on
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-slate-200 bg-white'
                          )}
                        >
                          <button
                            onClick={() => toggle(m.id)}
                            className="flex items-center gap-2 text-left"
                          >
                            <Checkbox checked={on} onChange={() => toggle(m.id)} />
                            <span className="min-w-0">
                              <span className="block w-28 truncate text-sm font-medium text-slate-800">
                                {m.name}
                              </span>
                              <span className="block text-[11px] text-slate-400">
                                {m.rank}
                              </span>
                            </span>
                          </button>
                          {on ? (
                            <div className="ml-auto flex items-center gap-2">
                              <Select
                                value={s.mode}
                                onChange={(e) =>
                                  setTournamentSubsidyMode(m.id, e.target.value)
                                }
                                className="h-8 w-28 text-xs"
                              >
                                <option value="none">全額自己負担</option>
                                <option value="half">半額補助</option>
                                <option value="full">全額補助</option>
                                <option value="custom">その他補助</option>
                              </Select>
                              {s.mode === 'custom' ? (
                                <Input
                                  type="number"
                                  min={0}
                                  value={s.custom === 0 ? '' : s.custom}
                                  placeholder="補助額"
                                  onChange={(e) =>
                                    setTournamentSubsidyCustom(
                                      m.id,
                                      num(e.target.value)
                                    )
                                  }
                                  className="h-8 w-24 text-right text-xs tabular-nums"
                                />
                              ) : (
                                <span className="w-24 text-right text-xs tabular-nums text-slate-400">
                                  −{formatYen(subsidyAmount)}
                                </span>
                              )}
                              <span className="w-20 text-right text-xs font-semibold tabular-nums text-primary">
                                {formatYen(net)}
                              </span>
                            </div>
                          ) : (
                            <span className="ml-auto text-xs text-slate-300">
                              不参加
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {membersByGrade.map(({ grade, list }) => (
                <div key={grade}>
                  <div className="mb-1 text-xs font-semibold text-slate-400">
                    {grade}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {list.map((m) => {
                      const on = selected.has(m.id)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggle(m.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors',
                            on
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          )}
                        >
                          <Checkbox checked={on} onChange={() => toggle(m.id)} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-800">
                              {m.name}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              {m.rank}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
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

// ---- その他費用エディタ（配達代と同じイメージの自由追加項目） ----
function OtherEditor({ items, onAdd, onUpdate, onRemove }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Tag className="h-4 w-4 text-sky-500" />
          その他費用
        </div>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          項目を追加
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-slate-400">
          その他費用はまだありません
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_76px_76px_76px_28px] gap-1.5 px-1 text-[10px] font-medium text-slate-400">
            <span>項目名</span>
            <span className="text-right">金額</span>
            <span className="text-right">補助</span>
            <span className="text-right">請求額</span>
            <span></span>
          </div>
          {items.map((o) => (
            <div
              key={o.uid}
              className="grid grid-cols-[1fr_76px_76px_76px_28px] items-center gap-1.5"
            >
              <Input
                value={o.name}
                placeholder="教材費など"
                onChange={(e) => onUpdate(o.uid, 'name', e.target.value)}
                className="h-8 text-xs"
              />
              <SmallNum
                value={o.amount}
                onChange={(v) => onUpdate(o.uid, 'amount', v)}
              />
              <SmallNum
                value={o.subsidy}
                onChange={(v) => onUpdate(o.uid, 'subsidy', v)}
              />
              <div className="text-right text-xs font-semibold tabular-nums text-primary">
                {formatYen(otherItemNet(o))}
              </div>
              <button
                onClick={() => onRemove(o.uid)}
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
