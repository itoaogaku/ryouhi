import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Save, UserPlus, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { RANKS, GROUPS, GRADES, DORMS, GROUP_BY_DORM } from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Badge,
  Skeleton,
} from '../components/ui/index.jsx'
import { cn, compareMembersByGradeKana } from '../lib/utils.js'

// 画面A：寮生マスター管理
export default function MembersScreen() {
  const { members, loading, saveMembers } = useApp()
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [filterGroup, setFilterGroup] = useState('all')
  const [filterActive, setFilterActive] = useState('all')

  useEffect(() => {
    setRows(members.map((m) => ({ ...m })))
    setDirty(false)
  }, [members])

  const update = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
    setDirty(true)
  }

  // 所属寮を変更したとき、対応する集金グループが決まっていれば自動で合わせる
  // （例: 寮を「2寮」にすると集金グループも自動で「2寮」になる）。
  // 対応するグループが無い寮（1寮）に変更した場合は、古いグループを
  // 残さず「未選択」にして、集金グループの選び直しが必要なことを分かりやすくする
  const updateDorm = (id, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        return { ...r, dorm: value, group: GROUP_BY_DORM[value] || '' }
      })
    )
    setDirty(true)
  }

  const addMember = () => {
    const nextId = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        name: '',
        name_kana: '',
        rank: RANKS[0],
        grade: GRADES[0],
        group: GROUPS[0],
        dorm: DORMS[0],
        active: true,
      },
    ])
    setDirty(true)
  }

  const removeMember = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    setDirty(true)
  }

  const reset = () => {
    setRows(members.map((m) => ({ ...m })))
    setDirty(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveMembers(rows)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const filtered = rows
    .filter((r) => {
      if (filterGroup !== 'all' && r.group !== filterGroup) return false
      if (filterActive === 'active' && !r.active) return false
      if (filterActive === 'inactive' && r.active) return false
      return true
    })
    .slice()
    .sort(compareMembersByGradeKana)

  const activeCount = rows.filter((r) => r.active).length

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* ツールバー */}
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
          <Select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="w-32"
          >
            <option value="all">在籍/退寮 全て</option>
            <option value="active">在籍のみ</option>
            <option value="inactive">退寮のみ</option>
          </Select>
          <Badge variant="secondary">
            在籍 {activeCount}名 / 全{rows.length}名
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={addMember}>
            <UserPlus className="h-4 w-4" />
            メンバー追加
          </Button>
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

      {/* テーブル */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="w-14 px-4 py-3">ID</th>
                  <th className="px-4 py-3">氏名</th>
                  <th className="px-4 py-3">読み仮名</th>
                  <th className="w-24 px-3 py-3">学年</th>
                  <th className="w-36 px-3 py-3">チームランク</th>
                  <th className="w-24 px-3 py-3">寮</th>
                  <th className="w-36 px-3 py-3">集金グループ</th>
                  <th className="w-24 px-4 py-3">在籍</th>
                  <th className="w-16 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'border-b border-slate-100 transition-colors hover:bg-slate-50/60',
                      !r.active && 'bg-slate-50/40 text-slate-400'
                    )}
                  >
                    <td className="px-4 py-2 tabular-nums text-slate-500">
                      {r.id}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={r.name}
                        placeholder="氏名を入力"
                        onChange={(e) => update(r.id, 'name', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={r.name_kana || ''}
                        placeholder="よみがな"
                        onChange={(e) => update(r.id, 'name_kana', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={r.grade || ''}
                        onChange={(e) => update(r.id, 'grade', e.target.value)}
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={r.rank}
                        onChange={(e) => update(r.id, 'rank', e.target.value)}
                      >
                        {RANKS.map((rank) => (
                          <option key={rank} value={rank}>
                            {rank}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={r.dorm || ''}
                        onChange={(e) => updateDorm(r.id, e.target.value)}
                      >
                        {DORMS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={r.group || ''}
                        onChange={(e) => update(r.id, 'group', e.target.value)}
                        className={cn(
                          !r.group && 'border-destructive text-destructive font-semibold'
                        )}
                      >
                        <option value="">未選択</option>
                        {GROUPS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => update(r.id, 'active', !r.active)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                          r.active
                            ? 'border-success/20 bg-success/10 text-success'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        )}
                      >
                        {r.active ? '在籍' : '退寮'}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(r.id)}
                        className="text-slate-400 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
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
        ※「保存」を押すと全メンバー分がマスターへ一括反映されます（GAS: saveMembers）。
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
