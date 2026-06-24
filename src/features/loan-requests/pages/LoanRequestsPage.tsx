import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  getLoanRequestStatusTone,
  type LoanRequest,
} from '../data/loanRequests'
import { fetchLoanRequestsFromSupabase } from '../data/loanRequestsSupabase'

type QuickFilter =
  | 'All'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Converted to Loan'

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function LoanRequestsPage() {
  const navigate = useNavigate()

  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('All')

  useEffect(() => {
    let isMounted = true

    async function loadLoanRequests() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const requests = await fetchLoanRequestsFromSupabase()

        if (!isMounted) {
          return
        }

        setLoanRequests(requests)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load loan requests from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadLoanRequests()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredRequests = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm)

    return loanRequests.filter((request) => {
      const searchableText = normalizeSearchText(
        [
          request.code,
          request.requesterName,
          request.requesterCompany,
          request.requesterEmail,
          request.requesterType,
          request.requestedHandler,
        ].join(' '),
      )

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch)

      const matchesStatus =
        statusFilter === 'All' || request.status === statusFilter

      const matchesQuickFilter =
        quickFilter === 'All' || request.status === quickFilter

      return matchesSearch && matchesStatus && matchesQuickFilter
    })
  }, [loanRequests, searchTerm, statusFilter, quickFilter])

  const pendingRequests = loanRequests.filter(
    (request) => request.status === 'Pending',
  )

  const approvedRequests = loanRequests.filter(
    (request) => request.status === 'Approved',
  )

  const rejectedRequests = loanRequests.filter(
    (request) => request.status === 'Rejected',
  )

  const convertedRequests = loanRequests.filter(
    (request) => request.status === 'Converted to Loan',
  )

  const pendingMsrpTotal = pendingRequests.reduce(
    (total, request) => total + request.msrpTotalAmount,
    0,
  )

  function openRequest(requestCode: string) {
    navigate(`/loan-requests/${requestCode}`)
  }

  function applyQuickFilter(filter: QuickFilter) {
    setQuickFilter(filter)
    setSearchTerm('')
    setStatusFilter('All')
  }

  function clearQuickFilter() {
    setQuickFilter('All')
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div>
          <p className="text-sm font-medium text-[#666666]">
            Administrative Review
          </p>

          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
            Loan Requests
          </h2>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Loan requests could not be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryFilterCard
            label="Pending Requests"
            value={isLoading ? '—' : `${pendingRequests.length}`}
            description="Public submissions awaiting administrator review."
            active={quickFilter === 'Pending'}
            onClick={() => applyQuickFilter('Pending')}
          />

          <SummaryFilterCard
            label="Approved Requests"
            value={isLoading ? '—' : `${approvedRequests.length}`}
            description="Requests ready to be converted into loans."
            active={quickFilter === 'Approved'}
            onClick={() => applyQuickFilter('Approved')}
          />

          <SummaryFilterCard
            label="Rejected Requests"
            value={isLoading ? '—' : `${rejectedRequests.length}`}
            description="Requests declined during administrative review."
            active={quickFilter === 'Rejected'}
            onClick={() => applyQuickFilter('Rejected')}
          />

          <SummaryFilterCard
            label="Converted to Loan"
            value={isLoading ? '—' : `${convertedRequests.length}`}
            description="Approved requests already transformed into loan records."
            active={quickFilter === 'Converted to Loan'}
            onClick={() => applyQuickFilter('Converted to Loan')}
          />

          <SummaryMetricCard
            label="Pending MSRP Exposure"
            value={isLoading ? '—' : formatCurrency(pendingMsrpTotal)}
            description="Reference value currently awaiting approval."
          />
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)]">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Search Requests
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Request number, requester, company or email"
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Converted to Loan">Converted to Loan</option>
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
                Request Review Queue
              </h3>

              <p className="mt-1 text-sm text-[#666666]">
                Requests submitted from the public equipment request form.
              </p>
            </div>

            <div className="rounded-full bg-[#f3f3f0] px-3 py-1 text-sm font-semibold text-[#444444]">
              {filteredRequests.length} visible requests
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#171717]">
                Loading loan requests...
              </p>

              <p className="mt-2 text-sm text-[#555555]">
                Retrieving request records from Supabase.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#ecece8]">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Request
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Requester
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Type
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Requested To
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Preferred Checkout
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Expected Return
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Lines
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        MSRP Total
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
                    {filteredRequests.map((request) => (
                      <tr
                        key={request.code}
                        onClick={() => openRequest(request.code)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            openRequest(request.code)
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        className="cursor-pointer transition hover:bg-[#fff8d6] focus:bg-[#fff8d6] focus:outline-none"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                          {request.code}
                        </td>

                        <td className="min-w-64 px-5 py-4">
                          <p className="text-sm font-semibold text-[#171717]">
                            {request.requesterName}
                          </p>

                          <p className="mt-1 text-xs text-[#777777]">
                            {request.requesterCompany}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {request.requesterType}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {request.requestedHandler}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {request.preferredCheckoutDate}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {request.expectedReturnDate}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-[#555555]">
                          {request.items.length}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-[#171717]">
                          {formatCurrency(request.msrpTotalAmount)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge
                            label={request.status}
                            tone={getLoanRequestStatusTone(request.status)}
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            to={`/loan-requests/${request.code}`}
                            onClick={(event) => event.stopPropagation()}
                            className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRequests.length === 0 && (
                <div className="border-t border-[#e5e5e2] px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-[#171717]">
                    No loan requests match the current filters.
                  </p>

                  <p className="mt-2 text-sm text-[#555555]">
                    Adjust the search or select another status.
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

function SummaryFilterCard({
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

      <p className="mt-2 text-sm leading-6 text-[#555555]">
        {description}
      </p>
    </button>
  )
}

function SummaryMetricCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <article className="rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#666666]">{label}</p>

      <p className="mt-3 text-3xl font-semibold text-[#171717]">{value}</p>

      <p className="mt-2 text-sm leading-6 text-[#555555]">
        {description}
      </p>
    </article>
  )
}
