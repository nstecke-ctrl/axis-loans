import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { LoanItem } from '../data/loans'

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-z0-9-_]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function currentDocumentDate() {
  return new Intl.DateTimeFormat('en-GB').format(new Date())
}

function parseDisplayDate(value?: string) {
  if (!value || !value.includes('/')) {
    return null
  }

  const [day, month, year] = value.split('/').map(Number)

  if (!day || !month || !year) {
    return null
  }

  const parsedDate = new Date(year, month - 1, day)
  parsedDate.setHours(0, 0, 0, 0)

  return parsedDate
}

function calculateDaysBetween(start?: string, end?: string) {
  const startDate = parseDisplayDate(start)
  const endDate = parseDisplayDate(end)

  if (!startDate || !endDate) {
    return 'Not available'
  }

  const difference = Math.ceil(
    (endDate.getTime() - startDate.getTime()) /
      (1000 * 60 * 60 * 24),
  )

  return `${Math.max(difference, 0)} days`
}

function calculateDaysOverdue(loan: LoanItem) {
  if (loan.status === 'Returned' || loan.status === 'Cancelled') {
    return '0 days'
  }

  const expectedDate = parseDisplayDate(loan.expectedReturnDate)

  if (!expectedDate) {
    return 'Not available'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const difference = Math.ceil(
    (today.getTime() - expectedDate.getTime()) /
      (1000 * 60 * 60 * 24),
  )

  return `${Math.max(difference, 0)} days`
}

function emptyFallback(value?: string) {
  return value && value.trim() ? value : 'Not registered'
}

async function loadImageAsDataUrl(src: string) {
  const response = await fetch(src)
  const blob = await response.blob()

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read image as data URL.'))
    }

    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function addPageFooter(doc: jsPDF, loan: LoanItem) {
  const pageCount = doc.getNumberOfPages()

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber)

    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)

    doc.text(
      `Loan ${loan.code} · Generated ${currentDocumentDate()}`,
      40,
      812,
    )

    doc.text(`Page ${pageNumber} of ${pageCount}`, 515, 812, {
      align: 'right',
    })
  }
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(255, 218, 0)
  doc.rect(40, y, 515, 18, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 17, 17)
  doc.text(title, 48, y + 12)
}

function detailRows(rows: Array<[string, string]>) {
  return rows.map(([label, value]) => [label, value])
}

export async function generateLoanDocumentPdf(loan: LoanItem) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(24, 24, 24)
  doc.rect(0, 0, pageWidth, 92, 'F')

  try {
    const logoDataUrl = await loadImageAsDataUrl('/branding/axis-logo-white.png')
    const logoProperties = doc.getImageProperties(logoDataUrl)
    const logoWidth = 118
    const logoHeight = (logoProperties.height * logoWidth) / logoProperties.width

    doc.addImage(logoDataUrl, 'PNG', 40, 30, logoWidth, logoHeight)
  } catch {
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('AXIS', 40, 50)
  }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 218, 0)
  doc.text('Equipment Loan Document', pageWidth - 40, 34, {
    align: 'right',
  })

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(loan.code, pageWidth - 40, 60, {
    align: 'right',
  })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(210, 210, 210)
  doc.text(`Generated: ${currentDocumentDate()}`, pageWidth - 40, 77, {
    align: 'right',
  })

  // Status summary
  doc.setFillColor(250, 250, 248)
  doc.roundedRect(40, 116, 515, 72, 10, 10, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 100, 100)
  doc.text('CURRENT STATUS', 58, 140)

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 17, 17)
  doc.text(loan.status, 58, 166)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(`Company: ${loan.company}`, 305, 140)
  doc.text(`Responsible: ${loan.responsible}`, 305, 158)
  doc.text(`Equipment count: ${loan.equipment.length}`, 305, 176)

  // Recipient section
  drawSectionTitle(doc, 'Recipient Information', 215)

  autoTable(doc, {
    startY: 245,
    theme: 'grid',
    margin: { left: 40, right: 40 },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      lineColor: [230, 230, 226],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        fillColor: [250, 250, 248],
        cellWidth: 150,
      },
      1: {
        cellWidth: 365,
      },
    },
    body: detailRows([
      ['Recipient Type', emptyFallback(loan.recipientType)],
      ['Company', emptyFallback(loan.company)],
      ['Contact Name', emptyFallback(loan.contactName)],
      ['Contact Email', emptyFallback(loan.contactEmail)],
      ['Contact Phone', emptyFallback(loan.contactPhone)],
      ['Destination', `${emptyFallback(loan.city)}, ${emptyFallback(loan.country)}`],
      ['Address', emptyFallback(loan.address)],
    ]),
  })

  // Management section
  const afterRecipientY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 360

  drawSectionTitle(doc, 'Loan Management', afterRecipientY + 28)

  autoTable(doc, {
    startY: afterRecipientY + 58,
    theme: 'grid',
    margin: { left: 40, right: 40 },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      lineColor: [230, 230, 226],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        fillColor: [250, 250, 248],
        cellWidth: 150,
      },
      1: {
        cellWidth: 365,
      },
    },
    body: detailRows([
      ['Internal Owner', emptyFallback(loan.responsible)],
      ['Reason', emptyFallback(loan.reason)],
      ['Associated Project', emptyFallback(loan.projectName)],
      ['Checkout Date', emptyFallback(loan.checkoutDate)],
      ['Expected Return Date', emptyFallback(loan.expectedReturnDate)],
      ['Actual Closed Date', emptyFallback(loan.actualClosedDate)],
      ['Planned Duration', calculateDaysBetween(loan.checkoutDate, loan.expectedReturnDate)],
      ['Days Overdue', calculateDaysOverdue(loan)],
      ['Notes', emptyFallback(loan.notes)],
    ]),
  })

  const afterManagementY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 520

  // Equipment section
  drawSectionTitle(doc, 'Equipment Included in the Loan', afterManagementY + 28)

  autoTable(doc, {
    startY: afterManagementY + 58,
    theme: 'striped',
    margin: { left: 40, right: 40 },
    headStyles: {
      fillColor: [24, 24, 24],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 5,
      overflow: 'linebreak',
      lineColor: [230, 230, 226],
      lineWidth: 0.4,
    },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 62 },
      2: { cellWidth: 138 },
      3: { cellWidth: 92 },
      4: { cellWidth: 62 },
      5: { cellWidth: 90 },
    },
    head: [
      [
        'Code',
        'Category',
        'Model',
        'Serial',
        'Status',
        'Returned At',
      ],
    ],
    body: loan.equipment.map((equipment) => [
      equipment.equipmentCode,
      equipment.category,
      equipment.model,
      equipment.serialNumber,
      equipment.itemStatus,
      equipment.returnedAt ?? 'Pending',
    ]),
  })

  const afterEquipmentY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 650

  const signatureStartY =
    afterEquipmentY > 675 ? 110 : afterEquipmentY + 44

  if (afterEquipmentY > 675) {
    doc.addPage()
  }

  drawSectionTitle(doc, 'Signatures and Acceptance', signatureStartY)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text(
    'This document records the delivery and custody of demo equipment. Returned assets must be checked and registered in the system.',
    40,
    signatureStartY + 44,
    {
      maxWidth: 515,
    },
  )

  const lineY = signatureStartY + 110

  doc.setDrawColor(160, 160, 160)
  doc.line(40, lineY, 220, lineY)
  doc.line(375, lineY, 555, lineY)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 17, 17)
  doc.text('Delivered by', 40, lineY + 18)
  doc.text('Received by', 375, lineY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text('Name / Signature', 40, lineY + 34)
  doc.text('Name / Signature', 375, lineY + 34)

  const returnLineY = lineY + 85

  doc.setDrawColor(160, 160, 160)
  doc.line(40, returnLineY, 220, returnLineY)
  doc.line(375, returnLineY, 555, returnLineY)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(17, 17, 17)
  doc.text('Return received by', 40, returnLineY + 18)
  doc.text('Date', 375, returnLineY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 90)
  doc.text('Name / Signature', 40, returnLineY + 34)
  doc.text('Return date', 375, returnLineY + 34)

  addPageFooter(doc, loan)

  doc.save(`${sanitizeFileName(loan.code)}_${sanitizeFileName(loan.company)}_loan_document.pdf`)
}