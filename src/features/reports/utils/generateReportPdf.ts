import { jsPDF } from 'jspdf'
import { autoTable, type RowInput } from 'jspdf-autotable'
import { describeDaysLeft } from './exportReportWorkbook'
import { reportPeriodLabels, type LoansReport } from './reportMetrics'

type RGB = [number, number, number]

const ink: RGB = [17, 17, 17]
const inkSecondary: RGB = [85, 85, 85]
const inkMuted: RGB = [130, 130, 130]
const rule: RGB = [229, 229, 226]
const panel: RGB = [250, 250, 248]
const headFill: RGB = [243, 243, 240]
const axisYellow: RGB = [255, 218, 0]
const critical: RGB = [180, 35, 24]
const good: RGB = [12, 120, 12]
const series1: RGB = [42, 120, 214]
const series2: RGB = [235, 104, 52]

const PAGE_MARGIN = 40

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const shortDate = new Intl.DateTimeFormat('en-GB')

async function loadImageAsDataUrl(src: string) {
  const response = await fetch(src)
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Unable to read image.'))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function lastTableY(doc: jsPDF, fallback: number) {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback
}

const tableStyles = {
  theme: 'plain' as const,
  styles: {
    font: 'helvetica',
    fontSize: 8,
    cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
    textColor: inkSecondary,
    lineColor: rule,
    lineWidth: { bottom: 0.5 },
    overflow: 'linebreak' as const,
  },
  headStyles: {
    fillColor: headFill,
    textColor: ink,
    fontStyle: 'bold' as const,
    lineWidth: 0,
  },
}

export async function generateReportPdf(report: LoansReport, owner: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PAGE_MARGIN * 2
  const ownerLabel = owner === 'All' ? 'All internal owners' : owner
  const periodLabel = reportPeriodLabels[report.period]

  // ------------------------------------------------------------- header
  try {
    const logo = await loadImageAsDataUrl('/branding/axis-logo-dark.png')
    const props = doc.getImageProperties(logo)
    const logoWidth = 110
    doc.addImage(logo, 'PNG', PAGE_MARGIN, 34, logoWidth, (props.height * logoWidth) / props.width)
  } catch {
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...ink)
    doc.text('AXIS', PAGE_MARGIN, 58)
  }

  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...inkMuted)
  doc.text('Demo Equipment Loans', pageWidth - PAGE_MARGIN, 42, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...ink)
  doc.text('Loan Report', pageWidth - PAGE_MARGIN, 63, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...inkMuted)
  doc.text(`${periodLabel} · ${ownerLabel} · ${shortDate.format(report.generatedAt)}`, pageWidth - PAGE_MARGIN, 78, {
    align: 'right',
  })

  doc.setDrawColor(...axisYellow).setLineWidth(2)
  doc.line(PAGE_MARGIN, 94, pageWidth - PAGE_MARGIN, 94)

  let y = 118

  function sectionTitle(title: string, subtitle?: string) {
    if (y > pageHeight - 140) {
      doc.addPage()
      y = 56
    }
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...ink)
    doc.text(title, PAGE_MARGIN, y)
    if (subtitle) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...inkMuted)
      doc.text(subtitle, PAGE_MARGIN, y + 12)
      y += 22
    } else {
      y += 10
    }
  }

  // ------------------------------------------------------------- KPI grid
  const { snapshot, activity, fleet, value } = report
  const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)
  const days = (value: number | null) => (value === null ? '—' : `${Math.round(value)} days`)

  function kpiRow(title: string, items: Array<{ label: string; value: string; note?: string; color?: RGB }>) {
    sectionTitle(title)
    const gap = 10
    const boxWidth = (contentWidth - gap * (items.length - 1)) / items.length
    const boxHeight = 62

    items.forEach((item, index) => {
      const x = PAGE_MARGIN + index * (boxWidth + gap)
      doc.setFillColor(...panel).setDrawColor(...rule).setLineWidth(0.5)
      doc.roundedRect(x, y, boxWidth, boxHeight, 6, 6, 'FD')
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...inkMuted)
      doc.text(item.label, x + 10, y + 16)
      doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...(item.color ?? ink))
      doc.text(item.value, x + 10, y + 40)
      if (item.note) {
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...inkMuted)
        doc.text(item.note, x + 10, y + 53, { maxWidth: boxWidth - 16 })
      }
    })

    y += boxHeight + 22
  }

  kpiRow('Today', [
    { label: 'Open loans', value: `${snapshot.openLoans}`, note: `${snapshot.clientsWithEquipment} clients` },
    { label: 'On time', value: `${snapshot.onTimeLoans}`, note: `${snapshot.dueSoonLoans} due in 7 days`, color: good },
    {
      label: 'Overdue',
      value: `${snapshot.overdueLoans}`,
      note: snapshot.openLoans ? `${pct(snapshot.overdueLoans / snapshot.openLoans)} of open loans` : undefined,
      color: snapshot.overdueLoans > 0 ? critical : ink,
    },
    {
      label: 'Units in the field',
      value: `${snapshot.unitsOut}`,
      note: snapshot.pricedUnitsOut ? `${usd.format(snapshot.msrpOut)} MSRP` : undefined,
    },
  ])

  kpiRow(periodLabel, [
    { label: 'Loans opened', value: `${activity.loansOpened}`, note: `${activity.unitsLent} units` },
    { label: 'Returned on time', value: pct(activity.onTimeRate), note: `${activity.closedOnTime} of ${activity.closedOnTime + activity.closedLate} closed` },
    { label: 'Avg. loan length', value: days(activity.avgDurationDays), note: 'Checkout to full return' },
    { label: 'Fleet utilization', value: pct(fleet.utilization), note: `${fleet.onLoan} of ${fleet.total - fleet.damaged} units` },
  ])

  const usdCompact = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  })

  kpiRow('Inventory value · Axis MSRP, active products', [
    { label: 'In the warehouse', value: usdCompact.format(value.warehouse.msrp), note: `${value.warehouse.units} units` },
    {
      label: 'On loan',
      value: usdCompact.format(value.onLoan.msrp),
      note: value.onLoanShare === null ? `${value.onLoan.units} units` : `${value.onLoan.units} units · ${pct(value.onLoanShare)} of lendable`,
    },
    {
      label: 'Overdue value',
      value: usdCompact.format(value.overdue.msrp),
      note: `${value.overdue.units} units`,
      color: value.overdue.msrp > 0 ? critical : ink,
    },
    {
      label: 'Discontinued',
      value: `${value.discontinued.units} units`,
      note:
        value.discontinued.unitsWithLastKnownPrice > 0
          ? `${usdCompact.format(value.discontinued.lastKnownMsrp)} last known`
          : 'Not in current pricelist',
    },
  ])

  // ------------------------------------------------------------- tables
  function table(head: string[], body: RowInput[], columnStyles: Record<number, object> = {}) {
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, top: 50 },
      head: [head],
      body,
      columnStyles,
    })
    y = lastTableY(doc, y) + 26
  }

  const overdue = report.openLoanRows.filter((row) => (row.daysLeft ?? 0) < 0)
  sectionTitle(
    `Needs attention · ${overdue.length} overdue loan${overdue.length === 1 ? '' : 's'}`,
    'Past the expected return date, most overdue first.',
  )
  if (overdue.length === 0) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...inkSecondary)
    doc.text('Nothing overdue.', PAGE_MARGIN, y + 4)
    y += 26
  } else {
    table(
      ['Loan', 'Client', 'Contact', 'Owner', 'Overdue', 'Units'],
      overdue.slice(0, 20).map((row) => [
        row.code,
        row.company,
        [row.contactName, row.contactPhone].filter(Boolean).join('\n') || '—',
        row.responsible,
        { content: `${-(row.daysLeft ?? 0)} days`, styles: { textColor: critical, fontStyle: 'bold' } },
        `${row.unitsOut}`,
      ]),
      { 0: { cellWidth: 62 }, 4: { cellWidth: 52 }, 5: { cellWidth: 34, halign: 'right' } },
    )
  }

  const comingDue = report.openLoanRows.filter(
    (row) => row.daysLeft !== null && row.daysLeft >= 0 && row.daysLeft <= 14,
  )
  if (comingDue.length > 0) {
    sectionTitle('Coming due · next 14 days', 'Worth a reminder before they become overdue.')
    table(
      ['Loan', 'Client', 'Owner', 'Expected return', 'Status', 'Units'],
      comingDue.slice(0, 20).map((row) => [
        row.code,
        row.company,
        row.responsible,
        row.expectedReturnDate ? shortDate.format(row.expectedReturnDate) : '—',
        describeDaysLeft(row.daysLeft),
        `${row.unitsOut}`,
      ]),
      { 0: { cellWidth: 62 }, 5: { cellWidth: 34, halign: 'right' } },
    )
  }

  // ------------------------------------------------------------- rankings (side by side)
  sectionTitle(`Rankings · ${periodLabel}`, 'By loans opened in the period.')
  const columnWidth = (contentWidth - 16) / 2
  const startY = y
  const realRows = <T extends { label: string }>(rows: T[]) =>
    rows.filter((row) => row.label !== 'Not registered').slice(0, 10)

  autoTable(doc, {
    ...tableStyles,
    startY,
    margin: { left: PAGE_MARGIN, top: 50 },
    tableWidth: columnWidth,
    head: [['Top clients', 'Loans', 'Units']],
    body: realRows(report.byClient).map((row) => [row.label, `${row.loans}`, `${row.units}`]),
    columnStyles: { 1: { halign: 'right', cellWidth: 36 }, 2: { halign: 'right', cellWidth: 36 } },
  })
  const leftEnd = lastTableY(doc, startY)

  autoTable(doc, {
    ...tableStyles,
    startY,
    margin: { left: PAGE_MARGIN + columnWidth + 16, top: 50 },
    tableWidth: columnWidth,
    head: [['Who lends the most', 'Loans', 'Units']],
    body: realRows(report.byOwner).map((row) => [row.label, `${row.loans}`, `${row.units}`]),
    columnStyles: { 1: { halign: 'right', cellWidth: 36 }, 2: { halign: 'right', cellWidth: 36 } },
  })
  y = Math.max(leftEnd, lastTableY(doc, startY)) + 26

  if (value.byClient.length > 0) {
    sectionTitle('Value held by client', 'MSRP of equipment each client has right now (active products).')
    table(
      ['Client', 'Units', 'MSRP'],
      value.byClient.slice(0, 10).map((row) => [row.label, `${row.units}`, usd.format(row.msrp)]),
      { 1: { halign: 'right', cellWidth: 50 }, 2: { halign: 'right', cellWidth: 80 } },
    )
  }

  sectionTitle('Most requested models')
  table(
    ['Model', 'Units lent', 'In loans'],
    realRows(report.byModel).map((row) => [row.label, `${row.units}`, `${row.loans}`]),
    { 1: { halign: 'right', cellWidth: 60 }, 2: { halign: 'right', cellWidth: 60 } },
  )

  // ------------------------------------------------------------- monthly trend chart
  const chartHeight = 130
  if (y > pageHeight - (chartHeight + 90)) {
    doc.addPage()
    y = 56
  }
  sectionTitle('Loans opened vs. closed · last 12 months')

  const legendY = y + 2
  ;[
    { label: 'Opened', color: series1 },
    { label: 'Closed', color: series2 },
  ].forEach((entry, index) => {
    const x = PAGE_MARGIN + index * 70
    doc.setFillColor(...entry.color).rect(x, legendY - 6, 8, 8, 'F')
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...inkSecondary)
    doc.text(entry.label, x + 12, legendY + 1)
  })
  y += 16

  const trend = report.monthlyTrend
  const maxValue = Math.max(1, ...trend.flatMap((m) => [m.opened, m.closed]))
  const plotTop = y
  const plotBottom = y + chartHeight - 18
  const band = contentWidth / trend.length
  const barWidth = Math.min(10, band / 3)

  doc.setDrawColor(...rule).setLineWidth(0.5)
  doc.line(PAGE_MARGIN, plotBottom, pageWidth - PAGE_MARGIN, plotBottom)

  trend.forEach((month, index) => {
    const center = PAGE_MARGIN + band * index + band / 2
    ;[
      { value: month.opened, color: series1, x: center - barWidth - 1 },
      { value: month.closed, color: series2, x: center + 1 },
    ].forEach((bar) => {
      if (bar.value <= 0) return
      const height = ((plotBottom - plotTop - 12) * bar.value) / maxValue
      doc.setFillColor(...bar.color).rect(bar.x, plotBottom - height, barWidth, height, 'F')
      doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...inkSecondary)
      doc.text(`${bar.value}`, bar.x + barWidth / 2, plotBottom - height - 3, { align: 'center' })
    })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...inkMuted)
    doc.text(month.label, center, plotBottom + 11, { align: 'center' })
  })
  y = plotBottom + 30

  // ------------------------------------------------------------- footer
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...inkMuted)
    doc.text(`Loan Report · ${periodLabel} · ${ownerLabel}`, PAGE_MARGIN, pageHeight - 24)
    doc.text(`Page ${page} of ${pages}`, pageWidth - PAGE_MARGIN, pageHeight - 24, { align: 'right' })
  }

  doc.save(`Loans-Report_${report.generatedAt.toISOString().slice(0, 10)}.pdf`)
}
