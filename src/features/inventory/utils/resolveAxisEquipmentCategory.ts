import type { AxisPricelistItem } from '../../loan-requests/data/axisPricelist'

export type ResolvedEquipmentCategory =
  | 'Camera'
  | 'Intercom'
  | 'Audio'
  | 'Radar'
  | 'Access Control'
  | 'Switch'
  | 'Accessory'
  | 'Other'

export type AxisCategoryResolution = {
  category: ResolvedEquipmentCategory
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term))
}

function getAxisModelToken(productName: string) {
  const normalizedName = normalizeText(productName)

  const match = normalizedName.match(/\bAXIS\s+([A-Z]\d{3,5}[A-Z0-9-]*)\b/)

  return match?.[1] ?? ''
}

export function resolveAxisEquipmentCategory(
  item: AxisPricelistItem,
): AxisCategoryResolution {
  const name = normalizeText(item.productName)
  const description = normalizeText(item.productDescription)
  const combined = `${name} ${description}`
  const modelToken = getAxisModelToken(item.productName)

  // ------------------------------------------------------------
  // 1. Intercom
  // ------------------------------------------------------------

  if (
    modelToken.startsWith('I') ||
    includesAny(combined, [
      'INTERCOM',
      'DOOR STATION',
      'NETWORK DOOR STATION',
      '2N IP VERSO',
      '2N IP SOLO',
      '2N IP FORCE',
      '2N IP STYLE',
      '2N IP BASE',
      '2N IP ONE',
    ])
  ) {
    return {
      category: 'Intercom',
      confidence: 'high',
      reason: 'Detected as intercom / door station family.',
    }
  }

  // ------------------------------------------------------------
  // 2. Access Control
  // ------------------------------------------------------------

  if (
    modelToken.startsWith('A') ||
    includesAny(combined, [
      'ACCESS CONTROL',
      'ACCESS UNIT',
      'ACCESS COMMANDER',
      'DOOR CONTROLLER',
      'READER',
      'RFID',
      'KEY FOB',
      'ACCESS CARD',
      'MOBILE CREDENTIAL',
      'FINGERPRINT',
      '2N AU',
      '2N AC ',
      '2N ACCESS',
    ])
  ) {
    return {
      category: 'Access Control',
      confidence: 'high',
      reason: 'Detected as access control product or credential family.',
    }
  }

  // ------------------------------------------------------------
  // 3. Audio
  // ------------------------------------------------------------

  if (
    modelToken.startsWith('C') ||
    includesAny(combined, [
      'NETWORK SPEAKER',
      'HORN SPEAKER',
      'CEILING SPEAKER',
      'CABINET SPEAKER',
      'AUDIO MANAGER',
      'AUDIO SYSTEM DEVICE',
      'AUDIO BRIDGE',
      'NETWORK AUDIO',
      'SPEAKER',
    ])
  ) {
    return {
      category: 'Audio',
      confidence: 'high',
      reason: 'Detected as network audio product.',
    }
  }

  // ------------------------------------------------------------
  // 4. Radar
  // ------------------------------------------------------------

  if (
    includesAny(combined, ['RADAR']) ||
    modelToken.startsWith('D20') ||
    modelToken.startsWith('D21') ||
    modelToken.startsWith('D22')
  ) {
    return {
      category: 'Radar',
      confidence: 'high',
      reason: 'Detected as radar or radar-family device.',
    }
  }

  // ------------------------------------------------------------
  // 5. Switch
  // ------------------------------------------------------------

  if (
    includesAny(combined, [
      'NETWORK SWITCH',
      'POE SWITCH',
      'POWER OVER ETHERNET SWITCH',
    ]) ||
    modelToken.startsWith('T85') ||
    modelToken.startsWith('D80') ||
    modelToken.startsWith('D82') ||
    modelToken.startsWith('D83')
  ) {
    return {
      category: 'Switch',
      confidence: 'high',
      reason: 'Detected as network switch family.',
    }
  }

  // ------------------------------------------------------------
  // 6. Camera
  // ------------------------------------------------------------

  if (
    modelToken.startsWith('M') ||
    modelToken.startsWith('P') ||
    modelToken.startsWith('Q') ||
    includesAny(combined, [
      'CAMERA',
      'BLOCK CAMERA',
      'BOX CAMERA',
      'BULLET CAMERA',
      'DOME CAMERA',
      'PANORAMIC CAMERA',
      'PTZ CAMERA',
      'THERMAL CAMERA',
      'FISHEYE CAMERA',
      'MODULAR CAMERA',
      'EXPLOSION-PROTECTED CAMERA',
    ])
  ) {
    return {
      category: 'Camera',
      confidence: 'high',
      reason: 'Detected as Axis camera family.',
    }
  }

  // ------------------------------------------------------------
  // 7. Accessory
  // ------------------------------------------------------------

  if (
    includesAny(combined, [
      'MOUNT',
      'BRACKET',
      'WALL-AND-POLE',
      'POLE MOUNT',
      'PENDANT KIT',
      'ADAPTER',
      'ADAPTOR',
      'HOUSING',
      'CABINET',
      'ENCLOSURE',
      'LENS',
      'ILLUMINATOR',
      'POWER SUPPLY',
      'POWER INJECTOR',
      'MIDSPAN',
      'CABLE',
      'CONVERTER',
      'CONNECTOR',
      'ACCESSORY',
      'JOYSTICK',
      'KEYPAD',
      'SD CARD',
      'HARD DRIVE',
    ])
  ) {
    return {
      category: 'Accessory',
      confidence: 'medium',
      reason: 'Detected as accessory, mounting or connectivity item.',
    }
  }

  // ------------------------------------------------------------
  // 8. Fallback
  // ------------------------------------------------------------

  return {
    category: 'Other',
    confidence: 'low',
    reason: 'No high-confidence category signal was found.',
  }
}