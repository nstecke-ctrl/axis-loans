import {
  axisPricelistItems,
  type AxisPricelistItem,
} from './axisPricelist'

export type LoanRequestStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Converted to Loan'

export type LoanRequestItem = {
  id: string
  pricelistItemId: string
  partNumber: string
  productName: string
  productDescription: string
  quantity: number
  msrpUnit: number
  msrpLineTotal: number
}

export type LoanRequest = {
  code: string
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
  status: LoanRequestStatus
  submittedAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNotes?: string
  convertedLoanCode?: string
  responsibilityAcknowledged: boolean
  responsibilityText: string
  items: LoanRequestItem[]
  msrpTotalAmount: number
}

export type CreateLoanRequestInput = {
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

const LOCAL_STORAGE_KEY = 'axis-demo-assets-loan-requests'

export const responsibilityText =
  'I acknowledge that lost, damaged, or unreturned equipment may be charged based on the applicable MSRP value shown in this request.'

function getTodayDisplayDate() {
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()

  return `${day}/${month}/${year}`
}

function getPricelistItem(partNumber: string): AxisPricelistItem {
  const item = axisPricelistItems.find(
    (pricelistItem) => pricelistItem.partNumber === partNumber,
  )

  if (!item) {
    throw new Error(`Pricelist item not found: ${partNumber}`)
  }

  return item
}

function buildLoanRequestItem(
  id: string,
  partNumber: string,
  quantity: number,
): LoanRequestItem {
  const item = getPricelistItem(partNumber)

  return {
    id,
    pricelistItemId: item.id,
    partNumber: item.partNumber,
    productName: item.productName,
    productDescription: item.productDescription,
    quantity,
    msrpUnit: item.msrp,
    msrpLineTotal: item.msrp * quantity,
  }
}

function calculateRequestTotal(items: LoanRequestItem[]) {
  return items.reduce((total, item) => total + item.msrpLineTotal, 0)
}

const requestItems001 = [
  buildLoanRequestItem('REQITEM-001-01', '02332-001', 2),
  buildLoanRequestItem('REQITEM-001-02', '02408-001', 1),
]

const requestItems002 = [
  buildLoanRequestItem('REQITEM-002-01', '02770-001', 1),
  buildLoanRequestItem('REQITEM-002-02', '02813-001', 2),
]

const requestItems003 = [
  buildLoanRequestItem('REQITEM-003-01', '02317-004', 1),
  buildLoanRequestItem('REQITEM-003-02', '02653-001', 1),
]

const requestItems004 = [
  buildLoanRequestItem('REQITEM-004-01', '02331-001', 1),
]

const seedLoanRequests: LoanRequest[] = [
  {
    code: 'REQ-000021',
    requesterName: 'María González',
    requesterCompany: 'Banco Central',
    requesterEmail: 'maria.gonzalez@cliente-demo.cl',
    requesterPhone: '+56 9 5555 1111',
    requesterType: 'End Customer',
    requestedUseCase:
      'Evaluation of camera image quality and intercom functionality for a controlled access pilot.',
    destinationCountry: 'Chile',
    destinationCity: 'Santiago',
    preferredCheckoutDate: '22/05/2026',
    expectedReturnDate: '05/06/2026',
    additionalNotes:
      'Request previously discussed with Axis account management. Equipment will be used in a controlled indoor pilot.',
    status: 'Pending',
    submittedAt: '15/05/2026',
    responsibilityAcknowledged: true,
    responsibilityText,
    items: requestItems001,
    msrpTotalAmount: calculateRequestTotal(requestItems001),
  },
  {
    code: 'REQ-000020',
    requesterName: 'Carlos Vega',
    requesterCompany: 'Integrador Demo Chile',
    requesterEmail: 'carlos.vega@integrador-demo.cl',
    requesterPhone: '+56 9 5555 2222',
    requesterType: 'Integrator',
    requestedUseCase:
      'Outdoor radar and audio validation for a perimeter protection demonstration.',
    destinationCountry: 'Chile',
    destinationCity: 'Antofagasta',
    preferredCheckoutDate: '20/05/2026',
    expectedReturnDate: '03/06/2026',
    status: 'Approved',
    submittedAt: '13/05/2026',
    reviewedBy: 'Nicolás Steck',
    reviewedAt: '14/05/2026',
    reviewNotes:
      'Request reviewed and approved. Physical inventory assignment pending.',
    responsibilityAcknowledged: true,
    responsibilityText,
    items: requestItems002,
    msrpTotalAmount: calculateRequestTotal(requestItems002),
  },
  {
    code: 'REQ-000019',
    requesterName: 'Paula Rojas',
    requesterCompany: 'Municipalidad de Santiago',
    requesterEmail: 'paula.rojas@municipio-demo.cl',
    requesterPhone: '+56 9 5555 3333',
    requesterType: 'End Customer',
    requestedUseCase:
      'Temporary evaluation of high-performance PTZ and access control equipment.',
    destinationCountry: 'Chile',
    destinationCity: 'Santiago',
    preferredCheckoutDate: '16/05/2026',
    expectedReturnDate: '31/05/2026',
    status: 'Rejected',
    submittedAt: '10/05/2026',
    reviewedBy: 'Nicolás Steck',
    reviewedAt: '12/05/2026',
    reviewNotes:
      'Rejected because the proposed evaluation period and required stock were not aligned with current demo planning.',
    responsibilityAcknowledged: true,
    responsibilityText,
    items: requestItems003,
    msrpTotalAmount: calculateRequestTotal(requestItems003),
  },
  {
    code: 'REQ-000018',
    requesterName: 'Equipo Comercial',
    requesterCompany: 'Axis Chile',
    requesterEmail: 'sales.team@axis-demo.cl',
    requesterPhone: '+56 9 5555 4444',
    requesterType: 'Internal',
    requestedUseCase:
      'Internal sales demo for customer presentation and solution positioning.',
    destinationCountry: 'Chile',
    destinationCity: 'Santiago',
    preferredCheckoutDate: '06/05/2026',
    expectedReturnDate: '10/05/2026',
    status: 'Converted to Loan',
    submittedAt: '04/05/2026',
    reviewedBy: 'Nicolás Steck',
    reviewedAt: '05/05/2026',
    reviewNotes:
      'Approved and converted into an internal loan record.',
    convertedLoanCode: 'LOAN-000011',
    responsibilityAcknowledged: true,
    responsibilityText,
    items: requestItems004,
    msrpTotalAmount: calculateRequestTotal(requestItems004),
  },
]

function getStoredLoanRequests(): LoanRequest[] {
  try {
    const rawValue = window.localStorage.getItem(LOCAL_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? (parsedValue as LoanRequest[]) : []
  } catch {
    return []
  }
}

function saveStoredLoanRequests(requests: LoanRequest[]) {
  window.localStorage.setItem(
    LOCAL_STORAGE_KEY,
    JSON.stringify(requests),
  )
}

function saveLoanRequestOverride(request: LoanRequest) {
  const storedRequests = getStoredLoanRequests()
  const existingIndex = storedRequests.findIndex(
    (storedRequest) => storedRequest.code === request.code,
  )

  if (existingIndex >= 0) {
    const updatedRequests = [...storedRequests]
    updatedRequests[existingIndex] = request
    saveStoredLoanRequests(updatedRequests)
    return
  }

  saveStoredLoanRequests([request, ...storedRequests])
}

export function getLoanRequests(): LoanRequest[] {
  const storedRequests = getStoredLoanRequests()
  const storedByCode = new Map(
    storedRequests.map((request) => [request.code, request]),
  )

  const seedCodes = new Set(seedLoanRequests.map((request) => request.code))

  const locallyCreatedRequests = storedRequests.filter(
    (request) => !seedCodes.has(request.code),
  )

  const mergedSeedRequests = seedLoanRequests.map(
    (request) => storedByCode.get(request.code) ?? request,
  )

  return [...locallyCreatedRequests, ...mergedSeedRequests]
}

export function getLoanRequestByCode(code: string) {
  return getLoanRequests().find((request) => request.code === code)
}

export function createLoanRequest(
  input: CreateLoanRequestInput,
): LoanRequest {
  const timestamp = Date.now()

  const items: LoanRequestItem[] = input.items.map((item, index) => ({
    id: `REQITEM-LCL-${timestamp}-${index + 1}`,
    pricelistItemId: item.pricelistItemId,
    partNumber: item.partNumber,
    productName: item.productName,
    productDescription: item.productDescription,
    quantity: item.quantity,
    msrpUnit: item.msrpUnit,
    msrpLineTotal: item.msrpUnit * item.quantity,
  }))

  const newRequest: LoanRequest = {
    code: `REQ-LCL-${timestamp.toString().slice(-6)}`,
    requesterName: input.requesterName,
    requesterCompany: input.requesterCompany,
    requesterEmail: input.requesterEmail,
    requesterPhone: input.requesterPhone,
    requesterType: input.requesterType,
    requestedUseCase: input.requestedUseCase,
    destinationCountry: input.destinationCountry,
    destinationCity: input.destinationCity,
    preferredCheckoutDate: input.preferredCheckoutDate,
    expectedReturnDate: input.expectedReturnDate,
    additionalNotes: input.additionalNotes || undefined,
    status: 'Pending',
    submittedAt: getTodayDisplayDate(),
    responsibilityAcknowledged: input.responsibilityAcknowledged,
    responsibilityText,
    items,
    msrpTotalAmount: calculateRequestTotal(items),
  }

  saveLoanRequestOverride(newRequest)

  return newRequest
}

export function markLoanRequestReviewed(
  requestCode: string,
  status: 'Approved' | 'Rejected',
  reviewNotes: string,
) {
  const request = getLoanRequestByCode(requestCode)

  if (!request) {
    return undefined
  }

  const updatedRequest: LoanRequest = {
    ...request,
    status,
    reviewedBy: 'Nicolás Steck',
    reviewedAt: getTodayDisplayDate(),
    reviewNotes: reviewNotes.trim() || undefined,
  }

  saveLoanRequestOverride(updatedRequest)

  return updatedRequest
}

export function markLoanRequestConverted(
  requestCode: string,
  convertedLoanCode: string,
) {
  const request = getLoanRequestByCode(requestCode)

  if (!request) {
    return undefined
  }

  const updatedRequest: LoanRequest = {
    ...request,
    status: 'Converted to Loan',
    convertedLoanCode,
    reviewedBy: request.reviewedBy ?? 'Nicolás Steck',
    reviewedAt: request.reviewedAt ?? getTodayDisplayDate(),
  }

  saveLoanRequestOverride(updatedRequest)

  return updatedRequest
}

export function getLoanRequestStatusTone(
  status: LoanRequestStatus,
): 'warning' | 'info' | 'danger' | 'success' {
  switch (status) {
    case 'Pending':
      return 'warning'
    case 'Approved':
      return 'info'
    case 'Rejected':
      return 'danger'
    case 'Converted to Loan':
      return 'success'
  }
}