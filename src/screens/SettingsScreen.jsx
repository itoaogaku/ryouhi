import React, { useState, useEffect } from 'react'
import { Save, X, Pencil, ClipboardList, Coins } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Skeleton,
} from '../components/ui/index.jsx'
import { MEAL_TRACKING_DORMS } from '../lib/constants.js'
import { num, formatYen } from '../lib/utils.js'
import { mealPriceFor } from '../lib/calc.js'

// 画面：規定（食費単価・部費と、寮費清算の細かいルールのメモ）
// 食費単価は1寮・2寮でそれぞれ別に設定できる。
// 誤って書き換えてしまわないよう、通常は読み取り専用で表示し、
// 「編集」ボタンを押したときだけ入力できるようにする。
export default function SettingsScreen() {
  const { config, loading, saveConfig } = useApp()
  const [form, setForm] = useState(() => buildForm(config))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setForm(buildForm(config))
    setDirty(false)
  }, [config])

  const updatePrice = (dorm, meal, value) => {
    setForm((prev) => ({
      ...prev,
      prices: {
        ...prev.prices,
        [dorm]: { ...prev.prices[dorm], [meal]: value },
      },
    }))
    setDirty(true)
  }

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const startEditing = () => {
    setForm(buildForm(config))
    setDirty(false)
    setEditing(true)
  }

  const cancelEditing = () => {
    setForm(buildForm(config))
    setDirty(false)
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        base_club_fee: num(form.base_club_fee),
        notes: form.notes,
      }
      for (const dorm of MEAL_TRACKING_DORMS) {
        payload[`breakfast_price_${dorm}`] = num(form.prices[dorm]?.breakfast)
        payload[`dinner_price_${dorm}`] = num(form.prices[dorm]?.dinner)
      }
      await saveConfig(payload)
      setDirty(false)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          食費の単価や部費、寮費清算に関する細かいルールをここにまとめて管理します。
        </p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing} disabled={saving}>
                <X className="h-4 w-4" />
                キャンセル
              </Button>
              <Button onClick={handleSave} disabled={saving || !dirty}>
                <Save className="h-4 w-4" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </>
          ) : (
            <Button onClick={startEditing}>
              <Pencil className="h-4 w-4" />
              編集
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Coins className="h-4 w-4 text-amber-500" />
            食費の単価（寮ごと）
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500">
                  <th className="w-40 py-1.5"></th>
                  {MEAL_TRACKING_DORMS.map((dorm) => (
                    <th key={dorm} className="px-2 py-1.5 text-right">
                      {dorm}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1.5 pr-3 text-xs font-medium text-slate-500">
                    朝食単価（1食あたり）
                  </td>
                  {MEAL_TRACKING_DORMS.map((dorm) =>
                    editing ? (
                      <td key={dorm} className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={
                            form.prices[dorm]?.breakfast === 0
                              ? ''
                              : form.prices[dorm]?.breakfast
                          }
                          placeholder="0"
                          onChange={(e) =>
                            updatePrice(dorm, 'breakfast', num(e.target.value))
                          }
                          className="text-right tabular-nums"
                        />
                      </td>
                    ) : (
                      <td
                        key={dorm}
                        className="px-2 py-1.5 text-right tabular-nums text-slate-800"
                      >
                        {formatYen(form.prices[dorm]?.breakfast)}
                      </td>
                    )
                  )}
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-xs font-medium text-slate-500">
                    夕食単価（1食あたり）
                  </td>
                  {MEAL_TRACKING_DORMS.map((dorm) =>
                    editing ? (
                      <td key={dorm} className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={
                            form.prices[dorm]?.dinner === 0
                              ? ''
                              : form.prices[dorm]?.dinner
                          }
                          placeholder="0"
                          onChange={(e) =>
                            updatePrice(dorm, 'dinner', num(e.target.value))
                          }
                          className="text-right tabular-nums"
                        />
                      </td>
                    ) : (
                      <td
                        key={dorm}
                        className="px-2 py-1.5 text-right tabular-nums text-slate-800"
                      >
                        {formatYen(form.prices[dorm]?.dinner)}
                      </td>
                    )
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              部費（月額・一律）
            </label>
            {editing ? (
              <Input
                type="number"
                min={0}
                value={form.base_club_fee === 0 ? '' : form.base_club_fee}
                placeholder="0"
                onChange={(e) => update('base_club_fee', num(e.target.value))}
                className="text-right tabular-nums"
              />
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm tabular-nums text-slate-800">
                {formatYen(form.base_club_fee)}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">
            食費は「実際に食事をとった寮」の単価で計算されます（寮間移動でもう一方の寮で食べた日はその寮の単価が使われます）。清算画面・集金用PDFに反映されます。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            寮費清算のルール（メモ）
          </div>
          <p className="text-xs text-slate-400">
            細かい取り決めや例外対応などを自由に書き留めておけます（表示のみで、金額の自動計算には使われません）。
          </p>
          {editing ? (
            <Textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={14}
              placeholder="例）退寮月は日割り計算とする／大会不参加でも一律負担／体調不良による欠食は申告制 など"
            />
          ) : (
            <div className="min-h-[10rem] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {form.notes ? (
                form.notes
              ) : (
                <span className="text-slate-400">
                  まだメモがありません。「編集」から記入できます。
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function buildForm(config) {
  const prices = {}
  for (const dorm of MEAL_TRACKING_DORMS) {
    prices[dorm] = {
      breakfast: num(mealPriceFor(config, dorm, 'breakfast')),
      dinner: num(mealPriceFor(config, dorm, 'dinner')),
    }
  }
  return {
    prices,
    base_club_fee: num(config.base_club_fee),
    notes: config.notes || '',
  }
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
