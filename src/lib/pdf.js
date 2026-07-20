import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// -------------------------------------------------------------
// PDF出力（html2canvas + jsPDF）
// -------------------------------------------------------------
// jsPDF は日本語フォントを内蔵しないため、html2canvas で
// ブラウザ描画（＝日本語フォント使用）した DOM を画像化して
// PDF に貼り付ける方式を採用しています。
// 渡された「ページ要素の配列」を1要素=1ページとして出力します。
// -------------------------------------------------------------

// A4 (mm)
const A4 = {
  portrait: { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
}

// 汎用: ページ要素の配列から複数ページPDFを生成
export async function generatePdf(pageElements, fileName, options = {}) {
  const orientation = options.orientation || 'portrait'
  const size = A4[orientation]
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i]
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const imgData = canvas.toDataURL('image/png')

    // アスペクト比を保ったまま A4 幅にフィット
    const imgWidth = size.w
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const renderHeight = Math.min(imgHeight, size.h)

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, renderHeight, undefined, 'FAST')
  }

  pdf.save(fileName)
}

// グループ別 集金PDF（A4縦）
export async function generateGroupPdf(pageElements, fileName) {
  return generatePdf(pageElements, fileName, { orientation: 'portrait' })
}

// 全選手一覧PDF（A4横）
export async function generateSummaryPdf(pageElements, fileName) {
  return generatePdf(pageElements, fileName, { orientation: 'landscape' })
}

// 食堂掲示用 月間食数一覧PDF（A4横）
export async function generateMealListPdf(pageElements, fileName) {
  return generatePdf(pageElements, fileName, { orientation: 'landscape' })
}
