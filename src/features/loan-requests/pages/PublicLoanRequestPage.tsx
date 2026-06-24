import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import {
  axisPricelistItems,
  type AxisPricelistItem,
} from '../data/axisPricelist'
import { responsibilityText } from '../data/loanRequests'
import { createPublicLoanRequestInSupabase } from '../data/loanRequestsSupabase'

type RequesterType =
  | ''
  | 'End Customer'
  | 'Integrator'
  | 'Distributor'
  | 'Internal'
  | 'Other'

type PublicRequestForm = {
  requesterName: string
  company: string
  email: string
  phone: string
  requesterType: RequesterType
  country: string
  city: string
  preferredCheckoutDate: string
  expectedReturnDate: string
  useCase: string
  additionalNotes: string
  responsibilityAccepted: boolean
}

type RequestedEquipmentLine = {
  id: string
  searchTerm: string
  selectedItem: AxisPricelistItem | null
  quantity: number
}

type SubmittedRequest = {
  requestCode: string
  form: PublicRequestForm
  lines: RequestedEquipmentLine[]
  totalMsrp: number
}

const initialFormState: PublicRequestForm = {
  requesterName: '',
  company: '',
  email: '',
  phone: '',
  requesterType: '',
  country: 'Chile',
  city: '',
  preferredCheckoutDate: '',
  expectedReturnDate: '',
  useCase: '',
  additionalNotes: '',
  responsibilityAccepted: false,
}

function createEmptyEquipmentLine(): RequestedEquipmentLine {
  return {
    id: crypto.randomUUID(),
    searchTerm: '',
    selectedItem: null,
    quantity: 1,
  }
}

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

function formatDateForDisplay(value: string) {
  if (!value) {
    return 'Pending'
  }

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function PublicLoanRequestPage() {
  const [form, setForm] = useState<PublicRequestForm>(initialFormState)

  const [equipmentLines, setEquipmentLines] = useState<
    RequestedEquipmentLine[]
  >([createEmptyEquipmentLine()])

  const [submittedRequest, setSubmittedRequest] =
    useState<SubmittedRequest | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const hasInvalidDateRange = Boolean(
    form.preferredCheckoutDate &&
      form.expectedReturnDate &&
      form.expectedReturnDate < form.preferredCheckoutDate,
  )

  const selectedLines = equipmentLines.filter(
    (line) => line.selectedItem !== null,
  )

  const totalMsrp = selectedLines.reduce((sum, line) => {
    if (!line.selectedItem) {
      return sum
    }

    return sum + line.selectedItem.msrp * line.quantity
  }, 0)

  const formIsReady = Boolean(
    form.requesterName.trim() &&
      form.company.trim() &&
      form.email.trim() &&
      form.phone.trim() &&
      form.requesterType &&
      form.country.trim() &&
      form.city.trim() &&
      form.preferredCheckoutDate &&
      form.expectedReturnDate &&
      form.useCase.trim() &&
      !hasInvalidDateRange &&
      selectedLines.length > 0 &&
      equipmentLines.every(
        (line) => line.selectedItem === null || line.quantity >= 1,
      ) &&
      form.responsibilityAccepted,
  )

  function updateForm(
    field: keyof PublicRequestForm,
    value: string | boolean,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateLineSearch(lineId: string, searchTerm: string) {
    setEquipmentLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              searchTerm,
              selectedItem: null,
            }
          : line,
      ),
    )
  }

  function selectPricelistItem(
    lineId: string,
    selectedItem: AxisPricelistItem,
  ) {
    setEquipmentLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              selectedItem,
              searchTerm: `${selectedItem.partNumber} — ${selectedItem.productName}`,
            }
          : line,
      ),
    )
  }

  function clearSelectedItem(lineId: string) {
    setEquipmentLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              searchTerm: '',
              selectedItem: null,
            }
          : line,
      ),
    )
  }

  function updateLineQuantity(lineId: string, quantity: number) {
    const safeQuantity =
      Number.isFinite(quantity) && quantity >= 1 ? quantity : 1

    setEquipmentLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              quantity: safeQuantity,
            }
          : line,
      ),
    )
  }

  function addEquipmentLine() {
    setEquipmentLines((currentLines) => [
      ...currentLines,
      createEmptyEquipmentLine(),
    ])
  }

  function removeEquipmentLine(lineId: string) {
    setEquipmentLines((currentLines) => {
      if (currentLines.length === 1) {
        return currentLines
      }

      return currentLines.filter((line) => line.id !== lineId)
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formIsReady || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await createPublicLoanRequestInSupabase({
        requesterName: form.requesterName,
        requesterCompany: form.company,
        requesterEmail: form.email,
        requesterPhone: form.phone,
        requesterType: form.requesterType,
        requestedUseCase: form.useCase,
        destinationCountry: form.country,
        destinationCity: form.city,
        preferredCheckoutDate: form.preferredCheckoutDate,
        expectedReturnDate: form.expectedReturnDate,
        additionalNotes: form.additionalNotes,
        responsibilityAcknowledged: form.responsibilityAccepted,
        items: selectedLines.map((line) => {
          const item = line.selectedItem as AxisPricelistItem

          return {
            pricelistItemId: item.id,
            partNumber: item.partNumber,
            productName: item.productName,
            productDescription: item.productDescription,
            quantity: line.quantity,
            msrpUnit: item.msrp,
          }
        }),
      })

      setSubmittedRequest({
        requestCode: result.requestCode,
        form,
        lines: selectedLines,
        totalMsrp,
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to submit the loan request.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetRequestForm() {
    setForm(initialFormState)
    setEquipmentLines([createEmptyEquipmentLine()])
    setSubmittedRequest(null)
    setSubmitError(null)
  }

  if (submittedRequest) {
    return (
      <div className="min-h-screen bg-[#f5f5f3] text-[#171717]">
        <header className="border-b border-[#e5e5e2] bg-white px-6 py-6 lg:px-12">
          <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">
            <img
              src="/branding/axis-logo-dark.png"
              alt="Axis Communications"
              className="h-auto w-full max-w-[220px]"
            />

            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
            >
              Back to Sign In
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-12 lg:py-10">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
            <div className="space-y-6">
              <article className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  Request Submitted
                </p>

                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-emerald-950">
                  {submittedRequest.requestCode}
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-800">
                  Your equipment request has been submitted successfully and is
                  now available for administrative review.
                </p>
              </article>

              <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Request Summary"
                  title="Submitted Information"
                />

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <SummaryField
                    label="Requester"
                    value={submittedRequest.form.requesterName}
                  />

                  <SummaryField
                    label="Company"
                    value={submittedRequest.form.company}
                  />

                  <SummaryField
                    label="Email"
                    value={submittedRequest.form.email}
                  />

                  <SummaryField
                    label="Phone"
                    value={submittedRequest.form.phone}
                  />

                  <SummaryField
                    label="Requester Type"
                    value={submittedRequest.form.requesterType}
                  />

                  <SummaryField
                    label="Location"
                    value={`${submittedRequest.form.city}, ${submittedRequest.form.country}`}
                  />

                  <SummaryField
                    label="Preferred Checkout"
                    value={formatDateForDisplay(
                      submittedRequest.form.preferredCheckoutDate,
                    )}
                  />

                  <SummaryField
                    label="Expected Return"
                    value={formatDateForDisplay(
                      submittedRequest.form.expectedReturnDate,
                    )}
                  />
                </div>

                <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
                  <p className="text-sm font-medium text-[#666666]">
                    Intended Use Case
                  </p>

                  <p className="mt-2 text-sm leading-7 text-[#555555]">
                    {submittedRequest.form.useCase}
                  </p>
                </div>

                {submittedRequest.form.additionalNotes && (
                  <div className="mt-4 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
                    <p className="text-sm font-medium text-[#666666]">
                      Additional Notes
                    </p>

                    <p className="mt-2 text-sm leading-7 text-[#555555]">
                      {submittedRequest.form.additionalNotes}
                    </p>
                  </div>
                )}
              </article>

              <article className="overflow-hidden rounded-3xl border border-[#e5e5e2] bg-white shadow-sm">
                <div className="border-b border-[#e5e5e2] px-6 py-5">
                  <SectionHeader
                    eyebrow="Requested Equipment"
                    title="Axis Pricelist Selection"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#ecece8]">
                    <thead className="bg-[#fafaf8]">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Part Number
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Product
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Qty
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          MSRP Unit
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Line Total
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#f0f0ed] bg-white">
                      {submittedRequest.lines.map((line) => {
                        const item = line.selectedItem as AxisPricelistItem
                        const lineTotal = item.msrp * line.quantity

                        return (
                          <tr key={line.id}>
                            <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                              {item.partNumber}
                            </td>

                            <td className="min-w-[24rem] px-5 py-4">
                              <p className="text-sm font-semibold text-[#171717]">
                                {item.productName}
                              </p>

                              <p className="mt-1 text-sm leading-6 text-[#555555]">
                                {item.productDescription}
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-[#555555]">
                              {line.quantity}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-[#555555]">
                              {formatCurrency(item.msrp)}
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-[#171717]">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
              <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="MSRP Exposure"
                  title="Requested Equipment Value"
                />

                <p className="mt-6 text-4xl font-semibold tracking-tight text-[#171717]">
                  {formatCurrency(submittedRequest.totalMsrp)}
                </p>

                <p className="mt-3 text-sm leading-7 text-[#555555]">
                  This value is based on the Axis MSRP associated with the
                  requested products.
                </p>
              </article>

              <article className="rounded-3xl border border-amber-200 bg-[#fff8d6] p-6 shadow-sm">
                <p className="text-sm font-semibold text-[#5d4a00]">
                  Responsibility Acknowledged
                </p>

                <p className="mt-4 text-sm leading-7 text-[#5d4a00]">
                  {responsibilityText}
                </p>
              </article>

              <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <button
                  type="button"
                  onClick={resetRequestForm}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#181818] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
                >
                  Submit Another Request
                </button>
              </article>
            </aside>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f3] text-[#171717]">
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-6 lg:px-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <img
              src="/branding/axis-logo-dark.png"
              alt="Axis Communications"
              className="h-auto w-full max-w-[220px]"
            />

            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
              Demo Assets Control
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
          >
            Back to Sign In
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-12 lg:py-10">
        <div className="mb-8 max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#666666]">
            Public Request Form
          </p>

          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#171717] md:text-5xl">
            Request Demo Equipment
          </h1>

          <p className="mt-5 text-base leading-8 text-[#555555]">
            Submit an equipment loan request using the current Axis MSRP
            pricelist. This form does not confirm availability. Every request
            will be reviewed and approved by the administrator before an actual
            loan is created.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]"
        >
          <div className="space-y-6">
            <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 1"
                title="Requester Information"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <TextField
                  label="Full Name"
                  value={form.requesterName}
                  placeholder="Requester full name"
                  onChange={(value) => updateForm('requesterName', value)}
                />

                <TextField
                  label="Company"
                  value={form.company}
                  placeholder="Company name"
                  onChange={(value) => updateForm('company', value)}
                />

                <TextField
                  label="Email"
                  value={form.email}
                  placeholder="email@company.com"
                  onChange={(value) => updateForm('email', value)}
                />

                <TextField
                  label="Phone"
                  value={form.phone}
                  placeholder="+56 9..."
                  onChange={(value) => updateForm('phone', value)}
                />

                <SelectField
                  label="Requester Type"
                  value={form.requesterType}
                  onChange={(value) =>
                    updateForm('requesterType', value as RequesterType)
                  }
                  options={[
                    { label: 'Select', value: '' },
                    { label: 'End Customer', value: 'End Customer' },
                    { label: 'Integrator', value: 'Integrator' },
                    { label: 'Distributor', value: 'Distributor' },
                    { label: 'Internal', value: 'Internal' },
                    { label: 'Other', value: 'Other' },
                  ]}
                />

                <TextField
                  label="Country"
                  value={form.country}
                  placeholder="Chile"
                  onChange={(value) => updateForm('country', value)}
                />

                <TextField
                  label="City"
                  value={form.city}
                  placeholder="Santiago"
                  onChange={(value) => updateForm('city', value)}
                />
              </div>
            </article>

            <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader eyebrow="Step 2" title="Loan Context" />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DateField
                  label="Preferred Checkout Date"
                  value={form.preferredCheckoutDate}
                  onChange={(value) =>
                    updateForm('preferredCheckoutDate', value)
                  }
                />

                <DateField
                  label="Expected Return Date"
                  value={form.expectedReturnDate}
                  onChange={(value) =>
                    updateForm('expectedReturnDate', value)
                  }
                />
              </div>

              {hasInvalidDateRange && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    The expected return date cannot be earlier than the
                    preferred checkout date.
                  </p>
                </div>
              )}

              <div className="mt-5 space-y-5">
                <TextareaField
                  label="Intended Use Case"
                  value={form.useCase}
                  placeholder="Describe the opportunity, demo, proof of concept or validation where the requested equipment will be used."
                  onChange={(value) => updateForm('useCase', value)}
                />

                <TextareaField
                  label="Additional Notes"
                  value={form.additionalNotes}
                  placeholder="Optional comments."
                  onChange={(value) =>
                    updateForm('additionalNotes', value)
                  }
                />
              </div>
            </article>

            <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <SectionHeader
                  eyebrow="Step 3"
                  title="Requested Axis Equipment"
                />

                <button
                  type="button"
                  onClick={addEquipmentLine}
                  className="inline-flex items-center justify-center rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                >
                  + Add Equipment
                </button>
              </div>

              <p className="mt-4 max-w-4xl text-sm leading-7 text-[#555555]">
                Search by Axis part number, product name or description. The
                MSRP shown comes from the current LATAM pricelist uploaded to
                the system.
              </p>

              <div className="mt-6 space-y-4">
                {equipmentLines.map((line, index) => (
                  <EquipmentRequestLine
                    key={line.id}
                    line={line}
                    index={index}
                    canRemove={equipmentLines.length > 1}
                    onSearchChange={updateLineSearch}
                    onSelectItem={selectPricelistItem}
                    onClearItem={clearSelectedItem}
                    onQuantityChange={updateLineQuantity}
                    onRemoveLine={removeEquipmentLine}
                  />
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-amber-200 bg-[#fff8d6] p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 4"
                title="Responsibility Acknowledgement"
              />

              <label className="mt-6 flex cursor-pointer items-start gap-4 rounded-2xl border border-amber-300 bg-white/55 p-4">
                <input
                  type="checkbox"
                  checked={form.responsibilityAccepted}
                  onChange={(event) =>
                    updateForm(
                      'responsibilityAccepted',
                      event.target.checked,
                    )
                  }
                  className="mt-1 h-5 w-5"
                />

                <span className="text-sm leading-7 text-[#5d4a00]">
                  {responsibilityText}
                </span>
              </label>
            </article>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-8 xl:self-start">
            {submitError && (
              <article className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
                <p className="text-sm font-semibold text-red-800">
                  Request could not be submitted
                </p>

                <p className="mt-3 text-sm leading-7 text-red-700">
                  {submitError}
                </p>
              </article>
            )}

            <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader eyebrow="Request Preview" title="Summary" />

              <div className="mt-6 space-y-5">
                <SummaryField
                  label="Requester"
                  value={form.requesterName || 'Pending'}
                />

                <SummaryField
                  label="Company"
                  value={form.company || 'Pending'}
                />

                <SummaryField
                  label="Preferred Checkout"
                  value={formatDateForDisplay(form.preferredCheckoutDate)}
                />

                <SummaryField
                  label="Expected Return"
                  value={formatDateForDisplay(form.expectedReturnDate)}
                />

                <SummaryField
                  label="Selected Product Lines"
                  value={`${selectedLines.length}`}
                />
              </div>
            </article>

            <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="MSRP Exposure"
                title="Requested Equipment Value"
              />

              <p className="mt-6 text-4xl font-semibold tracking-tight text-[#171717]">
                {formatCurrency(totalMsrp)}
              </p>

              <p className="mt-3 text-sm leading-7 text-[#555555]">
                Total calculated from the MSRP values of the selected Axis
                products and requested quantities.
              </p>
            </article>

            <article className="rounded-3xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <button
                type="submit"
                disabled={!formIsReady || isSubmitting}
                className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
                  formIsReady && !isSubmitting
                    ? 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSubmitting ? 'Submitting Request...' : 'Submit Request'}
              </button>

              <p className="mt-4 text-sm leading-7 text-[#666666]">
                The request can be submitted once contact information, dates,
                equipment selection and the responsibility acknowledgement are
                complete.
              </p>
            </article>
          </aside>
        </form>
      </main>
    </div>
  )
}

function EquipmentRequestLine({
  line,
  index,
  canRemove,
  onSearchChange,
  onSelectItem,
  onClearItem,
  onQuantityChange,
  onRemoveLine,
}: {
  line: RequestedEquipmentLine
  index: number
  canRemove: boolean
  onSearchChange: (lineId: string, value: string) => void
  onSelectItem: (lineId: string, item: AxisPricelistItem) => void
  onClearItem: (lineId: string) => void
  onQuantityChange: (lineId: string, quantity: number) => void
  onRemoveLine: (lineId: string) => void
}) {
  const normalizedSearch = normalizeSearchText(line.searchTerm)

  const results = useMemo(() => {
    if (line.selectedItem || normalizedSearch.length < 2) {
      return []
    }

    return axisPricelistItems
      .filter((item) => {
        const searchableText = normalizeSearchText(
          [
            item.partNumber,
            item.productName,
            item.productDescription,
          ].join(' '),
        )

        return searchableText.includes(normalizedSearch)
      })
      .slice(0, 8)
  }, [line.selectedItem, normalizedSearch])

  const lineTotal = line.selectedItem
    ? line.selectedItem.msrp * line.quantity
    : 0

  return (
    <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-[#171717]">
            Equipment Line {index + 1}
          </p>

          <p className="mt-1 text-sm text-[#666666]">
            Select one Axis pricelist item for this line.
          </p>
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemoveLine(line.id)}
            className="text-sm font-semibold text-red-700 transition hover:text-red-900 hover:underline"
          >
            Remove Line
          </button>
        )}
      </div>

      {!line.selectedItem ? (
        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-[#444444]">
            Search Axis Pricelist
          </label>

          <input
            type="text"
            value={line.searchTerm}
            onChange={(event) =>
              onSearchChange(line.id, event.target.value)
            }
            placeholder="Part number, product name or description"
            className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
          />

          {normalizedSearch.length === 1 && (
            <p className="mt-3 text-sm text-[#666666]">
              Type at least 2 characters to search.
            </p>
          )}

          {normalizedSearch.length >= 2 && results.length === 0 && (
            <div className="mt-3 rounded-2xl border border-[#e5e5e2] bg-white p-4">
              <p className="text-sm font-semibold text-[#171717]">
                No Axis products match this search.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(line.id, item)}
                  className="block w-full border-b border-[#f0f0ed] px-4 py-4 text-left transition last:border-b-0 hover:bg-[#fff8d6]"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <p className="text-sm font-semibold text-[#171717]">
                        {item.partNumber} — {item.productName}
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#555555]">
                        {item.productDescription}
                      </p>
                    </div>

                    <div className="whitespace-nowrap text-sm font-semibold text-[#171717]">
                      {formatCurrency(item.msrp)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-[#ead272] bg-[#fff8d6] p-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-semibold text-[#171717]">
                  {line.selectedItem.partNumber}
                </p>

                <p className="mt-1 text-base font-semibold text-[#171717]">
                  {line.selectedItem.productName}
                </p>

                <p className="mt-2 text-sm leading-6 text-[#555555]">
                  {line.selectedItem.productDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onClearItem(line.id)}
                className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
              >
                Change Product
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#444444]">
                Quantity
              </label>

              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(event) =>
                  onQuantityChange(line.id, Number(event.target.value))
                }
                className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[#666666]">
                MSRP Unit
              </p>

              <p className="mt-3 text-lg font-semibold text-[#171717]">
                {formatCurrency(line.selectedItem.msrp)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-[#666666]">
                Line Total
              </p>

              <p className="mt-3 text-lg font-semibold text-[#171717]">
                {formatCurrency(lineTotal)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
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
      <h2 className="mt-1 text-xl font-semibold text-[#171717]">{title}</h2>
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
