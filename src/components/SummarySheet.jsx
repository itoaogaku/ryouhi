import React from 'react'
import { formatYen, formatNumber, formatYearMonthJa } from '../lib/utils.js'
import { MEAL_TRACKING_DORMS } from '../lib/constants.js'
import { mealPriceFor } from '../lib/calc.js'

// -------------------------------------------------------------
// 全選手 清算一覧（A4横・全データ・複数ページ）
// 全選手を行、全項目を列に並べた一覧表。行数に応じて自動改ページ。
// -------------------------------------------------------------

const PAGE_W = 1123 // A4横 幅 (96dpi)
const PAGE_H = 794 // A4横 高さ (96dpi)
const ROWS_PER_PAGE = 22 // 1ページあたりの行数（小計・合計行含む）

// 列定義（sum:true は小計/合計で集計、money:true は円表示）
const COLS = [
  { key: 'name', label: '氏名', w: '11%', align: 'left' },
  { key: 'group', label: 'グループ', w: '7%', align: 'left' },
  { key: 'rank', label: 'ランク', w: '6%', align: 'left' },
  { key: 'clubFee', label: '部費', w: '6%', align: 'right', money: true, sum: true },
  { key: 'breakfastCount', label: '朝', w: '3%', align: 'right', sum: true },
  { key: 'dinnerCount', label: '夕', w: '3%', align: 'right', sum: true },
  { key: 'mealFee', label: '食費', w: '7%', align: 'right', money: true, sum: true },
  {
    key: 'tournament',
    label: '大会費',
    w: '9%',
    align: 'right',
    money: true,
    sum: true,
    sub: (r) => r.tournamentRows.map((t) => t.name).join('・'),
  },
  {
    key: 'camp',
    label: '合宿費',
    w: '9%',
    align: 'right',
    money: true,
    sum: true,
    sub: (r) => r.campRows.map((c) => `${c.name}(${c.nights}泊)`).join('・'),
  },
  { key: 'medicalActual', label: '治療実費', w: '5%', align: 'right', money: true, sum: true },
  { key: 'medicalSubsidy', label: '治療補助', w: '5%', align: 'right', money: true, sum: true },
  { key: 'medical', label: '治療差額', w: '5%', align: 'right', money: true, sum: true },
  { key: 'sagawa', label: '佐川', w: '4%', align: 'right', money: true, sum: true },
  {
    key: 'other',
    label: 'その他',
    w: '8%',
    align: 'right',
    money: true,
    sum: true,
    sub: (r) => r.otherRows.map((o) => o.name).join('・'),
  },
  {
    key: 'total',
    label: '合計',
    w: '10%',
    align: 'right',
    money: true,
    sum: true,
    accent: true,
  },
]

function sumRows(rows) {
  const acc = {}
  for (const col of COLS) {
    if (col.sum) acc[col.key] = rows.reduce((a, r) => a + (Number(r[col.key]) || 0), 0)
  }
  return acc
}

// 表示アイテム列（メンバー行 + グループ小計 + 全体合計）を生成
function buildItems(rows, groups) {
  const items = []
  for (const group of groups) {
    const groupRows = rows.filter((r) => r.group === group)
    if (groupRows.length === 0) continue
    for (const r of groupRows) items.push({ type: 'member', row: r })
    items.push({
      type: 'subtotal',
      label: `${group} 小計（${groupRows.length}名）`,
      sums: sumRows(groupRows),
    })
  }
  items.push({
    type: 'grand',
    label: `全体合計（${rows.length}名）`,
    sums: sumRows(rows),
  })
  return items
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function SummarySheet({ rows, groups, year, month, config }) {
  const items = buildItems(rows, groups)
  const pages = chunk(items, ROWS_PER_PAGE)
  if (pages.length === 0) return null

  return (
    <>
      {pages.map((pageItems, pi) => (
        <div key={pi} data-pdf-page>
          <Page
            items={pageItems}
            pageIndex={pi}
            pageCount={pages.length}
            year={year}
            month={month}
            config={config}
          />
        </div>
      ))}
    </>
  )
}

function Page({ items, pageIndex, pageCount, year, month, config }) {
  return (
    <div
      style={{
        width: PAGE_W,
        minHeight: PAGE_H,
        padding: '20px 22px',
        boxSizing: 'border-box',
        background: '#ffffff',
        color: '#0f172a',
        fontFamily:
          "'Hiragino Kaku Gothic ProN','Hiragino Sans','Meiryo',sans-serif",
      }}
    >
      {/* ヘッダー */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '2.5px solid #2563eb',
          paddingBottom: 6,
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>
            全選手 清算一覧
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
            {formatYearMonthJa(year, month)}分
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>
          部費{formatYen(config.base_club_fee)}
          {MEAL_TRACKING_DORMS.map((dorm) => (
            <span key={dorm}>
              ／{dorm}朝{formatYen(mealPriceFor(config, dorm, 'breakfast'))}・夕
              {formatYen(mealPriceFor(config, dorm, 'dinner'))}
            </span>
          ))}
          　|　Page {pageIndex + 1} / {pageCount}
        </div>
      </div>

      {/* テーブル */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 9,
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr style={{ background: '#eff6ff' }}>
            {COLS.map((c) => (
              <th
                key={c.key}
                style={{
                  width: c.w,
                  textAlign: c.align,
                  padding: '5px 4px',
                  borderBottom: '1.5px solid #bfdbfe',
                  fontSize: 9,
                  color: '#1e40af',
                  fontWeight: 700,
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            if (it.type === 'member') return <MemberRow key={idx} row={it.row} zebra={idx % 2 === 1} />
            return (
              <TotalRow
                key={idx}
                label={it.label}
                sums={it.sums}
                grand={it.type === 'grand'}
              />
            )
          })}
        </tbody>
      </table>

      {pageIndex === pageCount - 1 && (
        <div style={{ marginTop: 10, fontSize: 8.5, color: '#94a3b8' }}>
          ※
          大会費=各(参加費−補助)の合計、合宿費=各(1泊単価×泊数)の合計、治療差額=実費−補助、その他=自由項目の合計。大会費・合宿費・その他のセル下部に対象イベント/項目名を表示しています。
        </div>
      )}
    </div>
  )
}

function MemberRow({ row, zebra }) {
  return (
    <tr style={{ background: zebra ? '#f8fafc' : '#ffffff' }}>
      {COLS.map((c) => {
        const raw = row[c.key]
        let content
        if (c.money) content = raw ? formatYen(raw) : '—'
        else if (c.key === 'breakfastCount' || c.key === 'dinnerCount')
          content = raw ? formatNumber(raw) : '—'
        else content = raw
        const subText = c.sub ? c.sub(row) : ''
        return (
          <td
            key={c.key}
            style={{
              textAlign: c.align,
              padding: '3px 4px',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: c.accent ? 700 : c.key === 'name' ? 600 : 400,
              color: c.accent ? '#2563eb' : '#0f172a',
              fontVariantNumeric: 'tabular-nums',
              wordBreak: 'break-all',
              verticalAlign: 'top',
            }}
          >
            <div>{content}</div>
            {subText && (
              <div style={{ fontSize: 7.5, color: '#94a3b8', lineHeight: 1.3 }}>
                {subText}
              </div>
            )}
          </td>
        )
      })}
    </tr>
  )
}

function TotalRow({ label, sums, grand }) {
  return (
    <tr style={{ background: grand ? '#dbeafe' : '#f1f5f9' }}>
      {COLS.map((c, i) => {
        if (i === 0) {
          return (
            <td
              key={c.key}
              colSpan={3}
              style={{
                textAlign: 'left',
                padding: '4px 4px',
                borderBottom: grand ? '2px solid #93c5fd' : '1px solid #cbd5e1',
                borderTop: grand ? '2px solid #93c5fd' : 'none',
                fontWeight: 700,
                color: grand ? '#1e3a8a' : '#475569',
              }}
            >
              {label}
            </td>
          )
        }
        if (i < 3) return null // colSpan で吸収済み
        const val = sums[c.key]
        let content = '—'
        if (val != null) {
          content = c.money
            ? formatYen(val)
            : c.sum
            ? formatNumber(val)
            : ''
        }
        return (
          <td
            key={c.key}
            style={{
              textAlign: c.align,
              padding: '4px 4px',
              borderBottom: grand ? '2px solid #93c5fd' : '1px solid #cbd5e1',
              borderTop: grand ? '2px solid #93c5fd' : 'none',
              fontWeight: 700,
              color: c.accent ? '#1e40af' : grand ? '#1e3a8a' : '#334155',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {content}
          </td>
        )
      })}
    </tr>
  )
}
