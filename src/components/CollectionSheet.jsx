import React from 'react'
import { formatYen, formatYearMonthJa } from '../lib/utils.js'
import { MEAL_TRACKING_DORMS } from '../lib/constants.js'
import { mealPriceFor } from '../lib/calc.js'

// -------------------------------------------------------------
// 集金用A4シート（1グループ = 1ページ）
// html2canvas で画像化するため、インラインスタイル中心で
// 固定幅（A4 = 794px @ 96dpi）で描画します。
// -------------------------------------------------------------

const PAGE_WIDTH = 794 // A4 幅 (96dpi)

export default function CollectionSheet({ group, rows, year, month, config }) {
  const totalSum = rows.reduce((a, r) => a + r.total, 0)

  return (
    <div
      style={{
        width: PAGE_WIDTH,
        minHeight: 1123, // A4 高さ (96dpi)
        padding: '32px 28px',
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
          paddingBottom: 10,
          marginBottom: 6,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#64748b', letterSpacing: 1 }}>
            寮費・食費 集金一覧表
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>
            {group}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {formatYearMonthJa(year, month)}分
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            対象人数: {rows.length}名
          </div>
        </div>
      </div>

      {/* 単価注記（食費は実際に食べた寮の単価。寮ごとに異なる場合がある） */}
      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 10 }}>
        部費 {formatYen(config.base_club_fee)}
        {MEAL_TRACKING_DORMS.map((dorm) => (
          <span key={dorm}>
            ／{dorm}: 朝食 {formatYen(mealPriceFor(config, dorm, 'breakfast'))}
            ・夕食 {formatYen(mealPriceFor(config, dorm, 'dinner'))}
          </span>
        ))}
      </div>

      {/* テーブル */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 10.5,
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr style={{ background: '#eff6ff' }}>
            <Th w="4%" align="center">No</Th>
            <Th w="16%">氏名</Th>
            <Th w="9%">ランク</Th>
            <Th w="9%" align="right">部費</Th>
            <Th w="10%" align="right">食費</Th>
            <Th w="9%" align="right">大会費</Th>
            <Th w="9%" align="right">合宿費</Th>
            <Th w="9%" align="right">治療費</Th>
            <Th w="8%" align="right">その他</Th>
            <Th w="11%" align="right">合計</Th>
            <Th w="6%" align="center">領収</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const other = r.sagawa + r.other
            return (
              <tr
                key={r.memberId}
                style={{ background: i % 2 === 1 ? '#f8fafc' : '#ffffff' }}
              >
                <Td align="center" muted>{i + 1}</Td>
                <Td bold>{r.name}</Td>
                <Td muted>{r.rank}</Td>
                <Td align="right">{formatYen(r.clubFee)}</Td>
                <Td align="right">
                  {formatYen(r.mealFee)}
                  <div style={{ fontSize: 8, color: '#94a3b8' }}>
                    朝{r.breakfastCount}・夕{r.dinnerCount}
                  </div>
                </Td>
                <Td align="right">{r.tournament ? formatYen(r.tournament) : '—'}</Td>
                <Td align="right">{r.camp ? formatYen(r.camp) : '—'}</Td>
                <Td align="right">{r.medical ? formatYen(r.medical) : '—'}</Td>
                <Td align="right">{other ? formatYen(other) : '—'}</Td>
                <Td align="right" bold accent>{formatYen(r.total)}</Td>
                <Td align="center">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      border: '1.5px solid #94a3b8',
                      borderRadius: 3,
                    }}
                  />
                </Td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#dbeafe' }}>
            <Td align="right" bold colSpan={9}>
              グループ合計
            </Td>
            <Td align="right" bold accent>
              {formatYen(totalSum)}
            </Td>
            <Td />
          </tr>
        </tfoot>
      </table>

      {/* 大会・合宿 明細（対象者のみ） */}
      <BreakdownSection rows={rows} />

      {/* フッター（集金係記入欄） */}
      <div
        style={{
          marginTop: 20,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#475569',
        }}
      >
        <div>
          集金担当者: ______________________
        </div>
        <div>
          集金完了日: ______ 年 ______ 月 ______ 日
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 9, color: '#94a3b8' }}>
        ※
        大会費は「参加費 − 補助 = 請求額」、合宿費は「1泊単価 ×
        泊数」、治療費は「実費 − チーム補助金」です。「その他」列は佐川代・その他費用（自由項目）の合計です。領収欄は集金確認用のチェック欄です。
      </div>
    </div>
  )
}

// 大会・合宿・その他費用の明細（名前・金額つき）。対象者がいなければ非表示。
function BreakdownSection({ rows }) {
  const withTournament = rows.filter((r) => r.tournamentRows.length > 0)
  const withCamp = rows.filter((r) => r.campRows.length > 0)
  const withOther = rows.filter((r) => r.otherRows.length > 0)
  if (
    withTournament.length === 0 &&
    withCamp.length === 0 &&
    withOther.length === 0
  )
    return null

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#1e40af',
          borderBottom: '1.5px solid #bfdbfe',
          paddingBottom: 3,
          marginBottom: 6,
        }}
      >
        大会・合宿・その他費用 明細
      </div>

      {withTournament.length > 0 && (
        <div
          style={{
            marginBottom: withCamp.length > 0 || withOther.length > 0 ? 8 : 0,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 3 }}>
            ● 大会（参加費 − 補助 = 請求額）
          </div>
          {withTournament.map((r) => (
            <div
              key={r.memberId}
              style={{
                fontSize: 9.5,
                color: '#334155',
                padding: '2px 0',
                borderBottom: '1px dotted #e2e8f0',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 700 }}>{r.name}</span>：{' '}
              {r.tournamentRows.map((t, i) => (
                <span key={i}>
                  {i > 0 && '／ '}
                  {t.name} 参加{formatYen(t.fee)}・補助{formatYen(t.subsidy)}→
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>
                    請求{formatYen(t.net)}
                  </span>{' '}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {withCamp.length > 0 && (
        <div style={{ marginBottom: withOther.length > 0 ? 8 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#047857', marginBottom: 3 }}>
            ● 合宿（1泊単価 × 泊数 = 費用）
          </div>
          {withCamp.map((r) => (
            <div
              key={r.memberId}
              style={{
                fontSize: 9.5,
                color: '#334155',
                padding: '2px 0',
                borderBottom: '1px dotted #e2e8f0',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 700 }}>{r.name}</span>：{' '}
              {r.campRows.map((c, i) => (
                <span key={i}>
                  {i > 0 && '／ '}
                  {c.name} {formatYen(c.perNight)}×{c.nights}泊=
                  <span style={{ fontWeight: 700, color: '#047857' }}>
                    {formatYen(c.cost)}
                  </span>{' '}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {withOther.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0369a1', marginBottom: 3 }}>
            ● その他費用（自由項目、金額 − 補助 = 請求額）
          </div>
          {withOther.map((r) => (
            <div
              key={r.memberId}
              style={{
                fontSize: 9.5,
                color: '#334155',
                padding: '2px 0',
                borderBottom: '1px dotted #e2e8f0',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 700 }}>{r.name}</span>：{' '}
              {r.otherRows.map((o, i) => (
                <span key={i}>
                  {i > 0 && '／ '}
                  {o.name}{' '}
                  {o.subsidy > 0
                    ? `金額${formatYen(o.amount)}・補助${formatYen(o.subsidy)}→`
                    : ''}
                  <span style={{ fontWeight: 700, color: '#0369a1' }}>
                    {' '}
                    {formatYen(o.net)}
                  </span>{' '}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Th({ children, w, align = 'left' }) {
  return (
    <th
      style={{
        width: w,
        textAlign: align,
        padding: '7px 6px',
        borderBottom: '2px solid #bfdbfe',
        fontSize: 10,
        color: '#1e40af',
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', bold, muted, accent, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align,
        padding: '6px 6px',
        borderBottom: '1px solid #e2e8f0',
        fontWeight: bold ? 700 : 400,
        color: accent ? '#2563eb' : muted ? '#94a3b8' : '#0f172a',
        fontVariantNumeric: 'tabular-nums',
        wordBreak: 'break-all',
      }}
    >
      {children}
    </td>
  )
}
