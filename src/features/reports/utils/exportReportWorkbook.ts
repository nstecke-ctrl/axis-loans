import { reportPeriodLabels, type LoansReport, type RankRow } from './reportMetrics'

function percent(value: number | null) {
  return value === null ? 'n/a' : `${Math.round(value * 100)}%`
}

function round(value: number | null, digits = 1) {
  return value === null ? 'n/a' : Number(value.toFixed(digits))
}

function rankSheet(rows: RankRow[], labelHeader: string) {
  return rows.map((row) => ({
    [labelHeader]: row.label,
    Loans: row.loans,
    Units: row.units,
    'Open now': row.openNow,
    'Overdue now': row.overdueNow,
  }))
}

export async function exportReportWorkbook(report: LoansReport, owner: string) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  const summary = [
    { Metric: 'Generated', Value: report.generatedAt.toLocaleString('en-GB') },
    { Metric: 'Period', Value: reportPeriodLabels[report.period] },
    { Metric: 'Internal owner filter', Value: owner },
    { Metric: '— Current snapshot —', Value: '' },
    { Metric: 'Open loans', Value: report.snapshot.openLoans },
    { Metric: 'On time (Active + Due Soon)', Value: report.snapshot.onTimeLoans },
    { Metric: 'Due within 7 days', Value: report.snapshot.dueSoonLoans },
    { Metric: 'Overdue', Value: report.snapshot.overdueLoans },
    { Metric: 'Units in the field', Value: report.snapshot.unitsOut },
    { Metric: 'Clients holding equipment', Value: report.snapshot.clientsWithEquipment },
    { Metric: 'MSRP in the field (USD, priced units)', Value: Math.round(report.snapshot.msrpOut) },
    {
      Metric: 'Units with known MSRP',
      Value: `${report.snapshot.pricedUnitsOut} of ${report.snapshot.unitsOut}`,
    },
    { Metric: '— Fleet —', Value: '' },
    { Metric: 'Total equipment', Value: report.fleet.total },
    { Metric: 'Available', Value: report.fleet.available },
    { Metric: 'On loan', Value: report.fleet.onLoan },
    { Metric: 'Reserved', Value: report.fleet.reserved },
    { Metric: 'Under review', Value: report.fleet.underReview },
    { Metric: 'Damaged', Value: report.fleet.damaged },
    { Metric: 'Utilization (on loan / lendable)', Value: percent(report.fleet.utilization) },
    { Metric: 'Available, never loaned', Value: report.fleet.neverLoaned },
    { Metric: '— Activity in period —', Value: '' },
    { Metric: 'Loans opened', Value: report.activity.loansOpened },
    { Metric: 'Units lent', Value: report.activity.unitsLent },
    { Metric: 'Unique clients', Value: report.activity.uniqueClients },
    { Metric: 'Loans closed', Value: report.activity.loansClosed },
    { Metric: 'Closed on time', Value: report.activity.closedOnTime },
    { Metric: 'Closed late', Value: report.activity.closedLate },
    { Metric: 'On-time return rate', Value: percent(report.activity.onTimeRate) },
    { Metric: 'Average loan duration (days)', Value: round(report.activity.avgDurationDays) },
    { Metric: 'Median loan duration (days)', Value: round(report.activity.medianDurationDays) },
    { Metric: 'Average days late (late returns)', Value: round(report.activity.avgDaysLate) },
    { Metric: 'Loan requests received', Value: report.requests.total },
    { Metric: 'Request conversion rate', Value: percent(report.requests.conversionRate) },
  ]

  const sheets: Array<[string, Record<string, unknown>[]]> = [
    ['Summary', summary],
    [
      'Overdue',
      report.overdueLoans.map((row) => ({
        Loan: row.code,
        Client: row.company,
        'Internal owner': row.responsible,
        'Expected return': row.expectedReturnDate,
        'Days overdue': row.daysOverdue,
        'Pending units': row.pendingUnits,
        'Pending MSRP (USD)': row.pendingMsrp ?? 'n/a',
      })),
    ],
    [
      'Partial returns',
      report.partialLoans.map((row) => ({
        Loan: row.code,
        Client: row.company,
        'Internal owner': row.responsible,
        Status: row.status,
        'Expected return': row.expectedReturnDate,
        'Returned units': row.returnedUnits,
        'Pending units': row.pendingUnits,
        'Pending models': row.pendingModels,
      })),
    ],
    [
      'Monthly trend',
      report.monthlyTrend.map((row) => ({
        Month: row.label,
        'Loans opened': row.opened,
        'Loans closed': row.closed,
      })),
    ],
    ['By owner', rankSheet(report.byOwner, 'Internal owner')],
    ['By handler', rankSheet(report.byHandler, 'Checkout handler')],
    ['By client', rankSheet(report.byClient, 'Client')],
    ['By recipient type', rankSheet(report.byRecipientType, 'Recipient type')],
    ['By reason', rankSheet(report.byReason, 'Reason')],
    ['By destination', rankSheet(report.byCity, 'Destination')],
    [
      'By model',
      report.byModel.map((row) => ({ Model: row.label, Units: row.units, Loans: row.loans })),
    ],
    [
      'By category',
      report.byCategory.map((row) => ({ Category: row.label, Units: row.units, Loans: row.loans })),
    ],
    [
      'Never loaned',
      report.idleEquipment.map((row) => ({
        Code: row.code,
        Category: row.category,
        Model: row.model,
        Location: row.location,
        Acquired: row.acquiredAt,
      })),
    ],
  ]

  for (const [name, rows] of sheets) {
    const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No data' }])
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }

  const stamp = report.generatedAt.toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `loans-report_${stamp}.xlsx`)
}
