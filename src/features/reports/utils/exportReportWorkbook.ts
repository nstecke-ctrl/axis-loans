import type { WorkSheet } from 'xlsx'
import {
  reportPeriodLabels,
  type LoansReport,
  type RankRow,
  type UnitRankRow,
} from './reportMetrics'

type Cell = string | number | Date | null
type ColumnFormat = 'text' | 'int' | 'usd' | 'date' | 'pct'

type Column = {
  header: string
  width: number
  format?: ColumnFormat
}

const numberFormats: Record<Exclude<ColumnFormat, 'text'>, string> = {
  int: '0',
  usd: '"US$" #,##0',
  date: 'dd/mm/yyyy',
  pct: '0%',
}

export function describeDaysLeft(daysLeft: number | null) {
  if (daysLeft === null) return 'No return date'
  if (daysLeft < 0) return `Overdue · ${-daysLeft} day${daysLeft === -1 ? '' : 's'}`
  if (daysLeft === 0) return 'Due today'
  if (daysLeft <= 7) return `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
  return `On track · ${daysLeft} days left`
}

function formatGeneratedAt(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

export async function exportReportWorkbook(report: LoansReport, owner: string) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  const ownerLabel = owner === 'All' ? 'All internal owners' : owner
  const scopeLine = `${reportPeriodLabels[report.period]} · ${ownerLabel} · Generated ${formatGeneratedAt(report.generatedAt)}`

  function applyFormats(sheet: WorkSheet, columns: Column[], firstDataRow: number, rowCount: number) {
    columns.forEach((column, columnIndex) => {
      if (!column.format || column.format === 'text') return
      for (let row = firstDataRow; row < firstDataRow + rowCount; row += 1) {
        const cell = sheet[XLSX.utils.encode_cell({ r: row, c: columnIndex })]
        if (cell && (cell.t === 'n' || cell.t === 'd')) {
          cell.z = numberFormats[column.format]
        }
      }
    })
  }

  /** Title, subtitle, blank line, then a filterable table. */
  function tableSheet(name: string, title: string, description: string, columns: Column[], rows: Cell[][]) {
    const headerRow = 3
    const body = rows.length > 0 ? rows : [[`Nothing to show for ${ownerLabel.toLowerCase()} in this view.`]]
    const sheet = XLSX.utils.aoa_to_sheet(
      [[title], [`${description}  —  ${scopeLine}`], [], columns.map((c) => c.header), ...body],
      { cellDates: true },
    )

    sheet['!cols'] = columns.map((column) => ({ wch: column.width }))

    if (rows.length > 0) {
      sheet['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: headerRow, c: 0 },
          e: { r: headerRow + rows.length, c: columns.length - 1 },
        }),
      }
      applyFormats(sheet, columns, headerRow + 1, rows.length)
    }

    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }

  // ---------------------------------------------------------------- Summary
  const { snapshot, fleet, activity, value } = report
  const percentOrDash = (value: number | null) => (value === null ? '—' : value)
  const daysOrDash = (value: number | null) => (value === null ? '—' : Math.round(value))

  const summaryRows: Cell[][] = [
    ['TODAY — status of loans currently open', null, null],
    ['Open loans', snapshot.openLoans, 'Loans with equipment still outside the warehouse.'],
    ['On time', snapshot.onTimeLoans, 'Open loans not yet past their expected return date.'],
    ['Due in the next 7 days', snapshot.dueSoonLoans, 'Included in "On time" — contact them before they become overdue.'],
    ['Overdue', snapshot.overdueLoans, 'Past the expected return date. See the "Open loans" sheet, sorted by urgency.'],
    ['Units in the field', snapshot.unitsOut, 'Individual pieces of equipment not yet returned.'],
    ['Clients holding equipment', snapshot.clientsWithEquipment, 'Distinct companies with at least one open loan.'],
  ]

  if (snapshot.pricedUnitsOut > 0) {
    summaryRows.push([
      'MSRP value in the field',
      Math.round(snapshot.msrpOut),
      `Axis list price of ${snapshot.pricedUnitsOut} of ${snapshot.unitsOut} units (the rest have no pricelist match).`,
    ])
  }

  summaryRows.push(
    [null, null, null],
    [`ACTIVITY — ${reportPeriodLabels[report.period].toUpperCase()}`, null, null],
    ['Loans opened', activity.loansOpened, 'Loans with a checkout date in this period.'],
    ['Units lent', activity.unitsLent, 'Pieces of equipment that left in those loans.'],
    ['Clients served', activity.uniqueClients, 'Distinct companies that received equipment.'],
    ['Loans closed', activity.loansClosed, 'Loans fully returned in this period.'],
    ['Returned on time', percentOrDash(activity.onTimeRate), `${activity.closedOnTime} on time, ${activity.closedLate} late.`],
    ['Average loan length (days)', daysOrDash(activity.avgDurationDays), 'From checkout to full return, closed loans only.'],
    [null, null, null],
    ['INVENTORY VALUE — Axis MSRP, active products only', null, null],
    ['Active inventory value', Math.round(value.active.msrp), `${value.active.units} units whose part number is in the current Axis pricelist.`],
    ['In the warehouse', Math.round(value.warehouse.msrp), `${value.warehouse.units} units available or reserved.`],
    ['On loan', Math.round(value.onLoan.msrp), `${value.onLoan.units} units in the field.`],
    ['Share of lendable value on loan', percentOrDash(value.onLoanShare), 'On loan ÷ (warehouse + on loan).'],
    ['Overdue value', Math.round(value.overdue.msrp), `${value.overdue.units} units on loans past their return date.`],
    ['Under review / damaged', Math.round(value.notLendable.msrp), `${value.notLendable.units} units not available to lend.`],
    ['Idle capital (never loaned)', Math.round(value.idle.msrp), `${value.idle.units} available units that have never left the warehouse.`],
    ['Discontinued units', value.discontinued.units, `Not in the current pricelist: ${value.discontinued.inWarehouse} in warehouse, ${value.discontinued.onLoan} on loan, ${value.discontinued.notLendable} under review/damaged.`],
    ...(value.discontinued.unitsWithLastKnownPrice > 0
      ? [[
          'Discontinued — last known MSRP',
          Math.round(value.discontinued.lastKnownMsrp),
          `Price found in past loan requests for ${value.discontinued.unitsWithLastKnownPrice} of ${value.discontinued.units} discontinued units.`,
        ] as Cell[]]
      : []),
    ['Units without part number', value.missingPartNumber, 'Cannot be valued — complete the part number in Inventory.'],
    [null, null, null],
    ['FLEET — whole inventory', null, null],
    ['Total equipment', fleet.total, null],
    ['Available in warehouse', fleet.available, null],
    ['On loan', fleet.onLoan, null],
    ['Under review / damaged', fleet.underReview + fleet.damaged, 'Not available to lend.'],
    ['Fleet utilization', fleet.utilization, 'On loan ÷ lendable units (excludes damaged).'],
    ['Available but never loaned', fleet.neverLoaned, 'Listed in the "Never loaned" sheet.'],
  )

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Demo Equipment Loans — Report'],
    [scopeLine],
    [],
    ['Indicator', 'Value', 'What it means'],
    ...summaryRows,
  ])
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 80 }]

  summaryRows.forEach((row, index) => {
    const cell = summarySheet[XLSX.utils.encode_cell({ r: index + 4, c: 1 })]
    if (!cell || cell.t !== 'n') return
    const label = String(row[0])
    const percentRows = ['Returned on time', 'Fleet utilization', 'Share of lendable value on loan']
    const usdRows = [
      'MSRP value in the field',
      'Active inventory value',
      'In the warehouse',
      'On loan',
      'Overdue value',
      'Under review / damaged',
      'Idle capital (never loaned)',
      'Discontinued — last known MSRP',
    ]
    if (percentRows.includes(label)) cell.z = '0%'
    if (usdRows.includes(label)) cell.z = numberFormats.usd
  })
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  // ---------------------------------------------------------------- Open loans
  tableSheet(
    'Open loans',
    'Open loans — sorted by urgency',
    'Overdue first, then by expected return date. One row per loan.',
    [
      { header: 'Loan', width: 13 },
      { header: 'Return status', width: 24 },
      { header: 'Expected return', width: 15, format: 'date' },
      { header: 'Client', width: 30 },
      { header: 'Contact', width: 22 },
      { header: 'Phone', width: 17 },
      { header: 'Email', width: 30 },
      { header: 'Internal owner', width: 20 },
      { header: 'Delivered by', width: 20 },
      { header: 'Destination', width: 20 },
      { header: 'Checkout', width: 12, format: 'date' },
      { header: 'Units out', width: 10, format: 'int' },
      { header: 'Equipment still out', width: 60 },
      { header: 'Picked up from', width: 26 },
      { header: 'MSRP out', width: 13, format: 'usd' },
    ],
    report.openLoanRows.map((row) => [
      row.code,
      describeDaysLeft(row.daysLeft),
      row.expectedReturnDate,
      row.company,
      row.contactName || null,
      row.contactPhone || null,
      row.contactEmail || null,
      row.responsible,
      row.checkoutHandler || null,
      row.destination || null,
      row.checkoutDate,
      row.unitsOut,
      row.equipmentOut,
      row.pickupLocations || null,
      row.msrpOut,
    ]),
  )

  // ---------------------------------------------------------------- Equipment out
  tableSheet(
    'Equipment out',
    'Equipment in the field — one row per unit',
    'Every piece of equipment not yet returned, with its loan and where it was picked up from.',
    [
      { header: 'Equipment', width: 12 },
      { header: 'Model', width: 28 },
      { header: 'Category', width: 14 },
      { header: 'Serial', width: 16 },
      { header: 'Loan', width: 13 },
      { header: 'Client', width: 30 },
      { header: 'Internal owner', width: 20 },
      { header: 'Expected return', width: 15, format: 'date' },
      { header: 'Return status', width: 24 },
      { header: 'Picked up from', width: 26 },
      { header: 'MSRP', width: 12, format: 'usd' },
    ],
    report.equipmentOut.map((row) => [
      row.equipmentCode,
      row.model,
      row.category,
      row.serialNumber,
      row.loanCode,
      row.company,
      row.responsible,
      row.expectedReturnDate,
      describeDaysLeft(row.daysLeft),
      row.lastLocation || null,
      row.msrp,
    ]),
  )

  // ---------------------------------------------------------------- Rankings
  const top = 15
  const realRows = <T extends { label: string }>(rows: T[]) =>
    rows.filter((row) => row.label !== 'Not registered').slice(0, top)

  const rankingAoa: Cell[][] = [
    [`Rankings — ${reportPeriodLabels[report.period]}`],
    [`Top ${top} per list, by loans opened in the period  —  ${scopeLine}`],
    [],
  ]

  function pushLoanRanking(title: string, labelHeader: string, rows: RankRow[]) {
    rankingAoa.push([title], ['#', labelHeader, 'Loans', 'Units', 'Still open', 'Overdue'])
    const data = realRows(rows)
    if (data.length === 0) rankingAoa.push([null, 'No activity in this period'])
    data.forEach((row, index) =>
      rankingAoa.push([index + 1, row.label, row.loans, row.units, row.openNow, row.overdueNow]),
    )
    rankingAoa.push([])
  }

  function pushUnitRanking(title: string, labelHeader: string, rows: UnitRankRow[]) {
    rankingAoa.push([title], ['#', labelHeader, 'Units lent', 'In loans'])
    const data = realRows(rows)
    if (data.length === 0) rankingAoa.push([null, 'No activity in this period'])
    data.forEach((row, index) => rankingAoa.push([index + 1, row.label, row.units, row.loans]))
    rankingAoa.push([])
  }

  pushLoanRanking('Clients receiving the most equipment', 'Client', report.byClient)
  pushLoanRanking('Internal owners lending the most', 'Internal owner', report.byOwner)
  pushUnitRanking('Most requested models', 'Model', report.byModel)

  const rankingSheet = XLSX.utils.aoa_to_sheet(rankingAoa)
  rankingSheet['!cols'] = [{ wch: 5 }, { wch: 40 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(workbook, rankingSheet, 'Rankings')

  // ---------------------------------------------------------------- Value
  const valueAoa: Cell[][] = [
    ['Inventory value — Axis MSRP (active products)'],
    [`Who holds the value and where it sits  —  ${scopeLine}`],
    [],
  ]
  const usdCells: Array<[number, number]> = []

  function pushValueBlock(title: string, labelHeader: string, rows: Array<{ label: string; msrp: number; units: number }>) {
    valueAoa.push([title], ['#', labelHeader, 'MSRP (USD)', 'Units'])
    if (rows.length === 0) valueAoa.push([null, 'No priced equipment'])
    rows.slice(0, top).forEach((row, index) => {
      usdCells.push([valueAoa.length, 2])
      valueAoa.push([index + 1, row.label, Math.round(row.msrp), row.units])
    })
    valueAoa.push([])
  }

  pushValueBlock('Value held by client (on loan now)', 'Client', value.byClient)
  pushValueBlock('Value on loan by internal owner', 'Internal owner', value.byOwner)
  pushValueBlock('Active inventory value by category', 'Category', value.byCategory)

  valueAoa.push(['Most valuable units in the field'], ['#', 'Equipment', 'MSRP (USD)', 'Model', 'Client', 'Loan', 'Return status'])
  if (value.mostValuableOut.length === 0) valueAoa.push([null, 'No priced equipment on loan'])
  value.mostValuableOut.forEach((row, index) => {
    usdCells.push([valueAoa.length, 2])
    valueAoa.push([index + 1, row.equipmentCode, Math.round(row.msrp), row.model, row.company, row.loanCode, describeDaysLeft(row.daysLeft)])
  })

  const valueSheet = XLSX.utils.aoa_to_sheet(valueAoa)
  valueSheet['!cols'] = [{ wch: 5 }, { wch: 36 }, { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 13 }, { wch: 22 }]
  for (const [r, c] of usdCells) {
    const cell = valueSheet[XLSX.utils.encode_cell({ r, c })]
    if (cell) cell.z = numberFormats.usd
  }
  XLSX.utils.book_append_sheet(workbook, valueSheet, 'Value (MSRP)')

  // ---------------------------------------------------------------- Monthly trend
  tableSheet(
    'Monthly trend',
    'Loans opened vs. closed — last 12 months',
    'Opened by checkout month; closed by the month the loan was fully returned.',
    [
      { header: 'Month', width: 12 },
      { header: 'Opened', width: 10, format: 'int' },
      { header: 'Closed', width: 10, format: 'int' },
      { header: 'Net change', width: 12, format: 'int' },
    ],
    report.monthlyTrend.map((row) => [row.label, row.opened, row.closed, row.opened - row.closed]),
  )

  // ---------------------------------------------------------------- Never loaned
  if (report.idleEquipment.length > 0) {
    tableSheet(
      'Never loaned',
      'Available equipment that has never been loaned',
      'Candidates for demos, redeployment or review.',
      [
        { header: 'Equipment', width: 12 },
        { header: 'Category', width: 14 },
        { header: 'Model', width: 32 },
        { header: 'Location', width: 26 },
        { header: 'Acquired', width: 12 },
      ],
      report.idleEquipment.map((row) => [row.code, row.category, row.model, row.location, row.acquiredAt]),
    )
  }

  const stamp = report.generatedAt.toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `Loans-Report_${stamp}.xlsx`, { cellDates: true })
}
