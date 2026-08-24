import { useState } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { EquipmentCodeScanner } from '../components/EquipmentCodeScanner'
import {
  getEquipmentStatusTone,
  type EquipmentItem,
  type EquipmentStatus,
} from '../data/equipment'
import { createEquipmentInSupabase } from '../data/equipmentSupabase'
import {
  parseAxisProductCode,
  parseAxisSerialCode,
  type ParsedAxisProductCode,
  type ParsedAxisSerialCode,
} from '../utils/parseAxisBoxCode'

type NewEquipmentForm = {
  category: string
  brand: string
  model: string
  partNumber: string
  serialNumber: string
  hasNoSerial: boolean
  legacyCode: string
  status: EquipmentStatus
  currentLocation: string
  acquiredAt: string
  accessories: string
  conditionNotes: string
  generalNotes: string
}

type ScannerStep = 'product' | 'serial' | null

const initialFormState: NewEquipmentForm = {
  category: '',
  brand: 'Axis',
  model: '',
  partNumber: '',
  serialNumber: '',
  hasNoSerial: false,
  legacyCode: '',
  status: 'Available',
  currentLocation: 'Demo Warehouse',
  acquiredAt: '',
  accessories: '',
  conditionNotes: '',
  generalNotes: '',
}

function formatMsrp(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatConfidence(value: 'high' | 'medium' | 'low') {
  switch (value) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
  }
}

export function NewEquipmentPage() {
  const [form, setForm] = useState<NewEquipmentForm>(initialFormState)
  const [submittedEquipment, setSubmittedEquipment] =
    useState<EquipmentItem | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [scannerStep, setScannerStep] = useState<ScannerStep>(null)
  const [productScanResult, setProductScanResult] =
    useState<ParsedAxisProductCode | null>(null)
  const [serialScanResult, setSerialScanResult] =
    useState<ParsedAxisSerialCode | null>(null)
  const [scanAppliedMessage, setScanAppliedMessage] = useState<string | null>(
    null,
  )

  const effectiveSerialNumber = form.hasNoSerial
    ? 'No Serial'
    : form.serialNumber.trim()

  const serialIsValid =
    form.hasNoSerial || form.serialNumber.trim().length > 0

  const isFormReady =
    Boolean(
      form.category &&
        form.brand.trim() &&
        form.model.trim() &&
        form.currentLocation.trim() &&
        serialIsValid,
    ) && !isSubmitting

  const productStepCompleted = Boolean(
    productScanResult?.detectedPartNumber,
  )

  const serialStepCompleted = Boolean(
    serialScanResult?.detectedSerialNumber,
  )

  const capturedDataReady = productStepCompleted && serialStepCompleted

  function updateForm(
    field: keyof NewEquipmentForm,
    value: string | boolean,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function handleNoSerialChange(checked: boolean) {
    setForm((currentForm) => ({
      ...currentForm,
      hasNoSerial: checked,
      serialNumber: checked ? '' : currentForm.serialNumber,
    }))
  }

  function openProductScanner() {
    setScanAppliedMessage(null)
    setScannerStep('product')
  }

  function openSerialScanner() {
    setScanAppliedMessage(null)
    setScannerStep('serial')
  }

  function closeScanner() {
    setScannerStep(null)
  }

  function handleDetectedCode(rawText: string) {
    if (scannerStep === 'product') {
      const parsedResult = parseAxisProductCode(rawText)
      setProductScanResult(parsedResult)
      setScanAppliedMessage(null)
      setScannerStep(null)
      return
    }

    if (scannerStep === 'serial') {
      const parsedResult = parseAxisSerialCode(rawText)
      setSerialScanResult(parsedResult)
      setScanAppliedMessage(null)
      setScannerStep(null)
    }
  }

  function handleApplyCapturedData() {
    if (!capturedDataReady) {
      return
    }

    setForm((currentForm) => ({
      ...currentForm,
      category:
        productScanResult?.categoryResolution?.category ??
        currentForm.category,
      brand: currentForm.brand.trim() || 'Axis',
      model:
        productScanResult?.catalogItem?.productName ?? currentForm.model,
      partNumber:
        productScanResult?.detectedPartNumber ?? currentForm.partNumber,
      serialNumber:
        serialScanResult?.detectedSerialNumber ?? currentForm.serialNumber,
      hasNoSerial: false,
    }))

    setScanAppliedMessage(
      'Product, category and serial information were applied to the equipment form.',
    )
  }

  async function handleSubmitEquipment() {
    if (!isFormReady) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const createdEquipment = await createEquipmentInSupabase({
        category: form.category,
        brand: form.brand.trim(),
        model: form.model.trim(),
        partNumber: form.partNumber.trim(),
        serialNumber: effectiveSerialNumber,
        legacyCode: form.legacyCode.trim() || undefined,
        status: form.status,
        location: form.currentLocation.trim(),
        acquiredAt: form.acquiredAt || undefined,
        accessories: form.accessories.trim() || undefined,
        conditionNotes: form.conditionNotes.trim() || undefined,
        generalNotes: form.generalNotes.trim() || undefined,
      })

      setSubmittedEquipment(createdEquipment)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to create this equipment asset.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCreateAnotherEquipment() {
    setForm(initialFormState)
    setSubmittedEquipment(null)
    setSubmitError(null)
    setScannerStep(null)
    setProductScanResult(null)
    setSerialScanResult(null)
    setScanAppliedMessage(null)
  }

  if (submittedEquipment) {
    return (
      <>
        <header className="border-b border-[#e5e5e2] bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Equipment created successfully
            </p>

            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
              Asset registered
            </h2>
          </div>
        </header>

        <section className="px-6 py-6 lg:px-10 lg:py-8">
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr]">
            <div className="space-y-6">
              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-medium text-emerald-700">
                  Final Internal Code
                </p>

                <h3 className="mt-2 text-3xl font-semibold text-emerald-950">
                  {submittedEquipment.code}
                </h3>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-800">
                  The equipment asset has been registered successfully. Its
                  initial inventory movement was also created automatically.
                </p>
              </article>

              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Creation Summary"
                  title="Registered Equipment Details"
                />

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <SummaryField
                    label="Category"
                    value={submittedEquipment.category}
                  />

                  <SummaryField
                    label="Brand"
                    value={submittedEquipment.brand}
                  />

                  <SummaryField
                    label="Model"
                    value={submittedEquipment.model}
                  />

                  <SummaryField
                    label="Part Number"
                    value={submittedEquipment.partNumber || 'Not registered'}
                  />

                  <SummaryField
                    label="Serial Number"
                    value={submittedEquipment.serialNumber}
                  />

                  <SummaryField
                    label="Legacy Code"
                    value={submittedEquipment.legacyCode ?? 'Not registered'}
                  />

                  <SummaryField
                    label="Initial Location"
                    value={submittedEquipment.location}
                  />

                  <SummaryField
                    label="Acquisition Date"
                    value={submittedEquipment.acquiredAt}
                  />
                </div>

                <div className="mt-6">
                  <p className="text-sm font-medium text-[#666666]">
                    Initial Status
                  </p>

                  <div className="mt-2">
                    <StatusBadge
                      label={submittedEquipment.status}
                      tone={getEquipmentStatusTone(submittedEquipment.status)}
                    />
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Additional Information"
                  title="Accessories and Notes"
                />

                <div className="mt-6 space-y-4">
                  <SummaryBlock
                    label="Included Accessories"
                    value={submittedEquipment.accessories ?? 'Not registered'}
                  />

                  <SummaryBlock
                    label="Condition / Technical Notes"
                    value={
                      submittedEquipment.conditionNotes ?? 'No observations'
                    }
                  />

                  <SummaryBlock
                    label="General Notes"
                    value={submittedEquipment.generalNotes ?? 'No observations'}
                  />
                </div>
              </article>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
                <SectionHeader eyebrow="Next Action" title="Continue" />

                <div className="mt-6 space-y-3">
                  <Link
                    to={`/inventory/${submittedEquipment.code}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#181818] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-black"
                  >
                    View Equipment Detail
                  </Link>

                  <Link
                    to="/inventory"
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-center text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Back to Inventory
                  </Link>

                  <button
                    type="button"
                    onClick={handleCreateAnotherEquipment}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-center text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                  >
                    Register Another Equipment
                  </button>
                </div>
              </article>

              <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                <p className="text-sm font-semibold text-emerald-900">
                  Registration completed
                </p>

                <ul className="mt-4 space-y-3 text-sm leading-6 text-emerald-800">
                  <li>• Asset saved in the inventory database.</li>
                  <li>• Final sequential EQ code generated.</li>
                  <li>• Duplicate real serial numbers validated.</li>
                  <li>• Initial movement registered automatically.</li>
                </ul>
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
              New Equipment
            </h2>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-[#fff8d6] px-4 py-3">
            <p className="text-sm font-semibold text-[#5d4a00]">
              Asset Registration
            </p>

            <p className="mt-1 text-sm text-[#5d4a00]">
              Complete the asset profile before adding it to inventory.
            </p>
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {submitError && (
          <article className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-red-800">
              Equipment could not be created
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {submitError}
            </p>
          </article>
        )}

        {scanAppliedMessage && (
          <article className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-800">
              {scanAppliedMessage}
            </p>
          </article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Optional Fast Capture"
                title="Scan Axis Box Labels"
              />

              <p className="mt-4 max-w-4xl text-sm leading-7 text-[#555555]">
                Axis boxes normally include one code with the product
                information and another code with the serial number. Complete
                both scans to prepare the equipment record automatically.
              </p>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <ScanStepCard
                  step="Step 1 of 2"
                  title="Scan Product Code"
                  description="Read the label that contains the Axis part number. This is used to identify the product and match it with the internal catalog."
                  completed={productStepCompleted}
                  buttonLabel={
                    productStepCompleted
                      ? 'Rescan Product Code'
                      : 'Scan Product Code'
                  }
                  onClick={openProductScanner}
                />

                <ScanStepCard
                  step="Step 2 of 2"
                  title="Scan Serial Number"
                  description="Read the second code on the box. This code is used to capture the unique serial number of the physical device."
                  completed={serialStepCompleted}
                  disabled={!productStepCompleted}
                  buttonLabel={
                    serialStepCompleted
                      ? 'Rescan Serial Number'
                      : 'Scan Serial Number'
                  }
                  onClick={openSerialScanner}
                />
              </div>

              {scannerStep === 'product' && (
                <div className="mt-6">
                  <EquipmentCodeScanner
                    eyebrow="Product Capture"
                    title="Scan Product Code"
                    description="Point the camera at the barcode or QR code that contains the product information from the Axis box."
                    scanningMessage="Camera active. Waiting for the product code."
                    onDetected={handleDetectedCode}
                    onClose={closeScanner}
                  />
                </div>
              )}

              {scannerStep === 'serial' && (
                <div className="mt-6">
                  <EquipmentCodeScanner
                    eyebrow="Serial Capture"
                    title="Scan Serial Number"
                    description="Point the camera at the second code on the Axis box. This code should contain the unique serial number of the device."
                    scanningMessage="Camera active. Waiting for the serial number code."
                    onDetected={handleDetectedCode}
                    onClose={closeScanner}
                  />
                </div>
              )}

              {(productScanResult || serialScanResult) && (
                <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <p className="text-sm font-medium text-[#666666]">
                        Captured Information
                      </p>

                      <h4 className="mt-1 text-lg font-semibold text-[#171717]">
                        Scan summary
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyCapturedData}
                      disabled={!capturedDataReady}
                      className={`inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        capturedDataReady
                          ? 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                          : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                      }`}
                    >
                      Apply Captured Data
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <ScanSummaryField
                      label="Part Number"
                      value={
                        productScanResult?.detectedPartNumber ??
                        'Not detected'
                      }
                    />

                    <ScanSummaryField
                      label="Matched Model"
                      value={
                        productScanResult?.catalogItem?.productName ??
                        'No catalog match'
                      }
                    />

                    <ScanSummaryField
                      label="Reference MSRP"
                      value={
                        productScanResult?.catalogItem
                          ? formatMsrp(productScanResult.catalogItem.msrp)
                          : 'Not available'
                      }
                    />

                    <ScanSummaryField
                      label="Detected Category"
                      value={
                        productScanResult?.categoryResolution?.category ??
                        'Not resolved'
                      }
                    />

                    <ScanSummaryField
                      label="Category Confidence"
                      value={
                        productScanResult?.categoryResolution
                          ? formatConfidence(
                              productScanResult.categoryResolution.confidence,
                            )
                          : 'Not available'
                      }
                    />

                    <ScanSummaryField
                      label="Serial Number"
                      value={
                        serialScanResult?.detectedSerialNumber ??
                        'Not detected'
                      }
                    />
                  </div>

                  {productScanResult?.catalogItem && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-900">
                        Catalog match found
                      </p>

                      <p className="mt-3 text-sm leading-6 text-emerald-800">
                        {productScanResult.catalogItem.productDescription}
                      </p>
                    </div>
                  )}

                  {productScanResult?.categoryResolution ? (
                    <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900">
                        Category resolved automatically
                      </p>

                      <p className="mt-2 text-sm leading-6 text-blue-800">
                        {productScanResult.categoryResolution.reason}
                      </p>

                      <p className="mt-2 text-sm leading-6 text-blue-800">
                        This category will be applied to the form, but it
                        remains editable before saving the asset.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-[#fff8d6] p-4">
                      <p className="text-sm font-semibold text-[#5d4a00]">
                        Category could not be resolved
                      </p>

                      <p className="mt-2 text-sm leading-6 text-[#5d4a00]">
                        The form will remain editable and the category can be
                        selected manually.
                      </p>
                    </div>
                  )}

                  {productScanResult && (
                    <ParserBlock
                      title="Product Code Parser Notes"
                      messages={productScanResult.messages}
                      rawText={productScanResult.rawText}
                    />
                  )}

                  {serialScanResult && (
                    <ParserBlock
                      title="Serial Code Parser Notes"
                      messages={serialScanResult.messages}
                      rawText={serialScanResult.rawText}
                    />
                  )}
                </div>
              )}
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 1"
                title="Equipment Identification"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Category"
                  value={form.category}
                  onChange={(value) => updateForm('category', value)}
                  options={[
                    { label: 'Select', value: '' },
                    { label: 'Camera', value: 'Camera' },
                    { label: 'Intercom', value: 'Intercom' },
                    { label: 'Audio', value: 'Audio' },
                    { label: 'Radar', value: 'Radar' },
                    {
                      label: 'Access Control',
                      value: 'Access Control',
                    },
                    { label: 'Switch', value: 'Switch' },
                    { label: 'Accessory', value: 'Accessory' },
                    { label: 'Other', value: 'Other' },
                  ]}
                />

                <TextField
                  label="Brand"
                  value={form.brand}
                  placeholder="Example: Axis"
                  onChange={(value) => updateForm('brand', value)}
                />

                <TextField
                  label="Model"
                  value={form.model}
                  placeholder="Example: AXIS P3268-LVE"
                  onChange={(value) => updateForm('model', value)}
                />

                <TextField
                  label="Part Number"
                  value={form.partNumber}
                  placeholder="Optional"
                  onChange={(value) => updateForm('partNumber', value)}
                />

                <TextField
                  label="Legacy Code"
                  value={form.legacyCode}
                  placeholder="Optional"
                  onChange={(value) => updateForm('legacyCode', value)}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-[#171717]">
                      Serial Number
                    </p>

                    <p className="mt-1 text-sm leading-6 text-[#555555]">
                      If the asset has no physical serial number, mark the
                      corresponding option.
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717]">
                    <input
                      type="checkbox"
                      checked={form.hasNoSerial}
                      onChange={(event) =>
                        handleNoSerialChange(event.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    No Serial Number
                  </label>
                </div>

                <div className="mt-5">
                  <TextField
                    label="Serial Number"
                    value={form.serialNumber}
                    placeholder={
                      form.hasNoSerial
                        ? 'This asset will be saved as “No Serial”'
                        : 'Enter physical serial number'
                    }
                    disabled={form.hasNoSerial}
                    onChange={(value) => updateForm('serialNumber', value)}
                  />
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 2"
                title="Initial Status and Location"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <SelectField
                  label="Initial Status"
                  value={form.status}
                  onChange={(value) =>
                    updateForm('status', value as EquipmentStatus)
                  }
                  options={[
                    { label: 'Available', value: 'Available' },
                    { label: 'Reserved', value: 'Reserved' },
                    { label: 'Under Review', value: 'Under Review' },
                    { label: 'Damaged', value: 'Damaged' },
                  ]}
                />

                <TextField
                  label="Current Location"
                  value={form.currentLocation}
                  placeholder="Example: Demo Warehouse"
                  onChange={(value) =>
                    updateForm('currentLocation', value)
                  }
                />

                <DateField
                  label="Acquisition Date"
                  value={form.acquiredAt}
                  onChange={(value) => updateForm('acquiredAt', value)}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Step 3"
                title="Additional Information"
              />

              <div className="mt-6 space-y-5">
                <TextareaField
                  label="Included Accessories"
                  value={form.accessories}
                  placeholder="Example: power supply, box, bracket, cabling."
                  onChange={(value) => updateForm('accessories', value)}
                />

                <TextareaField
                  label="Condition / Technical Notes"
                  value={form.conditionNotes}
                  placeholder="Example: used, minor cosmetic issue, pending visual check."
                  onChange={(value) => updateForm('conditionNotes', value)}
                />

                <TextareaField
                  label="General Notes"
                  value={form.generalNotes}
                  placeholder="Useful comments for future reference."
                  onChange={(value) => updateForm('generalNotes', value)}
                />
              </div>
            </article>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader eyebrow="Preview" title="Equipment Summary" />

              <div className="mt-6 space-y-5">
                <SummaryField
                  label="Category"
                  value={form.category || 'Pending'}
                />

                <SummaryField
                  label="Brand"
                  value={form.brand || 'Pending'}
                />

                <SummaryField
                  label="Model"
                  value={form.model || 'Pending'}
                />

                <SummaryField
                  label="Part Number"
                  value={form.partNumber || 'Pending'}
                />

                <SummaryField
                  label="Serial"
                  value={
                    form.hasNoSerial
                      ? 'No Serial'
                      : form.serialNumber || 'Pending'
                  }
                />

                <SummaryField
                  label="Location"
                  value={form.currentLocation || 'Pending'}
                />
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-[#666666]">
                  Initial Status
                </p>

                <div className="mt-2">
                  <StatusBadge
                    label={form.status}
                    tone={getEquipmentStatusTone(form.status)}
                  />
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <button
                type="button"
                onClick={handleSubmitEquipment}
                disabled={!isFormReady}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isFormReady
                    ? 'bg-[#ffda00] text-[#111111] hover:bg-[#f2cd00]'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSubmitting ? 'Saving Equipment...' : 'Save Equipment'}
              </button>

              <p className="mt-3 text-sm leading-6 text-[#666666]">
                The asset will be saved once the minimum required information
                is complete.
              </p>
            </article>
          </aside>
        </div>
      </section>
    </>
  )
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#666666]">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-semibold text-[#171717]">{title}</h3>
    </div>
  )
}

function ScanStepCard({
  step,
  title,
  description,
  completed,
  disabled = false,
  buttonLabel,
  onClick,
}: {
  step: string
  title: string
  description: string
  completed: boolean
  disabled?: boolean
  buttonLabel: string
  onClick: () => void
}) {
  return (
    <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-medium text-[#666666]">{step}</p>
          <h4 className="mt-1 text-lg font-semibold text-[#171717]">
            {title}
          </h4>
        </div>

        <StatusBadge
          label={completed ? 'Completed' : disabled ? 'Locked' : 'Pending'}
          tone={completed ? 'success' : disabled ? 'neutral' : 'warning'}
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-[#555555]">{description}</p>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
          disabled
            ? 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
            : 'bg-[#181818] text-white hover:bg-black'
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  )
}

function ParserBlock({
  title,
  messages,
  rawText,
}: {
  title: string
  messages: string[]
  rawText: string
}) {
  return (
    <div className="mt-5 rounded-2xl border border-[#e5e5e2] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#777777]">
        {title}
      </p>

      <ul className="mt-3 space-y-2 text-sm leading-6 text-[#555555]">
        {messages.map((message) => (
          <li key={message}>• {message}</li>
        ))}
      </ul>

      <div className="mt-4 rounded-xl bg-[#fafaf8] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#777777]">
          Raw scanned content
        </p>

        <p className="mt-2 break-all text-sm leading-6 text-[#171717]">
          {rawText}
        </p>
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition placeholder:text-[#999999] ${
          disabled
            ? 'cursor-not-allowed border-[#e5e5e2] bg-[#f3f3f0] text-[#888888]'
            : 'border-[#d8d8d4] bg-white text-[#171717] focus:border-[#ffda00]'
        }`}
      />
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function TextareaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#444444]">
        {label}
      </label>

      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-none rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
      />
    </div>
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

function SummaryBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4">
      <p className="text-sm font-medium text-[#666666]">{label}</p>
      <p className="mt-2 text-sm leading-7 text-[#555555]">{value}</p>
    </div>
  )
}

function ScanSummaryField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-[#e5e5e2] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#777777]">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold leading-6 text-[#171717]">
        {value}
      </p>
    </div>
  )
}
