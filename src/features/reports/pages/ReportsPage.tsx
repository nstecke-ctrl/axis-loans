import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { EquipmentItem } from '../../inventory/data/equipment'
import { fetchEquipmentItemsFromSupabase } from '../../inventory/data/equipmentSupabase'
import type { LoanRequest } from '../../loan-requests/data/loanRequests'
import { fetchLoanRequestsFromSupabase } from '../../loan-requests/data/loanRequestsSupabase'
import type { LoanItem } from '../../loans/data/loans'
import { fetchLoansFromSupabase } from '../../loans/data/loansSupabase'
import {
  GroupedColumnChart,
  RankedBarList,
  ReportCard,
  SegmentedBar,
  StatTile,
  chartTokens,
  type RankedItem,
} from '../components/ReportCharts'
import { exportReportWorkbook } from '../utils/exportReportWorkbook'
import {
  buildLoansReport,
  buildPriceLookup,
  reportPeriodLabels,
  type PriceLookup,
  type RankRow,
  type ReportPeriod,
  type UnitRankRow,
} from '../utils/reportMetrics'

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function formatDays(value: number | null) {
  return value === null ? '—' : `${Math.round(value)} d`
}

function rankToItems(rows: RankRow[], metric: 'loans' | 'units'): RankedItem[] {
  return [...rows]
    .sort((a, b) => b[metric] - a[metric] || a.label.localeCompare(b.label))
    .map((row) => ({
      label: row.label,
      value: row[metric],
      secondary:
        metric === 'loans'
          ? `${row.units} units`
          : `${row.loans} loan${row.loans === 1 ? '' : 's'}`,
      tooltip: [
        { label: metric === 'loans' ? 'Units' : 'Loans', value: metric === 'loans' ? row.units : row.loans },
        { label: 'Open now', value: row.openNow },
        { label: 'Overdue now', value: row.overdueNow },
      ],
    }))
}

function unitRankToItems(rows: UnitRankRow[]): RankedItem[] {
  return rows.map((row) => ({
    label: row.label,
    value: row.units,
    secondary: `${row.loans} loan${row.loans === 1 ? '' : 's'}`,
    tooltip: [{ label: 'Loans', value: row.loans }],
  }))
}

export function ReportsPage() {
  const [loans, setLoans] = useState<LoanItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [requests, setRequests] = useState<LoanRequest[]>([])
  const [priceLookup, setPriceLookup] = useState<PriceLookup>(new Map())

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [partialWarnings, setPartialWarnings] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const [period, setPeriod] = useState<ReportPeriod>('12m')
  const [owner, setOwner] = useState('All')
  const [clientMetric, setClientMetric] = useState<'loans' | 'units'>('loans')

  useEffect(() => {
    let isMounted = true

    async function loadReportData() {
      setIsLoading(true)
      setLoadError(null)

      const [loansResult, equipmentResult, requestsResult, pricelistResult] =
        await Promise.allSettled([
          fetchLoansFromSupabase(),
          fetchEquipmentItemsFromSupabase(),
          fetchLoanRequestsFromSupabase(),
          import('../../loan-requests/data/axisPricelist').then(
            (module) => module.axisPricelistItems,
          ),
        ])

      if (!isMounted) return

      if (loansResult.status === 'rejected') {
        setLoadError(
          loansResult.reason instanceof Error
            ? loansResult.reason.message
            : 'Unable to load loans for reporting.',
        )
        setIsLoading(false)
        return
      }

      const warnings: string[] = []
      setLoans(loansResult.value)

      if (equipmentResult.status === 'fulfilled') {
        setEquipment(equipmentResult.value)
      } else {
        warnings.push('Inventory could not be loaded: fleet and MSRP figures are incomplete.')
      }

      if (requestsResult.status === 'fulfilled') {
        setRequests(requestsResult.value)
      } else {
        warnings.push('Loan requests could not be loaded: the request funnel is empty.')
      }

      if (pricelistResult.status === 'fulfilled') {
        setPriceLookup(buildPriceLookup(pricelistResult.value))
      } else {
        warnings.push('The MSRP pricelist could not be loaded: value figures are unavailable.')
      }

      setPartialWarnings(warnings)
      setIsLoading(false)
    }

    void loadReportData()

    return () => {
      isMounted = false
    }
  }, [])

  const owners = useMemo(
    () =>
      [...new Set(loans.map((loan) => loan.responsible).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [loans],
  )

  const report = useMemo(
    () => buildLoansReport({ loans, equipment, requests, priceLookup, period, owner }),
    [loans, equipment, requests, priceLookup, period, owner],
  )

  const periodLabel = reportPeriodLabels[period]
  const { snapshot, fleet, activity } = report

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportReportWorkbook(report, owner)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-medium text-[#666666]">Reports &amp; Insights</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Loan Analytics
            </h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#777777]">
                Period
              </span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as ReportPeriod)}
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-[#ffda00] sm:w-44"
              >
                {(Object.keys(reportPeriodLabels) as ReportPeriod[]).map((key) => (
                  <option key={key} value={key}>
                    {reportPeriodLabels[key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#777777]">
                Internal owner
              </span>
              <select
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm text-[#171717] outline-none transition focus:border-[#ffda00] sm:w-52"
              >
                <option value="All">All owners</option>
                {owners.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isLoading || isExporting || Boolean(loadError)}
              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#ffda00] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f2cd00] disabled:cursor-not-allowed disabled:bg-[#ecece8] disabled:text-[#888888]"
            >
              {isExporting ? 'Preparing Excel…' : 'Export to Excel'}
            </button>
          </div>
        </div>
      </header>

      <section className="space-y-8 px-6 py-6 lg:px-10 lg:py-8">
        {loadError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">Reports could not be loaded</p>
            <p className="mt-2 text-sm leading-6 text-red-700">{loadError}</p>
          </div>
        )}

        {partialWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-[#fff8d6] p-4">
            {partialWarnings.map((warning) => (
              <p key={warning} className="text-sm text-[#5d4a00]">
                {warning}
              </p>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-[#e5e5e2] bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-sm font-semibold text-[#171717]">Building reports…</p>
            <p className="mt-2 text-sm text-[#555555]">
              Loading loans, inventory, requests and MSRP pricing.
            </p>
          </div>
        ) : loadError ? null : (
          <>
            {/* ------------------------------------------------------------- */}
            <div>
              <SectionTitle
                title="Current snapshot"
                note={`As of today${owner === 'All' ? '' : ` · ${owner}`} — not affected by the period filter`}
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatTile
                  label="Open loans"
                  value={`${snapshot.openLoans}`}
                  detail={`${snapshot.clientsWithEquipment} clients holding equipment`}
                />
                <StatTile
                  label="On time"
                  tone="good"
                  value={`${snapshot.onTimeLoans}`}
                  detail={`${snapshot.dueSoonLoans} due within 7 days`}
                />
                <StatTile
                  label="Overdue"
                  tone="critical"
                  value={`${snapshot.overdueLoans}`}
                  detail={
                    snapshot.openLoans
                      ? `${formatPercent(snapshot.overdueLoans / snapshot.openLoans)} of open loans`
                      : 'No open loans'
                  }
                />
                <StatTile
                  label="Units in the field"
                  value={`${snapshot.unitsOut}`}
                  detail={
                    snapshot.pricedUnitsOut
                      ? `${usdCompactFormatter.format(snapshot.msrpOut)} MSRP · ${snapshot.pricedUnitsOut}/${snapshot.unitsOut} units priced`
                      : 'No MSRP match for these units'
                  }
                />
                <StatTile
                  label="Fleet utilization"
                  value={formatPercent(fleet.utilization)}
                  detail={`${fleet.onLoan} on loan of ${fleet.total - fleet.damaged} lendable units`}
                />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <ReportCard title="Open loans by status" description="On track, due within 7 days, or past the expected return date.">
                  <SegmentedBar
                    emptyLabel="There are no open loans."
                    segments={[
                      { label: 'On track', value: snapshot.onTimeLoans - snapshot.dueSoonLoans, tone: 'good' },
                      { label: 'Due soon', value: snapshot.dueSoonLoans, tone: 'warning' },
                      { label: 'Overdue', value: snapshot.overdueLoans, tone: 'critical' },
                    ]}
                  />
                </ReportCard>

                <ReportCard title="Overdue aging" description="How long overdue loans have been past their expected return date.">
                  <RankedBarList
                    valueLabel="Loans"
                    color={chartTokens.critical}
                    emptyLabel="Nothing overdue. 🎉"
                    items={report.overdueAging.map((slice) => ({
                      label: slice.label,
                      value: slice.value,
                    }))}
                  />
                </ReportCard>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <ReportCard
                  title="Overdue loans"
                  description="Ordered by days overdue — your follow-up list."
                >
                  <SimpleTable
                    emptyLabel="No overdue loans."
                    headers={['Loan', 'Client', 'Owner', 'Days', 'Units', 'MSRP']}
                    rows={report.overdueLoans.slice(0, 10).map((row) => [
                      <LoanLink key="c" code={row.code} />,
                      row.company,
                      row.responsible,
                      <span key="d" className="font-semibold text-[#b42318]">{row.daysOverdue}</span>,
                      row.pendingUnits,
                      row.pendingMsrp === null ? '—' : usdFormatter.format(row.pendingMsrp),
                    ])}
                    footer={
                      report.overdueLoans.length > 10
                        ? `+ ${report.overdueLoans.length - 10} more in the Excel export`
                        : undefined
                    }
                  />
                </ReportCard>

                <ReportCard
                  title="Partial returns"
                  description="Open loans where part of the equipment is already back."
                >
                  <SimpleTable
                    emptyLabel="No partially returned loans."
                    headers={['Loan', 'Client', 'Back', 'Out', 'Still out']}
                    rows={report.partialLoans.slice(0, 10).map((row) => [
                      <LoanLink key="c" code={row.code} />,
                      row.company,
                      row.returnedUnits,
                      <span key="o" className="font-semibold text-[#171717]">{row.pendingUnits}</span>,
                      <span key="m" className="line-clamp-2 text-xs text-[#555555]">{row.pendingModels}</span>,
                    ])}
                  />
                </ReportCard>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            <div>
              <SectionTitle
                title={`Activity · ${periodLabel}`}
                note="Loans counted by checkout date; returns by close date"
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatTile label="Loans opened" value={`${activity.loansOpened}`} detail={`${activity.unitsLent} units lent`} />
                <StatTile label="Unique clients" value={`${activity.uniqueClients}`} detail="Companies that received equipment" />
                <StatTile
                  label="Loans closed"
                  value={`${activity.loansClosed}`}
                  detail={`${activity.closedOnTime} on time · ${activity.closedLate} late`}
                />
                <StatTile
                  label="On-time return rate"
                  value={formatPercent(activity.onTimeRate)}
                  detail={
                    activity.avgDaysLate === null
                      ? 'No late returns in this period'
                      : `Late returns average ${formatDays(activity.avgDaysLate)} late`
                  }
                />
                <StatTile
                  label="Average loan duration"
                  value={formatDays(activity.avgDurationDays)}
                  detail={`Median ${formatDays(activity.medianDurationDays)} · closed loans`}
                />
              </div>

              <ReportCard
                className="mt-4"
                title="Loans opened vs. closed"
                description="Last 12 months, regardless of the period filter."
              >
                <GroupedColumnChart
                  data={report.monthlyTrend}
                  series={[
                    { key: 'opened', label: 'Opened', color: chartTokens.series1, value: (row) => row.opened },
                    { key: 'closed', label: 'Closed', color: chartTokens.series2, value: (row) => row.closed },
                  ]}
                />
              </ReportCard>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <ReportCard title="Who lends the most" description="Internal owner responsible for the loan.">
                  <RankedBarList valueLabel="Loans" items={rankToItems(report.byOwner, 'loans')} />
                </ReportCard>

                <ReportCard
                  title="Top clients"
                  description="Companies receiving the most equipment."
                  action={
                    <div className="inline-flex rounded-xl border border-[#d8d8d4] p-0.5 text-xs font-semibold">
                      {(['loans', 'units'] as const).map((metric) => (
                        <button
                          key={metric}
                          type="button"
                          onClick={() => setClientMetric(metric)}
                          className={`rounded-lg px-3 py-1.5 capitalize transition ${
                            clientMetric === metric ? 'bg-[#181818] text-white' : 'text-[#555555] hover:bg-[#fafaf8]'
                          }`}
                        >
                          {metric}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <RankedBarList
                    valueLabel={clientMetric === 'loans' ? 'Loans' : 'Units'}
                    items={rankToItems(report.byClient, clientMetric)}
                  />
                </ReportCard>

                <ReportCard title="Most requested models" description="Units lent per model.">
                  <RankedBarList valueLabel="Units" items={unitRankToItems(report.byModel)} />
                </ReportCard>

                <ReportCard title="By category" description="Units lent per equipment category.">
                  <RankedBarList valueLabel="Units" items={unitRankToItems(report.byCategory)} />
                </ReportCard>

                <ReportCard title="Recipient type" description="End customers, integrators, distributors, internal.">
                  <RankedBarList valueLabel="Loans" items={rankToItems(report.byRecipientType, 'loans')} />
                </ReportCard>

                <ReportCard title="Loan reason" description="Why equipment leaves the warehouse.">
                  <RankedBarList valueLabel="Loans" items={rankToItems(report.byReason, 'loans')} />
                </ReportCard>

                <ReportCard title="Destinations" description="City and country of the loan.">
                  <RankedBarList valueLabel="Loans" items={rankToItems(report.byCity, 'loans')} />
                </ReportCard>

                <ReportCard title="Checkout handler" description="Who physically delivered the equipment.">
                  <RankedBarList valueLabel="Loans" items={rankToItems(report.byHandler, 'loans')} />
                </ReportCard>

                <ReportCard title="Condition on return" description="Equipment returned in this period.">
                  <SegmentedBar
                    emptyLabel="No returns registered in this period."
                    segments={[
                      { label: 'Available', value: report.returnConditions.find((s) => s.label === 'Available')?.value ?? 0, tone: 'good' },
                      { label: 'Under review', value: report.returnConditions.find((s) => s.label === 'Under Review')?.value ?? 0, tone: 'warning' },
                      { label: 'Damaged', value: report.returnConditions.find((s) => s.label === 'Damaged')?.value ?? 0, tone: 'critical' },
                    ]}
                  />
                </ReportCard>

                <ReportCard
                  title="Loan requests"
                  description={`${report.requests.total} received · conversion ${formatPercent(report.requests.conversionRate)} of decided requests`}
                >
                  <RankedBarList
                    valueLabel="Requests"
                    emptyLabel="No requests received in this period."
                    items={report.requests.byStatus.map((slice) => ({ label: slice.label, value: slice.value }))}
                  />
                </ReportCard>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            <div>
              <SectionTitle title="Fleet" note="Whole inventory, not affected by filters" />

              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <StatTile label="Total equipment" value={`${fleet.total}`} />
                <StatTile label="Available" value={`${fleet.available}`} />
                <StatTile label="On loan" value={`${fleet.onLoan}`} />
                <StatTile label="Reserved" value={`${fleet.reserved}`} />
                <StatTile label="Under review" tone="warning" value={`${fleet.underReview}`} />
                <StatTile label="Damaged" tone="critical" value={`${fleet.damaged}`} />
              </div>

              <ReportCard
                className="mt-4"
                title={`Never loaned · ${fleet.neverLoaned} units`}
                description="Available equipment that has never appeared in a loan — candidates for demos or redeployment."
              >
                <SimpleTable
                  emptyLabel="Every available unit has been loaned at least once."
                  headers={['Code', 'Category', 'Model', 'Location', 'Acquired']}
                  rows={report.idleEquipment.slice(0, 15).map((row) => [
                    <Link key="c" to={`/inventory/${row.code}`} className="font-semibold text-[#171717] hover:underline">
                      {row.code}
                    </Link>,
                    row.category,
                    row.model,
                    row.location,
                    row.acquiredAt,
                  ])}
                  footer={
                    report.idleEquipment.length > 15
                      ? `+ ${report.idleEquipment.length - 15} more in the Excel export`
                      : undefined
                  }
                />
              </ReportCard>
            </div>
          </>
        )}
      </section>
    </>
  )
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
      <h3 className="text-xl font-semibold tracking-tight text-[#171717]">{title}</h3>
      {note && <p className="text-sm text-[#777777]">{note}</p>}
    </div>
  )
}

function LoanLink({ code }: { code: string }) {
  return (
    <Link to={`/loans/${code}`} className="whitespace-nowrap font-semibold text-[#171717] hover:underline">
      {code}
    </Link>
  )
}

function SimpleTable({
  headers,
  rows,
  emptyLabel,
  footer,
}: {
  headers: string[]
  rows: ReactNode[][]
  emptyLabel: string
  footer?: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#777777]">{emptyLabel}</p>
  }

  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="min-w-full divide-y divide-[#ecece8]">
        <thead className="bg-[#fafaf8]">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f0ed]">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-[#fafaf8]">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-3 text-sm text-[#555555] tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <p className="px-6 pt-3 text-xs text-[#777777]">{footer}</p>}
    </div>
  )
}

