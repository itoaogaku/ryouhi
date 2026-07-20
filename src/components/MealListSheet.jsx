import React from 'react'
import { formatYearMonthJa, weekdayOf, WEEKDAY_JA } from '../lib/utils.js'

// -------------------------------------------------------------
// 食堂掲示用 月間食数一覧（A4横・複数ページ）
// -------------------------------------------------------------
// 名前(縦軸) × 日付(横軸) の一覧表。寮生が見て分かりやすいよう、
// 各セルは「○=食べる（緑の輪郭線）／□=食べない」の大きめのマークで
// 表現し、印刷インクを抑えつつ判読しやすく、変更があれば手書きで
// 印をつけやすい形にする。
// -------------------------------------------------------------

const PAGE_W = 1123 // A4横 幅 (96dpi)
const PAGE_H = 794 // A4横 高さ (96dpi)
const ROWS_PER_PAGE = 22 // 1ページあたりの人数
const EAT_COLOR = '#3E8A88' // 「食べる」マークの色

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function MealListSheet({ dorm, year, month, days, rows }) {
  const pages = chunk(rows, ROWS_PER_PAGE)
  if (pages.length === 0) return null

  return (
    <>
      {pages.map((pageRows, pi) => (
        <div key={pi} data-pdf-page>
          <Page
            dorm={dorm}
            year={year}
            month={month}
            days={days}
            rows={pageRows}
            pageIndex={pi}
            pageCount={pages.length}
          />
        </div>
      ))}
    </>
  )
}

function Page({ dorm, year, month, days, rows, pageIndex, pageCount }) {
  const today = new Date()
  const generatedAt = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`

  return (
    <div
      style={{
        width: PAGE_W,
        minHeight: PAGE_H,
        padding: '22px 24px',
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
          borderBottom: '3px solid #2563eb',
          paddingBottom: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 24, fontWeight: 700 }}>{dorm}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>
            食数一覧表
          </span>
          <span style={{ fontSize: 15, color: '#475569' }}>
            {formatYearMonthJa(year, month)}分
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8' }}>
          作成日: {generatedAt} ｜ Page {pageIndex + 1} / {pageCount}
        </div>
      </div>

      {/* 凡例・注意書き */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'transparent',
                border: `2px solid ${EAT_COLOR}`,
              }}
            />
            食べる
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                background: '#ffffff',
                border: '1px solid #94a3b8',
              }}
            />
            食べない
          </span>
          <span style={{ color: '#64748b' }}>
            各日 上段=朝食／下段=夕食
          </span>
        </div>
        <div
          style={{
            fontWeight: 700,
            color: '#b45309',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 4,
            padding: '4px 10px',
          }}
        >
          変更がある場合は、該当のマスに✕やメモを書き込んで食堂スタッフへお知らせください
        </div>
      </div>

      {/* テーブル */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: 130,
                textAlign: 'left',
                padding: '4px 8px',
                borderBottom: '2px solid #1e40af',
                borderRight: '2px solid #1e40af',
                fontSize: 12,
                color: '#1e40af',
                background: '#eff6ff',
              }}
            >
              氏名
            </th>
            {days.map((d) => {
              const dow = weekdayOf(year, month, d)
              const weekend = dow === 0 || dow === 6
              return (
                <th
                  key={d}
                  style={{
                    padding: '3px 0',
                    borderBottom: '2px solid #1e40af',
                    fontSize: 9.5,
                    fontWeight: 700,
                    background: weekend
                      ? dow === 0
                        ? '#fef2f2'
                        : '#eff6ff'
                      : '#f8fafc',
                    color: weekend
                      ? dow === 0
                        ? '#dc2626'
                        : '#2563eb'
                      : '#334155',
                  }}
                >
                  <div>{d}</div>
                  <div style={{ fontSize: 8 }}>{WEEKDAY_JA[dow]}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.memberId} style={{ background: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}>
              <td
                style={{
                  padding: '3px 8px',
                  borderBottom: '1px solid #e2e8f0',
                  borderRight: '2px solid #1e40af',
                  fontSize: 12.5,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {r.name}
                {r.isCrossDorm && (
                  <span style={{ fontSize: 8, fontWeight: 400, color: '#b45309', marginLeft: 4 }}>
                    （寮間移動）
                  </span>
                )}
                {r.isGuest && (
                  <span style={{ fontSize: 8, fontWeight: 400, color: '#4338ca', marginLeft: 4 }}>
                    （{r.category}）
                  </span>
                )}
              </td>
              {r.cells.map((c) => (
                <td
                  key={c.date}
                  style={{
                    padding: '3px 0',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 13,
                        height: 13,
                        borderRadius: c.breakfast ? '50%' : 0,
                        background: 'transparent',
                        border: c.breakfast
                          ? `2px solid ${EAT_COLOR}`
                          : '1px solid #64748b',
                      }}
                    />
                    <span
                      style={{
                        display: 'inline-block',
                        width: 13,
                        height: 13,
                        borderRadius: c.dinner ? '50%' : 0,
                        background: 'transparent',
                        border: c.dinner
                          ? `2px solid ${EAT_COLOR}`
                          : '1px solid #64748b',
                      }}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {pageIndex === pageCount - 1 && (
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#94a3b8',
          }}
        >
          <span>
            確認者サイン：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿
          </span>
          <span>反映済みチェック：☐</span>
        </div>
      )}
    </div>
  )
}
