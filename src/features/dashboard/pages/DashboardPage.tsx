import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAppRole } from '../../../components/auth/useAppRole'
import type { EquipmentItem } from '../../inventory/data/equipment'
import { fetchEquipmentItemsFromSupabase } from '../../inventory/data/equipmentSupabase'
import type { LoanRequest } from '../../loan-requests/data/loanRequests'
import { fetchLoanRequestsFromSupabase } from '../../loan-requests/data/loanRequestsSupabase'
import {
  fetchDashboardLoansFromSupabase,
  type DashboardLoanSummary,
} from '../data/dashboardSupabase'

type DashboardCard = {
  label: string
  value: string
  to: string
  description: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function DashboardPage() {
  const { permissions } = useAppRole()

  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [loanRequests, setLoanRequests] = useState<LoanRequest[]>([])
  const [overdueLoans, setOverdueLoans] = useState<DashboardLoanSummary[]>([])
  const [upcomingReturns, setUpcomingReturns] = useState<
    DashboardLoanSummary[]
  >([])

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [equipment, requests, loanSummary] = await Promise.all([
          fetchEquipmentItemsFromSupabase(),
          fetchLoanRequestsFromSupabase(),
          fetchDashboardLoansFromSupabase(),
        ])

        if (!isMounted) {
          return
        }

        setEquipmentItems(equipment)
        setLoanRequests(requests)
        setOverdueLoans(loanSummary.overdueLoans)
        setUpcomingReturns(loanSummary.upcomingReturns)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load dashboard data from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  const pendingRequests = loanRequests
    .filter((request) => request.status === 'Pending')
    .slice(0, 3)

  const pendingRequestsCount = loanRequests.filter(
    (request) => request.status === 'Pending',
  ).length

  const availableEquipmentCount = equipmentItems.filter(
    (equipment) => equipment.status === 'Available',
  ).length

  const onLoanEquipmentCount = equipmentItems.filter(
    (equipment) => equipment.status === 'On Loan',
  ).length

  const dashboardCards: DashboardCard[] = [
    {
      label: 'Registered Equipment',
      value: `${equipmentItems.length}`,
      to: '/inventory',
      description: 'View full inventory',
    },
    {
      label: 'Available',
      value: `${availableEquipmentCount}`,
      to: '/inventory',
      description: 'Review available assets',
    },
    {
      label: 'On Loan',
      value: `${onLoanEquipmentCount}`,
      to: '/inventory',
      description: 'Review loaned equipment',
    },
    {
      label: 'Overdue Loans',
      value: `${overdueLoans.length}`,
      to: '/loans',
      description: 'Review late returns',
    },
    {
      label: 'Pending Requests',
      value: `${pendingRequestsCount}`,
      to: '/loan-requests',
      description: 'Review pending submissions',
    },
  ]

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-medium text-[#666666]">
              Operations Overview
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Dashboard
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {permissions.canManageLoans && (
              <>
                <Link
                  to="/loans"
                  className="inline-flex items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                >
                  Return Equipment
                </Link>

                <Link
                  to="/loans/new"
                  className="inline-flex items-center justify-center rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                >
                  New Loan
                </Link>
              </>
            )}

            {permissions.canManageEquipment && (
              <Link
                to="/inventory/new"
                className="inline-flex items-center justify-center rounded-xl bg-[#ffda00] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f2cd00]"
              >
                New Equipment
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Dashboard could not be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {dashboardCards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="group rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d4d4cf] hover:shadow-md"
            >
              <p className="text-sm font-medium text-[#666666]">
                {card.label}
              </p>

              <p className="mt-4 text-4xl font-semibold tracking-tight text-[#171717]">
                {isLoading ? '—' : card.value}
              </p>

              <p className="mt-3 text-sm font-semibold text-[#171717] transition group-hover:underline">
                {card.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  Priority Follow-Up
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  Overdue Loans
                </h3>
              </div>

              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-800">
                {isLoading ? '...' : `${overdueLoans.length} pending`}
              </span>
            </div>

            <div className="space-y-3">
              {isLoading && (
                <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                  <p className="text-sm font-semibold text-[#171717]">
                    Loading overdue loans...
                  </p>
                </div>
              )}

              {!isLoading &&
                overdueLoans.slice(0, 3).map((loan) => (
                  <div
                    key={loan.code}
                    className="rounded-2xl border border-red-100 bg-red-50/60 p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <p className="font-semibold text-[#171717]">
                          {loan.company}
                        </p>

                        <p className="mt-1 text-sm text-[#555555]">
                          Owner: {loan.responsible}
                        </p>

                        <p className="text-sm text-[#555555]">
                          Expected return: {loan.expectedReturnDate}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">
                          {loan.overdueDelay}
                        </span>

                        <Link
                          to={`/loans/${loan.code}`}
                          className="text-sm font-semibold text-[#171717] hover:underline"
                        >
                          View Loan
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

              {!isLoading && overdueLoans.length === 0 && (
                <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                  <p className="text-sm font-semibold text-[#171717]">
                    No overdue loans.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    Late returns will appear here when they require follow-up.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  Upcoming Returns
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  Due Soon
                </h3>
              </div>

              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
                {isLoading ? '...' : `${upcomingReturns.length} upcoming`}
              </span>
            </div>

            <div className="space-y-3">
              {isLoading && (
                <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                  <p className="text-sm font-semibold text-[#171717]">
                    Loading upcoming returns...
                  </p>
                </div>
              )}

              {!isLoading &&
                upcomingReturns.slice(0, 3).map((loan) => (
                  <div
                    key={loan.code}
                    className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <p className="font-semibold text-[#171717]">
                          {loan.company}
                        </p>

                        <p className="mt-1 text-sm text-[#555555]">
                          Owner: {loan.responsible}
                        </p>

                        <p className="text-sm text-[#555555]">
                          Expected return: {loan.expectedReturnDate}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                          Due Soon
                        </span>

                        <Link
                          to={`/loans/${loan.code}`}
                          className="text-sm font-semibold text-[#171717] hover:underline"
                        >
                          View Loan
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

              {!isLoading && upcomingReturns.length === 0 && (
                <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                  <p className="text-sm font-semibold text-[#171717]">
                    No upcoming returns.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    Loans approaching their return date will appear here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium text-[#666666]">
                Administrative Review
              </p>

              <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                Pending Loan Requests
              </h3>
            </div>

            <Link
              to="/loan-requests"
              className="inline-flex items-center justify-center rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Review All Requests
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading && (
              <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                <p className="text-sm font-semibold text-[#171717]">
                  Loading pending requests...
                </p>
              </div>
            )}

            {!isLoading &&
              pendingRequests.map((request) => (
                <div
                  key={request.code}
                  className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">
                        {request.code} — {request.requesterCompany}
                      </p>

                      <p className="mt-1 text-sm text-[#555555]">
                        Requester: {request.requesterName}
                      </p>

                      <p className="text-sm text-[#555555]">
                        Requested MSRP:{' '}
                        {formatCurrency(request.msrpTotalAmount)}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
                        Pending
                      </span>

                      <Link
                        to={`/loan-requests/${request.code}`}
                        className="text-sm font-semibold text-[#171717] hover:underline"
                      >
                        Review Request
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

            {!isLoading && pendingRequests.length === 0 && (
              <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                <p className="text-sm font-semibold text-[#171717]">
                  No pending requests.
                </p>

                <p className="mt-2 text-sm leading-6 text-[#555555]">
                  New public requests will appear here once they are submitted.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-sm font-medium text-[#666666]">
              System Scope
            </p>

            <h3 className="mt-1 text-xl font-semibold text-[#171717]">
              What This Tool Controls
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Traceable Inventory',
                description:
                  'Know exactly what exists, where each asset is, and its current operational status.',
              },
              {
                title: 'Controlled Loans',
                description:
                  'Register recipient, internal owner, assigned equipment, and expected return dates.',
              },
              {
                title: 'Approval Workflow',
                description:
                  'Review public equipment requests before converting them into internal loan records.',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4"
              >
                <h4 className="font-semibold text-[#171717]">
                  {item.title}
                </h4>

                <p className="mt-2 text-sm leading-6 text-[#555555]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  )
}
