import React, { useState } from 'react'
import { Building2, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Label,
} from '../components/ui/index.jsx'

// ログイン画面。メールアドレスと PIN（4〜8桁の数字）でログインする。
// 情報漏洩防止のため、登録済みアカウント以外はデータに一切アクセスできない。
export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), pin.trim())
    } catch (err) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle>寮費・食費清算管理システム</CardTitle>
          <CardDescription>
            登録済みのメールアドレスとPINでログインしてください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">メールアドレス</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-pin">PIN（4〜8桁の数字）</Label>
              <Input
                id="login-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoComplete="current-password"
                required
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))
                }
                placeholder="••••••"
                className="tracking-widest"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-red-50 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {submitting ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            アカウントの登録・PINの再設定は管理者にご連絡ください。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
