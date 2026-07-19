import React, { useState, useEffect } from 'react'
import { Save, Trash2, UserPlus, RotateCcw, KeyRound, AlertCircle } from 'lucide-react'
import * as api from '../lib/api.js'
import {
  Button,
  Card,
  CardContent,
  Input,
  Badge,
  Skeleton,
  Modal,
  Label,
} from '../components/ui/index.jsx'
import { cn } from '../lib/utils.js'

// 画面：アカウント管理（ログインできる人の管理）
// 情報漏洩防止のため、ここに登録された「メールアドレス + PIN」を
// 持つ人だけがシステムにログインできる。
export default function AccountsScreen() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [pinTarget, setPinTarget] = useState(null) // 設定対象の account
  const [toast, setToast] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAccounts()
      setAccounts(data)
      setDirty(false)
    } catch (e) {
      setError(e.message || 'アカウント一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const update = (id, field, value) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    )
    setDirty(true)
  }

  const addAccount = () => {
    const nextId = accounts.length
      ? Math.max(...accounts.map((a) => a.id)) + 1
      : 1
    setAccounts((prev) => [
      ...prev,
      { id: nextId, name: '', email: '', active: true, hasPin: false },
    ])
    setDirty(true)
  }

  const removeAccount = (id) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    setDirty(true)
  }

  const reset = () => {
    load()
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const invalidEmails = accounts.filter(
        (a) => a.name.trim() && !/.+@.+\..+/.test(a.email.trim())
      )
      if (invalidEmails.length > 0) {
        setError('メールアドレスの形式が正しくない行があります')
        return
      }
      await api.saveAccounts(
        accounts.map((a) => ({
          id: a.id,
          name: a.name.trim(),
          email: a.email.trim(),
          active: !!a.active,
        }))
      )
      await load()
      showToast('アカウント一覧を保存しました')
    } catch (e) {
      setError(e.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          ここに登録された「メールアドレス + PIN」を持つ人だけがログインできます。
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={addAccount}>
            <UserPlus className="h-4 w-4" />
            アカウント追加
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

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-red-50 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="w-14 px-4 py-3">ID</th>
                  <th className="px-4 py-3">氏名</th>
                  <th className="px-4 py-3">メールアドレス</th>
                  <th className="w-28 px-4 py-3">状態</th>
                  <th className="w-48 px-4 py-3">PIN</th>
                  <th className="w-16 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className={cn(
                      'border-b border-slate-100 hover:bg-slate-50/60',
                      !a.active && 'bg-slate-50/40 text-slate-400'
                    )}
                  >
                    <td className="px-4 py-2 tabular-nums text-slate-500">
                      {a.id}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={a.name}
                        placeholder="氏名を入力"
                        onChange={(e) => update(a.id, 'name', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="email"
                        value={a.email}
                        placeholder="you@example.com"
                        onChange={(e) => update(a.id, 'email', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => update(a.id, 'active', !a.active)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                          a.active
                            ? 'border-success/20 bg-success/10 text-success'
                            : 'border-slate-200 bg-slate-100 text-slate-500'
                        )}
                      >
                        {a.active ? '有効' : '無効'}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Badge
                          variant={a.hasPin ? 'success' : 'warning'}
                          className="whitespace-nowrap"
                        >
                          {a.hasPin ? '設定済み' : '未設定'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!a.email.trim() || dirty}
                          title={
                            dirty
                              ? '先に保存してからPINを設定してください'
                              : ''
                          }
                          onClick={() => setPinTarget(a)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          {a.hasPin ? '再設定' : '設定'}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAccount(a.id)}
                        className="text-slate-400 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      ログイン可能なアカウントがまだありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ※「無効」にするとそのアカウントは即座にログインできなくなります（ログイン中の場合も次の操作でログアウトされます）。
        新規追加した行はまず「保存」してから、PINの「設定」でログインできるようにしてください。
      </p>

      {pinTarget && (
        <SetPinDialog
          account={pinTarget}
          onClose={() => setPinTarget(null)}
          onSaved={() => {
            setPinTarget(null)
            load()
            showToast('PINを設定しました')
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-success/20 bg-green-50 px-4 py-3 text-sm font-medium text-success shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function SetPinDialog({ account, onClose, onSaved }) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const valid = /^[0-9]{4,8}$/.test(pin) && pin === confirmPin

  const handleSubmit = async () => {
    if (!valid) return
    setSubmitting(true)
    setError('')
    try {
      await api.setAccountPin(account.email, pin)
      onSaved()
    } catch (e) {
      setError(e.message || 'PINの設定に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`PINを${account.hasPin ? '再設定' : '設定'} — ${account.name || account.email}`}
      maxWidth="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? '設定中...' : '設定する'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-pin">新しいPIN（4〜8桁の数字）</Label>
          <Input
            id="new-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
            className="tracking-widest"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pin">確認のため再入力</Label>
          <Input
            id="confirm-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            value={confirmPin}
            onChange={(e) =>
              setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))
            }
            className="tracking-widest"
          />
        </div>
        {pin && confirmPin && pin !== confirmPin && (
          <p className="text-xs text-destructive">PINが一致しません</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Modal>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
