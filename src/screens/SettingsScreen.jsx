import React, { useState, useEffect } from 'react'
import { Save, RotateCcw, ClipboardList, Coins } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  Button,
  Card,
  CardContent,
  Input,
  Textarea,
  Skeleton,
} from '../components/ui/index.jsx'
import { num } from '../lib/utils.js'

// 画面：規定（食費単価・部費と、寮費清算の細かいルールのメモ）
export default function SettingsScreen() {
  const { config, loading, saveConfig } = useApp()
  const [form, setForm] = useState(() => buildForm(config))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm(buildForm(config))
    setDirty(false)
  }, [config])

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }

  const reset = () => {
    setForm(buildForm(config))
    setDirty(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveConfig({
        breakfast_price: num(form.breakfast_price),
        dinner_price: num(form.dinner_price),
        base_club_fee: num(form.base_club_fee),
        notes: form.notes,
      })
      setDirty(false)
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
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Coins className="h-4 w-4 text-amber-500" />
            食費・部費の単価
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                朝食単価（1食あたり）
              </label>
              <Input
                type="number"
                min={0}
                value={form.breakfast_price === 0 ? '' : form.breakfast_price}
                placeholder="0"
                onChange={(e) => update('breakfast_price', num(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                夕食単価（1食あたり）
              </label>
              <Input
                type="number"
                min={0}
                value={form.dinner_price === 0 ? '' : form.dinner_price}
                placeholder="0"
                onChange={(e) => update('dinner_price', num(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                部費（月額・一律）
              </label>
              <Input
                type="number"
                min={0}
                value={form.base_club_fee === 0 ? '' : form.base_club_fee}
                placeholder="0"
                onChange={(e) => update('base_club_fee', num(e.target.value))}
                className="text-right tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            食費 = 朝食数 × 朝食単価 + 夕食数 ×
            夕食単価で計算され、清算画面・集金用PDFに反映されます。
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
          <Textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={14}
            placeholder="例）退寮月は日割り計算とする／大会不参加でも一律負担／体調不良による欠食は申告制 など"
          />
        </CardContent>
      </Card>
    </div>
  )
}

function buildForm(config) {
  return {
    breakfast_price: num(config.breakfast_price),
    dinner_price: num(config.dinner_price),
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
