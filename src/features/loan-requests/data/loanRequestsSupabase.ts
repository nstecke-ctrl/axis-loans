import { supabase } from '../../../lib/supabase'
import type { LoanRequest } from './loanRequests'

type LoanRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Converted to Loan'

type LoanRequestItemRow = {
  id: string
  pricelist_item_id: string | null
  part_number: string
  product_name: string
  product_description: string
  quantity: number
  msrp_unit: number | string
  msrp_line_total: number | string
}

type LoanRequestRow = {
  id: string
  code: string
  requester_name: string
  requester_company: string
  requester_email: string
  requester_phone: string
  requester_type: string
  requested_use_case: string
  destination_country: string
  destination_city: string
  preferred_checkout_date: string
  expected_return_date: string
  additional_notes: string | null
  status: LoanRequestStatus
  submitted_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  responsibility_acknowledged: boolean
  responsibility_text: string
  msrp_total_amount: number | string
  converted_loan_id: string | null
  loan_request_items?: LoanRequestItemRow[]
}

type ConvertedLoanRow = {
  code: string
}

type ReviewLoanRequestRpcResponse = {
  request_id: string
  request_code: string
  updated_status: 'Approved' | 'Rejected'
}

function formatDatabaseDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function formatDatabaseTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-GB').format(new Date(value))
}

function parseNumericValue(value: number | string) {
  return typeof value === 'number' ? value : Number(value)
}

function mapLoanRequestRowToRequest(
  row: LoanRequestRow,
  convertedLoanCode?: string,
): LoanRequest {
  return {
    code: row.code,
    requesterName: row.requester_name,
    requesterCompany: row.requester_company,
    requesterEmail: row.requester_email,
    requesterPhone: row.requester_phone,
    requesterType: row.requester_type,
    requestedUseCase: row.requested_use_case,
    destinationCountry: row.destination_country,
    destinationCity: row.destination_city,
    preferredCheckoutDate: formatDatabaseDate(row.preferred_checkout_date),
    expectedReturnDate: formatDatabaseDate(row.expected_return_date),
    additionalNotes: row.additional_notes ?? undefined,
    status: row.status,
    submittedAt: formatDatabaseTimestamp(row.submitted_at),
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at
      ? formatDatabaseTimestamp(row.reviewed_at)
      : undefined,
    reviewNotes: row.review_notes ?? undefined,
    convertedLoanCode,
    responsibilityAcknowledged: row.responsibility_acknowledged,
    responsibilityText: row.responsibility_text,
    items: (row.loan_request_items ?? []).map((item) => ({
      id: item.id,
      pricelistItemId: item.pricelist_item_id ?? '',
      partNumber: item.part_number,
      productName: item.product_name,
      productDescription: item.product_description,
      quantity: item.quantity,
      msrpUnit: parseNumericValue(item.msrp_unit),
      msrpLineTotal: parseNumericValue(item.msrp_line_total),
    })),
    msrpTotalAmount: parseNumericValue(row.msrp_total_amount),
  }
}

const loanRequestSelect = `
  id,
  code,
  requester_name,
  requester_company,
  requester_email,
  requester_phone,
  requester_type,
  requested_use_case,
  destination_country,
  destination_city,
  preferred_checkout_date,
  expected_return_date,
  additional_notes,
  status,
  submitted_at,
  reviewed_by,
  reviewed_at,
  review_notes,
  responsibility_acknowledged,
  responsibility_text,
  msrp_total_amount,
  converted_loan_id,
  loan_request_items (
    id,
    pricelist_item_id,
    part_number,
    product_name,
    product_description,
    quantity,
    msrp_unit,
    msrp_line_total
  )
`

export async function fetchLoanRequestsFromSupabase(): Promise<LoanRequest[]> {
  const { data, error } = await supabase
    .from('loan_requests')
    .select(loanRequestSelect)
    .order('submitted_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load loan requests: ${error.message}`)
  }

  return ((data ?? []) as LoanRequestRow[]).map((row) =>
    mapLoanRequestRowToRequest(row),
  )
}

export async function fetchLoanRequestDetailFromSupabase(
  requestCode: string,
): Promise<LoanRequest | null> {
  const { data, error } = await supabase
    .from('loan_requests')
    .select(loanRequestSelect)
    .eq('code', requestCode)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load loan request detail: ${error.message}`)
  }

  if (!data) {
    return null
  }

  const requestRow = data as LoanRequestRow

  if (!requestRow.converted_loan_id) {
    return mapLoanRequestRowToRequest(requestRow)
  }

  const { data: convertedLoan, error: convertedLoanError } = await supabase
    .from('loans')
    .select('code')
    .eq('id', requestRow.converted_loan_id)
    .limit(1)
    .maybeSingle()

  if (convertedLoanError) {
    throw new Error(
      `Unable to load converted loan reference: ${convertedLoanError.message}`,
    )
  }

  return mapLoanRequestRowToRequest(
    requestRow,
    (convertedLoan as ConvertedLoanRow | null)?.code,
  )
}

export async function reviewLoanRequestInSupabase(
  requestCode: string,
  status: 'Approved' | 'Rejected',
  reviewNotes: string,
): Promise<LoanRequest | null> {
  const { data: userData } = await supabase.auth.getUser()

  const reviewedBy = userData.user?.email ?? 'Administrator'

  const { data, error } = await supabase.rpc('review_loan_request', {
    p_request_code: requestCode,
    p_new_status: status,
    p_review_notes: reviewNotes.trim(),
    p_reviewed_by: reviewedBy,
  })

  if (error) {
    throw new Error(`Unable to review loan request: ${error.message}`)
  }

  const reviewedRequest = (
    data as ReviewLoanRequestRpcResponse[] | null
  )?.[0]

  if (!reviewedRequest) {
    throw new Error(
      'The loan request was reviewed, but no confirmation was returned.',
    )
  }

  return fetchLoanRequestDetailFromSupabase(reviewedRequest.request_code)
}

export type CreatePublicLoanRequestInput = {
  requesterName: string
  requesterCompany: string
  requesterEmail: string
  requesterPhone: string
  requesterType: string
  requestedUseCase: string
  destinationCountry: string
  destinationCity: string
  preferredCheckoutDate: string
  expectedReturnDate: string
  additionalNotes?: string
  responsibilityAcknowledged: boolean
  items: Array<{
    pricelistItemId: string
    partNumber: string
    productName: string
    productDescription: string
    quantity: number
    msrpUnit: number
  }>
}

type PublicLoanRequestRpcResponse = {
  request_id: string
  request_code: string
}

export async function createPublicLoanRequestInSupabase(
  input: CreatePublicLoanRequestInput,
) {
  const { data, error } = await supabase.rpc(
    'create_public_loan_request',
    {
      p_requester_name: input.requesterName,
      p_requester_company: input.requesterCompany,
      p_requester_email: input.requesterEmail,
      p_requester_phone: input.requesterPhone,
      p_requester_type: input.requesterType,
      p_requested_use_case: input.requestedUseCase,
      p_destination_country: input.destinationCountry,
      p_destination_city: input.destinationCity,
      p_preferred_checkout_date: input.preferredCheckoutDate,
      p_expected_return_date: input.expectedReturnDate,
      p_additional_notes: input.additionalNotes ?? '',
      p_responsibility_acknowledged:
        input.responsibilityAcknowledged,
      p_items: input.items.map((item) => ({
        pricelist_item_id: item.pricelistItemId,
        part_number: item.partNumber,
        product_name: item.productName,
        product_description: item.productDescription,
        quantity: item.quantity,
        msrp_unit: item.msrpUnit,
      })),
    },
  )

  if (error) {
    throw new Error(`Unable to submit loan request: ${error.message}`)
  }

  const createdRequest = (
    data as PublicLoanRequestRpcResponse[] | null
  )?.[0]

  if (!createdRequest) {
    throw new Error(
      'The request was processed, but no request code was returned.',
    )
  }

  return {
    requestId: createdRequest.request_id,
    requestCode: createdRequest.request_code,
  }
}