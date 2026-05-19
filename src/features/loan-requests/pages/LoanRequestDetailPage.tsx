import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  getLoanRequestStatusTone,
  type LoanRequest,
} from '../data/loanRequests'
import {
  fetchLoanRequestDetailFromSupabase,
  reviewLoanRequestInSupabase,
} from '../data/loanRequestsSupabase'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function LoanRequestDetailPage() {
  const navigate = useNavigate()
  const { requestCode } = useParams()

  const [request, setRequest] = useState<LoanRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [rejectionError, setRejectionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingDecision, setIsSavingDecision] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadRequestDetail() {
      if (!requestCode) {
        setRequest(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError(null)
      setActionMessage(null)
      setActionError(null)
      setRejectionError(null)

      try {
        const requestDetail =
          await fetchLoanRequestDetailFromSupabase(requestCode)

        if (!isMounted) {
          return
        }

        setRequest(requestDetail)
        setReviewNotes(requestDetail?.reviewNotes ?? '')
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load loan request detail from Supabase.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadRequestDetail()

    return () => {
      isMounted = false
    }
  }, [requestCode])

  async function handleApprove() {
    if (!request) {
      return
    }

    setIsSavingDecision(true)
    setActionMessage(null)
    setActionError(null)
    setRejectionError(null)

    try {
      const updatedRequest = await reviewLoanRequestInSupabase(
        request.code,
        'Approved',
        reviewNotes,
      )

      setRequest(updatedRequest)
      setReviewNotes(updatedRequest?.reviewNotes ?? reviewNotes)
      setActionMessage(
        'Request approved and saved in Supabase. It is now ready to be converted into a loan.',
      )
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to approve this loan request.',
      )
    } finally {
      setIsSavingDecision(false)
    }
  }

  async function handleReject() {
    if (!request) {
      return
    }

    if (!reviewNotes.trim()) {
      setRejectionError(
        'A rejection note is required before rejecting the request.',
      )
      return
    }

    setIsSavingDecision(true)
    setActionMessage(null)
    setActionError(null)
    setRejectionError(null)

    try {
      const updatedRequest = await reviewLoanRequestInSupabase(
        request.code,
        'Rejected',
        reviewNotes,
      )

      setRequest(updatedRequest)
      setReviewNotes(updatedRequest?.reviewNotes ?? reviewNotes)
      setActionMessage(
        'Request rejected and saved in Supabase. The review note has been preserved.',
      )
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to reject this loan request.',
      )
    } finally {
      setIsSavingDecision(false)
    }
  }

  function handleConvertToLoan() {
    if (!request || request.status !== 'Approved') {
      return
    }

    navigate(`/loans/new?request=${request.code}`)
  }

  if (isLoading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Loan Request Detail
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Loading request...
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            Retrieving the request, selected equipment and review information
            from Supabase.
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
            Loan Request Detail Error
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-red-950">
            The request could not be loaded
          </h2>

          <p className="mt-4 max-w-2xl text-red-800">{loadError}</p>

          <Link
            to="/loan-requests"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Loan Requests
          </Link>
        </div>
      </section>
    )
  }

  if (!request) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Request Not Found
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            No record exists for this loan request
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            The requested loan request is not available in Supabase.
          </p>

          <Link
            to="/loan-requests"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Loan Requests
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link
              to="/loan-requests"
              className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
            >
              ← Back to Loan Requests
            </Link>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  {request.code}
                </p>

                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
                  {request.requesterCompany}
                </h2>
              </div>

              <StatusBadge
                label={request.status}
                tone={getLoanRequestStatusTone(request.status)}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.85fr]">
          <div className="space-y-6">
            {actionMessage && (
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <p className="text-sm font-semibold text-emerald-800">
                  {actionMessage}
                </p>
              </article>
            )}

            {actionError && (
              <article className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <p className="text-sm font-semibold text-red-800">
                  {actionError}
                </p>
              </article>
            )}

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Requester Information"
                title="Submitted Contact Details"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DetailField
                  label="Requester"
                  value={request.requesterName}
                />

                <DetailField
                  label="Company"
                  value={request.requesterCompany}
                />

                <DetailField label="Email" value={request.requesterEmail} />

                <DetailField label="Phone" value={request.requesterPhone} />

                <DetailField
                  label="Requester Type"
                  value={request.requesterType}
                />

                <DetailField
                  label="Destination"
                  value={`${request.destinationCity}, ${request.destinationCountry}`}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Request Context"
                title="Purpose and Timing"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DetailField
                  label="Preferred Checkout"
                  value={request.preferredCheckoutDate}
                />

                <DetailField
                  label="Expected Return"
                  value={request.expectedReturnDate}
                />

                <DetailField
                  label="Submitted At"
                  value={request.submittedAt}
                />
              </div>

              <div className="mt-5 space-y-5">
                <DetailBlock
                  label="Requested Use Case"
                  value={request.requestedUseCase}
                />

                <DetailBlock
                  label="Additional Notes"
                  value={request.additionalNotes ?? 'No additional notes'}
                />
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
              <div className="border-b border-[#e5e5e2] px-6 py-5">
                <SectionHeader
                  eyebrow="Requested Axis Equipment"
                  title="Pricelist-Based Selection"
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
                    {request.items.map((item) => (
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
            </article>

            <article className="rounded-2xl border border-amber-200 bg-[#fff8d6] p-6 shadow-sm">
              <SectionHeader
                eyebrow="Responsibility"
                title="Acknowledged Statement"
              />

              <p className="mt-5 text-sm leading-7 text-[#5d4a00]">
                {request.responsibilityText}
              </p>
            </article>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Financial Exposure"
                title="MSRP Total"
              />

              <p className="mt-6 text-4xl font-semibold tracking-tight text-[#171717]">
                {formatCurrency(request.msrpTotalAmount)}
              </p>

              <p className="mt-3 text-sm leading-7 text-[#555555]">
                Total referential MSRP associated with the requested Axis
                equipment.
              </p>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Administrative Review"
                title="Decision"
              />

              <div className="mt-6">
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  Review Notes
                </label>

                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={5}
                  placeholder="Add approval, rejection or follow-up notes."
                  className="w-full resize-none rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                />
              </div>

              {rejectionError && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {rejectionError}
                  </p>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isSavingDecision}
                  className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isSavingDecision
                      ? 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                      : 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                  }`}
                >
                  {isSavingDecision ? 'Saving...' : 'Approve Request'}
                </button>

                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isSavingDecision}
                  className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    isSavingDecision
                      ? 'cursor-not-allowed border-[#e5e5e2] bg-[#ecece8] text-[#888888]'
                      : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                  }`}
                >
                  {isSavingDecision ? 'Saving...' : 'Reject Request'}
                </button>

                <button
                  type="button"
                  onClick={handleConvertToLoan}
                  disabled={request.status !== 'Approved'}
                  className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    request.status === 'Approved'
                      ? 'bg-[#181818] text-white hover:bg-black'
                      : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                  }`}
                >
                  Convert to Loan
                </button>
              </div>

              <p className="mt-4 text-sm leading-7 text-[#666666]">
                Conversion is available only after approval. The conversion
                form will be connected to Supabase in the next block.
              </p>
            </article>

            {(request.reviewedBy || request.reviewedAt) && (
              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Existing Review Record"
                  title="Previous Decision"
                />

                <div className="mt-6 space-y-5">
                  <DetailField
                    label="Reviewed By"
                    value={request.reviewedBy ?? 'Not registered'}
                  />

                  <DetailField
                    label="Reviewed At"
                    value={request.reviewedAt ?? 'Not registered'}
                  />

                  <DetailBlock
                    label="Stored Review Notes"
                    value={request.reviewNotes ?? 'No stored notes'}
                  />
                </div>
              </article>
            )}

            {request.convertedLoanCode && (
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Converted Loan"
                  title="Linked Loan Record"
                />

                <p className="mt-5 text-sm text-emerald-800">
                  This request has already been converted into:
                </p>

                <p className="mt-2 text-xl font-semibold text-emerald-950">
                  {request.convertedLoanCode}
                </p>

                <Link
                  to={`/loans/${request.convertedLoanCode}`}
                  className="mt-5 inline-flex w-full justify-center rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-950"
                >
                  View Loan
                </Link>
              </article>
            )}
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


