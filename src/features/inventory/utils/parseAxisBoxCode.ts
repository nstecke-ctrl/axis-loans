import {
  axisPricelistItems,
  type AxisPricelistItem,
} from '../../loan-requests/data/axisPricelist'

export type EquipmentCatalogCategory =
  | 'Camera'
  | 'Intercom'
  | 'Audio'
  | 'Radar'
  | 'Access Control'
  | 'Switch'
  | 'Accessory'
  | 'Other'

export type ParsedAxisBoxCode = {
  rawText: string
  detectedPartNumber?: string
  detectedSerialNumber?: string
  catalogItem?: AxisPricelistItem
  inferredCategory?: EquipmentCatalogCategory
  messages: string[]
}

function normalizeComparableText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function normalizeSerialCandidate(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function normalizeGenericPartNumber(value: string) {
  const compactValue = value.replace(/[^0-9]/g, '')

  if (compactValue.length !== 8) {
    return value.trim()
  }

  return `${compactValue.slice(0, 5)}-${compactValue.slice(5)}`
}

function findCatalogItem(rawText: string) {
  const normalizedRawText = normalizeComparableText(rawText)

  return axisPricelistItems.find((item) =>
    normalizedRawText.includes(normalizeComparableText(item.partNumber)),
  )
}

function detectGenericPartNumber(rawText: string) {
  const dashedPartNumber = rawText.match(/\b\d{5}[-_\s]?\d{3}\b/)

  if (!dashedPartNumber) {
    return undefined
  }

  return normalizeGenericPartNumber(dashedPartNumber[0])
}

function detectSerialNumber(rawText: string) {
  const labeledSerialPatterns = [
    /(?:SERIAL(?:\s*NUMBER|\s*NO\.?)?|S\/?N|SN)[\s:=#-]*([A-Z0-9:\-_]{8,32})/i,
    /(?:\(21\)|\b21\b)[\s:=#-]*([A-Z0-9:\-_]{8,32})/i,
  ]

  for (const pattern of labeledSerialPatterns) {
    const match = rawText.match(pattern)

    if (!match?.[1]) {
      continue
    }

    const candidate = normalizeSerialCandidate(match[1])

    if (/^[A-F0-9]{12}$/.test(candidate)) {
      return candidate
    }

    if (/^[A-Z0-9]{8,24}$/.test(candidate)) {
      return candidate
    }
  }

  const macWithSeparators = rawText.match(
    /\b(?:[A-F0-9]{2}[:-]){5}[A-F0-9]{2}\b/i,
  )

  if (macWithSeparators) {
    return normalizeSerialCandidate(macWithSeparators[0])
  }

  const standaloneHexSerial = rawText.match(/\b[A-F0-9]{12}\b/i)

  if (standaloneHexSerial) {
    return standaloneHexSerial[0].toUpperCase()
  }

  return undefined
}

function inferCategoryFromCatalogItem(
  item: AxisPricelistItem,
): EquipmentCatalogCategory {
  const searchableText =
    `${item.productName} ${item.productDescription}`.toLowerCase()

  if (searchableText.includes('radar')) {
    return 'Radar'
  }

  if (
    searchableText.includes('intercom') ||
    searchableText.includes('door station') ||
    searchableText.includes('ip verso') ||
    searchableText.includes('2n ip')
  ) {
    return 'Intercom'
  }

  if (
    searchableText.includes('speaker') ||
    searchableText.includes('microphone') ||
    searchableText.includes('audio') ||
    searchableText.includes('horn')
  ) {
    return 'Audio'
  }

  if (
    searchableText.includes('access commander') ||
    searchableText.includes('access unit') ||
    searchableText.includes('door controller') ||
    searchableText.includes('reader') ||
    searchableText.includes('rfid') ||
    searchableText.includes('keypad') ||
    searchableText.includes('fingerprint')
  ) {
    return 'Access Control'
  }

  if (
    searchableText.includes('network switch') ||
    searchableText.includes('poe switch') ||
    searchableText.includes('managed switch')
  ) {
    return 'Switch'
  }

  if (
    searchableText.includes('camera') ||
    searchableText.includes('ptz') ||
    searchableText.includes('bullet') ||
    searchableText.includes('dome') ||
    searchableText.includes('thermal') ||
    searchableText.includes('panoramic') ||
    searchableText.includes('multisensor') ||
    searchableText.includes('fisheye')
  ) {
    return 'Camera'
  }

  if (
    searchableText.includes('mount') ||
    searchableText.includes('bracket') ||
    searchableText.includes('adapter') ||
    searchableText.includes('adaptor') ||
    searchableText.includes('cable') ||
    searchableText.includes('power supply') ||
    searchableText.includes('housing') ||
    searchableText.includes('cover') ||
    searchableText.includes('cabinet') ||
    searchableText.includes('kit') ||
    searchableText.includes('accessory')
  ) {
    return 'Accessory'
  }

  return 'Other'
}

export function parseAxisBoxCode(rawText: string): ParsedAxisBoxCode {
  const messages: string[] = []

  const catalogItem = findCatalogItem(rawText)
  const genericPartNumber = detectGenericPartNumber(rawText)
  const serialNumber = detectSerialNumber(rawText)

  const detectedPartNumber =
    catalogItem?.partNumber ?? genericPartNumber ?? undefined

  if (catalogItem) {
    messages.push('Part number matched with the Axis catalog.')
  } else if (genericPartNumber) {
    messages.push(
      'A part number pattern was detected, but it was not found in the Axis catalog.',
    )
  } else {
    messages.push('No part number could be identified automatically.')
  }

  if (serialNumber) {
    messages.push('Serial number detected from the scanned content.')
  } else {
    messages.push('No serial number could be identified automatically.')
  }

  const inferredCategory = catalogItem
    ? inferCategoryFromCatalogItem(catalogItem)
    : undefined

  return {
    rawText,
    detectedPartNumber,
    detectedSerialNumber: serialNumber,
    catalogItem,
    inferredCategory,
    messages,
  }
}