import { supabase } from '../../../lib/supabase'
import type {
  CreateLoanInput,
  LoanDisplayStatus,
  LoanEquipmentItem,
  LoanItem,
  LoanItemStatus,
  RegisterLoanReturnInput,
} from './loans'

type EquipmentJoinRow = {
  code: string
  category: string
  model: string
  serial_number: string
}

type LoanItemRow = {
  item_status: LoanItemStatus
  returned_at: string | null
  return_condition: 'Available' | 'Under Review' | 'Damaged' | null
  return_notes: string | null
  equipment: EquipmentJoinRow | EquipmentJoinRow[] | null
}

type LoanRow = {
  id: string
  code: string
  recipient_type: string
  company: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  checkout_handler: string | null
  responsible: string
  reason: string
  project_name: string | null
  country: string
  city: string
  address: string | null
  checkout_date: string
  expected_return_date: string
  actual_closed_date: string | null
  status: LoanDisplayStatus
  notes: string | null
  loan_items?: LoanItemRow[]
  loan_requests?:
    | {
        msrp_total_amount: number | string
        responsibility_text: string | null
      }
    | Array<{
        msrp_total_amount: number | string
        responsibility_text: string | null
      }>
    | null
}

type CreateLoanRpcResponse = {
  loan_id: string
  loan_code: string
}

type RegisterReturnRpcResponse = {
  loan_id: string
  loan_code: string
  loan_closed: boolean
}

function formatDatabaseDate(value: string | null) {
  if (!value) {
    return undefined
  }

  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function mapLoanEquipmentItem(row: LoanItemRow): LoanEquipmentItem | null {
  const equipment = Array.isArray(row.equipment)
    ? row.equipment[0]
    : row.equipment

  if (!equipment) {
    return null
  }

  return {
    equipmentCode: equipment.code,
    category: equipment.category,
    model: equipment.model,
    serialNumber: equipment.serial_number,
    itemStatus: row.item_status,
    returnedAt: formatDatabaseDate(row.returned_at),
    returnCondition: row.return_condition ?? undefined,
    returnNotes: row.return_notes ?? undefined,
  }
}

function mapLoanRowToLoan(row: LoanRow): LoanItem {
  const sourceRequest = Array.isArray(row.loan_requests)
    ? row.loan_requests[0]
    : row.loan_requests

  return {
    code: row.code,
    recipientType: row.recipient_type,
    company: row.company,
    contactName: row.contact_name ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    checkoutHandler: row.checkout_handler ?? 'Tamara Castro',
    responsible: row.responsible,
    reason: row.reason,
    projectName: row.project_name ?? undefined,
    country: row.country,
    city: row.city,
    address: row.address ?? undefined,
    checkoutDate: formatDatabaseDate(row.checkout_date) ?? '',
    expectedReturnDate:
      formatDatabaseDate(row.expected_return_date) ?? '',
    actualClosedDate: formatDatabaseDate(row.actual_closed_date),
    status: row.status,
    notes: row.notes ?? undefined,
    msrpTotalAmount: sourceRequest
      ? parseNumericValue(sourceRequest.msrp_total_amount)
      : undefined,
    responsibilityText: sourceRequest?.responsibility_text ?? undefined,
    equipment: (row.loan_items ?? [])
      .map(mapLoanEquipmentItem)
      .filter((item): item is LoanEquipmentItem => item !== null),
  }
}

function parseNumericValue(value: number | string) {
  return typeof value === 'number' ? value : Number(value)
}

const loanSelect = `
  id,
  code,
  recipient_type,
  company,
  contact_name,
  contact_email,
  contact_phone,
  checkout_handler,
  responsible,
  reason,
  project_name,
  country,
  city,
  address,
  checkout_date,
  expected_return_date,
  actual_closed_date,
  status,
  notes,
  loan_requests!loans_source_request_id_fkey (
    msrp_total_amount,
    responsibility_text
  ),
  loan_items (
    item_status,
    returned_at,
    return_condition,
    return_notes,
    equipment (
      code,
      category,
      model,
      serial_number
    )
  )
`

export async function fetchLoansFromSupabase(): Promise<LoanItem[]> {
  const { data, error } = await supabase
    .from('loans')
    .select(loanSelect)
    .order('checkout_date', { ascending: false })

  if (error) {
    throw new Error(`Unable to load loans: ${error.message}`)
  }

  return ((data ?? []) as LoanRow[]).map(mapLoanRowToLoan)
}

export async function fetchLoanDetailFromSupabase(
  loanCode: string,
): Promise<LoanItem | null> {
  const { data, error } = await supabase
    .from('loans')
    .select(loanSelect)
    .eq('code', loanCode)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load loan detail: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return mapLoanRowToLoan(data as LoanRow)
}

export async function createInternalLoanInSupabase(
  input: CreateLoanInput,
  sourceRequestCode?: string,
) {
  const { data, error } = await supabase.rpc('create_internal_loan_v2', {
    p_source_request_code: sourceRequestCode ?? '',
    p_recipient_type: input.recipientType,
    p_company: input.company,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_checkout_handler: input.checkoutHandler,
    p_responsible: input.responsible,
    p_reason: input.reason,
    p_project_name: input.projectName ?? '',
    p_country: input.country,
    p_city: input.city,
    p_address: input.address ?? '',
    p_checkout_date: dateToDatabaseFormat(input.checkoutDate),
    p_expected_return_date: dateToDatabaseFormat(
      input.expectedReturnDate,
    ),
    p_notes: input.notes ?? '',
    p_equipment_codes: input.equipment.map(
      (equipment) => equipment.equipmentCode,
    ),
  })

  if (error) {
    throw new Error(`Unable to create loan: ${error.message}`)
  }

  const createdLoan = (data as CreateLoanRpcResponse[] | null)?.[0]

  if (!createdLoan) {
    throw new Error('The loan was created, but no loan code was returned.')
  }

  const loan = await fetchLoanDetailFromSupabase(createdLoan.loan_code)

  if (!loan) {
    throw new Error('The loan was created, but its detail could not be loaded.')
  }

  return loan
}

export async function registerLoanReturnInSupabase(
  input: RegisterLoanReturnInput,
) {
  const { data, error } = await supabase.rpc('register_loan_return', {
    p_loan_code: input.loanCode,
    p_return_date: dateToDatabaseFormat(input.returnDate),
    p_returned_items: input.returnedItems.map((item) => ({
      equipment_code: item.equipmentCode,
      condition: item.condition,
      notes: item.notes,
    })),
  })

  if (error) {
    throw new Error(`Unable to register loan return: ${error.message}`)
  }

  const returnResult = (data as RegisterReturnRpcResponse[] | null)?.[0]

  if (!returnResult) {
    throw new Error(
      'The return was processed, but no confirmation was returned.',
    )
  }

  const updatedLoan = await fetchLoanDetailFromSupabase(returnResult.loan_code)

  if (!updatedLoan) {
    throw new Error(
      'The return was processed, but the updated loan could not be loaded.',
    )
  }

  return {
    loan: updatedLoan,
    loanClosed: returnResult.loan_closed,
  }
}

function dateToDatabaseFormat(value: string) {
  if (!value.includes('/')) {
    return value
  }

  const [day, month, year] = value.split('/')
  return `${year}-${month}-${day}`
}
export type UpdateLoanProfileInput = {
  loanCode: string
  recipientType: string
  company: string
  contactName: string
  contactEmail: string
  contactPhone: string
  responsible: string
  reason: string
  projectName?: string
  country: string
  city: string
  address?: string
  checkoutDate: string
  expectedReturnDate: string
  notes?: string
  checkoutHandler: string
}

type UpdateLoanProfileRpcResponse = {
  loan_id: string
  loan_code: string
}

export async function updateLoanProfileInSupabase(
  input: UpdateLoanProfileInput,
): Promise<LoanItem> {
  const { data: userData } = await supabase.auth.getUser()

  const performedBy = userData.user?.email ?? 'Administrator'

  const { data, error } = await supabase.rpc('update_loan_profile_v2', {
    p_loan_code: input.loanCode,
    p_recipient_type: input.recipientType,
    p_company: input.company,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_checkout_handler: input.checkoutHandler,
    p_responsible: input.responsible,
    p_reason: input.reason,
    p_project_name: input.projectName ?? '',
    p_country: input.country,
    p_city: input.city,
    p_address: input.address ?? '',
    p_checkout_date: dateToDatabaseFormat(input.checkoutDate),
    p_expected_return_date: dateToDatabaseFormat(
      input.expectedReturnDate,
    ),
    p_notes: input.notes ?? '',
    p_performed_by: performedBy,
  })

  if (error) {
    throw new Error(`Unable to update loan profile: ${error.message}`)
  }

  const updatedLoan = (data as UpdateLoanProfileRpcResponse[] | null)?.[0]

  if (!updatedLoan) {
    throw new Error(
      'The loan was updated, but no confirmation was returned.',
    )
  }

  const loan = await fetchLoanDetailFromSupabase(updatedLoan.loan_code)

  if (!loan) {
    throw new Error(
      'The loan was updated, but its detail could not be loaded.',
    )
  }

  return loan
}
