import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAppRole } from '../../../components/auth/useAppRole'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  getEquipmentStatusTone,
  type EquipmentItem,
  type EquipmentStatus,
} from '../data/equipment'
import {
  changeEquipmentStatusInSupabase,
  fetchEquipmentDetailFromSupabase,
  updateEquipmentProfileInSupabase,
} from '../data/equipmentSupabase'

type ManualEquipmentStatus = Exclude<EquipmentStatus, 'On Loan'>

type StatusChangeForm = {
  newStatus: ManualEquipmentStatus
  newLocation: string
  notes: string
}

type EquipmentEditForm = {
  category: string
  brand: string
  model: string
  partNumber: string
  serialNumber: string
  hasNoSerial: boolean
  legacyCode: string
  acquiredAt: string
  accessories: string
  conditionNotes: string
  generalNotes: string
}

function dateForInput(value: string) {
  if (!value || !value.includes('/')) {
    return value
  }

  const [day, month, year] = value.split('/')
  return `${year}-${month}-${day}`
}

function buildInitialStatusForm(
  equipment: EquipmentItem,
): StatusChangeForm {
  const safeStatus =
    equipment.status === 'On Loan' ? 'Available' : equipment.status

  return {
    newStatus: safeStatus,
    newLocation: '',
    notes: '',
  }
}

function buildInitialEditForm(
  equipment: EquipmentItem,
): EquipmentEditForm {
  return {
    category: equipment.category,
    brand: equipment.brand,
    model: equipment.model,
    partNumber: equipment.partNumber,
    serialNumber:
      equipment.serialNumber === 'No Serial'
        ? ''
        : equipment.serialNumber,
    hasNoSerial: equipment.serialNumber === 'No Serial',
    legacyCode: equipment.legacyCode ?? '',
    acquiredAt: dateForInput(equipment.acquiredAt),
    accessories: equipment.accessories ?? '',
    conditionNotes: equipment.conditionNotes ?? '',
    generalNotes: equipment.generalNotes ?? '',
  }
}

export function EquipmentDetailPage() {
  const { permissions } = useAppRole()
  const { equipmentCode } = useParams()

  const [equipment, setEquipment] = useState<EquipmentItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showStatusEditor, setShowStatusEditor] = useState(false)
  const [statusForm, setStatusForm] = useState<StatusChangeForm | null>(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [statusActionMessage, setStatusActionMessage] = useState<
    string | null
  >(null)
  const [statusActionError, setStatusActionError] = useState<string | null>(
    null,
  )

  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState<EquipmentEditForm | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileActionMessage, setProfileActionMessage] = useState<
    string | null
  >(null)
  const [profileActionError, setProfileActionError] = useState<string | null>(
    null,
  )

  useEffect(() => {
    let isMounted = true

    async function loadEquipmentDetail() {
      if (!equipmentCode) {
        setEquipment(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const item = await fetchEquipmentDetailFromSupabase(equipmentCode)

        if (!isMounted) {
          return
        }

        setEquipment(item)

        if (item) {
          setStatusForm(buildInitialStatusForm(item))
          setEditForm(buildInitialEditForm(item))
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load equipment detail from the system.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadEquipmentDetail()

    return () => {
      isMounted = false
    }
  }, [equipmentCode])

  function openStatusEditor() {
    if (!equipment || equipment.status === 'On Loan') {
      return
    }

    setStatusForm(buildInitialStatusForm(equipment))
    setStatusActionMessage(null)
    setStatusActionError(null)
    setProfileActionMessage(null)
    setProfileActionError(null)
    setShowEditForm(false)
    setShowStatusEditor(true)
  }

  function closeStatusEditor() {
    setShowStatusEditor(false)
    setStatusActionError(null)
  }

  function updateStatusForm(
    field: keyof StatusChangeForm,
    value: string,
  ) {
    setStatusForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [field]: value,
          }
        : currentForm,
    )
  }

  const statusHasMeaningfulChange = Boolean(
    equipment &&
      statusForm &&
      (statusForm.newStatus !== equipment.status ||
        statusForm.newLocation.trim()),
  )

  async function handleSaveStatusChange() {
    if (
      !equipment ||
      !statusForm ||
      equipment.status === 'On Loan' ||
      !statusHasMeaningfulChange
    ) {
      return
    }

    setIsSavingStatus(true)
    setStatusActionError(null)
    setStatusActionMessage(null)

    try {
      const updatedEquipment = await changeEquipmentStatusInSupabase({
        equipmentCode: equipment.code,
        newStatus: statusForm.newStatus,
        newLocation: statusForm.newLocation.trim() || undefined,
        notes: statusForm.notes.trim() || undefined,
      })

      setEquipment(updatedEquipment)
      setStatusForm(buildInitialStatusForm(updatedEquipment))
      setEditForm(buildInitialEditForm(updatedEquipment))
      setShowStatusEditor(false)
      setStatusActionMessage(
        'Equipment status updated and activity recorded successfully.',
      )
    } catch (error) {
      setStatusActionError(
        error instanceof Error
          ? error.message
          : 'Unable to change equipment status.',
      )
    } finally {
      setIsSavingStatus(false)
    }
  }

  function openEditForm() {
    if (!equipment) {
      return
    }

    setEditForm(buildInitialEditForm(equipment))
    setProfileActionMessage(null)
    setProfileActionError(null)
    setStatusActionMessage(null)
    setStatusActionError(null)
    setShowStatusEditor(false)
    setShowEditForm(true)
  }

  function closeEditForm() {
    setShowEditForm(false)
    setProfileActionError(null)
  }

  function updateEditForm(
    field: keyof EquipmentEditForm,
    value: string | boolean,
  ) {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [field]: value,
          }
        : currentForm,
    )
  }

  function handleNoSerialChange(checked: boolean) {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            hasNoSerial: checked,
            serialNumber: checked ? '' : currentForm.serialNumber,
          }
        : currentForm,
    )
  }

  const effectiveEditedSerialNumber = editForm?.hasNoSerial
    ? 'No Serial'
    : editForm?.serialNumber.trim() ?? ''

  const editFormIsReady = Boolean(
    editForm &&
      editForm.category &&
      editForm.brand.trim() &&
      editForm.model.trim() &&
      effectiveEditedSerialNumber &&
      !isSavingProfile,
  )

  const profileHasMeaningfulChange = Boolean(
    equipment &&
      editForm &&
      (editForm.category !== equipment.category ||
        editForm.brand.trim() !== equipment.brand ||
        editForm.model.trim() !== equipment.model ||
        editForm.partNumber.trim() !== equipment.partNumber ||
        effectiveEditedSerialNumber !== equipment.serialNumber ||
        editForm.legacyCode.trim() !== (equipment.legacyCode ?? '') ||
        editForm.acquiredAt !== dateForInput(equipment.acquiredAt) ||
        editForm.accessories.trim() !== (equipment.accessories ?? '') ||
        editForm.conditionNotes.trim() !==
          (equipment.conditionNotes ?? '') ||
        editForm.generalNotes.trim() !== (equipment.generalNotes ?? '')),
  )

  async function handleSaveProfileUpdate() {
    if (
      !equipment ||
      !editForm ||
      !editFormIsReady ||
      !profileHasMeaningfulChange
    ) {
      return
    }

    setIsSavingProfile(true)
    setProfileActionError(null)
    setProfileActionMessage(null)

    try {
      const updatedEquipment = await updateEquipmentProfileInSupabase({
        equipmentCode: equipment.code,
        category: editForm.category,
        brand: editForm.brand.trim(),
        model: editForm.model.trim(),
        partNumber: editForm.partNumber.trim(),
        serialNumber: effectiveEditedSerialNumber,
        legacyCode: editForm.legacyCode.trim() || undefined,
        acquiredAt: editForm.acquiredAt || undefined,
        accessories: editForm.accessories.trim() || undefined,
        conditionNotes: editForm.conditionNotes.trim() || undefined,
        generalNotes: editForm.generalNotes.trim() || undefined,
      })

      setEquipment(updatedEquipment)
      setStatusForm(buildInitialStatusForm(updatedEquipment))
      setEditForm(buildInitialEditForm(updatedEquipment))
      setShowEditForm(false)
      setProfileActionMessage(
        'Equipment profile updated and activity recorded successfully.',
      )
    } catch (error) {
      setProfileActionError(
        error instanceof Error
          ? error.message
          : 'Unable to update equipment profile.',
      )
    } finally {
      setIsSavingProfile(false)
    }
  }

  if (isLoading) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Equipment Detail
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            Loading equipment...
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            Retrieving equipment, activity history and active loan information.
          </p>
        </div>
      </section>
    )
  }

  if (loadError) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <p className="text-sm font-medium text-red-700">
            Equipment Detail Error
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-red-950">
            The equipment record could not be loaded
          </h2>

          <p className="mt-4 max-w-2xl text-red-800">
            {loadError}
          </p>

          <Link
            to="/inventory"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Inventory
          </Link>
        </div>
      </section>
    )
  }

  if (!equipment) {
    return (
      <section className="px-6 py-8 lg:px-10">
        <div className="rounded-2xl border border-[#e5e5e2] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-[#666666]">
            Equipment Not Found
          </p>

          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717]">
            No record exists for this equipment code
          </h2>

          <p className="mt-4 max-w-2xl text-[#555555]">
            The requested asset is not available in the inventory.
          </p>

          <Link
            to="/inventory"
            className="mt-6 inline-flex rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
          >
            Back to Inventory
          </Link>
        </div>
      </section>
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

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium text-[#666666]">
                  {equipment.code}
                </p>

                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#171717]">
                  {equipment.model}
                </h2>
              </div>

              <StatusBadge
                label={equipment.status}
                tone={getEquipmentStatusTone(equipment.status)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {permissions.canChangeEquipmentStatus &&
              (equipment.status === 'On Loan' ? (
                <button
                  disabled
                  className="cursor-not-allowed rounded-xl border border-[#e5e5e2] bg-[#ecece8] px-4 py-2.5 text-sm font-semibold text-[#888888]"
                >
                  Status Locked While On Loan
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openStatusEditor}
                  className="rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
                >
                  Change Status
                </button>
              ))}

            {permissions.canManageEquipment && (
              <button
                type="button"
                onClick={openEditForm}
                className="rounded-xl bg-[#ffda00] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f2cd00]"
              >
                Edit Equipment
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="px-6 py-6 lg:px-10 lg:py-8">
        {statusActionMessage && (
          <article className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-800">
              {statusActionMessage}
            </p>
          </article>
        )}

        {profileActionMessage && (
          <article className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold text-emerald-800">
              {profileActionMessage}
            </p>
          </article>
        )}

        {showStatusEditor && statusForm && (
          <article className="mb-6 rounded-2xl border border-[#ffda00] bg-[#fff8d6] p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="text-sm font-medium text-[#5d4a00]">
                  Manual Equipment Status
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  Change operational status
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5d4a00]">
                  This action updates the asset status, optionally adjusts its
                  location, and records a movement in the activity history.
                  “On Loan” is managed only through loan creation and returns.
                </p>
              </div>

              <button
                type="button"
                onClick={closeStatusEditor}
                className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
              >
                Close
              </button>
            </div>

            {statusActionError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {statusActionError}
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  New Status
                </label>

                <select
                  value={statusForm.newStatus}
                  onChange={(event) =>
                    updateStatusForm('newStatus', event.target.value)
                  }
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition focus:border-[#ffda00]"
                >
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  New Location
                </label>

                <input
                  type="text"
                  value={statusForm.newLocation}
                  onChange={(event) =>
                    updateStatusForm('newLocation', event.target.value)
                  }
                  placeholder="Optional"
                  className="w-full rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                />

                <p className="mt-2 text-xs leading-5 text-[#6a5a16]">
                  Leave blank to use the system default where applicable.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#444444]">
                  Notes
                </label>

                <textarea
                  value={statusForm.notes}
                  onChange={(event) =>
                    updateStatusForm('notes', event.target.value)
                  }
                  rows={3}
                  placeholder="Optional operational note."
                  className="w-full resize-none rounded-xl border border-[#d8d8d4] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-[#999999] focus:border-[#ffda00]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={closeStatusEditor}
                className="rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveStatusChange}
                disabled={!statusHasMeaningfulChange || isSavingStatus}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  statusHasMeaningfulChange && !isSavingStatus
                    ? 'bg-[#181818] text-white hover:bg-black'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSavingStatus ? 'Saving Status...' : 'Save Status Change'}
              </button>
            </div>
          </article>
        )}

        {showEditForm && editForm && (
          <article className="mb-6 rounded-2xl border border-[#ffda00] bg-[#fff8d6] p-6 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <p className="text-sm font-medium text-[#5d4a00]">
                  Equipment Profile
                </p>

                <h3 className="mt-1 text-xl font-semibold text-[#171717]">
                  Edit administrative equipment data
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5d4a00]">
                  This section updates identification fields, accessories and
                  notes. Status and location are controlled separately through
                  Change Status and operational flows.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditForm}
                className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
              >
                Close
              </button>
            </div>

            {profileActionError && (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800">
                  {profileActionError}
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <SelectField
                label="Category"
                value={editForm.category}
                onChange={(value) => updateEditForm('category', value)}
                options={[
                  { label: 'Camera', value: 'Camera' },
                  { label: 'Intercom', value: 'Intercom' },
                  { label: 'Audio', value: 'Audio' },
                  { label: 'Radar', value: 'Radar' },
                  { label: 'Access Control', value: 'Access Control' },
                  { label: 'Switch', value: 'Switch' },
                  { label: 'Accessory', value: 'Accessory' },
                  { label: 'Other', value: 'Other' },
                ]}
              />

              <TextField
                label="Brand"
                value={editForm.brand}
                placeholder="Example: Axis"
                onChange={(value) => updateEditForm('brand', value)}
              />

              <TextField
                label="Model"
                value={editForm.model}
                placeholder="Example: AXIS P3268-LVE"
                onChange={(value) => updateEditForm('model', value)}
              />

              <TextField
                label="Part Number"
                value={editForm.partNumber}
                placeholder="Optional"
                onChange={(value) => updateEditForm('partNumber', value)}
              />

              <TextField
                label="Legacy Code"
                value={editForm.legacyCode}
                placeholder="Optional"
                onChange={(value) => updateEditForm('legacyCode', value)}
              />

              <DateField
                label="Acquisition Date"
                value={editForm.acquiredAt}
                onChange={(value) => updateEditForm('acquiredAt', value)}
              />
            </div>

            <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-white/70 p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-semibold text-[#171717]">
                    Serial Number
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#555555]">
                    Use “No Serial Number” only when the asset does not have a
                    physical serial.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717]">
                  <input
                    type="checkbox"
                    checked={editForm.hasNoSerial}
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
                  value={editForm.serialNumber}
                  placeholder={
                    editForm.hasNoSerial
                      ? 'This asset will be saved as “No Serial”'
                      : 'Enter physical serial number'
                  }
                  disabled={editForm.hasNoSerial}
                  onChange={(value) => updateEditForm('serialNumber', value)}
                />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <TextareaField
                label="Included Accessories"
                value={editForm.accessories}
                placeholder="Example: power supply, box, bracket, cabling."
                onChange={(value) => updateEditForm('accessories', value)}
              />

              <TextareaField
                label="Condition / Technical Notes"
                value={editForm.conditionNotes}
                placeholder="Operational or technical observations."
                onChange={(value) => updateEditForm('conditionNotes', value)}
              />

              <TextareaField
                label="General Notes"
                value={editForm.generalNotes}
                placeholder="Useful comments for future reference."
                onChange={(value) => updateEditForm('generalNotes', value)}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={closeEditForm}
                className="rounded-xl border border-[#d8d8d4] bg-white px-4 py-2.5 text-sm font-semibold text-[#171717] transition hover:border-[#bfbfba] hover:bg-[#fafaf8]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveProfileUpdate}
                disabled={
                  !editFormIsReady ||
                  !profileHasMeaningfulChange ||
                  isSavingProfile
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  editFormIsReady &&
                  profileHasMeaningfulChange &&
                  !isSavingProfile
                    ? 'bg-[#181818] text-white hover:bg-black'
                    : 'cursor-not-allowed bg-[#ecece8] text-[#888888]'
                }`}
              >
                {isSavingProfile ? 'Saving Changes...' : 'Save Equipment Edit'}
              </button>
            </div>
          </article>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Primary Information"
                title="Equipment Details"
              />

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <DetailField label="Internal Code" value={equipment.code} />
                <DetailField label="Category" value={equipment.category} />
                <DetailField label="Brand" value={equipment.brand} />
                <DetailField label="Model" value={equipment.model} />
                <DetailField
                  label="Part Number"
                  value={equipment.partNumber || 'Not registered'}
                />
                <DetailField
                  label="Serial Number"
                  value={equipment.serialNumber}
                />
                <DetailField
                  label="Current Location"
                  value={equipment.location}
                />
                <DetailField
                  label="Acquisition Date"
                  value={equipment.acquiredAt}
                />
                <DetailField
                  label="Legacy Code"
                  value={equipment.legacyCode ?? 'Not registered'}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Additional Information"
                title="Accessories and Notes"
              />

              <div className="mt-6 space-y-5">
                <DetailBlock
                  label="Included Accessories"
                  value={equipment.accessories ?? 'Not registered'}
                />

                <DetailBlock
                  label="Condition / Technical Notes"
                  value={equipment.conditionNotes ?? 'No observations'}
                />

                <DetailBlock
                  label="General Notes"
                  value={equipment.generalNotes ?? 'No observations'}
                />
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Traceability"
                title="Activity History"
              />

              {equipment.movements.length > 0 ? (
                <div className="mt-6 space-y-4">
                  {equipment.movements.map((movement, index) => (
                    <div
                      key={`${movement.date}-${movement.type}-${index}`}
                      className="rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-4"
                    >
                      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                        <div>
                          <p className="text-sm font-semibold text-[#171717]">
                            {movement.type}
                          </p>

                          <p className="mt-1 text-sm leading-6 text-[#555555]">
                            {movement.description}
                          </p>
                        </div>

                        <div className="text-sm text-[#666666] md:text-right">
                          <p>{movement.date}</p>
                          <p>{movement.user}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-[#e5e5e2] bg-[#fafaf8] p-5">
                  <p className="text-sm font-semibold text-[#171717]">
                    No activity history registered.
                  </p>

                  <p className="mt-2 text-sm leading-6 text-[#555555]">
                    Equipment movements will appear here once recorded.
                  </p>
                </div>
              )}
            </article>
          </div>

          <aside className="space-y-6">
            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Current Status"
                title="Operational Situation"
              />

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-[#fafaf8] p-4">
                  <p className="text-sm font-medium text-[#666666]">Status</p>

                  <div className="mt-3">
                    <StatusBadge
                      label={equipment.status}
                      tone={getEquipmentStatusTone(equipment.status)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-[#fafaf8] p-4">
                  <p className="text-sm font-medium text-[#666666]">
                    Location
                  </p>

                  <p className="mt-2 font-semibold text-[#171717]">
                    {equipment.location}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#e5e5e2] bg-white p-6 shadow-sm">
              <SectionHeader
                eyebrow="Active Loan"
                title="Current Assignment"
              />

              {equipment.activeLoan ? (
                <div className="mt-6 space-y-4">
                  <DetailField
                    label="Loan"
                    value={equipment.activeLoan.loanCode}
                  />

                  <DetailField
                    label="Company"
                    value={equipment.activeLoan.company}
                  />

                  <DetailField
                    label="Internal Owner"
                    value={equipment.activeLoan.responsible}
                  />

                  <DetailField
                    label="Checkout Date"
                    value={equipment.activeLoan.checkoutDate}
                  />

                  <DetailField
                    label="Expected Return"
                    value={equipment.activeLoan.expectedReturnDate}
                  />

                  <Link
                    to={`/loans/${equipment.activeLoan.loanCode}`}
                    className="mt-2 inline-flex w-full justify-center rounded-xl bg-[#181818] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    View Loan
                  </Link>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">
                    No active loan
                  </p>

                  <p className="mt-2 text-sm leading-6 text-emerald-700">
                    This asset is not currently linked to an open loan.
                  </p>
                </div>
              )}
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

function DetailField({
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

function DetailBlock({
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
