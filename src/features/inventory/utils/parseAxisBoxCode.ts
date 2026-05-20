import {
  axisPricelistItems,
  type AxisPricelistItem,
} from '../../loan-requests/data/axisPricelist'
import {
  resolveAxisEquipmentCategory,
  type AxisCategoryResolution,
} from './resolveAxisEquipmentCategory'

export type ParsedAxisProductCode = {
  rawText: string
  detectedPartNumber?: string
  catalogItem?: AxisPricelistItem
  categoryResolution?: AxisCategoryResolution
  messages: string[]
}

export type ParsedAxisSerialCode = {
  rawText: string
  detectedSerialNumber?: string
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

  const genericSerialCandidate = rawText.match(/\b[A-Z0-9]{10,24}\b/i)

  if (genericSerialCandidate) {
    return normalizeSerialCandidate(genericSerialCandidate[0])
  }

  return undefined
}

export function parseAxisProductCode(
  rawText: string,
): ParsedAxisProductCode {
  const messages: string[] = []

  const catalogItem = findCatalogItem(rawText)
  const genericPartNumber = detectGenericPartNumber(rawText)

  const detectedPartNumber =
    catalogItem?.partNumber ?? genericPartNumber ?? undefined

  const categoryResolution = catalogItem
    ? resolveAxisEquipmentCategory(catalogItem)
    : undefined

  if (catalogItem) {
    messages.push('Part number matched with the Axis catalog.')
  } else if (genericPartNumber) {
    messages.push(
      'A part number pattern was detected, but it was not found in the Axis catalog.',
    )
  } else {
    messages.push('No part number could be identified automatically.')
  }

  if (categoryResolution) {
    messages.push(
      `Category resolved as ${categoryResolution.category} with ${categoryResolution.confidence} confidence.`,
    )
  }

  return {
    rawText,
    detectedPartNumber,
    catalogItem,
    categoryResolution,
    messages,
  }
}

export function parseAxisSerialCode(
  rawText: string,
): ParsedAxisSerialCode {
  const messages: string[] = []
  const serialNumber = detectSerialNumber(rawText)

  if (serialNumber) {
    messages.push('Serial number detected successfully.')
  } else {
    messages.push('No serial number could be identified automatically.')
  }

  return {
    rawText,
    detectedSerialNumber: serialNumber,
    messages,
  }
}