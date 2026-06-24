import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  getLoanEquipmentStatusTone,
  getLoanStatusTone,
  type LoanEquipmentItem,
  type LoanItem,
} from '../data/loans'
import {
  fetchLoanDetailFromSupabase,
  registerLoanReturnInSupabase,
} from '../data/loansSupabase'

type ReturnCondition = 'Available' | 'Under Review' | 'Damaged'

type ReturnDraft = {
  selected: boolean
  condition: ReturnCondition
  notes: string
}

type SubmittedReturn = {
  returnDate: string
  returnedItems: Array<{
    equipment: LoanEquipmentItem
    condition: ReturnCondition
    notes: string
  }>
  remainingPendingItems: LoanEquipmentItem[]
  closesLoan: boolean
}

function formatDateForDisplay(value: string) {
  if (!value) {
    return 'Pending'
  }

  if (value.includes('/')) {
    return value
  }

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function buildDrafts(
  pendingEquipment: LoanEquipmentItem[],
): Record<string, ReturnDraft> {
  return Object.fromEntries(
    pendingEquipment.map((equipment) => [
      equipment.equipmentCode,
      {
        selected: false,
        condition: 'Available' as ReturnCondition,
        notes: '',
      },
    ]),
  )
}

export function ReturnLoanPage() {
  const { loanCode } = useParams()

  const [loan, setLoan] = useState<LoanItem | null>(null)
  const [returnDate, setReturnDate] = useState('')
  const [drafts, setDrafts] = useState<Record<string, ReturnDraft>>({})
  const [submittedReturn, setSubmittedReturn] =
    useState<SubmittedReturn | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadLoan() {
      if (!loanCode) {
        setLoan(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError(null)
      setSubmitError(null)

      try {
        const loanDetail = await fetchLoanDetailFromSupabase(loanCode)

        if (!isMounted) {
          return
        }

        setLoan(loanDetail)

        const pendingItems =
          loanDetail?.equipment.filter(
            (equipment) => equipment.itemStatus === 'On Loan',
          ) ?? []

        setDrafts(buildDrafts(pendingItems))
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load loan return data from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadLoan()

    return () => {
      isMounted = false
    }
  }, [loanCode])

  const pendingEquipment = useMemo(() => {
    return (
      loan?.equipment.filter(
        (equipment) => equipment.itemStatus === 'On Loan',
      ) ?? []
    )
  }, [loan])

  const selectedReturns = pendingEquipment.filter(
    (equipment) => drafts[equipment.equipmentCode]?.selected,
  )

  const canSubmit =
    Boolean(returnDate) &&
    selectedReturns.length > 0 &&
    selectedReturns.every(
      (equipment) => drafts[equipment.equipmentCode]?.condition,
    ) &&
    !isSubmitting

  function toggleSelection(equipmentCode: string) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [equipmentCode]: {
        selected: !currentDrafts[equipmentCode]?.selected,
        condition:
          currentDrafts[equipmentCode]?.condition ??
          ('Available' as ReturnCondition),
        notes: currentDrafts[equipmentCode]?.notes ?? '',
      },
    }))
  }

  function updateCondition(
    equipmentCode: string,
    condition: ReturnCondition,
  ) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [equipmentCode]: {
        selected: currentDrafts[equipmentCode]?.selected ?? false,
        condition,
        notes: currentDrafts[equipmentCode]?.notes ?? '',
      },
    }))
  }

  function updateNotes(equipmentCode: string, notes: string) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [equipmentCode]: {
        selected: currentDrafts[equipmentCode]?.selected ?? false,
        condition:
          currentDrafts[equipmentCode]?.condition ??
          ('Available' as ReturnCondition),
        notes,
      },
    }))
  }

  function selectAllPendingItems() {
    setDrafts((currentDrafts) => {
      const updatedDrafts = { ...currentDrafts }

      pendingEquipment.forEach((equipment) => {
        updatedDrafts[equipment.equipmentCode] = {
          selected: true,
          condition:
            updatedDrafts[equipment.equipmentCode]?.condition ??
            ('Available' as ReturnCondition),
          notes: updatedDrafts[equipment.equipmentCode]?.notes ?? '',
        }
      })

      return updatedDrafts
    })
  }

  function clearAllSelections() {
    setDrafts((currentDrafts) => {
      const updatedDrafts = { ...currentDrafts }

      pendingEquipment.forEach((equipment) => {
        updatedDrafts[equipment.equipmentCode] = {
          selected: false,
          condition:
            updatedDrafts[equipment.equipmentCode]?.condition ??
            ('Available' as ReturnCondition),
          notes: updatedDrafts[equipment.equipmentCode]?.notes ?? '',
        }
      })

      return updatedDrafts
    })
  }

  async function handleSubmitReturn() {
    if (!loan || !canSubmit) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const returnedItems = selectedReturns.map((equipment) => ({
      equipment,
      condition: drafts[equipment.equipmentCode].condition,
      notes: drafts[equipment.equipmentCode].notes,
    }))

    try {
      const result = await registerLoanReturnInSupabase({
        loanCode: loan.code,
        returnDate,
        returnedItems: returnedItems.map((item) => ({
          equipmentCode: item.equipment.equipmentCode,
          condition: item.condition,
          notes: item.notes,
        })),
      })

      const remainingPendingItems = result.loan.equipment.filter(
        (equipment) => equipment.itemStatus === 'On Loan',
      )

      setLoan(result.loan)

      setSubmittedReturn({
        returnDate: formatDateForDisplay(returnDate),
        returnedItems,
        remainingPendingItems,
        closesLoan: result.loanClosed,
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to register this return.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Return Management
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Loading return data...
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            Retrieving the current loan record and pending equipment from
            Supabase.
          </p>
        </div>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            Return Management Error
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-red-950">
            This return cannot be prepared
          </h2>

          <p className="mt-4 max-w-2xl text-red-800">{loadError}</p>

          <Link
            to="/loans"
            className="mt-6 inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#181818] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Loans
          </Link>
        </div>
      </section>
    )
  }

  if (!loan) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Loan Not Found
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            This return cannot be processed
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            The requested loan record was not found in Supabase.
          </p>

          <Link
            to="/loans"
            className="mt-6 inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-[#181818] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Loans
          </Link>
        </div>
      </section>
    )
  }

  if (
    loan.status === 'Returned' ||
    loan.status === 'Cancelled' ||
    pendingEquipment.length === 0
  ) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <Link
            to={`/loans/${loan.code}`}
            className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
          >
            ← Back to Loan
          </Link>

          <p className="mt-6 text-sm font-medium text-emerald-700">
            Return Not Required
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            This loan has no pending assets to return
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            The record is already closed, cancelled, or has no open equipment
            items.
          </p>
        </div>
      </section>
    )
  }

  if (submittedReturn) {
    return (
      <>
        <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Return registered successfully
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              {submittedReturn.closesLoan
                ? 'Full return saved in Supabase'
                : 'Partial return saved in Supabase'}
            </h2>
          </div>
        </header>

        <section className="px-6 py-6 lg:px-10 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
            <div className="space-y-6">
              <article
                className={`rounded-2xl border p-6 shadow-sm ${
                  submittedReturn.closesLoan
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-[#fff8d6]'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    submittedReturn.closesLoan
                      ? 'text-emerald-700'
                      : 'text-[#5d4a00]'
                  }`}
                >
                  Return Result
                </p>

                <h3
                  className={`mt-2 text-2xl font-semibold ${
                    submittedReturn.closesLoan
                      ? 'text-emerald-950'
                      : 'text-[#5d4a00]'
                  }`}
                >
                  {submittedReturn.closesLoan
                    ? 'All linked equipment has been returned'
                    : 'The loan remains open with pending equipment'}
                </h3>

                <p
                  className={`mt-4 text-sm leading-6 ${
                    submittedReturn.closesLoan
                      ? 'text-emerald-800'
                      : 'text-[#5d4a00]'
                  }`}
                >
                  Supabase updated the returned loan items, adjusted the
                  equipment status, stored return notes, registered movement
                  history and refreshed the loan state.
                </p>
              </article>

              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Return Summary"
                  title="Processed Information"
                />

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <SummaryField label="Loan" value={loan.code} />
                  <SummaryField label="Company" value={loan.company} />
                  <SummaryField
                    label="Return Date"
                    value={submittedReturn.returnDate}
                  />
                  <SummaryField
                    label="Returned Equipment"
                    value={`${submittedReturn.returnedItems.length}`}
                  />
                </div>
              </article>

              <article className="overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
                <div className="border-b border-[#e5e5e2] px-6 py-5">
                  <p className="text-sm font-medium text-[#666666]">
                    Returned Equipment
                  </p>

                  <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                    Return Condition
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#ecece8]">
                    <thead className="bg-[#fafaf8]">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Equipment
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Model
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Condition
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Notes
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#f0f0ed] bg-white">
                      {submittedReturn.returnedItems.map((item) => (
                        <tr key={item.equipment.equipmentCode}>
                          <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                            {item.equipment.equipmentCode}
                          </td>

                          <td className="min-w-64 px-5 py-4 text-sm text-[#555555]">
                            {item.equipment.model}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <StatusBadge
                              label={item.condition}
                              tone={getReturnConditionTone(item.condition)}
                            />
                          </td>

                          <td className="min-w-72 px-5 py-4 text-sm text-[#555555]">
                            {item.notes || 'No notes'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              {!submittedReturn.closesLoan && (
                <article className="overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
                  <div className="border-b border-[#e5e5e2] px-6 py-5">
                    <p className="text-sm font-medium text-[#666666]">
                      Still Pending
                    </p>

                    <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                      Equipment Remaining Outside the Warehouse
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#ecece8]">
                      <thead className="bg-[#fafaf8]">
                        <tr>
                          <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                            Equipment
                          </th>

                          <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                            Model
                          </th>

                          <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#f0f0ed] bg-white">
                        {submittedReturn.remainingPendingItems.map((item) => (
                          <tr key={item.equipmentCode}>
                            <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                              {item.equipmentCode}
                            </td>

                            <td className="min-w-64 px-5 py-4 text-sm text-[#555555]">
                              {item.model}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4">
                              <StatusBadge label="On Loan" tone="info" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              )}
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader eyebrow="Next Action" title="Continue" />

                <div className="mt-6 space-y-3">
                  <Link
                    to={`/loans/${loan.code}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#181818] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-black"
                  >
                    Back to Loan
                  </Link>

                  <Link
                    to="/loans"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-center text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Back to Loan List
                  </Link>

                  <Link
                    to="/inventory"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-center text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Review Updated Inventory
                  </Link>
                </div>
              </article>

              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-semibold text-emerald-900">
                  Processed in Supabase
                </p>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-emerald-800">
                  <li>• Loan item return status updated.</li>
                  <li>• Equipment status and location refreshed.</li>
                  <li>• Return notes saved.</li>
                  <li>• Activity movement recorded.</li>
                  <li>• Loan closure evaluated automatically.</li>
                </ul>
              </article>
            </aside>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link
              to={`/loans/${loan.code}`}
              className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
            >
              ← Back to Loan
            </Link>

            <p className="mt-4 text-sm font-medium text-[#666666]">
              Return Management
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Return Equipment
            </h2>
          </div>

          <div className="flex flex-col items-start gap-2 rounded-2xl border border-[#e5e5e2] bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-medium text-[#666666]">Loan</p>

            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold text-[#171717]">{loan.code}</p>

              <StatusBadge
                label={loan.status}
                tone={getLoanStatusTone(loan.status)}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {submitError && (
          <article className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">
              Return could not be registered
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {submitError}
            </p>
          </article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader eyebrow="Step 1" title="Return Date" />

              <p className="mt-2 text-sm leading-6 text-[#555555]">
                This date will be applied to the selected equipment items.
              </p>

              <div className="mt-6 max-w-sm">
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  Actual Return Date
                </label>

                <input
                  type="date"
                  value={returnDate}
                  onChange={(event) => setReturnDate(event.target.value)}
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-medium text-[#666666]">
                    Step 2
                  </p>

                  <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                    Select Returned Equipment
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    You may process a full or partial return.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={selectAllPendingItems}
                    className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Select All
                  </button>

                  <button
                    type="button"
                    onClick={clearAllSelections}
                    className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {pendingEquipment.map((equipment) => {
                  const draft = drafts[equipment.equipmentCode]

                  return (
                    <div
                      key={equipment.equipmentCode}
                      className={`rounded-2xl border p-5 transition ${
                        draft?.selected
                          ? 'border-[#ffda00] bg-[#fff8d6]'
                          : 'border-[#e5e5e2] bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-5">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[#171717]">
                                {equipment.equipmentCode}
                              </p>

                              <StatusBadge
                                label={equipment.itemStatus}
                                tone={getLoanEquipmentStatusTone(
                                  equipment.itemStatus,
                                )}
                              />
                            </div>

                            <p className="mt-2 text-lg font-semibold text-[#171717]">
                              {equipment.model}
                            </p>

                            <p className="mt-1 text-sm text-[#555555]">
                              {equipment.category} · {equipment.serialNumber}
                            </p>
                          </div>

                          <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717]">
                            <input
                              type="checkbox"
                              checked={draft?.selected ?? false}
                              onChange={() =>
                                toggleSelection(equipment.equipmentCode)
                              }
                              className="h-4 w-4"
                            />
                            Returned
                          </label>
                        </div>

                        {draft?.selected && (
                          <div className="grid gap-4 border-t border-[#ead272] pt-5 md:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-[#444444]">
                                Return Condition
                              </label>

                              <select
                                value={draft.condition}
                                onChange={(event) =>
                                  updateCondition(
                                    equipment.equipmentCode,
                                    event.target.value as ReturnCondition,
                                  )
                                }
                                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                              >
                                <option value="Available">Available</option>
                                <option value="Under Review">
                                  Under Review
                                </option>
                                <option value="Damaged">Damaged</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-2 block text-sm font-medium text-[#444444]">
                                Return Notes
                              </label>

                              <textarea
                                value={draft.notes}
                                onChange={(event) =>
                                  updateNotes(
                                    equipment.equipmentCode,
                                    event.target.value,
                                  )
                                }
                                rows={3}
                                placeholder="Optional"
                                className="w-full resize-none rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Return Preview"
                title="Before Confirmation"
              />

              <div className="mt-6 space-y-5">
                <SummaryField label="Loan" value={loan.code} />
                <SummaryField label="Company" value={loan.company} />
                <SummaryField
                  label="Return Date"
                  value={formatDateForDisplay(returnDate)}
                />
                <SummaryField
                  label="Selected Equipment"
                  value={`${selectedReturns.length}`}
                />
                <SummaryField
                  label="Equipment Pending After Save"
                  value={`${pendingEquipment.length - selectedReturns.length}`}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <button
                type="button"
                onClick={handleSubmitReturn}
                disabled={!canSubmit}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  canSubmit
                    ? 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSubmitting ? 'Registering Return...' : 'Confirm Return'}
              </button>

              <p className="mt-3 text-sm leading-6 text-[#666666]">
                The return is recorded in Supabase once a date and at least one
                returned equipment item are selected.
              </p>
            </article>
          </aside>
        </div>
      </section>
    </>
  )
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#666666]">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-semibold text-[#171717]">{title}</h3>
    </div>
  )
}

function SummaryField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#171717]">{value}</p>
    </div>
  )
}

function getReturnConditionTone(
  condition: ReturnCondition,
): 'success' | 'violet' | 'danger' {
  switch (condition) {
    case 'Available':
      return 'success'
    case 'Under Review':
      return 'violet'
    case 'Damaged':
      return 'danger'
  }
}
