import { motion } from "framer-motion"
import { useParams, Link } from "react-router-dom"
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Copy,
  AlertCircle,
  Loader2,
  User,
  Calendar,
  FileText,
  Zap,
  Building2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { useInvoice } from "@/hooks/useInvoice"
import { useAdvance } from "@/hooks/useAdvance"
import { usePrivyAccount } from "@/hooks/usePrivyAccount"
import { useInvoiceNFT } from "@/hooks/useInvoiceNFT"
import { formatUnits } from "viem"
import { toast } from "sonner"
import { Image as ImageIcon, Sparkles, Shield, TrendingUp } from "lucide-react"

const STATUS_LABELS: Record<number, string> = {
  0: "Issued",
  1: "Financed",
  2: "Paid",
  3: "Cleared",
}

const STATUS_COLORS: Record<number, string> = {
  0: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  1: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  2: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  3: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
}

export default function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const { invoice, isLoading: isLoadingInvoice, error } = useInvoice(invoiceId)
  const { advance, isLoading: isLoadingAdvance } = useAdvance(invoiceId ? BigInt(invoiceId) : undefined)
  const { address } = usePrivyAccount()
  const { tokenId, nftAddress, isLoading: isLoadingNFT } = useInvoiceNFT(invoiceId ? BigInt(invoiceId) : undefined)

  if (isLoadingInvoice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Invoice Not Found</h1>
        <p className="text-muted-foreground">This invoice does not exist or has been removed.</p>
        <Button asChild>
          <Link to="/app/invoices">Back to Invoices</Link>
        </Button>
      </div>
    )
  }

  const amount = parseFloat(formatUnits(invoice.amount, 6))
  const dueDate = new Date(Number(invoice.dueDate) * 1000)
  const createdAt = new Date(Number(invoice.createdAt) * 1000)
  const isPastDue = dueDate.getTime() < Date.now()
  const statusLabel = STATUS_LABELS[invoice.status] || "Unknown"
  const statusColor = STATUS_COLORS[invoice.status] || "bg-gray-100 text-gray-800"
  
  // Format dates
  const billDate = createdAt.toLocaleString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true 
  })
  const clearBillBefore = dueDate.toLocaleDateString('en-CA') // YYYY-MM-DD format
  
  // Calculate summary (simplified - using invoice amount as base)
  const subtotal = amount
  const tax = 0 // No tax stored on-chain
  const discount = 0 // No discount stored on-chain
  const totalAmount = subtotal + tax - discount

  const copyPaymentLink = () => {
    const link = `${window.location.origin}/pay/${invoice.invoiceId}`
    navigator.clipboard.writeText(link)
    toast.success("Payment link copied to clipboard!")
  }

  // Get seller address (from invoice)
  const sellerAddress = invoice.seller
  const buyerAddress = invoice.buyer
  
  // Get buyer metadata from localStorage (stored when invoice was created)
  const getBuyerMetadata = () => {
    try {
      // Try invoice ID first
      const stored = localStorage.getItem(`invoice_metadata_${invoice.invoiceId}`)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Error reading buyer metadata:', e)
    }
    return { buyerName: '', buyerEmail: '' }
  }
  
  const buyerMetadata = getBuyerMetadata()
  const buyerName = buyerMetadata.buyerName || ''
  const buyerEmail = buyerMetadata.buyerEmail || ''

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header with back button */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/app/invoices">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyPaymentLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`https://explorer.testnet.mantle.xyz/address/${invoice.invoiceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Explorer
                </a>
              </Button>
            </div>
          </div>

          {/* Invoice Document */}
          <div className="rounded-xl border border-border bg-white dark:bg-card shadow-lg p-8 md:p-12">
            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground mb-8">BILL DETAILS</h1>

            {/* Top Section: Bill Info + Seller Info */}
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              {/* Left: Bill Information */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Bill No:</p>
                  <p className="font-semibold text-gray-900 dark:text-foreground">
                    INV-{invoice.invoiceId.toString().padStart(10, '0')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">Bill Date:</p>
                  <p className="font-semibold text-gray-900 dark:text-foreground">{billDate}</p>
                </div>
                <div>
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">Clear Bill Before:</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">{clearBillBefore}</p>
                </div>
              </div>

              {/* Right: Seller/Issuer Information */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-muted-foreground">
                  <p className="font-medium text-gray-900 dark:text-foreground">SETTL. Protocol</p>
                  <p className="font-mono text-xs break-all">{sellerAddress.slice(0, 6)}...{sellerAddress.slice(-4)}</p>
                  <p className="font-mono text-xs break-all">{sellerAddress}</p>
                </div>
              </div>
            </div>

            {/* Bill To Section */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 dark:text-foreground mb-3">Bill To:</h2>
              <div className="border-l-4 border-primary bg-blue-50 dark:bg-blue-950/20 p-4 rounded-r-lg">
                {buyerName ? (
                  <>
                    <p className="font-bold text-lg text-gray-900 dark:text-foreground mb-1">
                      {buyerName}
                    </p>
                    {buyerEmail && (
                      <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2">
                        {buyerEmail}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-muted-foreground font-mono break-all">
                      {buyerAddress}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-lg text-gray-900 dark:text-foreground mb-1">
                      {buyerAddress.slice(0, 6)}...{buyerAddress.slice(-4)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground font-mono break-all">
                      {buyerAddress}
                    </p>
                  </>
                )}
              </div>

              {/* Tokenized Bill Info */}
              {nftAddress && (
                <div className="mt-4 border-l-4 border-green-500 bg-green-50/50 dark:bg-green-950/10 p-4 rounded-r-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-semibold text-green-900 dark:text-green-200">
                          Tokenized Bill Powered by SETTL.
                        </p>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
                          <Shield className="h-3 w-3" />
                          RWA
                        </span>
                      </div>
                      <p className="text-xs text-green-800/90 dark:text-green-300/90 leading-relaxed">
                        This invoice has been tokenized as an ERC721 NFT by SETTL, making it a tradeable Real-World Asset (RWA).
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tokenId && BigInt(tokenId) > 0n && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 h-8 text-xs"
                          >
                            <a
                              href={`https://explorer.testnet.mantle.xyz/token/${nftAddress}?a=${tokenId.toString()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 mr-1.5" />
                              View Explorer
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${nftAddress}/${tokenId.toString()}`)
                              toast.success("NFT ID copied!")
                            }}
                            className="h-8 text-xs text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-950/40"
                          >
                            <Copy className="h-3 w-3 mr-1.5" />
                            Copy ID
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-8 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-100 dark:bg-blue-900/30">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-foreground">Item / Service</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-foreground">Description</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-foreground">Quantity</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-foreground">Price</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-900 dark:text-foreground font-medium">Invoice Amount</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-muted-foreground">Payment for invoice INV-{invoice.invoiceId.toString().padStart(6, '0')}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-900 dark:text-foreground">1</td>
                    <td className="px-4 py-4 text-sm text-right text-gray-900 dark:text-foreground">
                      ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-semibold text-gray-900 dark:text-foreground">
                      ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Section */}
            <div className="mb-8 flex justify-end">
              <div className="w-full md:w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-muted-foreground">Subtotal:</span>
                  <span className="text-gray-900 dark:text-foreground font-medium">
                    ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-muted-foreground">Tax (18%):</span>
                    <span className="text-gray-900 dark:text-foreground font-medium">
                      ${tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Discount (5%):</span>
                    <span className="font-medium">
                      -${discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900 dark:text-foreground">Total Amount:</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-foreground">
                      ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Info Section */}
            <div className="border-t border-border pt-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-foreground mb-2">Payment Info:</h2>
              <div className="border-l-4 border-primary bg-blue-50 dark:bg-blue-950/20 p-3 rounded-r-lg">
                <p className="text-xs text-gray-400 dark:text-muted-foreground italic mb-1">Brand authorized digital signature</p>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="text-base font-bold text-gray-900 dark:text-foreground">SETTL. Network</div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-600 dark:text-muted-foreground">Payment Status:</p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-600 dark:text-muted-foreground">Due On:</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-foreground">{clearBillBefore}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Advance Information (if financed) */}
            {invoice.status === 1 && advance && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-primary">Advance Information</h3>
                </div>
                {isLoadingAdvance ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading advance details...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Advance Amount</p>
                      <p className="font-semibold">
                        ${parseFloat(formatUnits(advance.advanceAmount, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Repayment</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">
                        ${parseFloat(formatUnits(advance.totalRepayment, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Interest</p>
                      <p className="font-semibold">
                        ${parseFloat(formatUnits(advance.interest, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Information (if paid/cleared) */}
            {invoice.status >= 2 && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-green-900 dark:text-green-400">Payment Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {invoice.paidAt > 0n && (
                    <div>
                      <p className="text-muted-foreground">Paid At:</p>
                      <p className="font-semibold">
                        {new Date(Number(invoice.paidAt) * 1000).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {invoice.clearedAt > 0n && (
                    <div>
                      <p className="text-muted-foreground">Cleared At:</p>
                      <p className="font-semibold">
                        {new Date(Number(invoice.clearedAt) * 1000).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Payment Link Section - Prominent for sharing with buyer */}
            {invoice.status < 2 && (
              <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <h3 className="text-lg font-semibold text-primary mb-3">Share Payment Link with Buyer</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-0 rounded-md bg-background p-2.5 border border-border">
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      {window.location.origin}/pay/{invoice.invoiceId.toString()}
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={copyPaymentLink}
                    className="flex-shrink-0"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Payment Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-shrink-0"
                  >
                    <a
                      href={`${window.location.origin}/pay/${invoice.invoiceId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Link
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            {invoice.status === 0 && (
              <Button variant="default" className="gap-2" asChild>
                <Link to="/app/financing">
                  <Zap className="h-4 w-4" />
                  Request Advance
                </Link>
              </Button>
            )}
            <Button variant="outline" className="gap-2" asChild>
              <a
                href={`${window.location.origin}/pay/${invoice.invoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                View Payment Page
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
