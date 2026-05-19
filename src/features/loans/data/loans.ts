export type LoanDisplayStatus =
  | 'Active'
  | 'Overdue'
  | 'Due Soon'
  | 'Returned'
  | 'Cancelled'

export type LoanItemStatus = 'On Loan' | 'Returned'

export type LoanEquipmentItem = {
  equipmentCode: string
  category: string
  model: string
  serialNumber: string
  itemStatus: LoanItemStatus
  returnedAt?: string
  returnCondition?: 'Available' | 'Under Review' | 'Damaged'
  returnNotes?: string
}

export type LoanItem = {
  code: string
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
  actualClosedDate?: string
  status: LoanDisplayStatus
  notes?: string
  equipment: LoanEquipmentItem[]
}

export type CreateLoanInput = {
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
  equipment: Array<{
    equipmentCode: string
    category: string
    model: string
    serialNumber: string
  }>
}

export type RegisterLoanReturnInput = {
  loanCode: string
  returnDate: string
  returnedItems: Array<{
    equipmentCode: string
    condition: 'Available' | 'Under Review' | 'Damaged'
    notes: string
  }>
}

const LOCAL_STORAGE_KEY = 'axis-demo-assets-loans'

const seedLoanItems: LoanItem[] = [
  {
    code: 'LOAN-000014',
    recipientType: 'End Customer',
    company: 'Banco Central',
    contactName: 'María González',
    contactEmail: 'maria.gonzalez@cliente-demo.cl',
    contactPhone: '+56 9 5555 1111',
    responsible: 'Nicolás Steck',
    reason: 'Technical Evaluation',
    projectName: 'Pedestrian access validation',
    country: 'Chile',
    city: 'Santiago',
    address: 'Corporate building, Santiago Centro',
    checkoutDate: '05/05/2026',
    expectedReturnDate: '18/05/2026',
    status: 'Due Soon',
    notes:
      'Validation focused on user experience and intercom performance at the main entrance.',
    equipment: [
      {
        equipmentCode: 'EQ-000002',
        category: 'Intercom',
        model: 'AXIS I8116-E',
        serialNumber: 'ACCC8E8D1042',
        itemStatus: 'On Loan',
      },
    ],
  },
  {
    code: 'LOAN-000015',
    recipientType: 'Integrator',
    company: 'Integrador Demo Chile',
    contactName: 'Carlos Vega',
    contactEmail: 'carlos.vega@integrador-demo.cl',
    contactPhone: '+56 9 5555 2222',
    responsible: 'Pre-Sales Team',
    reason: 'Demo',
    projectName: 'IP audio for perimeter use cases',
    country: 'Chile',
    city: 'Santiago',
    checkoutDate: '09/05/2026',
    expectedReturnDate: '20/05/2026',
    status: 'Due Soon',
    notes:
      'Demo focused on deterrence messaging and event-based communication.',
    equipment: [
      {
        equipmentCode: 'EQ-000003',
        category: 'Audio',
        model: 'AXIS C1310-E',
        serialNumber: 'B894D3A12109',
        itemStatus: 'On Loan',
      },
    ],
  },
  {
    code: 'LOAN-000012',
    recipientType: 'End Customer',
    company: 'Municipalidad de Santiago',
    contactName: 'Paula Rojas',
    contactEmail: 'paula.rojas@municipio-demo.cl',
    contactPhone: '+56 9 5555 3333',
    responsible: 'Nicolás Steck',
    reason: 'PoC',
    projectName: 'Urban video security evaluation',
    country: 'Chile',
    city: 'Santiago',
    checkoutDate: '21/04/2026',
    expectedReturnDate: '08/05/2026',
    status: 'Overdue',
    notes:
      'Overdue loan. Follow-up is required to recover the assets and review proof-of-concept continuity.',
    equipment: [
      {
        equipmentCode: 'EQ-000008',
        category: 'Camera',
        model: 'AXIS Q1809-LE',
        serialNumber: 'SIMULATED-008',
        itemStatus: 'On Loan',
      },
      {
        equipmentCode: 'EQ-000009',
        category: 'Accessory',
        model: 'AXIS T91L61 Wall-and-Pole Mount',
        serialNumber: 'No Serial',
        itemStatus: 'On Loan',
      },
    ],
  },
  {
    code: 'LOAN-000010',
    recipientType: 'Integrator',
    company: 'Seguridad Integral Demo',
    contactName: 'Marcelo Díaz',
    contactEmail: 'marcelo.diaz@sidemo.cl',
    contactPhone: '+56 9 5555 4444',
    responsible: 'Nicolás Steck',
    reason: 'Training',
    projectName: 'Axis technical workshop',
    country: 'Chile',
    city: 'Concepción',
    checkoutDate: '10/04/2026',
    expectedReturnDate: '22/04/2026',
    actualClosedDate: '22/04/2026',
    status: 'Returned',
    notes:
      'Loan closed without observations. Equipment returned in operational condition.',
    equipment: [
      {
        equipmentCode: 'EQ-000001',
        category: 'Camera',
        model: 'AXIS P3268-LVE',
        serialNumber: 'B8A44F1C92D1',
        itemStatus: 'Returned',
        returnedAt: '22/04/2026',
        returnCondition: 'Available',
      },
      {
        equipmentCode: 'EQ-000010',
        category: 'Audio',
        model: 'AXIS C1210-E',
        serialNumber: 'SIMULATED-010',
        itemStatus: 'Returned',
        returnedAt: '22/04/2026',
        returnCondition: 'Available',
      },
    ],
  },
  {
    code: 'LOAN-000011',
    recipientType: 'Internal',
    company: 'Axis Chile',
    contactName: 'Sales Team',
    contactEmail: 'sales.team@axis-demo.cl',
    contactPhone: '+56 9 5555 5555',
    responsible: 'Pre-Sales Team',
    reason: 'Internal Demo',
    country: 'Chile',
    city: 'Santiago',
    checkoutDate: '28/04/2026',
    expectedReturnDate: '05/05/2026',
    actualClosedDate: '05/05/2026',
    status: 'Returned',
    notes:
      'Internal use for commercial presentation preparation.',
    equipment: [
      {
        equipmentCode: 'EQ-000004',
        category: 'Radar',
        model: 'AXIS D2210-VE',
        serialNumber: 'B8A44F9A8184',
        itemStatus: 'Returned',
        returnedAt: '05/05/2026',
        returnCondition: 'Available',
      },
    ],
  },
]

function getStoredLoans(): LoanItem[] {
  try {
    const rawValue = window.localStorage.getItem(LOCAL_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? (parsedValue as LoanItem[]) : []
  } catch {
    return []
  }
}

function saveStoredLoans(loans: LoanItem[]) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loans))
}

function saveLoanOverride(loan: LoanItem) {
  const storedLoans = getStoredLoans()
  const existingIndex = storedLoans.findIndex(
    (storedLoan) => storedLoan.code === loan.code,
  )

  if (existingIndex >= 0) {
    const updatedLoans = [...storedLoans]
    updatedLoans[existingIndex] = loan
    saveStoredLoans(updatedLoans)
    return
  }

  saveStoredLoans([loan, ...storedLoans])
}


function parseDisplayDate(value: string) {
  const [day, month, year] = value.split('/').map(Number)

  if (!day || !month || !year) {
    return null
  }

  return new Date(year, month - 1, day)
}

function determineLoanStatus(
  expectedReturnDate: string,
  equipment: LoanEquipmentItem[],
  actualClosedDate?: string,
): LoanDisplayStatus {
  const allReturned =
    equipment.length > 0 &&
    equipment.every((item) => item.itemStatus === 'Returned')

  if (allReturned || actualClosedDate) {
    return 'Returned'
  }

  const expectedDate = parseDisplayDate(expectedReturnDate)

  if (!expectedDate) {
    return 'Active'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  expectedDate.setHours(0, 0, 0, 0)

  const differenceInDays = Math.ceil(
    (expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (differenceInDays < 0) {
    return 'Overdue'
  }

  if (differenceInDays <= 7) {
    return 'Due Soon'
  }

  return 'Active'
}

export function getLoans(): LoanItem[] {
  const storedLoans = getStoredLoans()
  const storedByCode = new Map(
    storedLoans.map((loan) => [loan.code, loan]),
  )

  const seedCodes = new Set(seedLoanItems.map((loan) => loan.code))

  const locallyCreatedLoans = storedLoans.filter(
    (loan) => !seedCodes.has(loan.code),
  )

  const mergedSeedLoans = seedLoanItems.map(
    (loan) => storedByCode.get(loan.code) ?? loan,
  )

  return [...locallyCreatedLoans, ...mergedSeedLoans]
}

export const loanItems = getLoans()

export function getLoanByCode(code: string) {
  return getLoans().find((loan) => loan.code === code)
}

export function createLoan(input: CreateLoanInput): LoanItem {
  const timestamp = Date.now()

  const equipment: LoanEquipmentItem[] = input.equipment.map((item) => ({
    equipmentCode: item.equipmentCode,
    category: item.category,
    model: item.model,
    serialNumber: item.serialNumber,
    itemStatus: 'On Loan',
  }))

  const newLoan: LoanItem = {
    code: `LOAN-LCL-${timestamp.toString().slice(-6)}`,
    recipientType: input.recipientType,
    company: input.company,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    responsible: input.responsible,
    reason: input.reason,
    projectName: input.projectName || undefined,
    country: input.country,
    city: input.city,
    address: input.address || undefined,
    checkoutDate: input.checkoutDate,
    expectedReturnDate: input.expectedReturnDate,
    status: determineLoanStatus(input.expectedReturnDate, equipment),
    notes: input.notes || undefined,
    equipment,
  }

  saveLoanOverride(newLoan)

  return newLoan
}

export function registerLoanReturn(
  input: RegisterLoanReturnInput,
): LoanItem | undefined {
  const loan = getLoanByCode(input.loanCode)

  if (!loan) {
    return undefined
  }

  const updatedEquipment = loan.equipment.map((equipment) => {
    const returnedItem = input.returnedItems.find(
      (item) => item.equipmentCode === equipment.equipmentCode,
    )

    if (!returnedItem) {
      return equipment
    }

    return {
      ...equipment,
      itemStatus: 'Returned' as LoanItemStatus,
      returnedAt: input.returnDate,
      returnCondition: returnedItem.condition,
      returnNotes: returnedItem.notes || undefined,
    }
  })

  const allReturned = updatedEquipment.every(
    (equipment) => equipment.itemStatus === 'Returned',
  )

  const updatedLoan: LoanItem = {
    ...loan,
    equipment: updatedEquipment,
    actualClosedDate: allReturned ? input.returnDate : loan.actualClosedDate,
    status: determineLoanStatus(
      loan.expectedReturnDate,
      updatedEquipment,
      allReturned ? input.returnDate : loan.actualClosedDate,
    ),
  }

  saveLoanOverride(updatedLoan)

  return updatedLoan
}

export function getLoanStatusTone(
  status: LoanDisplayStatus,
): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'Active':
      return 'info'
    case 'Due Soon':
      return 'warning'
    case 'Overdue':
      return 'danger'
    case 'Returned':
      return 'success'
    case 'Cancelled':
      return 'neutral'
  }
}

export function getLoanEquipmentStatusTone(
  status: LoanItemStatus,
): 'info' | 'success' {
  switch (status) {
    case 'On Loan':
      return 'info'
    case 'Returned':
      return 'success'
  }
}