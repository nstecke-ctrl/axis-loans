import { supabase } from '../../../lib/supabase'
import type {
  ActiveLoan,
  EquipmentItem,
  EquipmentMovement,
  EquipmentStatus,
} from './equipment'

type EquipmentRow = {
  id: string
  code: string
  category: string
  brand: string
  model: string
  part_number: string
  serial_number: string
  status: EquipmentStatus
  location: string
  acquired_at: string
  legacy_code: string | null
  accessories: string | null
  condition_notes: string | null
  general_notes: string | null
}

type EquipmentMovementRow = {
  movement_date: string
  movement_type: string
  description: string
  performed_by: string
}

type LoanJoinRow = {
  code: string
  company: string
  responsible: string
  checkout_date: string
  expected_return_date: string
}

type ActiveLoanItemRow = {
  item_status: 'On Loan'
  loans: LoanJoinRow | LoanJoinRow[] | null
}

function formatDatabaseDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function mapEquipmentRowToItem(row: EquipmentRow): EquipmentItem {
  return {
    code: row.code,
    category: row.category,
    brand: row.brand,
    model: row.model,
    partNumber: row.part_number,
    serialNumber: row.serial_number,
    status: row.status,
    location: row.location,
    acquiredAt: formatDatabaseDate(row.acquired_at),
    legacyCode: row.legacy_code ?? undefined,
    accessories: row.accessories ?? undefined,
    conditionNotes: row.condition_notes ?? undefined,
    generalNotes: row.general_notes ?? undefined,
    movements: [],
  }
}

function mapMovementRowToMovement(
  row: EquipmentMovementRow,
): EquipmentMovement {
  return {
    date: formatDatabaseDate(row.movement_date),
    type: row.movement_type,
    description: row.description,
    user: row.performed_by,
  }
}

function mapActiveLoanRowToActiveLoan(
  row: ActiveLoanItemRow | null,
): ActiveLoan | undefined {
  if (!row?.loans) {
    return undefined
  }

  const loan = Array.isArray(row.loans) ? row.loans[0] : row.loans

  if (!loan) {
    return undefined
  }

  return {
    loanCode: loan.code,
    company: loan.company,
    responsible: loan.responsible,
    checkoutDate: formatDatabaseDate(loan.checkout_date),
    expectedReturnDate: formatDatabaseDate(loan.expected_return_date),
  }
}

export async function fetchEquipmentItemsFromSupabase() {
  const { data, error } = await supabase
    .from('equipment')
    .select(
      `
        id,
        code,
        category,
        brand,
        model,
        part_number,
        serial_number,
        status,
        location,
        acquired_at,
        legacy_code,
        accessories,
        condition_notes,
        general_notes
      `,
    )
    .order('code', { ascending: true })

  if (error) {
    throw new Error(`Unable to load equipment: ${error.message}`)
  }

  return (data as EquipmentRow[]).map(mapEquipmentRowToItem)
}

export async function fetchEquipmentDetailFromSupabase(
  equipmentCode: string,
): Promise<EquipmentItem | null> {
  const { data: equipmentRow, error: equipmentError } = await supabase
    .from('equipment')
    .select(
      `
        id,
        code,
        category,
        brand,
        model,
        part_number,
        serial_number,
        status,
        location,
        acquired_at,
        legacy_code,
        accessories,
        condition_notes,
        general_notes
      `,
    )
    .eq('code', equipmentCode)
    .limit(1)
    .maybeSingle()

  if (equipmentError) {
    throw new Error(
      `Unable to load equipment detail: ${equipmentError.message}`,
    )
  }

  if (!equipmentRow) {
    return null
  }

  const [movementsResponse, activeLoanResponse] = await Promise.all([
    supabase
      .from('equipment_movements')
      .select(
        `
          movement_date,
          movement_type,
          description,
          performed_by
        `,
      )
      .eq('equipment_id', equipmentRow.id)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false }),

    supabase
      .from('loan_items')
      .select(
        `
          item_status,
          loans (
            code,
            company,
            responsible,
            checkout_date,
            expected_return_date
          )
        `,
      )
      .eq('equipment_id', equipmentRow.id)
      .eq('item_status', 'On Loan')
      .limit(1)
      .maybeSingle(),
  ])

  if (movementsResponse.error) {
    throw new Error(
      `Unable to load equipment movements: ${movementsResponse.error.message}`,
    )
  }

  if (activeLoanResponse.error) {
    throw new Error(
      `Unable to load active loan: ${activeLoanResponse.error.message}`,
    )
  }

  const equipment = mapEquipmentRowToItem(equipmentRow as EquipmentRow)

  return {
    ...equipment,
    movements: (
      (movementsResponse.data ?? []) as EquipmentMovementRow[]
    ).map(mapMovementRowToMovement),
    activeLoan: mapActiveLoanRowToActiveLoan(
      activeLoanResponse.data as ActiveLoanItemRow | null,
    ),
  }
}
export type CreateEquipmentInput = {
  category: string
  brand: string
  model: string
  partNumber: string
  serialNumber: string
  legacyCode?: string
  status: EquipmentStatus
  location: string
  acquiredAt?: string
  accessories?: string
  conditionNotes?: string
  generalNotes?: string
}

type CreateEquipmentRpcResponse = {
  equipment_id: string
  equipment_code: string
}

export async function createEquipmentInSupabase(
  input: CreateEquipmentInput,
): Promise<EquipmentItem> {
  const { data: userData } = await supabase.auth.getUser()

  const performedBy = userData.user?.email ?? 'Administrator'

  const { data, error } = await supabase.rpc('create_equipment_asset', {
    p_category: input.category,
    p_brand: input.brand,
    p_model: input.model,
    p_part_number: input.partNumber,
    p_serial_number: input.serialNumber,
    p_legacy_code: input.legacyCode ?? '',
    p_status: input.status,
    p_location: input.location,
    p_acquired_at: input.acquiredAt || null,
    p_accessories: input.accessories ?? '',
    p_condition_notes: input.conditionNotes ?? '',
    p_general_notes: input.generalNotes ?? '',
    p_performed_by: performedBy,
  })

  if (error) {
    throw new Error(`Unable to create equipment: ${error.message}`)
  }

  const createdEquipment = (data as CreateEquipmentRpcResponse[] | null)?.[0]

  if (!createdEquipment) {
    throw new Error(
      'The equipment was created, but no equipment code was returned.',
    )
  }

  const equipment = await fetchEquipmentDetailFromSupabase(
    createdEquipment.equipment_code,
  )

  if (!equipment) {
    throw new Error(
      'The equipment was created, but its detail could not be loaded.',
    )
  }

  return equipment
}
export type ChangeEquipmentStatusInput = {
  equipmentCode: string
  newStatus: Exclude<EquipmentStatus, 'On Loan'>
  newLocation?: string
  notes?: string
}

type ChangeEquipmentStatusRpcResponse = {
  equipment_id: string
  equipment_code: string
  previous_status: EquipmentStatus
  updated_status: EquipmentStatus
}

export async function changeEquipmentStatusInSupabase(
  input: ChangeEquipmentStatusInput,
): Promise<EquipmentItem> {
  const { data: userData } = await supabase.auth.getUser()

  const performedBy = userData.user?.email ?? 'Administrator'

  const { data, error } = await supabase.rpc('change_equipment_status', {
    p_equipment_code: input.equipmentCode,
    p_new_status: input.newStatus,
    p_new_location: input.newLocation ?? '',
    p_notes: input.notes ?? '',
    p_performed_by: performedBy,
  })

  if (error) {
    throw new Error(`Unable to change equipment status: ${error.message}`)
  }

  const updatedStatus = (
    data as ChangeEquipmentStatusRpcResponse[] | null
  )?.[0]

  if (!updatedStatus) {
    throw new Error(
      'The status was updated, but no confirmation was returned.',
    )
  }

  const equipment = await fetchEquipmentDetailFromSupabase(
    updatedStatus.equipment_code,
  )

  if (!equipment) {
    throw new Error(
      'The status was updated, but the equipment detail could not be loaded.',
    )
  }

  return equipment
}
export type UpdateEquipmentProfileInput = {
  equipmentCode: string
  category: string
  brand: string
  model: string
  partNumber: string
  serialNumber: string
  legacyCode?: string
  acquiredAt?: string
  accessories?: string
  conditionNotes?: string
  generalNotes?: string
}

type UpdateEquipmentProfileRpcResponse = {
  equipment_id: string
  equipment_code: string
}

export async function updateEquipmentProfileInSupabase(
  input: UpdateEquipmentProfileInput,
): Promise<EquipmentItem> {
  const { data: userData } = await supabase.auth.getUser()

  const performedBy = userData.user?.email ?? 'Administrator'

  const { data, error } = await supabase.rpc('update_equipment_profile', {
    p_equipment_code: input.equipmentCode,
    p_category: input.category,
    p_brand: input.brand,
    p_model: input.model,
    p_part_number: input.partNumber,
    p_serial_number: input.serialNumber,
    p_legacy_code: input.legacyCode ?? '',
    p_acquired_at: input.acquiredAt || null,
    p_accessories: input.accessories ?? '',
    p_condition_notes: input.conditionNotes ?? '',
    p_general_notes: input.generalNotes ?? '',
    p_performed_by: performedBy,
  })

  if (error) {
    throw new Error(`Unable to update equipment profile: ${error.message}`)
  }

  const updatedProfile = (
    data as UpdateEquipmentProfileRpcResponse[] | null
  )?.[0]

  if (!updatedProfile) {
    throw new Error(
      'The equipment profile was updated, but no confirmation was returned.',
    )
  }

  const equipment = await fetchEquipmentDetailFromSupabase(
    updatedProfile.equipment_code,
  )

  if (!equipment) {
    throw new Error(
      'The equipment profile was updated, but its detail could not be loaded.',
    )
  }

  return equipment
}
export type ImportEquipmentAssetInput = {
  category: string
  brand: string
  model: string
  partNumber: string
  serialNumber: string
  legacyCode?: string
  status: Exclude<EquipmentStatus, 'On Loan'>
  location: string
  acquiredAt?: string
  accessories?: string
  conditionNotes?: string
  generalNotes?: string
}

export type ImportEquipmentAssetsResult = {
  importedCount: number
  firstEquipmentCode: string
  lastEquipmentCode: string
}

type ImportEquipmentAssetsRpcResponse = {
  imported_count: number
  first_equipment_code: string
  last_equipment_code: string
}

export async function importEquipmentAssetsInSupabase(
  items: ImportEquipmentAssetInput[],
): Promise<ImportEquipmentAssetsResult> {
  const { data: userData } = await supabase.auth.getUser()

  const performedBy = userData.user?.email ?? 'Administrator'

  const { data, error } = await supabase.rpc('import_equipment_assets', {
    p_items: items.map((item) => ({
      category: item.category,
      brand: item.brand,
      model: item.model,
      part_number: item.partNumber,
      serial_number: item.serialNumber,
      legacy_code: item.legacyCode ?? '',
      status: item.status,
      location: item.location,
      acquired_at: item.acquiredAt ?? '',
      accessories: item.accessories ?? '',
      condition_notes: item.conditionNotes ?? '',
      general_notes: item.generalNotes ?? '',
    })),
    p_performed_by: performedBy,
  })

  if (error) {
    throw new Error(`Unable to import equipment: ${error.message}`)
  }

  const importResult = (
    data as ImportEquipmentAssetsRpcResponse[] | null
  )?.[0]

  if (!importResult) {
    throw new Error(
      'The import was processed, but no confirmation was returned.',
    )
  }

  return {
    importedCount: importResult.imported_count,
    firstEquipmentCode: importResult.first_equipment_code,
    lastEquipmentCode: importResult.last_equipment_code,
  }
}