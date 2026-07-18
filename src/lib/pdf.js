import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

// -------------------------------------------------------------
// 集金用PDF出力
// -------------------------------------------------------------
// jsPDF は日本語フォントを内蔵しないため、html2canvas で
// ブラウザ描画（＝日本語フォント使用）した DOM を画像化して
// PDF に貼り付ける方式を採用しています。
// グループごとに1ページ（A4縦）で改ページします。
// -------------------------------------------------------------

// A4 (mm)
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

// 指定した「グループページ要素の配列」から複数ページPDFを生成
export async function generateGroupPdf(pageElements, fileName) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  for (let i = 0; i < pageElements.length; i++) {
    const el = pageElements[i]
    // 高解像度で描画
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
    const imgData = canvas.toDataURL('image/png')

    // アスペクト比を保ったまま A4 幅にフィット
    const imgWidth = A4_WIDTH_MM
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const renderHeight = Math.min(imgHeight, A4_HEIGHT_MM)

    if (i > 0) pdf.addPage()
    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      imgWidth,
      renderHeight,
      undefined,
      'FAST'
    )
  }

  pdf.save(fileName)
}
