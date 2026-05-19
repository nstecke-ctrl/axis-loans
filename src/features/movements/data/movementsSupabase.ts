import { supabase } from '../../../lib/supabase'

export type MovementType =
  | 'Equipment Created'
  | 'Loan Checkout'
  | 'Return Registered'
  | 'Manual Status Change'

export type GlobalMovement = {
  id: string
  date: string
  type: MovementType
  equipmentCode: string
  equipmentModel: string
  description: string
  user: string
  createdAt: string
}

type EquipmentMovementJoinRow = {
  code: string
  model: string
}

type EquipmentMovementRow = {
  movement_date: string
  movement_type: MovementType
  description: string
  performed_by: string
  created_at: string
  equipment: EquipmentMovementJoinRow | EquipmentMovementJoinRow[] | null
}

function formatDatabaseDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function mapMovementRowToMovement(
  row: EquipmentMovementRow,
  index: number,
): GlobalMovement | null {
  const equipment = Array.isArray(row.equipment)
    ? row.equipment[0]
    : row.equipment

  if (!equipment) {
    return null
  }

  return {
    id: `${equipment.code}-${row.created_at}-${index}`,
    date: formatDatabaseDate(row.movement_date),
    type: row.movement_type,
    equipmentCode: equipment.code,
    equipmentModel: equipment.model,
    description: row.description,
    user: row.performed_by,
    createdAt: row.created_at,
  }
}

export async function fetchMovementsFromSupabase(): Promise<GlobalMovement[]> {
  const { data, error } = await supabase
    .from('equipment_movements')
    .select(
      `
        movement_date,
        movement_type,
        description,
        performed_by,
        created_at,
        equipment (
          code,
          model
        )
      `,
    )
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load activity movements: ${error.message}`)
  }

  return ((data ?? []) as EquipmentMovementRow[])
    .map(mapMovementRowToMovement)
    .filter((movement): movement is GlobalMovement => movement !== null)
}