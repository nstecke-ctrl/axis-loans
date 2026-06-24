import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { internalContactOptions } from '../../../lib/internalContacts'
import {
  getEquipmentStatusTone,
  type EquipmentItem,
} from '../../inventory/data/equipment'
import { fetchEquipmentItemsFromSupabase } from '../../inventory/data/equipmentSupabase'
import type { LoanRequest } from '../../loan-requests/data/loanRequests'
import { fetchLoanRequestDetailFromSupabase } from '../../loan-requests/data/loanRequestsSupabase'
import type { LoanItem } from '../data/loans'
import { createInternalLoanInSupabase } from '../data/loansSupabase'

type NewLoanForm = {
  recipientType: string
  company: string
  contactName: string
  contactEmail: string
  contactPhone: string
  country: string
  city: string
  address: string
  checkoutHandler: string
  responsible: string
  reason: string
  projectName: string
  checkoutDate: string
  expectedReturnDate: string
  notes: string
}

type SubmittedLoan = {
  loan: LoanItem
  form: NewLoanForm
  equipment: EquipmentItem[]
}

const defaultFormState: NewLoanForm = {
  recipientType: '',
  company: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  country: 'Chile',
  city: '',
  address: '',
  checkoutHandler: 'Tamara Castro',
  responsible: 'Nicolás Steck',
  reason: '',
  projectName: '',
  checkoutDate: '',
  expectedReturnDate: '',
  notes: '',
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

function dateForInput(value: string) {
  if (!value.includes('/')) {
    return value
  }

  const [day, month, year] = value.split('/')
  return `${year}-${month}-${day}`
}

function buildFormFromRequest(request: LoanRequest): NewLoanForm {
  return {
    recipientType: request.requesterType,
    company: request.requesterCompany,
    contactName: request.requesterName,
    contactEmail: request.requesterEmail,
    contactPhone: request.requesterPhone,
    country: request.destinationCountry,
    city: request.destinationCity,
    address: '',
    checkoutHandler: request.requestedHandler,
    responsible: 'Nicolás Steck',
    reason: 'Requested Demo Equipment',
    projectName: '',
    checkoutDate: dateForInput(request.preferredCheckoutDate),
    expectedReturnDate: dateForInput(request.expectedReturnDate),
    notes: [
      `Converted from loan request ${request.code}.`,
      '',
      `Original use case: ${request.requestedUseCase}`,
      request.additionalNotes
        ? `Additional notes: ${request.additionalNotes}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

export function NewLoanPage() {
  const [searchParams] = useSearchParams()
  const requestCode = searchParams.get('request')

  const [sourceRequest, setSourceRequest] = useState<LoanRequest | null>(null)
  const [form, setForm] = useState<NewLoanForm>(defaultFormState)

  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [equipmentSearch, setEquipmentSearch] = useState('')
  const [selectedEquipmentCodes, setSelectedEquipmentCodes] = useState<
    string[]
  >([])

  const [submittedLoan, setSubmittedLoan] = useState<SubmittedLoan | null>(
    null,
  )

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadNewLoanData() {
      setIsLoading(true)
      setLoadError(null)
      setSubmitError(null)

      try {
        const equipmentPromise = fetchEquipmentItemsFromSupabase()

        const requestPromise = requestCode
          ? fetchLoanRequestDetailFromSupabase(requestCode)
          : Promise.resolve(null)

        const [equipment, request] = await Promise.all([
          equipmentPromise,
          requestPromise,
        ])

        if (!isMounted) {
          return
        }

        setEquipmentItems(equipment)
        setSourceRequest(request)

        if (requestCode && !request) {
          setLoadError(
            'The source loan request was not found in Supabase.',
          )
          return
        }

        if (request?.status === 'Converted to Loan') {
          setLoadError(
            'This request has already been converted into a loan.',
          )
          return
        }

        if (request && request.status !== 'Approved') {
          setLoadError(
            'Only approved requests can be converted into loans.',
          )
          return
        }

        if (request) {
          setForm(buildFormFromRequest(request))
        } else {
          setForm(defaultFormState)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load loan creation data from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadNewLoanData()

    return () => {
      isMounted = false
    }
  }, [requestCode])

  const availableEquipment = equipmentItems.filter(
    (equipment) => equipment.status === 'Available',
  )

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = normalizeSearchText(equipmentSearch)

    if (!normalizedSearch) {
      return availableEquipment
    }

    return availableEquipment.filter((equipment) => {
      const searchableText = normalizeSearchText(
        [
          equipment.code,
          equipment.category,
          equipment.brand,
          equipment.model,
          equipment.partNumber,
          equipment.serialNumber,
        ].join(' '),
      )

      return searchableText.includes(normalizedSearch)
    })
  }, [availableEquipment, equipmentSearch])

  const selectedEquipment = availableEquipment.filter((equipment) =>
    selectedEquipmentCodes.includes(equipment.code),
  )

  const hasInvalidDateRange = Boolean(
    form.checkoutDate &&
      form.expectedReturnDate &&
      form.expectedReturnDate < form.checkoutDate,
  )

  const isFormReady = Boolean(
    form.recipientType &&
      form.company &&
      form.checkoutHandler &&
      form.responsible &&
      form.reason &&
      form.checkoutDate &&
      form.expectedReturnDate &&
      selectedEquipment.length > 0 &&
      !hasInvalidDateRange &&
      !isSubmitting,
  )

  function updateForm(field: keyof NewLoanForm, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function toggleEquipmentSelection(equipmentCode: string) {
    setSelectedEquipmentCodes((currentCodes) => {
      if (currentCodes.includes(equipmentCode)) {
        return currentCodes.filter((code) => code !== equipmentCode)
      }

      return [...currentCodes, equipmentCode]
    })
  }

  function removeSelectedEquipment(equipmentCode: string) {
    setSelectedEquipmentCodes((currentCodes) =>
      currentCodes.filter((code) => code !== equipmentCode),
    )
  }

  async function handleSubmitLoan() {
    if (!isFormReady) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const createdLoan = await createInternalLoanInSupabase(
        {
          recipientType: form.recipientType,
          company: form.company,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          checkoutHandler: form.checkoutHandler,
          responsible: form.responsible,
          reason: form.reason,
          projectName: form.projectName || undefined,
          country: form.country,
          city: form.city,
          address: form.address || undefined,
          checkoutDate: form.checkoutDate,
          expectedReturnDate: form.expectedReturnDate,
          notes: form.notes || undefined,
          equipment: selectedEquipment.map((equipment) => ({
            equipmentCode: equipment.code,
            category: equipment.category,
            model: equipment.model,
            serialNumber: equipment.serialNumber,
          })),
        },
        sourceRequest?.code,
      )

      setSubmittedLoan({
        loan: createdLoan,
        form,
        equipment: selectedEquipment,
      })
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to create this loan.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCreateAnotherLoan() {
    setForm(defaultFormState)
    setEquipmentSearch('')
    setSelectedEquipmentCodes([])
    setSubmittedLoan(null)
    setSubmitError(null)
    setSourceRequest(null)
  }

  if (isLoading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Loan Management
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Loading loan creation data...
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            Retrieving available inventory and any approved source request from
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
            Loan Creation Error
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-red-950">
            This loan cannot be prepared
          </h2>

          <p className="mt-4 max-w-2xl text-red-800">{loadError}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/loan-requests"
              className="inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
            >
              Back to Loan Requests
            </Link>

            <Link
              to="/loans"
              className="inline-flex rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
            >
              Back to Loans
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (submittedLoan) {
    return (
      <>
        <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Loan created successfully
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Loan saved and equipment status updated
            </h2>
          </div>
        </header>

        <section className="px-6 py-6 lg:px-10 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
            <div className="space-y-6">
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-emerald-700">
                  Loan Code
                </p>

                <h3 className="mt-2 text-3xl font-semibold text-emerald-950">
                  {submittedLoan.loan.code}
                </h3>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-800">
                  This loan has been stored in Supabase. The assigned equipment
                  has also been updated to On Loan in the inventory.
                </p>
              </article>

              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Loan Summary"
                  title="Main Loan Information"
                  description="This is the information now registered in the database."
                />

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <SummaryDetail
                    label="Recipient"
                    value={submittedLoan.loan.company}
                  />

                  <SummaryDetail
                    label="Recipient Type"
                    value={submittedLoan.loan.recipientType}
                  />

                  <SummaryDetail
                    label="Contact"
                    value={submittedLoan.loan.contactName || 'Not registered'}
                  />

                  <SummaryDetail
                    label="Email"
                    value={submittedLoan.loan.contactEmail || 'Not registered'}
                  />

                  <SummaryDetail
                    label="Internal Owner"
                    value={submittedLoan.loan.responsible}
                  />

                  <SummaryDetail
                    label="Reason"
                    value={submittedLoan.loan.reason}
                  />

                  <SummaryDetail
                    label="Checkout Date"
                    value={submittedLoan.loan.checkoutDate}
                  />

                  <SummaryDetail
                    label="Expected Return"
                    value={submittedLoan.loan.expectedReturnDate}
                  />
                </div>

                {submittedLoan.loan.notes && (
                  <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
                    <p className="text-sm font-medium text-[#666666]">
                      Notes
                    </p>

                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#555555]">
                      {submittedLoan.loan.notes}
                    </p>
                  </div>
                )}
              </article>

              <article className="overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
                <div className="border-b border-[#e5e5e2] px-6 py-5">
                  <p className="text-sm font-medium text-[#666666]">
                    Selected Equipment
                  </p>

                  <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                    Assets Included in the Loan
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#ecece8]">
                    <thead className="bg-[#fafaf8]">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Code
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Model
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Serial
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#f0f0ed] bg-white">
                      {submittedLoan.loan.equipment.map((equipment) => (
                        <tr key={equipment.equipmentCode}>
                          <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                            {equipment.equipmentCode}
                          </td>

                          <td className="min-w-64 px-5 py-4 text-sm text-[#555555]">
                            {equipment.model}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                            {equipment.serialNumber}
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
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader eyebrow="Next Action" title="Continue" />

                <div className="mt-6 space-y-3">
                  <Link
                    to="/loans"
                    className="inline-flex w-full justify-center rounded-xl bg-[#181818] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    Back to Loans
                  </Link>

                  <Link
                    to="/inventory"
                    className="inline-flex w-full justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    View Updated Inventory
                  </Link>

                  <Link
                    to={`/loans/${submittedLoan.loan.code}`}
                    className="inline-flex w-full justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    View Loan Detail
                  </Link>

                  <button
                    type="button"
                    onClick={handleCreateAnotherLoan}
                    className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Register Another Loan
                  </button>
                </div>
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
              to={
                sourceRequest
                  ? `/loan-requests/${sourceRequest.code}`
                  : '/loans'
              }
              className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
            >
              ← {sourceRequest ? 'Back to Loan Request' : 'Back to Loans'}
            </Link>

            <p className="mt-4 text-sm font-medium text-[#666666]">
              Loan Management
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              New Loan
            </h2>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-[#fff8d6] px-4 py-3">
            <p className="text-sm font-semibold text-[#5d4a00]">
              {sourceRequest ? 'Converted from Loan Request' : 'Loan Creation'}
            </p>

            <p className="mt-1 text-sm text-[#5d4a00]">
              {sourceRequest
                ? `${sourceRequest.code} has prefilled this loan form.`
                : 'Build the loan before saving it to the system.'}
            </p>
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {submitError && (
          <article className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">
              Loan could not be created
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {submitError}
            </p>
          </article>
        )}

        {sourceRequest && (
          <article className="mb-6 overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
            <div className="border-b border-[#e5e5e2] px-6 py-5">
              <SectionHeader
                eyebrow="Source Request"
                title="Requested Axis Equipment Reference"
                description="Use this as the commercial reference. Assign the actual physical assets below."
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
                  {sourceRequest.items.map((item) => (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                        {item.partNumber}
                      </td>

                      <td className="min-w-[26rem] px-5 py-4">
                        <p className="text-sm font-semibold text-[#171717]">
                          {item.productName}
                        </p>

                        <p className="mt-1 text-sm leading-6 text-[#555555]">
                          {item.productDescription}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-[#555555]">
                        {item.quantity}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-[#555555]">
                        {formatCurrency(item.msrpUnit)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-[#171717]">
                        {formatCurrency(item.msrpLineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-[#e5e5e2] bg-[#fafaf8] px-6 py-5 md:flex-row md:items-center">
              <p className="text-sm leading-6 text-[#555555]">
                This request represents pricelist products, not automatically
                available serialized inventory.
              </p>

              <div className="text-sm">
                <span className="text-[#666666]">Requested MSRP Total: </span>

                <span className="font-semibold text-[#171717]">
                  {formatCurrency(sourceRequest.msrpTotalAmount)}
                </span>
              </div>
            </div>
          </article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 1"
                title="Recipient Information"
                description="Identify who will receive the equipment."
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Recipient Type"
                  value={form.recipientType}
                  onChange={(value) => updateForm('recipientType', value)}
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
                  label="Receiving Company"
                  value={form.company}
                  placeholder="Example: Banco Central"
                  onChange={(value) => updateForm('company', value)}
                />

                <TextField
                  label="Contact Name"
                  value={form.contactName}
                  placeholder="Contact person"
                  onChange={(value) => updateForm('contactName', value)}
                />

                <TextField
                  label="Contact Email"
                  value={form.contactEmail}
                  placeholder="email@company.com"
                  onChange={(value) => updateForm('contactEmail', value)}
                />

                <TextField
                  label="Contact Phone"
                  value={form.contactPhone}
                  placeholder="+56 9..."
                  onChange={(value) => updateForm('contactPhone', value)}
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

                <TextField
                  label="Address or Reference"
                  value={form.address}
                  placeholder="Optional"
                  onChange={(value) => updateForm('address', value)}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 2"
                title="Internal Management"
                description="Define ownership and purpose of the loan."
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Delivered By"
                  value={form.checkoutHandler}
                  onChange={(value) => updateForm('checkoutHandler', value)}
                  options={internalContactOptions}
                />

                <SelectField
                  label="Follow-Up Owner"
                  value={form.responsible}
                  onChange={(value) => updateForm('responsible', value)}
                  options={internalContactOptions}
                />

                <SelectField
                  label="Loan Reason"
                  value={form.reason}
                  onChange={(value) => updateForm('reason', value)}
                  options={[
                    { label: 'Select', value: '' },
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
                  value={form.projectName}
                  placeholder="Optional"
                  onChange={(value) => updateForm('projectName', value)}
                />
              </div>

              <div className="mt-5">
                <TextareaField
                  label="Notes"
                  value={form.notes}
                  placeholder="Relevant comments for this loan."
                  onChange={(value) => updateForm('notes', value)}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 3"
                title="Loan Dates"
                description="Define checkout and expected return."
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DateField
                  label="Checkout Date"
                  value={form.checkoutDate}
                  onChange={(value) => updateForm('checkoutDate', value)}
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
                    The expected return date cannot be earlier than the checkout
                    date.
                  </p>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 4"
                title="Assign Physical Inventory"
                description="Select the actual available assets that will be loaned."
              />

              <div className="mt-6">
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  Search Available Equipment
                </label>

                <input
                  type="text"
                  value={equipmentSearch}
                  onChange={(event) => setEquipmentSearch(event.target.value)}
                  placeholder="Code, model, serial, category or part number"
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                />
              </div>

              <div className="mt-5 space-y-3">
                {filteredEquipment.map((equipment) => {
                  const isSelected = selectedEquipmentCodes.includes(
                    equipment.code,
                  )

                  return (
                    <div
                      key={equipment.code}
                      className={`rounded-2xl border p-4 transition ${
                        isSelected
                          ? 'border-[#ffda00] bg-[#fff8d6]'
                          : 'border-[#e5e5e2] bg-white hover:bg-[#fafaf8]'
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#171717]">
                              {equipment.code}
                            </p>

                            <StatusBadge
                              label={equipment.status}
                              tone={getEquipmentStatusTone(equipment.status)}
                            />
                          </div>

                          <p className="mt-2 font-semibold text-[#171717]">
                            {equipment.model}
                          </p>

                          <p className="mt-1 text-sm text-[#555555]">
                            {equipment.category} · {equipment.partNumber} ·{' '}
                            {equipment.serialNumber}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleEquipmentSelection(equipment.code)
                          }
                          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                            isSelected
                              ? 'border border-[#d8d8d4] bg-white text-[#171717] hover:bg-[#fafaf8]'
                              : 'bg-[#181818] text-white hover:bg-black'
                          }`}
                        >
                          {isSelected ? 'Remove' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  )
                })}

                {filteredEquipment.length === 0 && (
                  <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                    <p className="text-sm font-semibold text-[#171717]">
                      No available equipment matches this search.
                    </p>
                  </div>
                )}
              </div>
            </article>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader eyebrow="Preview" title="Loan Summary" />

              <div className="mt-6 space-y-5">
                <SummaryField
                  label="Recipient"
                  value={form.company || 'Pending'}
                />

                <SummaryField
                  label="Recipient Type"
                  value={form.recipientType || 'Pending'}
                />

                <SummaryField
                  label="Delivered By"
                  value={form.checkoutHandler || 'Pending'}
                />

                <SummaryField
                  label="Follow-Up Owner"
                  value={form.responsible || 'Pending'}
                />

                <SummaryField
                  label="Reason"
                  value={form.reason || 'Pending'}
                />

                <SummaryField
                  label="Checkout Date"
                  value={form.checkoutDate || 'Pending'}
                />

                <SummaryField
                  label="Expected Return"
                  value={form.expectedReturnDate || 'Pending'}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#666666]">
                    Assigned Equipment
                  </p>

                  <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                    {selectedEquipment.length} assets
                  </h3>
                </div>

                <span className="rounded-full bg-[#f3f3f0] px-3 py-1 text-sm font-semibold text-[#444444]">
                  Available
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {selectedEquipment.map((equipment) => (
                  <div
                    key={equipment.code}
                    className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#171717]">
                          {equipment.code}
                        </p>

                        <p className="mt-1 text-sm text-[#555555]">
                          {equipment.model}
                        </p>

                        <p className="mt-1 text-xs text-[#777777]">
                          {equipment.serialNumber}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeSelectedEquipment(equipment.code)
                        }
                        className="text-sm font-semibold text-red-700 transition hover:text-red-900 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {selectedEquipment.length === 0 && (
                  <div className="rounded-2xl bg-[#fafaf8] p-4">
                    <p className="text-sm leading-6 text-[#555555]">
                      No physical inventory has been assigned yet.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <button
                type="button"
                onClick={handleSubmitLoan}
                disabled={!isFormReady}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isFormReady
                    ? 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSubmitting ? 'Saving Loan...' : 'Save Loan'}
              </button>

              <p className="mt-3 text-sm leading-6 text-[#666666]">
                Saving the loan will register it in Supabase and update the
                selected assets as On Loan.
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
  description,
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#666666]">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-semibold text-[#171717]">{title}</h3>

      {description && (
        <p className="mt-2 text-sm leading-6 text-[#555555]">{description}</p>
      )}
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

function SummaryDetail({
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
