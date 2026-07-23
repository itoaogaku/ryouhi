import React, { useState } from 'react'
import {
  Users,
  CalendarCheck,
  Receipt,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  LogOut,
  Loader2,
  Settings,
} from 'lucide-react'
import { useAuth } from './context/AuthContext.jsx'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { cn } from './lib/utils.js'
import { formatYearMonthJa } from './lib/utils.js'
import { GUEST_CATEGORIES_BY_DORM } from './lib/constants.js'
import MonthSelector from './components/MonthSelector.jsx'
import Toast from './components/Toast.jsx'
import { Badge, Button } from './components/ui/index.jsx'

import LoginScreen from './screens/LoginScreen.jsx'
import MembersScreen from './screens/MembersScreen.jsx'
import MealLogsScreen from './screens/MealLogsScreen.jsx'
import ExpensesScreen from './screens/ExpensesScreen.jsx'
import SettlementScreen from './screens/SettlementScreen.jsx'
import AccountsScreen from './screens/AccountsScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'

const TABS = [
  { id: 'members', label: '寮生マスター', icon: Users, Component: MembersScreen },
  {
    id: 'meals1',
    label: '1寮 食数',
    icon: CalendarCheck,
    Component: MealLogsScreen,
    props: { dorm: '1寮', guestCategories: GUEST_CATEGORIES_BY_DORM['1寮'] },
  },
  {
    id: 'meals2',
    label: '2寮 食数',
    icon: CalendarCheck,
    Component: MealLogsScreen,
    props: { dorm: '2寮', guestCategories: GUEST_CATEGORIES_BY_DORM['2寮'] },
  },
  { id: 'expenses', label: '月次経費', icon: Receipt, Component: ExpensesScreen },
  { id: 'settlement', label: '清算・PDF出力', icon: FileSpreadsheet, Component: SettlementScreen },
  { id: 'settings', label: '規定', icon: Settings, Component: SettingsScreen },
  { id: 'accounts', label: 'アカウント管理', icon: ShieldCheck, Component: AccountsScreen },
]

// ルート: ログイン状態に応じてログイン画面 or アプリ本体を表示する
export default function App() {
  const { isAuthenticated, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return (
    <AppProvider onAuthError={logout}>
      <AppShell />
    </AppProvider>
  )
}

function AppShell() {
  const [active, setActive] = useState('members')
  const { year, month, usingDummy, error } = useApp()
  const { user, logout } = useAuth()
  const activeTab = TABS.find((t) => t.id === active)
  const ActiveComponent = activeTab.Component

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight text-slate-900">
                  寮費・食費清算管理システム
                </h1>
                <p className="text-xs text-muted-foreground">
                  対象: {formatYearMonthJa(year, month)}
                  {usingDummy && (
                    <Badge variant="warning" className="ml-2">
                      ダミーデータ
                    </Badge>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MonthSelector />
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <span className="hidden text-sm text-slate-600 sm:inline">
                  {user?.name}
                </span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-3.5 w-3.5" />
                  ログアウト
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* タブナビゲーション */}
        <nav className="mx-auto max-w-7xl px-2">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = active === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* 本体 */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/20 bg-red-50 px-4 py-3 text-sm text-destructive">
            {error}（ダミーデータで表示している可能性があります）
          </div>
        )}
        <ActiveComponent key={activeTab.id} {...(activeTab.props || {})} />
      </main>

      <Toast />
    </div>
  )
}
