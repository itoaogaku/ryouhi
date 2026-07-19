import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import * as api from '../lib/api.js'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth は AuthProvider の内側で使用してください')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function init() {
      // ダミーモード（GAS未接続のローカル確認用）はログイン不要
      if (api.USE_DUMMY) {
        if (!cancelled) {
          setUser({ name: 'ローカル確認用ユーザー', email: 'local@example.com' })
          setLoading(false)
        }
        return
      }
      const token = api.getStoredToken()
      if (!token) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const res = await api.whoami()
        if (!cancelled) setUser(res.user)
      } catch (e) {
        api.clearStoredToken()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, pin) => {
    const res = await api.login(email, pin)
    api.setStoredToken(res.token)
    setUser({ name: res.name, email: res.email })
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch (e) {
      // ベストエフォート。失敗してもローカルのセッションは破棄する
    }
    api.clearStoredToken()
    setUser(null)
  }, [])

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    usingDummy: api.USE_DUMMY,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
