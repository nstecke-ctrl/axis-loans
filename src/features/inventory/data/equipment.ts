export type EquipmentStatus =
  | 'Available'
  | 'On Loan'
  | 'Reserved'
  | 'Under Review'
  | 'Damaged'

export type EquipmentMovement = {
  date: string
  type: string
  description: string
  user: string
}

export type ActiveLoan = {
  loanCode: string
  company: string
  responsible: string
  checkoutDate: string
  expectedReturnDate: string
}

export type EquipmentItem = {
  code: string
  category: string
  brand: string
  model: string
  partNumber: string
  serialNumber: string
  status: EquipmentStatus
  location: string
  acquiredAt: string
  legacyCode?: string
  accessories?: string
  conditionNotes?: string
  generalNotes?: string
  activeLoan?: ActiveLoan
  movements: EquipmentMovement[]
}

export type MarkEquipmentOnLoanInput = {
  loanCode: string
  company: string
  responsible: string
  checkoutDate: string
  expectedReturnDate: string
  equipmentCodes: string[]
}

export type RegisterEquipmentReturnInput = {
  loanCode: string
  returnDate: string
  returnedItems: Array<{
    equipmentCode: string
    condition: 'Available' | 'Under Review' | 'Damaged'
    notes: string
  }>
}

const LOCAL_STORAGE_KEY = 'axis-demo-assets-equipment'

const seedEquipmentItems: EquipmentItem[] = [
  {
    code: 'EQ-000001',
    category: 'Camera',
    brand: 'Axis',
    model: 'AXIS P3268-LVE',
    partNumber: '02634-001',
    serialNumber: 'B8A44F1C92D1',
    status: 'Available',
    location: 'Demo Warehouse',
    acquiredAt: '10/03/2026',
    legacyCode: 'CAM-DEMO-01',
    accessories: 'Original box, network cable and mounting bracket.',
    conditionNotes: 'Equipment in good condition, with no visible issues.',
    generalNotes:
      'Used for demos related to analytics and image quality.',
    movements: [
      {
        date: '10/03/2026',
        type: 'Equipment Created',
        description: 'Equipment added to the demo inventory.',
        user: 'Nicolás Steck',
      },
      {
        date: '22/04/2026',
        type: 'Loan Checkout',
        description: 'Loaned for technical evaluation to Demo Customer.',
        user: 'Nicolás Steck',
      },
      {
        date: '30/04/2026',
        type: 'Return Registered',
        description:
          'Equipment returned in good condition and set as available.',
        user: 'Nicolás Steck',
      },
    ],
  },
  {
    code: 'EQ-000002',
    category: 'Intercom',
    brand: 'Axis',
    model: 'AXIS I8116-E',
    partNumber: '02447-001',
    serialNumber: 'ACCC8E8D1042',
    status: 'On Loan',
    location: 'Banco Central',
    acquiredAt: '12/03/2026',
    accessories: 'Main unit and installation adapters.',
    conditionNotes: 'No issues reported before checkout.',
    generalNotes:
      'Loaned for access validation and remote call handling.',
    activeLoan: {
      loanCode: 'LOAN-000014',
      company: 'Banco Central',
      responsible: 'Nicolás Steck',
      checkoutDate: '05/05/2026',
      expectedReturnDate: '18/05/2026',
    },
    movements: [
      {
        date: '12/03/2026',
        type: 'Equipment Created',
        description: 'Equipment added to inventory.',
        user: 'Nicolás Steck',
      },
      {
        date: '05/05/2026',
        type: 'Loan Checkout',
        description: 'Equipment checked out to Banco Central.',
        user: 'Nicolás Steck',
      },
    ],
  },
  {
    code: 'EQ-000003',
    category: 'Audio',
    brand: 'Axis',
    model: 'AXIS C1310-E',
    partNumber: '01796-001',
    serialNumber: 'B894D3A12109',
    status: 'On Loan',
    location: 'Integrador Demo Chile',
    acquiredAt: '18/03/2026',
    accessories: 'Speaker, quick guide and original packaging.',
    conditionNotes: 'Operational at the time of checkout.',
    generalNotes:
      'Used in a proof of concept for deterrence messaging and event-based communication.',
    activeLoan: {
      loanCode: 'LOAN-000015',
      company: 'Integrador Demo Chile',
      responsible: 'Pre-Sales Team',
      checkoutDate: '09/05/2026',
      expectedReturnDate: '20/05/2026',
    },
    movements: [
      {
        date: '18/03/2026',
        type: 'Equipment Created',
        description: 'Equipment added to inventory.',
        user: 'Nicolás Steck',
      },
      {
        date: '09/05/2026',
        type: 'Loan Checkout',
        description: 'Equipment checked out to Integrador Demo Chile.',
        user: 'Pre-Sales Team',
      },
    ],
  },
  {
    code: 'EQ-000004',
    category: 'Radar',
    brand: 'Axis',
    model: 'AXIS D2210-VE',
    partNumber: '02370-001',
    serialNumber: 'B8A44F9A8184',
    status: 'Available',
    location: 'Demo Warehouse',
    acquiredAt: '25/03/2026',
    accessories: 'Basic mounting hardware and documentation.',
    conditionNotes: 'Good condition.',
    generalNotes:
      'Available asset for perimeter detection demonstrations.',
    movements: [
      {
        date: '25/03/2026',
        type: 'Equipment Created',
        description: 'Radar asset registered in inventory.',
        user: 'Nicolás Steck',
      },
    ],
  },
  {
    code: 'EQ-000005',
    category: 'Camera',
    brand: 'Axis',
    model: 'AXIS Q6225-LE',
    partNumber: '01923-001',
    serialNumber: 'ACCC8E2B7001',
    status: 'Under Review',
    location: 'Technical Review',
    acquiredAt: '02/04/2026',
    accessories: 'Injector, box and mounting parts.',
    conditionNotes:
      'Pending technical review due to intermittent behavior during tests.',
    generalNotes:
      'Should not be assigned to new loans until the review is closed.',
    movements: [
      {
        date: '02/04/2026',
        type: 'Equipment Created',
        description: 'Equipment added to inventory.',
        user: 'Nicolás Steck',
      },
      {
        date: '12/05/2026',
        type: 'Manual Status Change',
        description: 'Available → Under Review.',
        user: 'Nicolás Steck',
      },
    ],
  },
  {
    code: 'EQ-000006',
    category: 'Accessory',
    brand: 'Axis',
    model: 'AXIS T91B67 Pole Mount',
    partNumber: '01472-001',
    serialNumber: 'No Serial',
    status: 'Reserved',
    location: 'Reserved for Mining Demo',
    acquiredAt: '08/04/2026',
    accessories: 'Complete mounting kit.',
    conditionNotes: 'No relevant usage registered.',
    generalNotes:
      'Manually reserved for an industrial demo scenario.',
    movements: [
      {
        date: '08/04/2026',
        type: 'Equipment Created',
        description: 'Accessory registered in inventory.',
        user: 'Nicolás Steck',
      },
      {
        date: '13/05/2026',
        type: 'Manual Status Change',
        description: 'Available → Reserved.',
        user: 'Nicolás Steck',
      },
    ],
  },
  {
    code: 'EQ-000007',
    category: 'Access Control',
    brand: 'Axis',
    model: 'AXIS A1610 Network Door Controller',
    partNumber: '02637-001',
    serialNumber: 'B8A44F7D6300',
    status: 'Damaged',
    location: 'Pending Assessment',
    acquiredAt: '15/04/2026',
    accessories: 'Controller without additional accessories registered.',
    conditionNotes: 'Physical damage reported on one connector.',
    generalNotes:
      'Pending repair or retirement decision.',
    movements: [
      {
        date: '15/04/2026',
        type: 'Equipment Created',
        description: 'Controller registered in inventory.',
        user: 'Nicolás Steck',
      },
      {
        date: '11/05/2026',
        type: 'Manual Status Change',
        description: 'Available → Damaged.',
        user: 'Nicolás Steck',
      },
    ],
  },
]

function getStoredEquipment(): EquipmentItem[] {
  try {
    const rawValue = window.localStorage.getItem(LOCAL_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? (parsedValue as EquipmentItem[]) : []
  } catch {
    return []
  }
}

function saveStoredEquipment(items: EquipmentItem[]) {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items))
}

function saveEquipmentOverride(item: EquipmentItem) {
  const storedEquipment = getStoredEquipment()
  const existingIndex = storedEquipment.findIndex(
    (storedItem) => storedItem.code === item.code,
  )

  if (existingIndex >= 0) {
    const updatedEquipment = [...storedEquipment]
    updatedEquipment[existingIndex] = item
    saveStoredEquipment(updatedEquipment)
    return
  }

  saveStoredEquipment([item, ...storedEquipment])
}

export function getEquipmentItems(): EquipmentItem[] {
  const storedEquipment = getStoredEquipment()
  const storedByCode = new Map(
    storedEquipment.map((item) => [item.code, item]),
  )

  const seedCodes = new Set(seedEquipmentItems.map((item) => item.code))

  const locallyCreatedEquipment = storedEquipment.filter(
    (item) => !seedCodes.has(item.code),
  )

  const mergedSeedEquipment = seedEquipmentItems.map(
    (item) => storedByCode.get(item.code) ?? item,
  )

  return [...locallyCreatedEquipment, ...mergedSeedEquipment]
}

export const equipmentItems = getEquipmentItems()

export function getEquipmentByCode(code: string) {
  return getEquipmentItems().find((item) => item.code === code)
}

export function markEquipmentOnLoan(input: MarkEquipmentOnLoanInput) {
  const equipment = getEquipmentItems()

  const updatedEquipment = equipment.map((item) => {
    if (!input.equipmentCodes.includes(item.code)) {
      return item
    }

    const updatedItem: EquipmentItem = {
      ...item,
      status: 'On Loan',
      location: input.company,
      activeLoan: {
        loanCode: input.loanCode,
        company: input.company,
        responsible: input.responsible,
        checkoutDate: input.checkoutDate,
        expectedReturnDate: input.expectedReturnDate,
      },
      movements: [
        {
          date: input.checkoutDate,
          type: 'Loan Checkout',
          description: `Equipment checked out to ${input.company} under loan ${input.loanCode}.`,
          user: input.responsible,
        },
        ...item.movements,
      ],
    }

    saveEquipmentOverride(updatedItem)

    return updatedItem
  })

  return updatedEquipment
}

export function registerEquipmentReturn(
  input: RegisterEquipmentReturnInput,
) {
  const equipment = getEquipmentItems()

  const updatedEquipment = equipment.map((item) => {
    const returnedItem = input.returnedItems.find(
      (returnItem) => returnItem.equipmentCode === item.code,
    )

    if (!returnedItem) {
      return item
    }

    const statusAfterReturn: EquipmentStatus = returnedItem.condition

    const locationAfterReturn =
      returnedItem.condition === 'Available'
        ? 'Demo Warehouse'
        : returnedItem.condition === 'Under Review'
          ? 'Technical Review'
          : 'Pending Assessment'

    const updatedItem: EquipmentItem = {
      ...item,
      status: statusAfterReturn,
      location: locationAfterReturn,
      activeLoan: undefined,
      conditionNotes:
        returnedItem.notes.trim() ||
        (returnedItem.condition === 'Available'
          ? item.conditionNotes
          : `Returned with condition: ${returnedItem.condition}.`),
      movements: [
        {
          date: input.returnDate,
          type: 'Return Registered',
          description: `Equipment returned from loan ${input.loanCode}. Final condition: ${returnedItem.condition}.`,
          user: 'Nicolás Steck',
        },
        ...item.movements,
      ],
    }

    saveEquipmentOverride(updatedItem)

    return updatedItem
  })

  return updatedEquipment
}

export function getEquipmentStatusTone(
  status: EquipmentStatus,
): 'success' | 'info' | 'warning' | 'violet' | 'danger' {
  switch (status) {
    case 'Available':
      return 'success'
    case 'On Loan':
      return 'info'
    case 'Reserved':
      return 'warning'
    case 'Under Review':
      return 'violet'
    case 'Damaged':
      return 'danger'
  }
}