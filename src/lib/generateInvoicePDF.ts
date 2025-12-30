import jsPDF from 'jspdf'
import { formatUnits } from 'viem'

export interface InvoicePDFData {
  invoiceId: string
  sellerName: string
  buyerName: string
  buyerEmail?: string
  buyerAddress?: string
  sellerAddress?: string
  amount: bigint | string
  amountFormatted: string
  dueDate: Date
  createdAt: Date
  paidAt?: Date
  clearedAt?: Date
  status: string
  statusNumber?: number // 0=Issued, 1=Financed, 2=Paid, 3=Cleared
  statusLabel: string
  invoiceNumber?: string
  description?: string
  tokenId?: string
  nftAddress?: string
  explorerLink?: string
  lineItems?: Array<{
    description: string
    quantity?: number
    price?: string
    total?: string
  }>
}

export function generateInvoicePDF(data: InvoicePDFData) {
  const doc = new jsPDF()
  
  // Colors matching the design
  const greenColor = [34, 197, 94] // Green-500
  const greenLight = [240, 253, 244] // Green-50
  const blueColor = [59, 130, 246] // Blue-500
  const blueLight = [239, 246, 255] // Blue-50
  const purpleColor = [168, 85, 247] // Purple-500
  const purpleLight = [250, 245, 255] // Purple-50
  const darkGray = [55, 65, 81] // Gray-700
  const lightGray = [156, 163, 175] // Gray-400
  const redColor = [239, 68, 68] // Red-500
  
  let yPos = 20
  
  // Title: BILL DETAILS
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('BILL DETAILS', 20, yPos)
  
  yPos += 15
  
  // Top Section: Bill Info (Left) + SETTL. Protocol (Right)
  const leftStart = 20
  const rightStart = 110
  
  // Left: Bill Information
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
  doc.text('Bill No:', leftStart, yPos)
  doc.text('Bill Date:', leftStart, yPos + 7)
  doc.text('Clear Bill Before:', leftStart, yPos + 14)
  
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text(data.invoiceNumber || `INV-${data.invoiceId.padStart(10, '0')}`, leftStart + 25, yPos)
  
  // Format bill date like "12/31/2025, 01:22:59 AM"
  const billDateStr = data.createdAt.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
  doc.setFont('helvetica', 'normal')
  doc.text(billDateStr, leftStart + 25, yPos + 7)
  
  // Clear Bill Before in red
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(redColor[0], redColor[1], redColor[2])
  const clearBillDate = data.dueDate.toLocaleDateString('en-CA') // YYYY-MM-DD
  doc.text(clearBillDate, leftStart + 40, yPos + 14)
  
  // Right: SETTL. Protocol
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('SETTL. Protocol', rightStart, yPos)
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
  if (data.sellerAddress) {
    const truncated = `${data.sellerAddress.slice(0, 6)}...${data.sellerAddress.slice(-4)}`
    doc.text(truncated, rightStart, yPos + 5)
    doc.text(data.sellerAddress, rightStart, yPos + 10)
  }
  
  yPos += 25
  
  // Bill To Section with blue background box
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Bill To:', leftStart, yPos)
  
  yPos += 7
  
  // Blue box for Bill To content
  doc.setFillColor(blueLight[0], blueLight[1], blueLight[2])
  doc.roundedRect(leftStart, yPos - 3, 170, 30, 3, 3, 'F')
  
  // Left border accent
  doc.setFillColor(blueColor[0], blueColor[1], blueColor[2])
  doc.rect(leftStart, yPos - 3, 4, 30, 'F')
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text(data.buyerName, leftStart + 8, yPos + 3)
  
  if (data.buyerEmail) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
    doc.text(data.buyerEmail, leftStart + 8, yPos + 9)
  }
  
  if (data.buyerAddress) {
    doc.setFontSize(8)
    doc.setFont('courier', 'normal')
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
    doc.text(data.buyerAddress, leftStart + 8, yPos + 16, { maxWidth: 155 })
  }
  
  yPos += 35
  
  // Tokenized Bill Information (if tokenId exists)
  if (data.tokenId && data.nftAddress) {
    doc.setFillColor(greenLight[0], greenLight[1], greenLight[2])
    doc.roundedRect(leftStart, yPos - 3, 170, 20, 3, 3, 'F')
    
    // Left border accent
    doc.setFillColor(greenColor[0], greenColor[1], greenColor[2])
    doc.rect(leftStart, yPos - 3, 4, 20, 'F')
    
    // Tokenized Bill Powered by SETTL.
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(greenColor[0], greenColor[1], greenColor[2])
    doc.text('Tokenized Bill Powered by SETTL.', leftStart + 8, yPos + 3)
    
    // RWA Badge
    doc.setFillColor(greenColor[0] - 40, greenColor[1] + 40, greenColor[2] - 20) // Lighter green
    doc.roundedRect(leftStart + 120, yPos - 2, 15, 6, 1, 1, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(greenColor[0], greenColor[1], greenColor[2])
    doc.text('RWA', leftStart + 124, yPos + 2)
    
    // Description
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(greenColor[0] - 20, greenColor[1] - 20, greenColor[2] - 20)
    doc.text(
      'This invoice has been tokenized as an ERC721 NFT by SETTL, making it a tradeable Real-World Asset (RWA).',
      leftStart + 8,
      yPos + 10,
      { maxWidth: 150 }
    )
    
    // View Explorer and Copy ID buttons (as text links)
    if (data.explorerLink) {
      // View Explorer link
      doc.setFontSize(8)
      doc.setTextColor(blueColor[0], blueColor[1], blueColor[2])
      doc.text('View Explorer', leftStart + 140, yPos + 3, {
        link: data.explorerLink,
        underlined: true
      })
      
      // Copy ID (display token ID)
      const tokenDisplay = `Token ID: ${data.tokenId}`
      doc.text(tokenDisplay, leftStart + 140, yPos + 9, { maxWidth: 40 })
    }
    
    yPos += 25
  }
  
  // Items Table
  yPos += 5
  
  // Table Header with blue background
  doc.setFillColor(blueLight[0], blueLight[1], blueLight[2])
  doc.rect(leftStart, yPos - 5, 170, 8, 'F')
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Item / Service', leftStart + 2, yPos)
  doc.text('Description', leftStart + 45, yPos)
  doc.text('Quantity', leftStart + 95, yPos)
  doc.text('Price', leftStart + 125, yPos)
  doc.text('Total', leftStart + 155, yPos)
  
  yPos += 5
  
  // Table rows
  const items = data.lineItems && data.lineItems.length > 0 
    ? data.lineItems 
    : [{
        description: data.description || `Payment for ${data.invoiceNumber || `INV-${data.invoiceId.padStart(6, '0')}`}`,
        quantity: 1,
        price: data.amountFormatted,
        total: data.amountFormatted
      }]
  
  items.forEach((item) => {
    yPos += 8
    if (yPos > 260) {
      doc.addPage()
      yPos = 20
    }
    
    // Row border
    doc.setDrawColor(220, 220, 220)
    doc.line(leftStart, yPos - 3, leftStart + 170, yPos - 3)
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
    
    doc.setFont('helvetica', 'normal')
    doc.text('Invoice Amount', leftStart + 2, yPos)
    doc.text(item.description || `Payment for ${data.invoiceNumber || `INV-${data.invoiceId.padStart(6, '0')}`}`, leftStart + 45, yPos, { maxWidth: 45 })
    doc.text(String(item.quantity || 1), leftStart + 95, yPos)
    doc.text(`$${item.price || data.amountFormatted}`, leftStart + 125, yPos)
    doc.setFont('helvetica', 'bold')
    doc.text(`$${item.total || data.amountFormatted}`, leftStart + 155, yPos)
  })
  
  yPos += 12
  
  // Totals (right-aligned)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  
  if (items.length > 1) {
    doc.text('Subtotal:', leftStart + 155, yPos)
    doc.text(`$${data.amountFormatted}`, leftStart + 175, yPos)
    yPos += 6
  }
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Total Amount:', leftStart + 145, yPos)
  doc.text(`$${data.amountFormatted}`, leftStart + 175, yPos)
  
  yPos += 15
  
  // Payment Info Section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Payment Info:', leftStart, yPos)
  
  yPos += 8
  
  // Payment Info Box - Digital Signature and Status
  doc.setFillColor(greenLight[0], greenLight[1], greenLight[2])
  doc.roundedRect(leftStart, yPos - 3, 170, 25, 3, 3, 'F')
  
  // Left border accent
  doc.setFillColor(greenColor[0], greenColor[1], greenColor[2])
  doc.rect(leftStart, yPos - 3, 4, 25, 'F')
  
  // Brand authorized digital signature
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
  doc.text('Brand authorized digital signature', leftStart + 8, yPos + 2)
  
  // SETTL. Network
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('SETTL. Network', leftStart + 8, yPos + 7)
  
  // Payment Status badge (purple for Cleared)
  const isCleared = data.statusNumber === 3 || data.statusLabel.toLowerCase() === 'cleared'
  const statusColor = isCleared ? purpleColor : blueColor
  const statusLight = isCleared ? purpleLight : blueLight
  
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setFillColor(statusLight[0], statusLight[1], statusLight[2])
  doc.roundedRect(leftStart + 8, yPos + 9, 25, 6, 1, 1, 'F')
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2])
  doc.text(data.statusLabel.toUpperCase(), leftStart + 11, yPos + 13)
  
  // Due On
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Due On:', leftStart + 40, yPos + 7)
  doc.text(clearBillDate, leftStart + 60, yPos + 7)
  
  // Payment Information section (on the right side)
  if (data.paidAt || data.clearedAt) {
    const paymentX = leftStart + 100
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(greenColor[0], greenColor[1], greenColor[2])
    doc.text('✓ Payment Information', paymentX, yPos + 2)
    
    if (data.paidAt) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
      const paidAtStr = data.paidAt.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      doc.text(`Paid At: ${paidAtStr}`, paymentX, yPos + 8)
    }
    
    if (data.clearedAt) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
      const clearedAtStr = data.clearedAt.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      doc.text(`Cleared At: ${clearedAtStr}`, paymentX, yPos + 14)
    }
  }
  
  // Footer
  const footerY = 275
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
  doc.text('Generated by SETTL. - Powered by blockchain | Tokenized as ERC721 NFT on Mantle Network', 20, footerY)
  doc.text(`Invoice ID: ${data.invoiceId}`, 20, footerY + 5)
  
  // Generate filename  
  const invoiceNum = data.invoiceNumber || `INV-${data.invoiceId.padStart(10, '0')}`
  const filename = `Invoice-${invoiceNum}-${data.createdAt.toISOString().split('T')[0]}.pdf`
  
  return { doc, filename }
}

export function downloadInvoicePDF(data: InvoicePDFData) {
  const { doc, filename } = generateInvoicePDF(data)
  doc.save(filename)
}
