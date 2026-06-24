import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAppRole } from '../../../components/auth/useAppRole'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { generateLoanDocumentPdf } from '../utils/generateLoanDocumentPdf'
import {
  getLoanEquipmentStatusTone,
  getLoanStatusTone,
  type LoanItem,
} from '../data/loans'
import {
  fetchLoanDetailFromSupabase,
  updateLoanProfileInSupabase,
} from '../data/loansSupabase'

type LoanEditForm = {
  recipientType: string
  company: string
  contactName: string
  contactEmail: string
  contactPhone: string
  responsible: string
  reason: string
  projectName: string
  country: string
  city: string
  address: string
  checkoutDate: string
  expectedReturnDate: string
  notes: string
}

function dateForInput(value: string) {
  if (!value || !value.includes('/')) {
    return value
  }

  const [day, month, year] = value.split('/')
  return `${year}-${month}-${day}`
}

function buildInitialEditForm(loan: LoanItem): LoanEditForm {
  return {
    recipientType: loan.recipientType,
    company: loan.company,
    contactName: loan.contactName,
    contactEmail: loan.contactEmail,
    contactPhone: loan.contactPhone,
    responsible: loan.responsible,
    reason: loan.reason,
    projectName: loan.projectName ?? '',
    country: loan.country,
    city: loan.city,
    address: loan.address ?? '',
    checkoutDate: dateForInput(loan.checkoutDate),
    expectedReturnDate: dateForInput(loan.expectedReturnDate),
    notes: loan.notes ?? '',
  }
}

export function LoanDetailPage() {
  const { permissions } = useAppRole()
  const { loanCode } = useParams()

  const [loan, setLoan] = useState<LoanItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState<LoanEditForm | null>(null)
  const [isSavingLoan, setIsSavingLoan] = useState(false)
  const [editActionMessage, setEditActionMessage] = useState<string | null>(
    null,
  )
  const [editActionError, setEditActionError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadLoanDetail() {
      if (!loanCode) {
        setLoan(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const loanDetail = await fetchLoanDetailFromSupabase(loanCode)

        if (!isMounted) {
          return
        }

        setLoan(loanDetail)

        if (loanDetail) {
          setEditForm(buildInitialEditForm(loanDetail))
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load loan detail from the system.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadLoanDetail()

    return () => {
      isMounted = false
    }
  }, [loanCode])

  function openEditForm() {
    if (!loan) {
      return
    }

    setEditForm(buildInitialEditForm(loan))
    setEditActionMessage(null)
    setEditActionError(null)
    setShowEditForm(true)
  }

  function closeEditForm() {
    setShowEditForm(false)
    setEditActionError(null)
  }

  function updateEditForm(field: keyof LoanEditForm, value: string) {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [field]: value,
          }
        : currentForm,
    )
  }

  const hasInvalidDateRange = Boolean(
    editForm &&
      editForm.checkoutDate &&
      editForm.expectedReturnDate &&
      editForm.expectedReturnDate < editForm.checkoutDate,
  )

  const editFormIsReady = Boolean(
    editForm &&
      editForm.recipientType &&
      editForm.company.trim() &&
      editForm.responsible &&
      editForm.reason &&
      editForm.country.trim() &&
      editForm.city.trim() &&
      editForm.checkoutDate &&
      editForm.expectedReturnDate &&
      !hasInvalidDateRange &&
      !isSavingLoan,
  )

  const profileHasMeaningfulChange = Boolean(
    loan &&
      editForm &&
      (editForm.recipientType !== loan.recipientType ||
        editForm.company.trim() !== loan.company ||
        editForm.contactName.trim() !== loan.contactName ||
        editForm.contactEmail.trim() !== loan.contactEmail ||
        editForm.contactPhone.trim() !== loan.contactPhone ||
        editForm.responsible !== loan.responsible ||
        editForm.reason !== loan.reason ||
        editForm.projectName.trim() !== (loan.projectName ?? '') ||
        editForm.country.trim() !== loan.country ||
        editForm.city.trim() !== loan.city ||
        editForm.address.trim() !== (loan.address ?? '') ||
        editForm.checkoutDate !== dateForInput(loan.checkoutDate) ||
        editForm.expectedReturnDate !==
          dateForInput(loan.expectedReturnDate) ||
        editForm.notes.trim() !== (loan.notes ?? '')),
  )

  async function handleSaveLoanEdit() {
    if (
      !loan ||
      !editForm ||
      !editFormIsReady ||
      !profileHasMeaningfulChange
    ) {
      return
    }

    setIsSavingLoan(true)
    setEditActionError(null)
    setEditActionMessage(null)

    try {
      const updatedLoan = await updateLoanProfileInSupabase({
        loanCode: loan.code,
        recipientType: editForm.recipientType,
        company: editForm.company.trim(),
        contactName: editForm.contactName.trim(),
        contactEmail: editForm.contactEmail.trim(),
        contactPhone: editForm.contactPhone.trim(),
        responsible: editForm.responsible,
        reason: editForm.reason,
        projectName: editForm.projectName.trim() || undefined,
        country: editForm.country.trim(),
        city: editForm.city.trim(),
        address: editForm.address.trim() || undefined,
        checkoutDate: editForm.checkoutDate,
        expectedReturnDate: editForm.expectedReturnDate,
        notes: editForm.notes.trim() || undefined,
      })

      setLoan(updatedLoan)
      setEditForm(buildInitialEditForm(updatedLoan))
      setShowEditForm(false)
      setEditActionMessage('Loan information updated successfully.')
    } catch (error) {
      setEditActionError(
        error instanceof Error
          ? error.message
          : 'Unable to update loan information.',
      )
    } finally {
      setIsSavingLoan(false)
    }
  }

  if (isLoading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Loan Detail
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Loading loan...
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            Retrieving loan details and assigned equipment.
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
            Loan Detail Error
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-red-950">
            The loan record could not be loaded
          </h2>

          <p className="mt-4 max-w-2xl text-red-800">{loadError}</p>

          <Link
            to="/loans"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
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
            No loan record exists for this code
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            The requested loan is not available in the system.
          </p>

          <Link
            to="/loans"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Loans
          </Link>
        </div>
      </section>
    )
  }

  const returnActionEnabled =
    loan.status !== 'Returned' && loan.status !== 'Cancelled'

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link
              to="/loans"
              className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
            >
              ← Back to Loans
            </Link>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  {loan.code}
                </p>

                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
                  {loan.company}
                </h2>
              </div>

              <StatusBadge
                label={loan.status}
                tone={getLoanStatusTone(loan.status)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void generateLoanDocumentPdf(loan)}
              className="rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
            >
              Download Loan PDF
            </button>

            {permissions.canManageLoans && (
              <button
                type="button"
                onClick={openEditForm}
                className="rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
              >
                Edit Loan
              </button>
            )}

            {permissions.canManageLoans &&
              (returnActionEnabled ? (
                <Link
                  to={`/loans/${loan.code}/return`}
                  className="rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Register Return
                </Link>
              ) : (
                <button
                  disabled
                  className="cursor-not-allowed rounded-xl bg-[#ecece8] px-4 py-2.5 text-sm font-semibold text-[#888888]"
                >
                  {loan.status === 'Returned'
                    ? 'Loan Closed'
                    : 'Loan Cancelled'}
                </button>
              ))}
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {editActionMessage && (
          <article className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-800">
              {editActionMessage}
            </p>
          </article>
        )}

        {showEditForm && editForm && (
          <article className="mb-6 rounded-2xl border border-[#ffda00] bg-[#fff8d6] p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="text-sm font-medium text-[#5d4a00]">
                  Loan Administration
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  Edit loan information
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5d4a00]">
                  This form updates administrative loan information. Assigned
                  equipment and return processing remain controlled through
                  their dedicated workflows.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditForm}
                className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
              >
                Close
              </button>
            </div>

            {editActionError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {editActionError}
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <SelectField
                label="Recipient Type"
                value={editForm.recipientType}
                onChange={(value) => updateEditForm('recipientType', value)}
                options={[
                  { label: 'End Customer', value: 'End Customer' },
                  { label: 'Integrator', value: 'Integrator' },
                  { label: 'Distributor', value: 'Distributor' },
                  { label: 'Internal', value: 'Internal' },
                  { label: 'Other', value: 'Other' },
                ]}
              />

              <TextField
                label="Company"
                value={editForm.company}
                placeholder="Receiving company"
                onChange={(value) => updateEditForm('company', value)}
              />

              <TextField
                label="Contact Name"
                value={editForm.contactName}
                placeholder="Optional"
                onChange={(value) => updateEditForm('contactName', value)}
              />

              <TextField
                label="Contact Email"
                value={editForm.contactEmail}
                placeholder="Optional"
                onChange={(value) => updateEditForm('contactEmail', value)}
              />

              <TextField
                label="Contact Phone"
                value={editForm.contactPhone}
                placeholder="Optional"
                onChange={(value) => updateEditForm('contactPhone', value)}
              />

              <SelectField
                label="Internal Owner"
                value={editForm.responsible}
                onChange={(value) => updateEditForm('responsible', value)}
                options={[
                  { label: 'Nicolás Steck', value: 'Nicolás Steck' },
                  { label: 'Pre-Sales Team', value: 'Pre-Sales Team' },
                  { label: 'Sales Team', value: 'Sales Team' },
                ]}
              />

              <SelectField
                label="Loan Reason"
                value={editForm.reason}
                onChange={(value) => updateEditForm('reason', value)}
                options={[
                  { label: 'Demo', value: 'Demo' },
                  { label: 'PoC', value: 'PoC' },
                  {
                    label: 'Technical Evaluation',
                    value: 'Technical Evaluation',
                  },
                  { label: 'Training', value: 'Training' },
                  {
                    label: 'Temporary Replacement',
                    value: 'Temporary Replacement',
                  },
                  {
                    label: 'Requested Demo Equipment',
                    value: 'Requested Demo Equipment',
                  },
                  { label: 'Other', value: 'Other' },
                ]}
              />

              <TextField
                label="Associated Project"
                value={editForm.projectName}
                placeholder="Optional"
                onChange={(value) => updateEditForm('projectName', value)}
              />

              <TextField
                label="Country"
                value={editForm.country}
                placeholder="Country"
                onChange={(value) => updateEditForm('country', value)}
              />

              <TextField
                label="City"
                value={editForm.city}
                placeholder="City"
                onChange={(value) => updateEditForm('city', value)}
              />

              <TextField
                label="Address"
                value={editForm.address}
                placeholder="Optional"
                onChange={(value) => updateEditForm('address', value)}
              />

              <DateField
                label="Checkout Date"
                value={editForm.checkoutDate}
                onChange={(value) => updateEditForm('checkoutDate', value)}
              />

              <DateField
                label="Expected Return Date"
                value={editForm.expectedReturnDate}
                onChange={(value) =>
                  updateEditForm('expectedReturnDate', value)
                }
              />
            </div>

            {hasInvalidDateRange && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  The expected return date cannot be earlier than the checkout
                  date.
                </p>
              </div>
            )}

            <div className="mt-6">
              <TextareaField
                label="Notes"
                value={editForm.notes}
                placeholder="Optional loan notes."
                onChange={(value) => updateEditForm('notes', value)}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={closeEditForm}
                className="rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveLoanEdit}
                disabled={
                  !editFormIsReady ||
                  !profileHasMeaningfulChange ||
                  isSavingLoan
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  editFormIsReady &&
                  profileHasMeaningfulChange &&
                  !isSavingLoan
                    ? 'bg-[#181818] text-white hover:bg-black'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSavingLoan ? 'Saving Changes...' : 'Save Loan Edit'}
              </button>
            </div>
          </article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Recipient"
                title="Loan Recipient Details"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DetailField
                  label="Recipient Type"
                  value={loan.recipientType}
                />

                <DetailField label="Company" value={loan.company} />

                <DetailField
                  label="Contact"
                  value={loan.contactName || 'Not registered'}
                />

                <DetailField
                  label="Email"
                  value={loan.contactEmail || 'Not registered'}
                />

                <DetailField
                  label="Phone"
                  value={loan.contactPhone || 'Not registered'}
                />

                <DetailField
                  label="Destination"
                  value={`${loan.city}, ${loan.country}`}
                />

                <DetailField
                  label="Address"
                  value={loan.address ?? 'Not registered'}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Internal Management"
                title="Purpose and Ownership"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DetailField
                  label="Internal Owner"
                  value={loan.responsible}
                />

                <DetailField label="Loan Reason" value={loan.reason} />

                <DetailField
                  label="Associated Project"
                  value={loan.projectName ?? 'Not registered'}
                />
              </div>

              <div className="mt-5">
                <DetailBlock
                  label="Notes"
                  value={loan.notes ?? 'No additional notes'}
                />
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
              <div className="border-b border-[#e5e5e2] px-6 py-5">
                <SectionHeader
                  eyebrow="Assigned Assets"
                  title="Equipment Included in the Loan"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#ecece8]">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Equipment Code
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Category
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Model
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Serial
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Item Status
                      </th>

                      <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Returned At
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f0f0ed] bg-white">
                    {loan.equipment.map((equipment) => (
                      <tr key={equipment.equipmentCode}>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                          <Link
                            to={`/inventory/${equipment.equipmentCode}`}
                            className="transition hover:text-black hover:underline"
                          >
                            {equipment.equipmentCode}
                          </Link>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {equipment.category}
                        </td>

                        <td className="min-w-64 px-5 py-4 text-sm font-medium text-[#171717]">
                          {equipment.model}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {equipment.serialNumber}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <StatusBadge
                            label={equipment.itemStatus}
                            tone={getLoanEquipmentStatusTone(
                              equipment.itemStatus,
                            )}
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                          {equipment.returnedAt ?? 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader eyebrow="Loan Status" title="Current State" />

              <div className="mt-6">
                <StatusBadge
                  label={loan.status}
                  tone={getLoanStatusTone(loan.status)}
                />
              </div>

              <div className="mt-6 space-y-5">
                <DetailField label="Checkout Date" value={loan.checkoutDate} />

                <DetailField
                  label="Expected Return"
                  value={loan.expectedReturnDate}
                />

                <DetailField
                  label="Actual Closed Date"
                  value={loan.actualClosedDate ?? 'Not closed'}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Operational Control"
                title="Recommended Action"
              />

              {loan.status === 'Overdue' && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    This loan is overdue.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-red-700">
                    Contact the recipient and recover or formally extend the
                    loan period.
                  </p>
                </div>
              )}

              {loan.status === 'Due Soon' && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    This loan is close to its return date.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Confirm return timing or decide whether an extension is
                    required.
                  </p>
                </div>
              )}

              {loan.status === 'Active' && (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    This loan is active.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-blue-800">
                    No immediate action is required unless the return planning
                    changes.
                  </p>
                </div>
              )}

              {loan.status === 'Returned' && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">
                    This loan is closed.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-800">
                    All associated equipment has been returned and the record is
                    complete.
                  </p>
                </div>
              )}

              {loan.status === 'Cancelled' && (
                <div className="mt-5 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
                  <p className="text-sm font-semibold text-[#171717]">
                    This loan was cancelled.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    No further return management is required.
                  </p>
                </div>
              )}
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

function DetailField({
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

function DetailBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-2 text-sm leading-7 text-[#555555]">{value}</p>
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
      />
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TextareaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
      />
    </div>
  )
}
