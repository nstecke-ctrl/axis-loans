import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import * as XLSX from 'xlsx'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  importEquipmentAssetsInSupabase,
  type ImportEquipmentAssetInput,
  type ImportEquipmentAssetsResult,
} from '../data/equipmentSupabase'

type ImportPreviewRow = {
  id: string
  rowNumber: number
  item: ImportEquipmentAssetInput | null
  errors: string[]
}

type DateParseResult = {
  value?: string
  error?: string
}

const REQUIRED_COLUMN_GROUPS = [
  {
    label: 'Category',
    aliases: ['Category', 'Categoría', 'Categoria'],
  },
  {
    label: 'Brand',
    aliases: ['Brand', 'Marca'],
  },
  {
    label: 'Model',
    aliases: ['Model', 'Modelo'],
  },
  {
    label: 'Serial Number',
    aliases: ['Serial Number', 'Serial', 'Número de Serie', 'Numero de Serie'],
  },
  {
    label: 'Status',
    aliases: ['Status', 'Estado'],
  },
  {
    label: 'Location',
    aliases: ['Location', 'Ubicación', 'Ubicacion'],
  },
]

const FIELD_ALIASES = {
  category: ['Category', 'Categoría', 'Categoria'],
  brand: ['Brand', 'Marca'],
  model: ['Model', 'Modelo'],
  partNumber: ['Part Number', 'PartNumber', 'Part_Number', 'SKU', 'P/N'],
  serialNumber: [
    'Serial Number',
    'SerialNumber',
    'Serial_Number',
    'Serial',
    'Número de Serie',
    'Numero de Serie',
  ],
  legacyCode: [
    'Legacy Code',
    'LegacyCode',
    'Legacy_Code',
    'Código Anterior',
    'Codigo Anterior',
  ],
  status: ['Status', 'Estado'],
  location: ['Location', 'Ubicación', 'Ubicacion'],
  acquiredAt: [
    'Acquired At',
    'AcquiredAt',
    'Acquired_At',
    'Acquisition Date',
    'Fecha de Adquisición',
    'Fecha de Adquisicion',
  ],
  accessories: ['Accessories', 'Accesorios'],
  conditionNotes: [
    'Condition Notes',
    'ConditionNotes',
    'Condition_Notes',
    'Notas de Condición',
    'Notas de Condicion',
  ],
  generalNotes: [
    'General Notes',
    'GeneralNotes',
    'General_Notes',
    'Notas Generales',
  ],
}

const STATUS_MAP = new Map<string, ImportEquipmentAssetInput['status']>([
  ['available', 'Available'],
  ['reserved', 'Reserved'],
  ['underreview', 'Under Review'],
  ['damaged', 'Damaged'],
])

const CATEGORY_MAP = new Map<string, string>([
  ['camera', 'Camera'],
  ['intercom', 'Intercom'],
  ['audio', 'Audio'],
  ['radar', 'Radar'],
  ['accesscontrol', 'Access Control'],
  ['switch', 'Switch'],
  ['accessory', 'Accessory'],
  ['other', 'Other'],
])

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function asTrimmedText(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function getRowValue(
  row: Record<string, unknown>,
  aliases: string[],
): unknown {
  const normalizedAliases = new Set(aliases.map(normalizeKey))

  const entry = Object.entries(row).find(([columnName]) =>
    normalizedAliases.has(normalizeKey(columnName)),
  )

  return entry?.[1] ?? ''
}

function rowHasAnyValue(row: Record<string, unknown>) {
  return Object.values(row).some((value) => asTrimmedText(value).length > 0)
}

function formatDateParts(year: number, month: number, day: number) {
  const safeMonth = String(month).padStart(2, '0')
  const safeDay = String(day).padStart(2, '0')
  return `${year}-${safeMonth}-${safeDay}`
}

function parseOptionalExcelDate(value: unknown): DateParseResult {
  if (value === null || value === undefined || asTrimmedText(value) === '') {
    return {}
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return {
        error:
          'Acquisition Date is invalid. Use YYYY-MM-DD or DD/MM/YYYY.',
      }
    }

    return {
      value: formatDateParts(
        value.getFullYear(),
        value.getMonth() + 1,
        value.getDate(),
      ),
    }
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)

    if (!parsed) {
      return {
        error:
          'Acquisition Date is invalid. Use YYYY-MM-DD or DD/MM/YYYY.',
      }
    }

    return {
      value: formatDateParts(parsed.y, parsed.m, parsed.d),
    }
  }

  const text = asTrimmedText(value)

  const yyyyMmDd = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (yyyyMmDd) {
    return {
      value: `${yyyyMmDd[1]}-${yyyyMmDd[2]}-${yyyyMmDd[3]}`,
    }
  }

  const ddMmYyyy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)

  if (ddMmYyyy) {
    return {
      value: formatDateParts(
        Number(ddMmYyyy[3]),
        Number(ddMmYyyy[2]),
        Number(ddMmYyyy[1]),
      ),
    }
  }

  return {
    error: 'Acquisition Date is invalid. Use YYYY-MM-DD or DD/MM/YYYY.',
  }
}

function validateHeaders(rows: Record<string, unknown>[]) {
  const firstRow = rows[0]

  if (!firstRow) {
    return ['The file does not contain importable data rows.']
  }

  const availableHeaders = new Set(
    Object.keys(firstRow).map((columnName) => normalizeKey(columnName)),
  )

  return REQUIRED_COLUMN_GROUPS.flatMap((columnGroup) => {
    const hasColumn = columnGroup.aliases.some((alias) =>
      availableHeaders.has(normalizeKey(alias)),
    )

    return hasColumn ? [] : [`Missing required column: ${columnGroup.label}.`]
  })
}

function buildPreviewRows(
  rawRows: Record<string, unknown>[],
): ImportPreviewRow[] {
  const previewRows = rawRows
    .filter(rowHasAnyValue)
    .map((row, index) => {
      const errors: string[] = []

      const rawCategory = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.category),
      )
      const rawBrand = asTrimmedText(getRowValue(row, FIELD_ALIASES.brand))
      const rawModel = asTrimmedText(getRowValue(row, FIELD_ALIASES.model))
      const rawPartNumber = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.partNumber),
      )
      const rawSerialNumber = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.serialNumber),
      )
      const rawLegacyCode = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.legacyCode),
      )
      const rawStatus = asTrimmedText(getRowValue(row, FIELD_ALIASES.status))
      const rawLocation = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.location),
      )
      const rawAcquiredAt = getRowValue(row, FIELD_ALIASES.acquiredAt)
      const rawAccessories = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.accessories),
      )
      const rawConditionNotes = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.conditionNotes),
      )
      const rawGeneralNotes = asTrimmedText(
        getRowValue(row, FIELD_ALIASES.generalNotes),
      )

      const normalizedCategory = CATEGORY_MAP.get(normalizeKey(rawCategory))
      const normalizedStatus = STATUS_MAP.get(normalizeKey(rawStatus))
      const normalizedSerial =
        normalizeKey(rawSerialNumber) === 'noserial'
          ? 'No Serial'
          : rawSerialNumber

      const acquiredAt = parseOptionalExcelDate(rawAcquiredAt)

      if (!rawCategory) {
        errors.push('Category is required.')
      } else if (!normalizedCategory) {
        errors.push(
          'Category is invalid. Use Camera, Intercom, Audio, Radar, Access Control, Switch, Accessory or Other.',
        )
      }

      if (!rawBrand) {
        errors.push('Brand is required.')
      }

      if (!rawModel) {
        errors.push('Model is required.')
      }

      if (!rawSerialNumber) {
        errors.push('Serial Number is required. Use No Serial when applicable.')
      }

      if (!rawStatus) {
        errors.push('Status is required.')
      } else if (!normalizedStatus) {
        errors.push(
          'Status is invalid. Use Available, Reserved, Under Review or Damaged.',
        )
      }

      if (!rawLocation) {
        errors.push('Location is required.')
      }

      if (acquiredAt.error) {
        errors.push(acquiredAt.error)
      }

      const item: ImportEquipmentAssetInput | null =
        errors.length === 0 && normalizedCategory && normalizedStatus
          ? {
              category: normalizedCategory,
              brand: rawBrand,
              model: rawModel,
              partNumber: rawPartNumber,
              serialNumber: normalizedSerial,
              legacyCode: rawLegacyCode || undefined,
              status: normalizedStatus,
              location: rawLocation,
              acquiredAt: acquiredAt.value,
              accessories: rawAccessories || undefined,
              conditionNotes: rawConditionNotes || undefined,
              generalNotes: rawGeneralNotes || undefined,
            }
          : null

      return {
        id: `row-${index + 2}`,
        rowNumber: index + 2,
        item,
        errors,
      }
    })

  const serialRows = new Map<string, ImportPreviewRow[]>()

  previewRows.forEach((row) => {
    const serial = row.item?.serialNumber

    if (!serial || normalizeKey(serial) === 'noserial') {
      return
    }

    const normalizedSerial = normalizeKey(serial)
    const matchingRows = serialRows.get(normalizedSerial) ?? []

    matchingRows.push(row)
    serialRows.set(normalizedSerial, matchingRows)
  })

  serialRows.forEach((rowsWithSameSerial) => {
    if (rowsWithSameSerial.length <= 1) {
      return
    }

    rowsWithSameSerial.forEach((row) => {
      row.errors.push('Duplicated Serial Number inside the Excel file.')
    })
  })

  return previewRows
}

export function ImportEquipmentPage() {
  const [fileInputVersion, setFileInputVersion] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headerErrors, setHeaderErrors] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isReadingFile, setIsReadingFile] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] =
    useState<ImportEquipmentAssetsResult | null>(null)

  const validRows = useMemo(
    () => previewRows.filter((row) => row.errors.length === 0 && row.item),
    [previewRows],
  )

  const invalidRows = useMemo(
    () => previewRows.filter((row) => row.errors.length > 0),
    [previewRows],
  )

  const canImport =
    previewRows.length > 0 &&
    headerErrors.length === 0 &&
    invalidRows.length === 0 &&
    !isImporting

  async function handleFileChange(file: File | undefined) {
    setFileName(file?.name ?? null)
    setHeaderErrors([])
    setPreviewRows([])
    setFileError(null)
    setImportError(null)
    setImportResult(null)

    if (!file) {
      return
    }

    setIsReadingFile(true)

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        cellDates: true,
      })

      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new Error('The Excel file does not contain any worksheet.')
      }

      const worksheet = workbook.Sheets[firstSheetName]

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        worksheet,
        {
          defval: '',
          raw: true,
        },
      )

      if (rows.length === 0) {
        throw new Error('The Excel file does not contain importable data rows.')
      }

      const detectedHeaderErrors = validateHeaders(rows)

      setHeaderErrors(detectedHeaderErrors)

      if (detectedHeaderErrors.length > 0) {
        return
      }

      const preparedRows = buildPreviewRows(rows)

      if (preparedRows.length === 0) {
        throw new Error('The Excel file only contains empty rows.')
      }

      setPreviewRows(preparedRows)
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : 'Unable to read the Excel file.',
      )
    } finally {
      setIsReadingFile(false)
    }
  }

  async function handleImport() {
    if (!canImport) {
      return
    }

    setIsImporting(true)
    setImportError(null)

    try {
      const items = validRows
        .map((row) => row.item)
        .filter((item): item is ImportEquipmentAssetInput => item !== null)

      const result = await importEquipmentAssetsInSupabase(items)

      setImportResult(result)
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : 'Unable to import equipment.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  function resetImportFlow() {
    setFileInputVersion((currentVersion) => currentVersion + 1)
    setFileName(null)
    setHeaderErrors([])
    setPreviewRows([])
    setFileError(null)
    setImportError(null)
    setImportResult(null)
    setIsReadingFile(false)
    setIsImporting(false)
  }

  if (importResult) {
    return (
      <>
        <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Excel import completed
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Equipment assets created successfully
            </h2>
          </div>
        </header>

        <section className="px-6 py-6 lg:px-10 lg:py-8">
          <div className="grid min-w-0 gap-6 xl:grid-cols-[1.35fr_0.8fr]">
            <div className="min-w-0 space-y-6">
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-emerald-700">
                  Import Result
                </p>

                <h3 className="mt-2 text-3xl font-semibold text-emerald-950">
                  {importResult.importedCount} assets imported
                </h3>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-800">
                  The batch was created in a single controlled operation. The
                  imported internal codes range from{' '}
                  <span className="font-semibold">
                    {importResult.firstEquipmentCode}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold">
                    {importResult.lastEquipmentCode}
                  </span>
                  .
                </p>
              </article>

              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-[#666666]">
                  Processing Rules
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  What the system registered
                </h3>

                <ul className="mt-5 space-y-3 text-sm leading-6 text-[#555555]">
                  <li>• Equipment rows were imported only after full validation.</li>
                  <li>• Final EQ codes were generated consecutively.</li>
                  <li>• Duplicate real serial numbers were rejected.</li>
                  <li>• An initial activity movement was created for every asset.</li>
                </ul>
              </article>
            </div>

            <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-[#666666]">
                  Next Action
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  Continue
                </h3>

                <div className="mt-6 space-y-3">
                  <Link
                    to="/inventory"
                    className="inline-flex w-full justify-center rounded-xl bg-[#181818] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    Back to Inventory
                  </Link>

                  <button
                    type="button"
                    onClick={resetImportFlow}
                    className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Import Another Excel
                  </button>
                </div>
              </article>
            </aside>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <Link
              to="/inventory"
              className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
            >
              ← Back to Inventory
            </Link>

            <p className="mt-4 text-sm font-medium text-[#666666]">
              Asset Management
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Import Equipment from Excel
            </h2>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-[#fff8d6] px-4 py-3">
            <p className="text-sm font-semibold text-[#5d4a00]">
              Bulk Inventory Load
            </p>

            <p className="mt-1 text-sm text-[#5d4a00]">
              Upload, review and import a validated equipment batch.
            </p>
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        <div className="grid min-w-0 gap-6 xl:grid-cols-[1.4fr_0.85fr]">
          <div className="min-w-0 space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div>
                  <p className="text-sm font-medium text-[#666666]">Step 1</p>

                  <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                    Select Excel File
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    Accepted formats: .xlsx and .xls. The first worksheet will
                    be used for import.
                  </p>
                </div>

                <a
                  href="/templates/Formato_Importacion_Inventario_Axis_Loans.xlsx"
                  download
                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                >
                  Download Excel Template
                </a>
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-[#d8d8d4] bg-[#fafaf8] p-6">
                <input
                  key={fileInputVersion}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) =>
                    void handleFileChange(event.target.files?.[0])
                  }
                  className="block w-full text-sm text-[#555555] file:mr-4 file:rounded-xl file:border-0 file:bg-[#181818] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-black"
                />

                {fileName && (
                  <p className="mt-4 break-words text-sm text-[#555555]">
                    Selected file:{' '}
                    <span className="font-semibold text-[#171717]">
                      {fileName}
                    </span>
                  </p>
                )}
              </div>

              {isReadingFile && (
                <div className="mt-5 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
                  <p className="text-sm font-semibold text-[#171717]">
                    Reading Excel file...
                  </p>
                </div>
              )}

              {fileError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {fileError}
                  </p>
                </div>
              )}

              {headerErrors.length > 0 && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    The file structure is incomplete
                  </p>

                  <ul className="mt-3 space-y-2 text-sm text-red-700">
                    {headerErrors.map((error) => (
                      <li key={error}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-[#666666]">Step 2</p>

              <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                Required Excel Structure
              </h3>

              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-[#ecece8]">
                  <thead className="bg-[#fafaf8]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Column
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Requirement
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                        Example
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#f0f0ed] bg-white text-sm">
                    {[
                      ['Category', 'Required', 'Camera'],
                      ['Brand', 'Required', 'Axis'],
                      ['Model', 'Required', 'AXIS P3268-LVE'],
                      ['Part Number', 'Optional', '02634-001'],
                      ['Serial Number', 'Required', 'B8A44F1C92D1 or No Serial'],
                      ['Legacy Code', 'Optional', 'CAM-DEMO-01'],
                      ['Status', 'Required', 'Available'],
                      ['Location', 'Required', 'Demo Warehouse'],
                      ['Acquired At', 'Optional', '2026-05-18'],
                      ['Accessories', 'Optional', 'Mounting bracket'],
                      ['Condition Notes', 'Optional', 'No visible issues'],
                      ['General Notes', 'Optional', 'Imported batch'],
                    ].map(([column, requirement, example]) => (
                      <tr key={column}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#171717]">
                          {column}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-[#555555]">
                          {requirement}
                        </td>

                        <td className="min-w-56 px-4 py-3 text-[#555555]">
                          {example}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-5 text-sm leading-6 text-[#555555]">
                For serial numbers, format the Excel column as text when
                possible. This prevents Excel from altering values that begin
                with zeros.
              </p>
            </article>

            {previewRows.length > 0 && (
              <article className="min-w-0 overflow-hidden rounded-2xl border border-[#e5e5e2] bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-[#e5e5e2] px-6 py-5 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-medium text-[#666666]">
                      Step 3
                    </p>

                    <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                      Import Preview
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                      {validRows.length} valid
                    </span>

                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-800">
                      {invalidRows.length} with errors
                    </span>
                  </div>
                </div>

                <div className="w-full min-w-0 overflow-x-auto">
                  <table className="min-w-[980px] divide-y divide-[#ecece8]">
                    <thead className="bg-[#fafaf8]">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Row
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Model
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Serial
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Status
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Location
                        </th>

                        <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-[#777777]">
                          Validation
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#f0f0ed] bg-white">
                      {previewRows.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#171717]">
                            {row.rowNumber}
                          </td>

                          <td className="min-w-64 px-5 py-4 text-sm text-[#555555]">
                            {row.item?.model ?? 'Review required'}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                            {row.item?.serialNumber ?? '—'}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-sm text-[#555555]">
                            {row.item?.status ?? '—'}
                          </td>

                          <td className="min-w-56 px-5 py-4 text-sm text-[#555555]">
                            {row.item?.location ?? '—'}
                          </td>

                          <td className="min-w-[24rem] px-5 py-4">
                            {row.errors.length === 0 ? (
                              <StatusBadge label="Valid" tone="success" />
                            ) : (
                              <div className="space-y-2">
                                <StatusBadge label="Review" tone="danger" />

                                <ul className="space-y-1 text-sm text-red-700">
                                  {row.errors.map((error) => (
                                    <li key={`${row.id}-${error}`}>• {error}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}
          </div>

          <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-[#666666]">
                Import Control
              </p>

              <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                Batch Summary
              </h3>

              <div className="mt-6 space-y-5">
                <SummaryField
                  label="Rows Prepared"
                  value={`${previewRows.length}`}
                />

                <SummaryField
                  label="Valid Rows"
                  value={`${validRows.length}`}
                />

                <SummaryField
                  label="Rows with Errors"
                  value={`${invalidRows.length}`}
                />
              </div>

              {importError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">
                    {importError}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleImport}
                disabled={!canImport}
                className={`mt-6 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  canImport
                    ? 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isImporting
                  ? 'Importing Equipment...'
                  : `Import ${validRows.length} Assets`}
              </button>

              <p className="mt-3 text-sm leading-6 text-[#666666]">
                The import button activates only when all detected rows are
                valid.
              </p>
            </article>

            <article className="rounded-2xl border border-amber-200 bg-[#fff8d6] p-6 shadow-sm">
              <p className="text-sm font-semibold text-[#5d4a00]">
                Validation Behavior
              </p>

              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#5d4a00]">
                <li>• Any invalid row blocks the full batch.</li>
                <li>• Duplicate serials inside the file are rejected.</li>
                <li>• Existing serials are validated again by the database.</li>
                <li>• Failed imports do not consume EQ folios.</li>
              </ul>
            </article>
          </aside>
        </div>
      </section>
    </>
  )
}

function SummaryField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#171717]">{value}</p>
    </div>
  )
}