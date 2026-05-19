import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  fetchMovementsFromSupabase,
  type GlobalMovement,
  type MovementType,
} from '../data/movementsSupabase'

type QuickFilter =
  | 'All'
  | 'Equipment Created'
  | 'Loan Checkout'
  | 'Return Registered'
  | 'Manual Status Change'

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function MovementsPage() {
  const [movements, setMovements] = useState<GlobalMovement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState('All')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('All')

  useEffect(() => {
    let isMounted = true

    async function loadMovements() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const items = await fetchMovementsFromSupabase()

        if (!isMounted) {
          return
        }

        setMovements(items)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load movements from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadMovements()

    return () => {
      isMounted = false
    }
  }, [])

  const filteredMovements = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm)

    return movements.filter((movement) => {
      const searchableText = normalizeSearchText(
        [
          movement.equipmentCode,
          movement.equipmentModel,
          movement.type,
          movement.description,
          movement.user,
        ].join(' '),
      )

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch)

      const matchesType =
        movementTypeFilter === 'All' ||
        movement.type === movementTypeFilter

      const matchesQuickFilter =
        quickFilter === 'All' || movement.type === quickFilter

      return matchesSearch && matchesType && matchesQuickFilter
    })
  }, [movements, searchTerm, movementTypeFilter, quickFilter])

  const createdCount = movements.filter(
    (movement) => movement.type === 'Equipment Created',
  ).length

  const checkoutCount = movements.filter(
    (movement) => movement.type === 'Loan Checkout',
  ).length

  const returnCount = movements.filter(
    (movement) => movement.type === 'Return Registered',
  ).length

  const statusChangeCount = movements.filter(
    (movement) => movement.type === 'Manual Status Change',
  ).length

  function applyQuickFilter(filter: QuickFilter) {
    setQuickFilter(filter)
    setSearchTerm('')
    setMovementTypeFilter('All')
  }

  function clearQuickFilter() {
    setQuickFilter('All')
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div>
          <p className="text-sm font-medium text-[#666666]">
            Traceability Overview
          </p>

          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
            Activity Log
          </h2>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Activity log could not be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryFilterCard
            label="Created Assets"
            value={isLoading ? '—' : `${createdCount}`}
            description="Equipment items added to inventory."
            active={quickFilter === 'Equipment Created'}
            onClick={() => applyQuickFilter('Equipment Created')}
          />

          <SummaryFilterCard
            label="Loan Checkouts"
            value={isLoading ? '—' : `${checkoutCount}`}
            description="Assets delivered to customers, partners or internal teams."
            active={quickFilter === 'Loan Checkout'}
            onClick={() => applyQuickFilter('Loan Checkout')}
          />

          <SummaryFilterCard
            label="Registered Returns"
            value={isLoading ? '—' : `${returnCount}`}
            description="Return actions already captured in the activity history."
            active={quickFilter === 'Return Registered'}
            onClick={() => applyQuickFilter('Return Registered')}
          />

          <SummaryFilterCard
            label="Status Changes"
            value={isLoading ? '—' : `${statusChangeCount}`}
            description="Reservations, technical reviews or damaged assets."
            active={quickFilter === 'Manual Status Change'}
            onClick={() => applyQuickFilter('Manual Status Change')}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)]">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Search Activity
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Equipment, model, description, user or activity type"
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Activity Type
              </label>

              <select
                value={movementTypeFilter}
                onChange={(event) =>
                  setMovementTypeFilter(event.target.value)
                }
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>
                <option value="Equipment Created">Equipment Created</option>
                <option value="Loan Checkout">Loan Checkout</option>
                <option value="Return Registered">Return Registered</option>
                <option value="Manual Status Change">
                  Manual Status Change
                </option>
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
                Operational Activity History
              </h3>

              <p className="mt-1 text-sm text-[#666666]">
                Consolidated log of inventory activity recorded in Supabase.
              </p>
            </div>

            <div className="rounded-full bg-[#f3f3f0] px-3 py-1 text-sm font-semibold text-[#444444]">
              {filteredMovements.length} visible entries
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#171717]">
                Loading activity log...
              </p>

              <p className="mt-2 text-sm text-[#555555]">
                Retrieving equipment movements from Supabase.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#ecece8]">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Date
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Activity
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Equipment
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Description
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        User
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f0f0ed] bg-white">
                    {filteredMovements.map((movement) => (
                      <tr
                        key={movement.id}
                        className="transition hover:bg-[#fafaf8]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {movement.date}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <MovementTypeBadge type={movement.type} />
                        </td>

                        <td className="min-w-72 px-5 py-4">
                          <Link
                            to={`/inventory/${movement.equipmentCode}`}
                            className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
                          >
                            {movement.equipmentCode}
                          </Link>

                          <p className="mt-1 text-sm text-[#555555]">
                            {movement.equipmentModel}
                          </p>
                        </td>

                        <td className="min-w-[28rem] px-5 py-4 text-sm leading-6 text-[#555555]">
                          {movement.description}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {movement.user}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            to={`/inventory/${movement.equipmentCode}`}
                            className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
                          >
                            View Equipment
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredMovements.length === 0 && (
                <div className="border-t border-[#e5e5e2] px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-[#171717]">
                    No activity matches the current filters.
                  </p>

                  <p className="mt-2 text-sm text-[#555555]">
                    Adjust the search or select another activity type.
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

function MovementTypeBadge({ type }: { type: MovementType }) {
  switch (type) {
    case 'Equipment Created':
      return <StatusBadge label={type} tone="success" />
    case 'Loan Checkout':
      return <StatusBadge label={type} tone="info" />
    case 'Return Registered':
      return <StatusBadge label={type} tone="warning" />
    case 'Manual Status Change':
      return <StatusBadge label={type} tone="violet" />
  }
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