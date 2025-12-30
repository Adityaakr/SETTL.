import jsPDF from 'jspdf'
import { formatUnits } from 'viem'

export interface InvoicePDFData {
  invoiceId: string
  sellerName: string
  buyerName: string
  buyerAddress?: string
  sellerAddress?: string
  amount: bigint | string
  amountFormatted: string
  dueDate: Date
  createdAt: Date
  status: string
  statusLabel: string
  invoiceNumber?: string
  description?: string
  lineItems?: Array<{
    description: string
    quantity?: number
    price?: string
    total?: string
  }>
}

export function generateInvoicePDF(data: InvoicePDFData) {
  const doc = new jsPDF()
  
  // Colors
  const primaryColor = [59, 130, 246] // Blue-500
  const darkGray = [55, 65, 81] // Gray-700
  const lightGray = [156, 163, 175] // Gray-400
  
  // Header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.rect(0, 0, 210, 40, 'F')
  
  // SETTL. Logo/Title
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('SETTL.', 20, 25)
  
  // Invoice Label
  doc.setFontSize(18)
  doc.text('INVOICE', 150, 25)
  
  // Reset text color
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  
  // Invoice Details Box
  let yPos = 50
  
  // Invoice Number and Date
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
  doc.text('Invoice #', 20, yPos)
  doc.text('Date', 20, yPos + 5)
  doc.text('Due Date', 20, yPos + 10)
  doc.text('Status', 20, yPos + 15)
  
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.setFont('helvetica', 'bold')
  doc.text(data.invoiceNumber || `INV-${data.invoiceId.padStart(6, '0')}`, 50, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(data.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), 50, yPos + 5)
  doc.text(data.dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }), 50, yPos + 10)
  
  // Status badge
  doc.setFillColor(59, 130, 246, 20)
  doc.roundedRect(50, yPos + 12, 30, 6, 1, 1, 'F')
  doc.setFontSize(8)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text(data.statusLabel.toUpperCase(), 53, yPos + 16)
  
  yPos += 30
  
  // Bill From
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Bill From', 20, yPos)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.sellerName, 20, yPos + 6)
  if (data.sellerAddress) {
    doc.setFontSize(8)
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
    const sellerAddr = data.sellerAddress.length > 42 
      ? `${data.sellerAddress.slice(0, 6)}...${data.sellerAddress.slice(-4)}`
      : data.sellerAddress
    doc.text(sellerAddr, 20, yPos + 11)
  }
  
  // Bill To
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Bill To', 110, yPos)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.buyerName, 110, yPos + 6)
  if (data.buyerAddress) {
    doc.setFontSize(8)
    doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
    const buyerAddr = data.buyerAddress.length > 42 
      ? `${data.buyerAddress.slice(0, 6)}...${data.buyerAddress.slice(-4)}`
      : data.buyerAddress
    doc.text(buyerAddr, 110, yPos + 11)
  }
  
  yPos += 25
  
  // Line Items Table Header
  doc.setFillColor(243, 244, 246) // Gray-100
  doc.rect(20, yPos - 5, 170, 7, 'F')
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  doc.text('Item/Service', 22, yPos)
  doc.text('Description', 70, yPos)
  doc.text('Qty', 130, yPos)
  doc.text('Price', 145, yPos)
  doc.text('Total', 170, yPos)
  
  yPos += 3
  
  // Line Items
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2])
  
  // Default line item if none provided
  const items = data.lineItems && data.lineItems.length > 0 
    ? data.lineItems 
    : [{
        description: data.description || `Payment for INV-${data.invoiceId.padStart(6, '0')}`,
        quantity: 1,
        price: data.amountFormatted,
        total: data.amountFormatted
      }]
  
  items.forEach((item, index) => {
    yPos += 8
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }
    
    // Draw row border
    doc.setDrawColor(229, 231, 235) // Gray-200
    doc.line(20, yPos - 3, 190, yPos - 3)
    
    doc.text(item.description || 'Invoice Amount', 22, yPos)
    doc.text(String(item.quantity || 1), 130, yPos)
    doc.text(`$${item.price || data.amountFormatted}`, 145, yPos)
    doc.text(`$${item.total || data.amountFormatted}`, 170, yPos)
  })
  
  yPos += 15
  
  // Total Section
  const totalY = Math.max(yPos, 230)
  
  // Subtotal (if multiple items)
  if (items.length > 1) {
    doc.setFontSize(9)
    doc.text('Subtotal:', 145, totalY)
    doc.text(data.amountFormatted, 170, totalY)
  }
  
  // Total
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Total:', 145, totalY + (items.length > 1 ? 8 : 0))
  doc.text(`$${data.amountFormatted}`, 170, totalY + (items.length > 1 ? 8 : 0))
  
  // Footer
  const footerY = 275
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(lightGray[0], lightGray[1], lightGray[2])
  doc.text('This invoice was generated on SETTL. - Powered by blockchain', 20, footerY)
  doc.text(`Invoice ID: ${data.invoiceId}`, 20, footerY + 5)
  doc.text('Tokenized as ERC721 NFT on Mantle Network', 20, footerY + 10)
  
  // Generate filename
  const filename = `Invoice-${data.invoiceNumber || data.invoiceId.padStart(6, '0')}-${data.createdAt.toISOString().split('T')[0]}.pdf`
  
  return { doc, filename }
}

export function downloadInvoicePDF(data: InvoicePDFData) {
  const { doc, filename } = generateInvoicePDF(data)
  doc.save(filename)
}

