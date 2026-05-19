import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  getLoanStatusTone,
  type LoanDisplayStatus,
  type LoanItem,
} from '../data/loans'
import { fetchLoansFromSupabase } from '../data/loansSupabase'

type QuickFilter = 'All' | 'Open' | 'Overdue' | 'Due Soon' | 'Returned'

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function LoansPage() {
  const [loans, setLoans] = useState<LoanItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | LoanDisplayStatus>(
    'All',
  )
  const [recipientTypeFilter, setRecipientTypeFilter] = useState('All')
  const [ownerFilter, setOwnerFilter] = useState('All')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('All')

  useEffect(() => {
    let isMounted = true

    async function loadLoans() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const items = await fetchLoansFromSupabase()

        if (!isMounted) {
          return
        }

        setLoans(items)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load loans from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadLoans()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredLoans = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm)

    return loans.filter((loan) => {
      const searchableText = normalizeSearchText(
        [
          loan.code,
          loan.company,
          loan.contactName,
          loan.contactEmail,
          loan.responsible,
          loan.reason,
          loan.projectName ?? '',
        ].join(' '),
      )

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch)

      const matchesStatus =
        statusFilter === 'All' || loan.status === statusFilter

      const matchesRecipientType =
        recipientTypeFilter === 'All' ||
        loan.recipientType === recipientTypeFilter

      const matchesOwner =
        ownerFilter === 'All' || loan.responsible === ownerFilter

      const matchesQuickFilter =
        quickFilter === 'All' ||
        (quickFilter === 'Open' &&
          (loan.status === 'Active' ||
            loan.status === 'Due Soon' ||
            loan.status === 'Overdue')) ||
        (quickFilter === 'Overdue' && loan.status === 'Overdue') ||
        (quickFilter === 'Due Soon' && loan.status === 'Due Soon') ||
        (quickFilter === 'Returned' && loan.status === 'Returned')

      return (
        matchesSearch &&
        matchesStatus &&
        matchesRecipientType &&
        matchesOwner &&
        matchesQuickFilter
      )
    })
  }, [
    loans,
    searchTerm,
    statusFilter,
    recipientTypeFilter,
    ownerFilter,
    quickFilter,
  ])

  const openLoans = loans.filter(
    (loan) =>
      loan.status === 'Active' ||
      loan.status === 'Due Soon' ||
      loan.status === 'Overdue',
  )

  const overdueLoans = loans.filter((loan) => loan.status === 'Overdue')
  const dueSoonLoans = loans.filter((loan) => loan.status === 'Due Soon')
  const returnedLoans = loans.filter((loan) => loan.status === 'Returned')

  function applyQuickFilter(filter: QuickFilter) {
    setQuickFilter(filter)
    setSearchTerm('')
    setStatusFilter('All')
    setRecipientTypeFilter('All')
    setOwnerFilter('All')
  }

  function clearQuickFilter() {
    setQuickFilter('All')
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-[#666666]">
              Loan Management
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Loans
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/loans"
              className="inline-flex items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
            >
              Return Equipment
            </Link>

            <Link
              to="/loans/new"
              className="inline-flex items-center justify-center rounded-xl bg-[#ffda00] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f2cd00]"
            >
              New Loan
            </Link>
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Loans could not be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Open Loans"
            value={isLoading ? '—' : `${openLoans.length}`}
            description="Loans that are still operationally open."
            active={quickFilter === 'Open'}
            onClick={() => applyQuickFilter('Open')}
          />

          <SummaryCard
            label="Overdue Loans"
            value={isLoading ? '—' : `${overdueLoans.length}`}
            description="Loans requiring immediate follow-up."
            active={quickFilter === 'Overdue'}
            onClick={() => applyQuickFilter('Overdue')}
          />

          <SummaryCard
            label="Due Soon"
            value={isLoading ? '—' : `${dueSoonLoans.length}`}
            description="Returns expected within the next few days."
            active={quickFilter === 'Due Soon'}
            onClick={() => applyQuickFilter('Due Soon')}
          />

          <SummaryCard
            label="Returned"
            value={isLoading ? '—' : `${returnedLoans.length}`}
            description="Closed loans currently registered."
            active={quickFilter === 'Returned'}
            onClick={() => applyQuickFilter('Returned')}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.8fr))]">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Search Loans
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Code, company, contact or internal owner"
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as 'All' | LoanDisplayStatus,
                  )
                }
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Overdue">Overdue</option>
                <option value="Due Soon">Due Soon</option>
                <option value="Returned">Returned</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Recipient Type
              </label>

              <select
                value={recipientTypeFilter}
                onChange={(event) =>
                  setRecipientTypeFilter(event.target.value)
                }
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>
                <option value="End Customer">End Customer</option>
                <option value="Integrator">Integrator</option>
                <option value="Distributor">Distributor</option>
                <option value="Internal">Internal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Internal Owner
              </label>

              <select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>
                <option value="Nicolás Steck">Nicolás Steck</option>
                <option value="Pre-Sales Team">Pre-Sales Team</option>
                <option value="Sales Team">Sales Team</option>
              </select>
            </div>
          </div>

          {quickFilter !== 'All' && (
            <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] px-4 py-3 md:flex-row md:items-center">
              <p className="text-sm text-[#555555]">
                Quick filter active:{' '}
                <span className="font-semibold text-[#171717]">
                  {quickFilter}
                </span>
              </p>

              <button
                type="button"
                onClick={clearQuickFilter}
                className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
              >
                Clear quick filter
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-[#e5e5e2] px-5 py-4 md:flex-row md:items-center">
            <div>
              <h3 className="text-lg font-semibold text-[#171717]">
                Loan Register
              </h3>

              <p className="mt-1 text-sm text-[#666666]">
                Operational view of open, overdue, due soon and historical
                loans loaded from Supabase.
              </p>
            </div>

            <div className="rounded-full bg-[#f3f3f0] px-3 py-1 text-sm font-semibold text-[#444444]">
              {filteredLoans.length} visible loans
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#171717]">
                Loading loans...
              </p>

              <p className="mt-2 text-sm text-[#555555]">
                Retrieving current loan records from Supabase.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#ecece8]">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Loan Number
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Company
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Type
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Internal Owner
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Checkout
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Expected Return
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Equipment
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Status
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f0f0ed] bg-white">
                    {filteredLoans.map((loan) => (
                      <tr
                        key={loan.code}
                        className="transition hover:bg-[#fafaf8]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                          {loan.code}
                        </td>

                        <td className="min-w-60 px-5 py-4">
                          <p className="text-sm font-semibold text-[#171717]">
                            {loan.company}
                          </p>

                          <p className="mt-1 text-xs text-[#777777]">
                            {loan.contactName || 'Not registered'}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {loan.recipientType}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {loan.responsible}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {loan.checkoutDate}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {loan.expectedReturnDate}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {loan.equipment.length}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge
                            label={loan.status}
                            tone={getLoanStatusTone(loan.status)}
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            to={`/loans/${loan.code}`}
                            className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredLoans.length === 0 && (
                <div className="border-t border-[#e5e5e2] px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-[#171717]">
                    No loans match the current filters.
                  </p>

                  <p className="mt-2 text-sm text-[#555555]">
                    Adjust the search or filter criteria.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

function SummaryCard({
  label,
  value,
  description,
  active,
  onClick,
}: {
  label: string
  value: string
  description: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active
          ? 'border-[#ffda00] ring-2 ring-[#fff1a8]'
          : 'border-[#e5e5e2]'
      }`}
    >
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[#171717]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#555555]">{description}</p>
    </button>
  )
}