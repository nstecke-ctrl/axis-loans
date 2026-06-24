import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppRole } from '../../../components/auth/useAppRole'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  getEquipmentStatusTone,
  type EquipmentItem,
  type EquipmentStatus,
} from '../data/equipment'
import { fetchEquipmentItemsFromSupabase } from '../data/equipmentSupabase'

type QuickFilter = 'All' | 'Available' | 'On Loan' | 'Requires Attention'

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getInitialQuickFilter(value: string | null): QuickFilter {
  return value === 'Available' ||
    value === 'On Loan' ||
    value === 'Requires Attention'
    ? value
    : 'All'
}

export function InventoryPage() {
  const { permissions } = useAppRole()
  const [searchParams] = useSearchParams()
  const requestedQuickFilter = searchParams.get('quick')

  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | EquipmentStatus>(
    'All',
  )
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(() =>
    getInitialQuickFilter(requestedQuickFilter),
  )

  useEffect(() => {
    let isMounted = true

    async function loadEquipment() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const items = await fetchEquipmentItemsFromSupabase()

        if (!isMounted) {
          return
        }

        setEquipmentItems(items)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load inventory from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadEquipment()

    return () => {
      isMounted = false
    }
  }, [])

  const availableLocations = useMemo(() => {
    return Array.from(
      new Set(equipmentItems.map((equipment) => equipment.location)),
    ).sort((a, b) => a.localeCompare(b))
  }, [equipmentItems])

  const availableCategories = useMemo(() => {
    return Array.from(
      new Set(equipmentItems.map((equipment) => equipment.category)),
    ).sort((a, b) => a.localeCompare(b))
  }, [equipmentItems])

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = normalizeSearchText(searchTerm)

    return equipmentItems.filter((equipment) => {
      const searchableText = normalizeSearchText(
        [
          equipment.code,
          equipment.category,
          equipment.brand,
          equipment.model,
          equipment.partNumber,
          equipment.serialNumber,
          equipment.location,
          equipment.legacyCode ?? '',
        ].join(' '),
      )

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch)

      const matchesStatus =
        statusFilter === 'All' || equipment.status === statusFilter

      const matchesCategory =
        categoryFilter === 'All' || equipment.category === categoryFilter

      const matchesLocation =
        locationFilter === 'All' || equipment.location === locationFilter

      const matchesQuickFilter =
        quickFilter === 'All' ||
        (quickFilter === 'Available' && equipment.status === 'Available') ||
        (quickFilter === 'On Loan' && equipment.status === 'On Loan') ||
        (quickFilter === 'Requires Attention' &&
          (equipment.status === 'Under Review' ||
            equipment.status === 'Damaged'))

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesLocation &&
        matchesQuickFilter
      )
    })
  }, [
    equipmentItems,
    searchTerm,
    statusFilter,
    categoryFilter,
    locationFilter,
    quickFilter,
  ])

  const availableInventory = equipmentItems.filter(
    (equipment) => equipment.status === 'Available',
  )

  const onLoanInventory = equipmentItems.filter(
    (equipment) => equipment.status === 'On Loan',
  )

  const requiresAttentionInventory = equipmentItems.filter(
    (equipment) =>
      equipment.status === 'Under Review' || equipment.status === 'Damaged',
  )

  function applyQuickFilter(filter: QuickFilter) {
    setQuickFilter(filter)
    setStatusFilter('All')
    setCategoryFilter('All')
    setLocationFilter('All')
    setSearchTerm('')
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
              Asset Management
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Inventory
            </h2>
          </div>

          {permissions.canManageEquipment && (
            <div className="flex flex-wrap gap-3">
              <Link
                to="/inventory/import"
                className="inline-flex items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
              >
                Import Excel
              </Link>

              <Link
                to="/inventory/new"
                className="inline-flex items-center justify-center rounded-xl bg-[#ffda00] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f2cd00]"
              >
                New Equipment
              </Link>
            </div>
          )}
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {loadError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-800">
              Inventory could not be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError}
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => applyQuickFilter('Available')}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              quickFilter === 'Available'
                ? 'border-emerald-300 ring-2 ring-emerald-100'
                : 'border-[#e5e5e2]'
            }`}
          >
            <p className="text-sm font-medium text-[#666666]">
              Available Inventory
            </p>

            <p className="mt-3 text-3xl font-semibold text-[#171717]">
              {availableInventory.length}
            </p>

            <p className="mt-2 text-sm leading-6 text-[#555555]">
              Assets ready to be assigned to new loans.
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyQuickFilter('On Loan')}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              quickFilter === 'On Loan'
                ? 'border-blue-300 ring-2 ring-blue-100'
                : 'border-[#e5e5e2]'
            }`}
          >
            <p className="text-sm font-medium text-[#666666]">
              Equipment on Loan
            </p>

            <p className="mt-3 text-3xl font-semibold text-[#171717]">
              {onLoanInventory.length}
            </p>

            <p className="mt-2 text-sm leading-6 text-[#555555]">
              Assets currently outside the warehouse.
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyQuickFilter('Requires Attention')}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              quickFilter === 'Requires Attention'
                ? 'border-red-300 ring-2 ring-red-100'
                : 'border-[#e5e5e2]'
            }`}
          >
            <p className="text-sm font-medium text-[#666666]">
              Requires Attention
            </p>

            <p className="mt-3 text-3xl font-semibold text-[#171717]">
              {requiresAttentionInventory.length}
            </p>

            <p className="mt-2 text-sm leading-6 text-[#555555]">
              Assets not ready for immediate reassignment.
            </p>
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white p-5 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,0.8fr))]">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Search Equipment
              </label>

              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Code, serial, model or part number"
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
                  setStatusFilter(event.target.value as 'All' | EquipmentStatus)
                }
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>
                <option value="Available">Available</option>
                <option value="On Loan">On Loan</option>
                <option value="Reserved">Reserved</option>
                <option value="Under Review">Under Review</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Category
              </label>

              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>

                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Location
              </label>

              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              >
                <option value="All">All</option>

                {availableLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
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
                Registered Equipment
              </h3>

              <p className="mt-1 text-sm text-[#666666]">
                Current catalog of traceable assets loaded from Supabase.
              </p>
            </div>

            <div className="rounded-full bg-[#f3f3f0] px-3 py-1 text-sm font-semibold text-[#444444]">
              {filteredEquipment.length} visible assets
            </div>
          </div>

          {isLoading ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-semibold text-[#171717]">
                Loading inventory...
              </p>

              <p className="mt-2 text-sm text-[#555555]">
                Retrieving equipment records from Supabase.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#ecece8]">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Code
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Category
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Model
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Part Number
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Serial
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Status
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Location
                      </th>

                      <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f0f0ed] bg-white">
                    {filteredEquipment.map((equipment) => (
                      <tr
                        key={equipment.code}
                        className="transition hover:bg-[#fafaf8]"
                      >
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                          {equipment.code}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {equipment.category}
                        </td>

                        <td className="min-w-60 px-5 py-4">
                          <p className="text-sm font-semibold text-[#171717]">
                            {equipment.model}
                          </p>

                          <p className="mt-1 text-xs text-[#777777]">
                            {equipment.brand}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {equipment.partNumber}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {equipment.serialNumber}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge
                            label={equipment.status}
                            tone={getEquipmentStatusTone(equipment.status)}
                          />
                        </td>

                        <td className="min-w-48 px-5 py-4 text-sm text-[#555555]">
                          {equipment.location}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <Link
                            to={`/inventory/${equipment.code}`}
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

              {filteredEquipment.length === 0 && (
                <div className="border-t border-[#e5e5e2] px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-[#171717]">
                    No equipment matches the current filters.
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
