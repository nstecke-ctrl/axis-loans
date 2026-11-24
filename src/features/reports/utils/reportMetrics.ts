import type { EquipmentItem } from '../../inventory/data/equipment'
import type { LoanRequest } from '../../loan-requests/data/loanRequests'
import type { LoanItem } from '../../loans/data/loans'

export type ReportPeriod = '30d' | '90d' | 'ytd' | '12m' | 'all'

export const reportPeriodLabels: Record<ReportPeriod, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  ytd: 'Year to date',
  '12m': 'Last 12 months',
  all: 'All time',
}

const DAY_MS = 86_400_000

export function parseDisplayDate(value?: string): Date | null {
  if (!value || !value.includes('/')) {
    return null
  }

  const [day, month, year] = value.split('/').map(Number)

  if (!day || !month || !year) {
    return null
  }

  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

export function getPeriodStart(period: ReportPeriod, today = startOfToday()) {
  const start = new Date(today)

  switch (period) {
    case '30d':
      start.setDate(start.getDate() - 29)
      return start
    case '90d':
      start.setDate(start.getDate() - 89)
      return start
    case 'ytd':
      return new Date(today.getFullYear(), 0, 1)
    case '12m':
      start.setMonth(start.getMonth() - 12)
      start.setDate(start.getDate() + 1)
      return start
    case 'all':
      return null
  }
}

function isInPeriod(value: string | undefined, periodStart: Date | null) {
  if (!periodStart) {
    return true
  }

  const date = parseDisplayDate(value)
  return Boolean(date && date >= periodStart)
}

export function isOpenLoan(loan: LoanItem) {
  return (
    loan.status === 'Active' ||
    loan.status === 'Due Soon' ||
    loan.status === 'Overdue'
  )
}

function normalizePartNumber(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, '').toUpperCase()
}

export type PriceLookup = Map<string, number>

export function buildPriceLookup(
  pricelist: Array<{ partNumber: string; msrp: number }>,
): PriceLookup {
  const lookup: PriceLookup = new Map()

  for (const item of pricelist) {
    if (Number.isFinite(item.msrp) && item.msrp > 0) {
      lookup.set(normalizePartNumber(item.partNumber), item.msrp)
    }
  }

  return lookup
}

type UnitPriceResolver = (equipmentCode: string) => number | null

function createUnitPriceResolver(
  equipment: EquipmentItem[],
  priceLookup: PriceLookup,
): UnitPriceResolver {
  const partNumberByCode = new Map(
    equipment.map((item) => [item.code, normalizePartNumber(item.partNumber)]),
  )

  return (equipmentCode) => {
    const partNumber = partNumberByCode.get(equipmentCode)

    if (!partNumber) {
      return null
    }

    return priceLookup.get(partNumber) ?? null
  }
}

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export type RankRow = {
  label: string
  loans: number
  units: number
  openNow: number
  overdueNow: number
}

function rankLoans(
  loans: LoanItem[],
  keyOf: (loan: LoanItem) => string | undefined,
): RankRow[] {
  const rows = new Map<string, RankRow>()

  for (const loan of loans) {
    const label = keyOf(loan)?.trim() || 'Not registered'
    const row = rows.get(label) ?? {
      label,
      loans: 0,
      units: 0,
      openNow: 0,
      overdueNow: 0,
    }

    row.loans += 1
    row.units += loan.equipment.length
    row.openNow += isOpenLoan(loan) ? 1 : 0
    row.overdueNow += loan.status === 'Overdue' ? 1 : 0
    rows.set(label, row)
  }

  return [...rows.values()].sort(
    (a, b) => b.loans - a.loans || b.units - a.units || a.label.localeCompare(b.label),
  )
}

export type UnitRankRow = {
  label: string
  units: number
  loans: number
}

function rankEquipment(
  loans: LoanItem[],
  keyOf: (item: LoanItem['equipment'][number]) => string,
): UnitRankRow[] {
  const rows = new Map<string, { units: number; loanCodes: Set<string> }>()

  for (const loan of loans) {
    for (const item of loan.equipment) {
      const label = keyOf(item)?.trim() || 'Not registered'
      const row = rows.get(label) ?? { units: 0, loanCodes: new Set<string>() }
      row.units += 1
      row.loanCodes.add(loan.code)
      rows.set(label, row)
    }
  }

  return [...rows.entries()]
    .map(([label, row]) => ({
      label,
      units: row.units,
      loans: row.loanCodes.size,
    }))
    .sort((a, b) => b.units - a.units || a.label.localeCompare(b.label))
}

// ---------------------------------------------------------------------------
// Report model
// ---------------------------------------------------------------------------

export type OverdueRow = {
  code: string
  company: string
  responsible: string
  expectedReturnDate: string
  daysOverdue: number
  pendingUnits: number
  pendingMsrp: number | null
}

export type PartialLoanRow = {
  code: string
  company: string
  responsible: string
  expectedReturnDate: string
  status: LoanItem['status']
  returnedUnits: number
  pendingUnits: number
  pendingModels: string
}

export type IdleEquipmentRow = {
  code: string
  category: string
  model: string
  location: string
  acquiredAt: string
}

export type MonthBucket = {
  key: string
  label: string
  opened: number
  closed: number
}

export type CountSlice = {
  label: string
  value: number
}

export type LoansReport = {
  generatedAt: Date
  period: ReportPeriod
  periodStart: Date | null

  snapshot: {
    openLoans: number
    onTimeLoans: number
    dueSoonLoans: number
    overdueLoans: number
    unitsOut: number
    clientsWithEquipment: number
    msrpOut: number
    pricedUnitsOut: number
  }

  fleet: {
    total: number
    available: number
    onLoan: number
    reserved: number
    underReview: number
    damaged: number
    utilization: number
    neverLoaned: number
  }

  activity: {
    loansOpened: number
    unitsLent: number
    uniqueClients: number
    loansClosed: number
    closedOnTime: number
    closedLate: number
    onTimeRate: number | null
    avgDurationDays: number | null
    medianDurationDays: number | null
    avgDaysLate: number | null
  }

  overdueAging: CountSlice[]
  overdueLoans: OverdueRow[]
  partialLoans: PartialLoanRow[]
  idleEquipment: IdleEquipmentRow[]
  monthlyTrend: MonthBucket[]
  returnConditions: CountSlice[]

  byOwner: RankRow[]
  byHandler: RankRow[]
  byClient: RankRow[]
  byRecipientType: RankRow[]
  byReason: RankRow[]
  byCity: RankRow[]
  byModel: UnitRankRow[]
  byCategory: UnitRankRow[]

  requests: {
    total: number
    byStatus: CountSlice[]
    conversionRate: number | null
  }
}

function median(values: number[]) {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function average(values: number[]) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: '2-digit',
})

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthlyTrend(loans: LoanItem[], today: Date): MonthBucket[] {
  const buckets: MonthBucket[] = []

  for (let offset = 11; offset >= 0; offset -= 1) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() - offset, 1)
    buckets.push({
      key: monthKey(monthStart),
      label: monthFormatter.format(monthStart),
      opened: 0,
      closed: 0,
    })
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  for (const loan of loans) {
    const checkout = parseDisplayDate(loan.checkoutDate)
    const closed = parseDisplayDate(loan.actualClosedDate)

    if (checkout) {
      const bucket = byKey.get(monthKey(checkout))
      if (bucket) bucket.opened += 1
    }

    if (closed && loan.status === 'Returned') {
      const bucket = byKey.get(monthKey(closed))
      if (bucket) bucket.closed += 1
    }
  }

  return buckets
}

const agingBuckets: Array<{ label: string; max: number }> = [
  { label: '1–7 days', max: 7 },
  { label: '8–30 days', max: 30 },
  { label: '31–60 days', max: 60 },
  { label: '60+ days', max: Number.POSITIVE_INFINITY },
]

export function buildLoansReport(input: {
  loans: LoanItem[]
  equipment: EquipmentItem[]
  requests: LoanRequest[]
  priceLookup: PriceLookup
  period: ReportPeriod
  owner: string
}): LoansReport {
  const today = startOfToday()
  const periodStart = getPeriodStart(input.period, today)
  const priceOf = createUnitPriceResolver(input.equipment, input.priceLookup)

  const scopedLoans =
    input.owner === 'All'
      ? input.loans
      : input.loans.filter((loan) => loan.responsible === input.owner)

  // --- Current snapshot (always "now", independent of the period) --------
  const openLoans = scopedLoans.filter(isOpenLoan)
  let unitsOut = 0
  let msrpOut = 0
  let pricedUnitsOut = 0

  for (const loan of openLoans) {
    for (const item of loan.equipment) {
      if (item.itemStatus !== 'On Loan') continue
      unitsOut += 1
      const price = priceOf(item.equipmentCode)
      if (price !== null) {
        msrpOut += price
        pricedUnitsOut += 1
      }
    }
  }

  const overdueRows: OverdueRow[] = openLoans
    .filter((loan) => loan.status === 'Overdue')
    .map((loan) => {
      const expected = parseDisplayDate(loan.expectedReturnDate)
      const pendingItems = loan.equipment.filter(
        (item) => item.itemStatus === 'On Loan',
      )
      const prices = pendingItems.map((item) => priceOf(item.equipmentCode))
      const knownPrices = prices.filter((price): price is number => price !== null)

      return {
        code: loan.code,
        company: loan.company,
        responsible: loan.responsible,
        expectedReturnDate: loan.expectedReturnDate,
        daysOverdue: expected ? Math.max(daysBetween(expected, today), 0) : 0,
        pendingUnits: pendingItems.length,
        pendingMsrp: knownPrices.length
          ? knownPrices.reduce((sum, price) => sum + price, 0)
          : null,
      }
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  const overdueAging: CountSlice[] = agingBuckets.map((bucket, index) => {
    const min = index === 0 ? 0 : agingBuckets[index - 1].max + 1
    return {
      label: bucket.label,
      value: overdueRows.filter(
        (row) => row.daysOverdue >= min && row.daysOverdue <= bucket.max,
      ).length,
    }
  })

  const partialLoans: PartialLoanRow[] = openLoans
    .map((loan) => {
      const pending = loan.equipment.filter((item) => item.itemStatus === 'On Loan')
      const returned = loan.equipment.length - pending.length
      return { loan, pending, returned }
    })
    .filter(({ pending, returned }) => returned > 0 && pending.length > 0)
    .map(({ loan, pending, returned }) => ({
      code: loan.code,
      company: loan.company,
      responsible: loan.responsible,
      expectedReturnDate: loan.expectedReturnDate,
      status: loan.status,
      returnedUnits: returned,
      pendingUnits: pending.length,
      pendingModels: [...new Set(pending.map((item) => item.model))].join(', '),
    }))

  // --- Fleet (inventory is global; not filtered by owner) -----------------
  const loanedCodes = new Set(
    input.loans.flatMap((loan) => loan.equipment.map((item) => item.equipmentCode)),
  )
  const countStatus = (status: EquipmentItem['status']) =>
    input.equipment.filter((item) => item.status === status).length

  const fleetOnLoan = countStatus('On Loan')
  const fleetDamaged = countStatus('Damaged')
  const lendableFleet = input.equipment.length - fleetDamaged

  const idleEquipment: IdleEquipmentRow[] = input.equipment
    .filter((item) => item.status === 'Available' && !loanedCodes.has(item.code))
    .map((item) => ({
      code: item.code,
      category: item.category,
      model: item.model,
      location: item.location,
      acquiredAt: item.acquiredAt,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))

  // --- Activity in the selected period ------------------------------------
  const periodLoans = scopedLoans.filter((loan) =>
    isInPeriod(loan.checkoutDate, periodStart),
  )

  const closedInPeriod = scopedLoans.filter(
    (loan) =>
      loan.status === 'Returned' &&
      Boolean(loan.actualClosedDate) &&
      isInPeriod(loan.actualClosedDate, periodStart),
  )

  const durations: number[] = []
  const lateDays: number[] = []
  let closedOnTime = 0

  for (const loan of closedInPeriod) {
    const checkout = parseDisplayDate(loan.checkoutDate)
    const expected = parseDisplayDate(loan.expectedReturnDate)
    const closed = parseDisplayDate(loan.actualClosedDate)

    if (checkout && closed) {
      durations.push(Math.max(daysBetween(checkout, closed), 0))
    }

    if (expected && closed) {
      const late = daysBetween(expected, closed)
      if (late <= 0) {
        closedOnTime += 1
      } else {
        lateDays.push(late)
      }
    }
  }

  const closedWithDates = closedOnTime + lateDays.length

  const returnConditionCounts = new Map<string, number>([
    ['Available', 0],
    ['Under Review', 0],
    ['Damaged', 0],
  ])

  for (const loan of scopedLoans) {
    for (const item of loan.equipment) {
      if (
        item.itemStatus === 'Returned' &&
        item.returnCondition &&
        isInPeriod(item.returnedAt, periodStart)
      ) {
        returnConditionCounts.set(
          item.returnCondition,
          (returnConditionCounts.get(item.returnCondition) ?? 0) + 1,
        )
      }
    }
  }

  // --- Requests -------------------------------------------------------------
  const periodRequests = input.requests.filter((request) =>
    isInPeriod(request.submittedAt, periodStart),
  )
  const requestStatuses: LoanRequest['status'][] = [
    'Pending',
    'Approved',
    'Converted to Loan',
    'Rejected',
  ]
  const requestsByStatus = requestStatuses.map((status) => ({
    label: status,
    value: periodRequests.filter((request) => request.status === status).length,
  }))
  const decidedRequests = periodRequests.filter(
    (request) => request.status !== 'Pending',
  ).length
  const convertedRequests = periodRequests.filter(
    (request) => request.status === 'Converted to Loan',
  ).length

  return {
    generatedAt: new Date(),
    period: input.period,
    periodStart,

    snapshot: {
      openLoans: openLoans.length,
      onTimeLoans: openLoans.filter(
        (loan) => loan.status === 'Active' || loan.status === 'Due Soon',
      ).length,
      dueSoonLoans: openLoans.filter((loan) => loan.status === 'Due Soon').length,
      overdueLoans: overdueRows.length,
      unitsOut,
      clientsWithEquipment: new Set(openLoans.map((loan) => loan.company)).size,
      msrpOut,
      pricedUnitsOut,
    },

    fleet: {
      total: input.equipment.length,
      available: countStatus('Available'),
      onLoan: fleetOnLoan,
      reserved: countStatus('Reserved'),
      underReview: countStatus('Under Review'),
      damaged: fleetDamaged,
      utilization: lendableFleet > 0 ? fleetOnLoan / lendableFleet : 0,
      neverLoaned: idleEquipment.length,
    },

    activity: {
      loansOpened: periodLoans.length,
      unitsLent: periodLoans.reduce((sum, loan) => sum + loan.equipment.length, 0),
      uniqueClients: new Set(periodLoans.map((loan) => loan.company)).size,
      loansClosed: closedInPeriod.length,
      closedOnTime,
      closedLate: lateDays.length,
      onTimeRate: closedWithDates > 0 ? closedOnTime / closedWithDates : null,
      avgDurationDays: average(durations),
      medianDurationDays: median(durations),
      avgDaysLate: average(lateDays),
    },

    overdueAging,
    overdueLoans: overdueRows,
    partialLoans,
    idleEquipment,
    monthlyTrend: buildMonthlyTrend(scopedLoans, today),
    returnConditions: [...returnConditionCounts.entries()].map(([label, value]) => ({
      label,
      value,
    })),

    byOwner: rankLoans(periodLoans, (loan) => loan.responsible),
    byHandler: rankLoans(periodLoans, (loan) => loan.checkoutHandler),
    byClient: rankLoans(periodLoans, (loan) => loan.company),
    byRecipientType: rankLoans(periodLoans, (loan) => loan.recipientType),
    byReason: rankLoans(periodLoans, (loan) => loan.reason),
    byCity: rankLoans(periodLoans, (loan) =>
      [loan.city, loan.country].filter(Boolean).join(', '),
    ),
    byModel: rankEquipment(periodLoans, (item) => item.model),
    byCategory: rankEquipment(periodLoans, (item) => item.category),

    requests: {
      total: periodRequests.length,
      byStatus: requestsByStatus,
      conversionRate: decidedRequests > 0 ? convertedRequests / decidedRequests : null,
    },
  }
}
