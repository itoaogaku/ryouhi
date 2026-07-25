import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Save,
  Coffee,
  UtensilsCrossed,
  CheckCheck,
  X,
  Plus,
  Trash2,
  GraduationCap,
  Home,
  CalendarDays,
  Table2,
  Wand2,
  Printer,
  Loader2,
  ArrowRightLeft,
  Undo2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import * as api from '../lib/api.js'
import {
  GUEST_CATEGORIES,
  STANDARD_MEAL_SCHEDULE,
  MEAL_TRACKING_DORMS,
  GROUP_BY_DORM,
  mealDormOf,
} from '../lib/constants.js'
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  Checkbox,
  Badge,
  Skeleton,
  Modal,
} from '../components/ui/index.jsx'
import {
  daysInMonth,
  toDateStr,
  weekdayOf,
  WEEKDAY_JA,
  formatYearMonthJa,
  uid,
  cn,
  compareMembersByGradeKana,
} from '../lib/utils.js'
import MonthlyMealMatrix from '../components/MonthlyMealMatrix.jsx'
import MealListSheet from '../components/MealListSheet.jsx'
import { buildMonthlyMealMatrix } from '../lib/mealMatrix.js'
import { generateMealListPdf } from '../lib/pdf.js'

// 画面B：日別・月別 食数管理（寮ごと）
// dorm: '1寮' | '2寮' — その寮の食数を管理
// guestCategories: この寮で記録を許可する「寮生以外」の種別
//   （2寮には高校生が泊まらないため見学高校生は対象外にできる）
export default function MealLogsScreen({ dorm, guestCategories = GUEST_CATEGORIES }) {
  const {
    year,
    month,
    yearMonth,
    members,
    mealLogs,
    guestMeals,
    dormTransfers,
    loading,
    saveMealLogs,
    saveMembers,
    registerDormTransfer,
    undoDormTransfer,
    dismissDormTransfer,
    removeDormTransferMember,
    showToast,
  } = useApp()

  const today = new Date()
  const defaultDay =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : 1
  const [day, setDay] = useState(defaultDay)
  // 表示モード: 'daily' = 日別入力 / 'monthly' = 月間一覧表（名前×日付）
  const [viewMode, setViewMode] = useState('daily')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showScheduleConfirm, setShowScheduleConfirm] = useState(false)
  const [applyingSchedule, setApplyingSchedule] = useState(false)
  const [generatingList, setGeneratingList] = useState(false)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [transferDay, setTransferDay] = useState(defaultDay)
  const [transferSelected, setTransferSelected] = useState(() => new Set())
  // 取り消し・通知消去の処理中は、対象の移動登録行だけボタンを無効化する
  const [processingTransferId, setProcessingTransferId] = useState(null)
  // 個別の対象者だけを取り消す処理中は `${移動登録id}__${選手id}` で管理する
  const [processingMemberKey, setProcessingMemberKey] = useState(null)
  const mealListRef = useRef(null)

  // member_id -> { breakfast, dinner } の編集バッファ（当日×この寮）
  const [draft, setDraft] = useState({})
  // 寮生以外（見学高校生・寮外生・寮管）の当日バッファ:
  // [{ uid, category, school, name, breakfast, dinner }]
  const [guestDraft, setGuestDraft] = useState([])

  const dateStr = toDateStr(year, month, day)
  const totalDays = daysInMonth(year, month)

  // 選択日が月の日数を超えたら丸める
  useEffect(() => {
    if (day > totalDays) setDay(totalDays)
  }, [totalDays, day])

  // 直前に表示していた「日付×寮」を記録しておく（日付セレクタでの
  // 切り替えだけでなく、ヘッダーの年月変更でも dateStr は変わるため、
  // どちらの場合も下の effect で一括して検知する）
  const prevKeyRef = useRef(null)

  // mealLogs / guestMeals から当日×この寮の状態を初期化
  // （切り替え前に未保存の変更があれば、保存を忘れて消えないよう自動保存する）
  useEffect(() => {
    const prevKey = prevKeyRef.current
    const isSwitch =
      prevKey && (prevKey.dateStr !== dateStr || prevKey.dorm !== dorm)

    if (isSwitch && dirty) {
      const oldLogs = members
        .filter((m) => m.active)
        .map((m) => {
          const v = draft[String(m.id)] || { breakfast: false, dinner: false }
          return {
            date: prevKey.dateStr,
            member_id: m.id,
            dorm: prevKey.dorm,
            breakfast: !!v.breakfast,
            dinner: !!v.dinner,
          }
        })
      const oldGuests = guestDraft
        .filter(
          (g) => (g.name || '').trim() !== '' || (g.school || '').trim() !== ''
        )
        .map((g) => ({
          date: prevKey.dateStr,
          dorm: prevKey.dorm,
          category: g.category || '見学高校生',
          school: (g.school || '').trim(),
          name: (g.name || '').trim(),
          breakfast: !!g.breakfast,
          dinner: !!g.dinner,
        }))
      saveMealLogs(oldLogs, oldGuests, prevKey.dateStr, prevKey.dorm, {
        silent: true,
      })
        .then(() => showToast(`${prevKey.dateStr} の入力を自動保存しました`))
        .catch((e) => {
          console.error(e)
          showToast(
            `${prevKey.dateStr} の自動保存に失敗しました。入力内容をご確認ください`,
            'error'
          )
        })
    }

    const map = {}
    for (const log of mealLogs) {
      if (log.date === dateStr && (log.dorm || '') === dorm) {
        map[String(log.member_id)] = {
          breakfast: !!log.breakfast,
          dinner: !!log.dinner,
        }
      }
    }
    setDraft(map)
    setGuestDraft(
      guestMeals
        .filter((g) => g.date === dateStr && (g.dorm || '') === dorm)
        .map((g) => ({
          uid: uid(),
          category: g.category || '見学高校生',
          school: g.school || '',
          name: g.name || '',
          breakfast: !!g.breakfast,
          dinner: !!g.dinner,
        }))
    )
    setDirty(false)
    prevKeyRef.current = { dateStr, dorm }
  }, [mealLogs, guestMeals, dateStr, dorm])

  const activeMembers = useMemo(
    () => members.filter((m) => m.active),
    [members]
  )

  // 標準スケジュール一括反映の対象（この寮で食事をする人）
  const schedulePopulation = useMemo(
    () => activeMembers.filter((m) => mealDormOf(m) === dorm),
    [activeMembers, dorm]
  )

  // 既に何らかの記録（朝食・夕食いずれかにチェック）がある「日付×メンバー」の組み合わせ
  const existingLogKeys = useMemo(() => {
    const set = new Set()
    for (const log of mealLogs) {
      if ((log.dorm || '') !== dorm) continue
      if (!log.breakfast && !log.dinner) continue
      set.add(`${log.date}__${log.member_id}`)
    }
    return set
  }, [mealLogs, dorm])

  // 火〜土曜=朝夕、日曜=朝のみ、月曜=提供なし の標準スケジュールのうち、
  // まだ記録の無い「日付×メンバー」だけを対象にした一覧（安全のため上書きしない）
  const pendingScheduleLogs = useMemo(() => {
    const logs = []
    for (const m of schedulePopulation) {
      for (let d = 1; d <= totalDays; d++) {
        const date = toDateStr(year, month, d)
        if (existingLogKeys.has(`${date}__${m.id}`)) continue
        const dow = weekdayOf(year, month, d)
        const sched = STANDARD_MEAL_SCHEDULE[dow]
        // 朝夕とも提供なしの日（月曜）は記録自体が残らないため対象外
        if (!sched.breakfast && !sched.dinner) continue
        logs.push({
          date,
          member_id: m.id,
          dorm,
          breakfast: sched.breakfast,
          dinner: sched.dinner,
        })
      }
    }
    return logs
  }, [schedulePopulation, existingLogKeys, dorm, totalDays, year, month])

  // 未入力の日付×メンバーにだけ標準スケジュールを一括反映する
  // （既に入力済みの日は一切変更しない。guests にも触れない）
  const applyStandardSchedule = async () => {
    if (pendingScheduleLogs.length === 0) {
      setShowScheduleConfirm(false)
      return
    }
    setApplyingSchedule(true)
    try {
      await saveMealLogs(pendingScheduleLogs, [], null, dorm)
      setShowScheduleConfirm(false)
    } finally {
      setApplyingSchedule(false)
    }
  }

  // 食堂掲示用PDFの元データ（表示中の絞り込みに関係なく、この寮の対象者全員）
  const printMatrix = useMemo(
    () =>
      buildMonthlyMealMatrix({
        members,
        mealLogs,
        guestMeals,
        dorm,
        year,
        month,
      }),
    [members, mealLogs, guestMeals, dorm, year, month]
  )

  const handleDownloadMealListPdf = async () => {
    setGeneratingList(true)
    try {
      await new Promise((r) => setTimeout(r, 50))
      const container = mealListRef.current
      const pages = Array.from(container.querySelectorAll('[data-pdf-page]'))
      if (pages.length === 0) {
        showToast('出力対象のデータがありません', 'error')
        return
      }
      await generateMealListPdf(
        pages,
        `${dorm}_食数一覧表_${formatYearMonthJa(year, month)}.pdf`
      )
      showToast('食堂掲示用PDFをダウンロードしました')
    } catch (e) {
      console.error(e)
      showToast('PDF生成に失敗しました', 'error')
    } finally {
      setGeneratingList(false)
    }
  }

  // この寮の所属者のみを表示する
  // （女子寮所属は1寮で食事をするため、1寮では「所属」として扱う）
  const filtered = activeMembers
    .filter((m) => mealDormOf(m) === dorm)
    .slice()
    .sort(compareMembersByGradeKana)

  // もう一方の食数管理対象寮（1寮なら2寮、2寮なら1寮）。
  // 寮間移動でこの寮に来て食べることがあるため、名前を挙げてチェックできるようにする
  const otherDorm = MEAL_TRACKING_DORMS.find((d) => d !== dorm) || ''
  const otherDormMembers = activeMembers
    .filter((m) => mealDormOf(m) === otherDorm)
    .slice()
    .sort(compareMembersByGradeKana)

  // 集金グループを自動設定できるか（1寮には対応する集金グループが無いため、
  // 1寮への移動時は手動確認が必要になる旨をダイアログで案内する）
  const transferGroupAutoSet = !!GROUP_BY_DORM[dorm]

  const toggleTransferMember = (id) => {
    setTransferSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 寮間移動を登録: 選んだ選手の寮生マスターをこの寮に切り替え、
  // 移動日から月末までこの寮の標準スケジュールを未入力の日にだけ一括反映する
  const applyDormTransfer = async () => {
    if (transferSelected.size === 0) return
    setTransferring(true)
    try {
      const selectedIds = new Set(transferSelected)
      // 取り消し用に、変更前の寮・集金グループを控えておく
      const previousMembers = members
        .filter((m) => selectedIds.has(m.id))
        .map((m) => ({ id: m.id, dorm: m.dorm, group: m.group }))
      const memberNames = previousMembers
        .map((pm) => members.find((m) => m.id === pm.id)?.name)
        .filter(Boolean)

      const updatedMembers = members.map((m) => {
        if (!selectedIds.has(m.id)) return m
        // 対応する集金グループが無い寮（1寮）への移動時は、古いグループを
        // 残さず「未選択」にする（寮生マスターで赤字表示され、選び直しが必要と分かる）
        return { ...m, dorm, group: GROUP_BY_DORM[dorm] || '' }
      })
      await saveMembers(updatedMembers)

      const transferLogs = []
      for (const id of selectedIds) {
        for (let d = transferDay; d <= totalDays; d++) {
          const date = toDateStr(year, month, d)
          if (existingLogKeys.has(`${date}__${id}`)) continue
          const sched = STANDARD_MEAL_SCHEDULE[weekdayOf(year, month, d)]
          if (!sched.breakfast && !sched.dinner) continue
          transferLogs.push({
            date,
            member_id: id,
            dorm,
            breakfast: sched.breakfast,
            dinner: sched.dinner,
          })
        }
      }
      if (transferLogs.length > 0) {
        await saveMealLogs(transferLogs, [], null, dorm, { silent: true })
      }
      // 取り消し用メタデータをシートへ永続化する（後日でもここから取り消せる）
      await registerDormTransfer({
        dorm,
        memberNames,
        previousMembers,
        createdLogs: transferLogs.map((l) => ({
          date: l.date,
          member_id: l.member_id,
          dorm: l.dorm,
        })),
      })
      showToast(`${selectedIds.size}名を${dorm}へ移動登録しました`)
      setShowTransferDialog(false)
      setTransferSelected(new Set())
    } catch (e) {
      console.error(e)
      showToast('寮間移動の登録に失敗しました', 'error')
    } finally {
      setTransferring(false)
    }
  }

  // この寮宛ての、まだ取り消されていない移動登録一覧
  const pendingTransfers = dormTransfers.filter((t) => t.dorm === dorm)

  const handleUndoTransfer = async (record) => {
    setProcessingTransferId(record.id)
    try {
      await undoDormTransfer(record)
    } catch (e) {
      // 失敗時のトーストは context 側で表示済み
    } finally {
      setProcessingTransferId(null)
    }
  }

  const handleDismissTransfer = async (record) => {
    setProcessingTransferId(record.id)
    try {
      await dismissDormTransfer(record)
    } catch (e) {
      console.error(e)
      showToast('通知の削除に失敗しました', 'error')
    } finally {
      setProcessingTransferId(null)
    }
  }

  // 複数人まとめた移動登録から、選んだ1人だけを取り消して除外する
  const handleRemoveMember = async (record, memberId) => {
    const key = `${record.id}__${memberId}`
    setProcessingMemberKey(key)
    try {
      await removeDormTransferMember(record, memberId)
    } catch (e) {
      // 失敗時のトーストは context 側で表示済み
    } finally {
      setProcessingMemberKey(null)
    }
  }

  const getVal = (id) =>
    draft[String(id)] || { breakfast: false, dinner: false }

  const setVal = (id, field, value) => {
    setDraft((prev) => ({
      ...prev,
      [String(id)]: { ...getVal(id), [field]: value },
    }))
    setDirty(true)
  }

  // 表示中メンバーに対する一括操作
  const bulkSet = (field, value) => {
    setDraft((prev) => {
      const next = { ...prev }
      for (const m of filtered) {
        next[String(m.id)] = { ...getVal(m.id), [field]: value }
      }
      return next
    })
    setDirty(true)
  }

  // ---- 寮生以外（見学高校生・寮外生・寮管）の操作 ----
  const addGuest = () => {
    setGuestDraft((prev) => [
      ...prev,
      {
        uid: uid(),
        category: guestCategories[0] || '見学高校生',
        school: '',
        name: '',
        breakfast: false,
        dinner: true,
      },
    ])
    setDirty(true)
  }
  const updateGuest = (uidKey, field, value) => {
    setGuestDraft((prev) =>
      prev.map((g) => (g.uid === uidKey ? { ...g, [field]: value } : g))
    )
    setDirty(true)
  }
  const removeGuest = (uidKey) => {
    setGuestDraft((prev) => prev.filter((g) => g.uid !== uidKey))
    setDirty(true)
  }

  // 現在の編集内容（当日×この寮）を保存用のペイロードに組み立てる
  // 手動保存・自動保存（日付切替／画面離脱）のいずれからも使う共通ロジック
  const buildSavePayload = () => {
    // 全在籍メンバー分を当日×この寮として UPSERT（未チェックは削除扱い）
    const logs = activeMembers.map((m) => {
      const v = getVal(m.id)
      return {
        date: dateStr,
        member_id: m.id,
        dorm,
        breakfast: !!v.breakfast,
        dinner: !!v.dinner,
      }
    })
    // 寮生以外（学校名または氏名ありのみ保存）
    const guests = guestDraft
      .filter(
        (g) => (g.name || '').trim() !== '' || (g.school || '').trim() !== ''
      )
      .map((g) => ({
        date: dateStr,
        dorm,
        category: g.category || '見学高校生',
        school: (g.school || '').trim(),
        name: (g.name || '').trim(),
        breakfast: !!g.breakfast,
        dinner: !!g.dinner,
      }))
    return { logs, guests }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { logs, guests } = buildSavePayload()
      await saveMealLogs(logs, guests, dateStr, dorm)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  // 常に最新の状態を参照するための ref（unmount / beforeunload の
  // クリーンアップはマウント時点のクロージャのままになるため）
  const autoSaveRef = useRef(null)
  autoSaveRef.current = {
    dirty,
    dateStr,
    dorm,
    yearMonth,
    buildSavePayload,
    saveMealLogs,
  }

  // 画面タブの切り替え（他の画面や別寮タブへ移動）でこの画面がアンマウント
  // されるときに、未保存の変更があれば自動保存する
  useEffect(() => {
    return () => {
      const s = autoSaveRef.current
      if (!s || !s.dirty) return
      const { logs, guests } = s.buildSavePayload()
      s.saveMealLogs(logs, guests, s.dateStr, s.dorm, { silent: true }).catch(
        (e) => console.error('画面離脱時の自動保存に失敗しました', e)
      )
    }
  }, [])

  // ブラウザタブを閉じる／リロードするときは、通常の非同期保存が完走する
  // 保証がないため sendBeacon でベストエフォート保存する
  useEffect(() => {
    const handleUnload = () => {
      const s = autoSaveRef.current
      if (!s || !s.dirty) return
      const { logs, guests } = s.buildSavePayload()
      api.saveMealLogsBeacon(s.yearMonth, logs, guests, s.dateStr, s.dorm)
    }
    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)
    return () => {
      window.removeEventListener('pagehide', handleUnload)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  // 当日の集計
  const counts = filtered.reduce(
    (acc, m) => {
      const v = getVal(m.id)
      if (v.breakfast) acc.breakfast += 1
      if (v.dinner) acc.dinner += 1
      return acc
    },
    { breakfast: 0, dinner: 0 }
  )
  const guestCounts = guestDraft.reduce(
    (acc, g) => {
      if (g.breakfast) acc.breakfast += 1
      if (g.dinner) acc.dinner += 1
      return acc
    },
    { breakfast: 0, dinner: 0 }
  )
  const otherDormCounts = otherDormMembers.reduce(
    (acc, m) => {
      const v = getVal(m.id)
      if (v.breakfast) acc.breakfast += 1
      if (v.dinner) acc.dinner += 1
      return acc
    },
    { breakfast: 0, dinner: 0 }
  )

  const dow = weekdayOf(year, month, day)
  const isWeekend = dow === 0 || dow === 6

  // セレクトの選択肢: この寮で許可された種別 + 既存データに残る種別（データ欠落防止）
  const availableCategories = Array.from(
    new Set([...guestCategories, ...guestDraft.map((g) => g.category)])
  )

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* 寮バナー */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
        <Home className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">
          {dorm} の食数管理
        </span>
        <span className="text-xs text-muted-foreground">
          （この寮で食べた人を記録します）
        </span>
      </div>

      {/* 表示モード切替 & 一括反映 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setViewMode('daily')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'daily'
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <CalendarDays className="h-4 w-4" />
            日別入力
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'monthly'
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Table2 className="h-4 w-4" />
            月間一覧表（名前×日付）
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleDownloadMealListPdf}
            disabled={generatingList}
          >
            {generatingList ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            {generatingList ? '生成中...' : '食堂掲示用PDF出力'}
          </Button>
          <Button variant="secondary" onClick={() => setShowScheduleConfirm(true)}>
            <Wand2 className="h-4 w-4" />
            標準スケジュールを一括反映
          </Button>
          {otherDorm && (
            <Button
              variant="secondary"
              onClick={() => {
                setTransferDay(day)
                setTransferSelected(new Set())
                setShowTransferDialog(true)
              }}
            >
              <ArrowRightLeft className="h-4 w-4" />
              寮間移動を登録
            </Button>
          )}
        </div>
      </div>

      {pendingTransfers.length > 0 && (
        <div className="space-y-2">
          {pendingTransfers.map((t) => {
            const processing = processingTransferId === t.id
            return (
              <div
                key={t.id}
                className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm"
              >
                <div className="text-amber-800">
                  {t.dorm}への移動登録（{formatTransferTimestamp(t.createdAt)}）。
                  誤って含めてしまった選手がいれば、名前の×から個別に取り消せます。
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {t.memberNames.map((name, i) => {
                    const pm = t.previousMembers[i]
                    const memberKey = `${t.id}__${pm?.id}`
                    const memberProcessing = processingMemberKey === memberKey
                    return (
                      <span
                        key={pm?.id ?? i}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white py-1 pl-2.5 pr-1.5 text-xs text-amber-800"
                      >
                        {name}
                        <button
                          onClick={() => pm && handleRemoveMember(t, pm.id)}
                          disabled={memberProcessing || processing || !pm}
                          title={`${name}さんだけ取り消す`}
                          aria-label={`${name}さんだけ取り消す`}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-amber-500 hover:bg-amber-100 hover:text-amber-700 disabled:opacity-40"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismissTransfer(t)}
                    disabled={processing}
                  >
                    了解（通知を消す）
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleUndoTransfer(t)}
                    disabled={processing}
                  >
                    <Undo2 className="h-4 w-4" />
                    {processing ? '処理中...' : '全員まとめて取り消す'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showTransferDialog && (
        <Modal
          open
          onClose={() => setShowTransferDialog(false)}
          title={`寮間移動を登録（${otherDorm} → ${dorm}）`}
          maxWidth="max-w-lg"
          footer={
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">
                  {transferSelected.size}名
                </span>{' '}
                を選択中
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowTransferDialog(false)}
                  disabled={transferring}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={applyDormTransfer}
                  disabled={transferring || transferSelected.size === 0}
                >
                  {transferring
                    ? '登録中...'
                    : `${transferSelected.size}名を${dorm}へ移動する`}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            <p className="text-slate-600">
              {otherDorm}に所属する選手を選ぶと、寮生マスターの「寮」を{dorm}
              に切り替え、移動日から月末まで{dorm}の標準スケジュール（火〜土:
              朝夕、日:朝のみ）を<strong>まだ記録の無い日にだけ</strong>
              一括反映します。
            </p>
            {!transferGroupAutoSet && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {dorm}には対応する集金グループが無いため、集金グループは「未選択」に
                リセットされます（寮生マスターに赤字で表示されるので、3階・2階の
                いずれかを選び直してください）。
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                移動日
              </label>
              <Select
                value={transferDay}
                onChange={(e) => setTransferDay(Number(e.target.value))}
                className="w-28"
              >
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                対象の選手（{otherDorm}所属）
              </label>
              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {otherDormMembers.map((m) => {
                  const on = transferSelected.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleTransferMember(m.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors',
                        on
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      )}
                    >
                      <Checkbox checked={on} onChange={() => toggleTransferMember(m.id)} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">
                          {m.name}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {m.grade} ・ {m.rank}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {otherDormMembers.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {otherDorm}に選手がいません
                  </p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showScheduleConfirm && (
        <Modal
          open
          onClose={() => setShowScheduleConfirm(false)}
          title="標準スケジュールを一括反映"
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowScheduleConfirm(false)}
                disabled={applyingSchedule}
              >
                キャンセル
              </Button>
              <Button
                onClick={applyStandardSchedule}
                disabled={applyingSchedule || pendingScheduleLogs.length === 0}
              >
                {applyingSchedule
                  ? '反映中...'
                  : pendingScheduleLogs.length === 0
                  ? '未入力の日はありません'
                  : `反映する（未入力 ${pendingScheduleLogs.length}件）`}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              {formatYearMonthJa(year, month)}の {dorm}
              （対象 {schedulePopulation.length}名）について、
              <strong>まだ記録の無い日にだけ</strong>
              以下の標準スケジュールを一括で入力します。
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>火曜〜土曜：朝食・夕食あり</li>
              <li>日曜：朝食のみ</li>
              <li>月曜：提供なし</li>
            </ul>
            <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-primary">
              安全のため、既に朝食・夕食のいずれかにチェックが入っている日は
              上書きしません。欠席や特別対応を反映済みの日はそのまま残ります。
            </p>
            <p className="text-xs text-slate-400">
              未入力の対象：{pendingScheduleLogs.length}件（{schedulePopulation.length}
              名 ×最大{totalDays}日のうち）
            </p>
          </div>
        </Modal>
      )}

      {viewMode === 'monthly' ? (
        <MonthlyMealMatrix
          dorm={dorm}
          year={year}
          month={month}
          members={members}
          mealLogs={mealLogs}
          guestMeals={guestMeals}
        />
      ) : (
        <>
      {/* 日付選択 & 集計 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              日付
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-24"
              >
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </Select>
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-sm font-medium',
                  isWeekend
                    ? dow === 0
                      ? 'bg-red-50 text-red-600'
                      : 'bg-blue-50 text-blue-600'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                ({WEEKDAY_JA[dow]})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Coffee className="h-3.5 w-3.5" /> 朝 {counts.breakfast}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <UtensilsCrossed className="h-3.5 w-3.5" /> 夕 {counts.dinner}
          </Badge>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : '一括保存'}
          </Button>
        </div>
      </div>

      {/* 一括操作バー */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="font-medium text-slate-500">表示中を一括:</span>
        <Button size="sm" variant="secondary" onClick={() => bulkSet('breakfast', true)}>
          <CheckCheck className="h-3.5 w-3.5" /> 朝 全◯
        </Button>
        <Button size="sm" variant="ghost" onClick={() => bulkSet('breakfast', false)}>
          <X className="h-3.5 w-3.5" /> 朝 全×
        </Button>
        <span className="mx-1 text-slate-300">|</span>
        <Button size="sm" variant="secondary" onClick={() => bulkSet('dinner', true)}>
          <CheckCheck className="h-3.5 w-3.5" /> 夕 全◯
        </Button>
        <Button size="sm" variant="ghost" onClick={() => bulkSet('dinner', false)}>
          <X className="h-3.5 w-3.5" /> 夕 全×
        </Button>
      </div>

      {/* グリッド */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <th className="w-12 px-4 py-3">ID</th>
                  <th className="px-4 py-3">氏名</th>
                  <th className="w-24 px-4 py-3">所属寮</th>
                  <th className="w-28 px-4 py-3">ランク</th>
                  <th className="w-28 px-4 py-3">グループ</th>
                  <th className="w-24 px-4 py-3 text-center">朝食</th>
                  <th className="w-24 px-4 py-3 text-center">夕食</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const v = getVal(m.id)
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-slate-100 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 tabular-nums text-slate-400">
                        {m.id}
                      </td>
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {m.name}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {m.dorm || '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-500">{m.rank}</td>
                      <td className="px-4 py-2 text-slate-500">{m.group}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={v.breakfast}
                            onChange={(val) => setVal(m.id, 'breakfast', val)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={v.dinner}
                            onChange={(val) => setVal(m.id, 'dinner', val)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
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

      {/* 寮間移動: もう一方の寮の選手がこの寮で食べた場合はここでチェックする */}
      {otherDorm && otherDormMembers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-700">
                {otherDorm}生
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <Coffee className="h-3.5 w-3.5" /> 朝 {otherDormCounts.breakfast}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <UtensilsCrossed className="h-3.5 w-3.5" /> 夕{' '}
                  {otherDormCounts.dinner}
                </Badge>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {otherDorm}所属の選手が寮間移動でこの寮で食事をした場合は、ここにチェックしてください（基本的には空欄のままで構いません）。
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-400">
                    <th className="py-1.5">氏名</th>
                    <th className="w-28 py-1.5">ランク</th>
                    <th className="w-20 py-1.5 text-center">朝食</th>
                    <th className="w-20 py-1.5 text-center">夕食</th>
                  </tr>
                </thead>
                <tbody>
                  {otherDormMembers.map((m) => {
                    const v = getVal(m.id)
                    return (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-1.5 font-medium text-slate-800">
                          {m.name}
                        </td>
                        <td className="py-1.5 text-slate-500">{m.rank}</td>
                        <td className="py-1.5">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={v.breakfast}
                              onChange={(val) => setVal(m.id, 'breakfast', val)}
                            />
                          </div>
                        </td>
                        <td className="py-1.5">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={v.dinner}
                              onChange={(val) => setVal(m.id, 'dinner', val)}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 寮生以外（見学高校生・寮外生・寮管）の食数 */}
      {guestCategories.length > 0 && (
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
              寮生以外の食数 · {dorm}（{month}月{day}日 {WEEKDAY_JA[dow]}）
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="gap-1">
                <Coffee className="h-3.5 w-3.5" /> 朝 {guestCounts.breakfast}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <UtensilsCrossed className="h-3.5 w-3.5" /> 夕 {guestCounts.dinner}
              </Badge>
              <Button size="sm" variant="secondary" onClick={addGuest}>
                <Plus className="h-3.5 w-3.5" />
                追加
              </Button>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            見学高校生・寮外生・寮管など、寮生以外で食事をとる人をここに記録します。
          </p>

          {guestDraft.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              この日は寮生以外の記録がありません。「追加」で種別・氏名・朝夕を記録できます。
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[100px_1fr_1fr_56px_56px_32px] gap-2 px-1 text-[11px] font-medium text-slate-400">
                <span>種別</span>
                <span>学校名・備考</span>
                <span>氏名</span>
                <span className="text-center">朝食</span>
                <span className="text-center">夕食</span>
                <span></span>
              </div>
              {guestDraft.map((g) => (
                <div
                  key={g.uid}
                  className="grid grid-cols-[100px_1fr_1fr_56px_56px_32px] items-center gap-2"
                >
                  <Select
                    value={g.category}
                    onChange={(e) => updateGuest(g.uid, 'category', e.target.value)}
                    className="h-9 text-xs"
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={g.school}
                    placeholder={
                      g.category === '見学高校生' ? '〇〇高校' : '備考（任意）'
                    }
                    onChange={(e) => updateGuest(g.uid, 'school', e.target.value)}
                  />
                  <Input
                    value={g.name}
                    placeholder="田中 太郎"
                    onChange={(e) => updateGuest(g.uid, 'name', e.target.value)}
                  />
                  <div className="flex justify-center">
                    <Checkbox
                      checked={g.breakfast}
                      onChange={(val) => updateGuest(g.uid, 'breakfast', val)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={g.dinner}
                      onChange={(val) => updateGuest(g.uid, 'dinner', val)}
                    />
                  </div>
                  <button
                    onClick={() => removeGuest(g.uid)}
                    className="flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-destructive"
                    aria-label="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <p className="text-xs text-muted-foreground">
        ※チェックの有無を当日の食数として一括保存します（メンバー: UPSERT
        {guestCategories.length > 0 && '、寮生以外: 当日分を入れ替え'}）。上部の「一括保存」ボタンで保存されます。
      </p>
        </>
      )}

      {/* PDF描画用オフスクリーン要素（食堂掲示用 月間食数一覧） */}
      <div className="pdf-offscreen" ref={mealListRef} aria-hidden>
        <MealListSheet
          dorm={dorm}
          year={year}
          month={month}
          days={printMatrix.days}
          rows={printMatrix.rows}
        />
      </div>
    </div>
  )
}

// 寮間移動の登録日時（ISO文字列）を「7/24 15:03」のような短い表記にする
function formatTransferTimestamp(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
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
