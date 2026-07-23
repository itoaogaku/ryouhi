import React from 'react'
import { formatYen, formatNumber, formatYearMonthJa } from '../lib/utils.js'
import { MEAL_TRACKING_DORMS } from '../lib/constants.js'
import { mealPriceFor, buildItemColumns, itemColumnValue } from '../lib/calc.js'

// -------------------------------------------------------------
// 全選手 清算一覧（A4横・全データ・複数ページ）
// 全選手を行、全項目を列に並べた一覧表。行数に応じて自動改ページ。
//
// 大会・合宿・その他費用は、その月に実際に使われた項目名をそのまま
// 列見出しにする（従来の紙の集金表と同じ見た目にするため）。
// 治療費・治療費補助や各項目の補助は別列にし、補助はマイナス表示にする。
// -------------------------------------------------------------

const PAGE_W = 1123 // A4横 幅 (96dpi)
const PAGE_H = 794 // A4横 高さ (96dpi)
const ROWS_PER_PAGE = 22 // 1ページあたりの行数（小計・合計行含む）

// 固定列（大会・合宿・その他費用の動的列はこの後ろに挿入する）
const FIXED_COLS_HEAD = [
  { key: 'name', label: '氏名', align: 'left' },
  { key: 'group', label: 'グループ', align: 'left' },
  { key: 'rank', label: 'ランク', align: 'left' },
  { key: 'clubFee', label: '部費', align: 'right', money: true, sum: true },
  { key: 'breakfastCount', label: '朝', align: 'right', sum: true, count: true },
  { key: 'dinnerCount', label: '夕', align: 'right', sum: true, count: true },
  { key: 'mealFee', label: '食費', align: 'right', money: true, sum: true },
]
const FIXED_COLS_TAIL = [
  { key: 'medicalActual', label: '治療費', align: 'right', money: true, sum: true },
  {
    key: 'medicalSubsidy',
    label: '治療費補助',
    align: 'right',
    money: true,
    sum: true,
    isSubsidy: true,
  },
  {
    key: 'motivation',
    label: 'モチベーション費補助',
    align: 'right',
    money: true,
    sum: true,
    isSubsidy: true,
  },
  { key: 'sagawa', label: '配達代', align: 'right', money: true, sum: true },
  {
    key: 'total',
    label: '合計',
    align: 'right',
    money: true,
    sum: true,
    accent: true,
  },
]

function cellRawValue(row, col) {
  return col.dynamic ? itemColumnValue(row, col) : row[col.key]
}

function sumRows(rows, cols) {
  const acc = {}
  for (const col of cols) {
    if (!col.sum) continue
    acc[col.key] = rows.reduce((a, r) => {
      const v = cellRawValue(r, col)
      return a + (v == null ? 0 : Number(v) || 0)
    }, 0)
  }
  return acc
}

// 表示アイテム列（メンバー行 + グループ小計 + 全体合計）を生成
function buildItems(rows, groups, cols) {
  const items = []
  for (const group of groups) {
    const groupRows = rows.filter((r) => r.group === group)
    if (groupRows.length === 0) continue
    for (const r of groupRows) items.push({ type: 'member', row: r })
    items.push({
      type: 'subtotal',
      label: `${group} 小計（${groupRows.length}名）`,
      sums: sumRows(groupRows, cols),
    })
  }
  items.push({
    type: 'grand',
    label: `全体合計（${rows.length}名）`,
    sums: sumRows(rows, cols),
  })
  return items
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function SummarySheet({ rows, groups, year, month, config }) {
  const dynamicCols = buildItemColumns(rows)
  const cols = [...FIXED_COLS_HEAD, ...dynamicCols, ...FIXED_COLS_TAIL]
  const items = buildItems(rows, groups, cols)
  const pages = chunk(items, ROWS_PER_PAGE)
  if (pages.length === 0) return null

  const fontSize = cols.length > 22 ? 7 : cols.length > 17 ? 8 : 9

  return (
    <>
      {pages.map((pageItems, pi) => (
        <div key={pi} data-pdf-page>
          <Page
            items={pageItems}
            cols={cols}
            fontSize={fontSize}
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

function Page({ items, cols, fontSize, pageIndex, pageCount, year, month, config }) {
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

      {/* テーブル（大会・合宿・その他費用はその月に実際に使われた項目名がそのまま列見出しになる） */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize,
          tableLayout: 'auto',
        }}
      >
        <thead>
          <tr style={{ background: '#eff6ff' }}>
            {cols.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align,
                  padding: '5px 4px',
                  borderBottom: '1.5px solid #bfdbfe',
                  fontSize: '1em',
                  color: '#1e40af',
                  fontWeight: 700,
                  wordBreak: 'break-all',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            if (it.type === 'member')
              return (
                <MemberRow key={idx} row={it.row} cols={cols} zebra={idx % 2 === 1} />
              )
            return (
              <TotalRow
                key={idx}
                label={it.label}
                sums={it.sums}
                cols={cols}
                grand={it.type === 'grand'}
              />
            )
          })}
        </tbody>
      </table>

      {pageIndex === pageCount - 1 && (
        <div style={{ marginTop: 10, fontSize: 8.5, color: '#94a3b8' }}>
          ※
          大会・合宿・その他費用は今月実際に使われた項目名がそのまま列になっています。「○○補助」はチームが負担した補助額（マイナス表示）です。治療費補助・モチベーション費補助も同様にマイナス表示です。
        </div>
      )}
    </div>
  )
}

function MemberRow({ row, cols, zebra }) {
  return (
    <tr style={{ background: zebra ? '#f8fafc' : '#ffffff' }}>
      {cols.map((c) => {
        const raw = cellRawValue(row, c)
        let content
        if (raw == null || raw === 0) content = '—'
        else if (c.money) content = c.isSubsidy ? `-${formatYen(raw)}` : formatYen(raw)
        else if (c.count) content = formatNumber(raw)
        else content = raw
        return (
          <td
            key={c.key}
            style={{
              textAlign: c.align,
              padding: '3px 4px',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: c.accent ? 700 : c.key === 'name' ? 600 : 400,
              color: c.isSubsidy && raw ? '#dc2626' : c.accent ? '#2563eb' : '#0f172a',
              fontVariantNumeric: 'tabular-nums',
              wordBreak: 'break-all',
              verticalAlign: 'top',
            }}
          >
            {content}
          </td>
        )
      })}
    </tr>
  )
}

function TotalRow({ label, sums, cols, grand }) {
  return (
    <tr style={{ background: grand ? '#dbeafe' : '#f1f5f9' }}>
      {cols.map((c, i) => {
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
        if (val != null && val !== 0) {
          if (c.money) content = c.isSubsidy ? `-${formatYen(val)}` : formatYen(val)
          else if (c.sum) content = formatNumber(val)
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
              color: c.isSubsidy && val
                ? '#dc2626'
                : c.accent
                ? '#1e40af'
                : grand
                ? '#1e3a8a'
                : '#334155',
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
