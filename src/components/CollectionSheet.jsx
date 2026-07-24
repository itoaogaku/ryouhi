import React from 'react'
import { formatYen, formatYearMonthJa } from '../lib/utils.js'
import { buildItemColumns, itemColumnValue } from '../lib/calc.js'

// -------------------------------------------------------------
// 集金用A4シート（1グループ = 1ページ）
// html2canvas で画像化するため、インラインスタイル中心で
// 固定幅（A4 = 794px @ 96dpi）で描画します。
//
// 印刷コストを抑えるため、色は黒・白・赤のみを使用（青などは使わない）。
// 従来の紙の集金表と同じく、全セルを黒枠で囲んだスプレッドシート風の
// 見た目にする。
//
// 大会・合宿・その他費用は、その月にこのグループで実際に使われた
// 項目名をそのまま列見出しにする。治療費・治療費補助や各項目の補助は
// 別列に分け、補助（マイナス額）は赤字で表示する。
// -------------------------------------------------------------

const PAGE_WIDTH = 794 // A4 幅 (96dpi)
const BORDER = '1px solid #000000'

export default function CollectionSheet({ group, rows, year, month }) {
  const totalSum = rows.reduce((a, r) => a + r.total, 0)

  // 大会・合宿・その他費用はその月に実際に使われた項目名がそのまま列見出しになる
  const dynamicCols = buildItemColumns(rows)

  function cellValue(r, col) {
    const v = itemColumnValue(r, col)
    if (v === null || v === 0) return '—'
    return col.isSubsidy ? `-${formatYen(v)}` : formatYen(v)
  }

  // 列が多い月でも収まるよう、内容量に応じて自動幅にする
  const totalCols = 5 + dynamicCols.length + 4 // No/氏名/ランク/部費/食費 + 動的列 + 治療費/治療費補助/モチベーション費補助/配達代 + 合計/領収(概算)

  return (
    <div
      style={{
        width: PAGE_WIDTH,
        minHeight: 1123, // A4 高さ (96dpi)
        padding: '32px 28px',
        boxSizing: 'border-box',
        background: '#ffffff',
        color: '#000000',
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
          borderBottom: '3px solid #000000',
          paddingBottom: 10,
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700 }}>{group}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {formatYearMonthJa(year, month)}分
        </div>
      </div>

      {/* テーブル（大会・合宿・その他費用はその月に実際に使われた項目名がそのまま列見出しになる） */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: totalCols > 14 ? 8 : totalCols > 11 ? 9 : 10.5,
          tableLayout: 'auto',
          border: BORDER,
        }}
      >
        <thead>
          <tr>
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
            <Th align="right">モチベーション費補助</Th>
            <Th align="right">配達代</Th>
            <Th align="right">合計</Th>
            <Th align="center">領収</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.memberId}>
              <Td align="center">{i + 1}</Td>
              <Td bold>{r.name}</Td>
              <Td>{r.rank}</Td>
              <Td align="right">{formatYen(r.clubFee)}</Td>
              <Td align="right">
                {formatYen(r.mealFee)}
                <div style={{ fontSize: 8, color: '#000000' }}>
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
              <Td align="right" danger={r.motivation > 0}>
                {r.motivation > 0 ? `-${formatYen(r.motivation)}` : '—'}
              </Td>
              <Td align="right">{r.sagawa ? formatYen(r.sagawa) : '—'}</Td>
              <Td align="right" bold>{formatYen(r.total)}</Td>
              <Td align="center">
                <span
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    border: '1.5px solid #000000',
                    borderRadius: 3,
                  }}
                />
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Td align="right" bold colSpan={4 + dynamicCols.length + 4}>
              グループ合計
            </Td>
            <Td align="right" bold>
              {formatYen(totalSum)}
            </Td>
            <Td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Th({ children, align = 'left' }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '6px 4px',
        border: BORDER,
        fontSize: '1em',
        color: '#ffffff',
        background: '#000000',
        fontWeight: 700,
        wordBreak: 'break-all',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', bold, danger, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align,
        padding: '5px 5px',
        border: BORDER,
        fontWeight: bold ? 700 : 400,
        color: danger ? '#cc0000' : '#000000',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  )
}
