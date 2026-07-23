import React from 'react'
import { formatYen, formatYearMonthJa } from '../lib/utils.js'
import { MEAL_TRACKING_DORMS } from '../lib/constants.js'
import { mealPriceFor, buildItemColumns, itemColumnValue } from '../lib/calc.js'

// -------------------------------------------------------------
// 集金用A4シート（1グループ = 1ページ）
// html2canvas で画像化するため、インラインスタイル中心で
// 固定幅（A4 = 794px @ 96dpi）で描画します。
//
// 大会・合宿・その他費用は、その月にこのグループで実際に使われた
// 項目名をそのまま列見出しにする（従来の紙の集金表と同じ見た目にして
// 寮生が戸惑わないようにするため）。治療費・治療費補助や各項目の補助は
// 別列に分け、補助はマイナス表示にする。
// -------------------------------------------------------------

const PAGE_WIDTH = 794 // A4 幅 (96dpi)

export default function CollectionSheet({ group, rows, year, month, config }) {
  const totalSum = rows.reduce((a, r) => a + r.total, 0)

  // 大会・合宿・その他費用はその月に実際に使われた項目名がそのまま列見出しになる
  const dynamicCols = buildItemColumns(rows)

  function cellValue(r, col) {
    const v = itemColumnValue(r, col)
    if (v === null || v === 0) return '—'
    return col.isSubsidy ? `-${formatYen(v)}` : formatYen(v)
  }

  // 列が多い月でも収まるよう、内容量に応じて自動幅にする
  const totalCols = 5 + dynamicCols.length + 3 // No/氏名/ランク/部費/食費 + 動的列 + 治療費/治療費補助/佐川 + 合計/領収(概算)

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

      {/* テーブル（大会・合宿・その他費用はその月に実際に使われた項目名がそのまま列見出しになる） */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: totalCols > 14 ? 8 : totalCols > 11 ? 9 : 10.5,
          tableLayout: 'auto',
        }}
      >
        <thead>
          <tr style={{ background: '#eff6ff' }}>
            <Th align="center">No</Th>
            <Th>氏名</Th>
            <Th>ランク</Th>
            <Th align="right">部費</Th>
            <Th align="right">食費</Th>
            {dynamicCols.map((col) => (
              <Th key={col.key} align="right">
                {col.label}
              </Th>
            ))}
            <Th align="right">治療費</Th>
            <Th align="right">治療費補助</Th>
            <Th align="right">佐川</Th>
            <Th align="right">合計</Th>
            <Th align="center">領収</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
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
              {dynamicCols.map((col) => (
                <Td key={col.key} align="right" danger={col.isSubsidy}>
                  {cellValue(r, col)}
                </Td>
              ))}
              <Td align="right">{r.medicalActual ? formatYen(r.medicalActual) : '—'}</Td>
              <Td align="right" danger={r.medicalSubsidy > 0}>
                {r.medicalSubsidy > 0 ? `-${formatYen(r.medicalSubsidy)}` : '—'}
              </Td>
              <Td align="right">{r.sagawa ? formatYen(r.sagawa) : '—'}</Td>
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
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#dbeafe' }}>
            <Td align="right" bold colSpan={4 + dynamicCols.length + 3}>
              グループ合計
            </Td>
            <Td align="right" bold accent>
              {formatYen(totalSum)}
            </Td>
            <Td />
          </tr>
        </tfoot>
      </table>

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
        大会・合宿・その他費用は今月実際に使われた項目名がそのまま列になっています。「○○補助」はチームが負担した補助額（マイナス表示）です。治療費補助も同様にマイナス表示です。領収欄は集金確認用のチェック欄です。
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '6px 4px',
        borderBottom: '2px solid #bfdbfe',
        fontSize: '1em',
        color: '#1e40af',
        fontWeight: 700,
        wordBreak: 'break-all',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', bold, muted, accent, danger, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align,
        padding: '5px 5px',
        borderBottom: '1px solid #e2e8f0',
        fontWeight: bold ? 700 : 400,
        color: danger
          ? '#dc2626'
          : accent
          ? '#2563eb'
          : muted
          ? '#94a3b8'
          : '#0f172a',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}
