import { motion } from "framer-motion"
import { useState, useMemo, useEffect } from "react"
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Copy, 
  ExternalLink,
  Zap,
  Eye,
  Loader2,
  RotateCcw,
  ImageIcon
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast as shadcnToast } from "@/hooks/use-toast"
import { toast } from "sonner"
import { useSellerInvoicesWithData, Invoice, InvoiceStatus } from "@/hooks/useInvoice"
import { useInvoiceNFT } from "@/hooks/useInvoiceNFT"
import { formatUnits } from "viem"
import { contractAddresses } from "@/lib/contracts"
import { Trash2, Download } from "lucide-react"
import { downloadInvoicePDF } from "@/lib/generateInvoicePDF"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Map invoice status enum to display strings
const STATUS_MAP: Record<InvoiceStatus, string> = {
  0: "issued",
  1: "financed",
  2: "paid",
  3: "cleared",
}

// Store hidden invoice IDs in localStorage
const HIDDEN_INVOICES_KEY = "settl-hidden-invoices"

function getHiddenInvoices(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const hidden = localStorage.getItem(HIDDEN_INVOICES_KEY)
  return hidden ? new Set(JSON.parse(hidden)) : new Set()
}

function setHiddenInvoices(hidden: Set<string>) {
  if (typeof window === "undefined") return
  localStorage.setItem(HIDDEN_INVOICES_KEY, JSON.stringify(Array.from(hidden)))
}

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("")
  const [hiddenInvoiceIds, setHiddenInvoiceIds] = useState<Set<string>>(() => getHiddenInvoices())
  const { invoices, isLoading, error } = useSellerInvoicesWithData()

  // Sync hidden invoices with localStorage (only write, don't read to avoid loops)
  useEffect(() => {
    if (hiddenInvoiceIds.size === 0) {
      // If empty, clear localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(HIDDEN_INVOICES_KEY)
      }
    } else {
      setHiddenInvoices(hiddenInvoiceIds)
    }
  }, [hiddenInvoiceIds])

  const handleHideInvoice = (invoiceId: bigint) => {
    setHiddenInvoiceIds(prev => new Set([...prev, invoiceId.toString()]))
    toast.success("Invoice hidden", {
      description: "The invoice has been hidden from your list. It still exists on-chain.",
    })
  }

  const handleRestoreAllHidden = () => {
    const count = hiddenInvoiceIds.size
    console.log('🔄 Restoring hidden invoices:', { count, hiddenIds: Array.from(hiddenInvoiceIds) })
    
    // Clear localStorage first
    if (typeof window !== 'undefined') {
      localStorage.removeItem(HIDDEN_INVOICES_KEY)
      console.log('✅ Cleared localStorage')
    }
    
    // Update state with empty Set - React will detect this change
    setHiddenInvoiceIds(new Set())
    console.log('✅ Set hiddenInvoiceIds to empty Set')
    
    toast.success(`Restored ${count} hidden invoice${count !== 1 ? 's' : ''}`, {
      description: "All previously hidden invoices are now visible.",
    })
  }

  // Format invoices for display
  const formattedInvoices = useMemo(() => {
    if (!invoices) return []
    
    return invoices.map((invoice) => ({
      id: `INV-${invoice.invoiceId.toString().padStart(10, '0')}`, // 10 digits to match PDF format
      invoiceId: invoice.invoiceId,
      buyer: invoice.buyer,
      seller: invoice.seller,
      amount: parseFloat(formatUnits(invoice.amount, 6)), // USDC has 6 decimals
      amountRaw: invoice.amount, // Keep raw bigint for PDF
      status: STATUS_MAP[invoice.status] as "issued" | "financed" | "paid" | "cleared",
      dueDate: new Date(Number(invoice.dueDate) * 1000),
      createdDate: new Date(Number(invoice.createdAt) * 1000),
      paidAt: invoice.paidAt,
      clearedAt: invoice.clearedAt,
      link: `${window.location.origin}/pay/${invoice.invoiceId}`,
    }))
  }, [invoices])

  const filteredInvoices = useMemo(() => {
    if (!formattedInvoices) return []
    
    // Debug: log invoice counts
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Invoice filtering:', {
        totalInvoices: formattedInvoices.length,
        hiddenCount: hiddenInvoiceIds.size,
        hiddenIds: Array.from(hiddenInvoiceIds),
        searchQuery,
      })
    }
    
    const visibleInvoices = formattedInvoices
      .filter(inv => {
        const invoiceIdStr = inv.invoiceId.toString()
        const isHidden = hiddenInvoiceIds.has(invoiceIdStr)
        return !isHidden
      })
      .filter(
        (inv) =>
          inv.buyer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    
    // Debug: log filtered results
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Filtered invoices result:', {
        visibleCount: visibleInvoices.length,
        totalCount: formattedInvoices.length,
        hiddenCount: hiddenInvoiceIds.size,
      })
    }
    
    return visibleInvoices
  }, [formattedInvoices, searchQuery, hiddenInvoiceIds])

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link)
    shadcnToast({
      title: "Link copied",
      description: "Payment link copied to clipboard",
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage your invoice payment links
            {invoices && invoices.length > 0 && (
              <span className="ml-2 text-xs">
                (Showing {filteredInvoices.length} of {invoices.length}{hiddenInvoiceIds.size > 0 ? `, ${hiddenInvoiceIds.size} hidden` : ''})
              </span>
            )}
          </p>
        </div>
        <Button variant="hero" asChild>
          <Link to="/app/invoices/new">
            <Plus className="h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {hiddenInvoiceIds.size > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRestoreAllHidden}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Show All ({hiddenInvoiceIds.size} hidden)
          </Button>
        )}
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Invoice table */}
      <div className="rounded-xl border border-border bg-card shadow-md overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading invoices...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive mb-2">Error loading invoices</p>
            <p className="text-sm text-muted-foreground">{error.message || "Please try again"}</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "No invoices match your search" : 
               formattedInvoices.length > 0 && hiddenInvoiceIds.size > 0
                ? `${hiddenInvoiceIds.size} invoice${hiddenInvoiceIds.size !== 1 ? 's' : ''} ${hiddenInvoiceIds.size === 1 ? 'is' : 'are'} hidden. Click "Show All" above to restore ${hiddenInvoiceIds.size === 1 ? 'it' : 'them'}.`
                : "No invoices yet"}
            </p>
            {!searchQuery && formattedInvoices.length === 0 && (
              <Button asChild>
                <Link to="/app/invoices/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Invoice
                </Link>
              </Button>
            )}
            {!searchQuery && formattedInvoices.length > 0 && hiddenInvoiceIds.size > 0 && (
              <Button onClick={handleRestoreAllHidden} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Show All Hidden Invoices
              </Button>
            )}
          </div>
        ) : (
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  Invoice
                  {contractAddresses.InvoiceNFT && (
                    <span className="text-xs text-purple-600 dark:text-purple-400" title="Invoices are tokenized">
                      🎨 Tokenized
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Buyer</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Amount</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Due Date</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredInvoices.map((invoice) => (
              <motion.tr
                key={invoice.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group transition-colors hover:bg-secondary/30"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/app/invoices/${invoice.invoiceId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {invoice.id}
                    </Link>
                    {contractAddresses.InvoiceNFT && (
                      <InvoiceNFTBadge invoiceId={invoice.invoiceId} />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium font-mono text-sm">
                      {invoice.buyer.slice(0, 6)}...{invoice.buyer.slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground">{invoice.buyer}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold number-display">
                    ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {invoice.dueDate.toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={invoice.status}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </StatusBadge>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLink(invoice.link)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {invoice.status === "issued" && (
                      <Button variant="ghost" size="sm" className="text-primary">
                        <Zap className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/app/invoices/${invoice.invoiceId}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {/* PDF download button hidden for now */}
                        {false && <InvoicePDFDownloadButton invoice={invoice} />}
                        <DropdownMenuItem onClick={() => copyLink(invoice.link)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={invoice.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open Payment Page
                          </a>
                        </DropdownMenuItem>
                        {invoice.status === "issued" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-primary" asChild>
                              <Link to={`/app/financing`}>
                                <Zap className="mr-2 h-4 w-4" />
                                Request Advance
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem 
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Hide Invoice
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hide Invoice?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will hide the invoice from your list. The invoice still exists on-chain and cannot be permanently deleted. 
                                You can view it again by clearing your browser's local storage.
                                <br /><br />
                                Invoice: <strong>{invoice.id}</strong>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleHideInvoice(invoice.invoiceId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Hide Invoice
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </motion.div>
  )
}

// Component to show NFT badge if invoice is tokenized
function InvoiceNFTBadge({ invoiceId }: { invoiceId: bigint }) {
  const { tokenId, isLoading } = useInvoiceNFT(invoiceId)
  
  if (isLoading || !tokenId || BigInt(tokenId) === 0n) {
    return null
  }
  
  return (
    <span 
      className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700"
      title="This invoice is tokenized"
    >
      <ImageIcon className="h-3 w-3" />
      Tokenized
    </span>
  )
}

// Component to handle PDF download with NFT token fetching
function InvoicePDFDownloadButton({ invoice }: { invoice: { invoiceId: bigint; buyer: string; amount: number; amountRaw?: bigint; seller?: string; dueDate: Date; createdDate: Date; paidAt?: bigint; clearedAt?: bigint; status: string; id: string } }) {
  const { tokenId, nftAddress } = useInvoiceNFT(invoice.invoiceId)
  
  return (
    <DropdownMenuItem 
      onClick={() => {
        try {
          // Get metadata from localStorage
          let metadata = { buyerName: '', buyerEmail: '', sellerName: '' }
          try {
            const stored = localStorage.getItem(`invoice_metadata_${invoice.invoiceId}`)
            if (stored) {
              metadata = JSON.parse(stored)
            }
          } catch (e) {
            console.log('No metadata found for invoice', invoice.invoiceId)
          }
          
          const statusNumber = invoice.status === 'issued' ? 0 
            : invoice.status === 'financed' ? 1
            : invoice.status === 'paid' ? 2
            : 3
          
          const paidAt = invoice.paidAt && invoice.paidAt > 0n
            ? new Date(Number(invoice.paidAt) * 1000)
            : undefined
          const clearedAt = invoice.clearedAt && invoice.clearedAt > 0n
            ? new Date(Number(invoice.clearedAt) * 1000)
            : undefined
          
          const explorerLink = tokenId && nftAddress && BigInt(tokenId) > 0n
            ? `https://explorer.testnet.mantle.xyz/token/${nftAddress}?a=${tokenId.toString()}`
            : undefined
          
          downloadInvoicePDF({
            invoiceId: invoice.invoiceId.toString(),
            sellerName: metadata.sellerName || 'SETTL. Business',
            buyerName: metadata.buyerName || `${invoice.buyer.slice(0, 6)}...${invoice.buyer.slice(-4)}`,
            buyerEmail: metadata.buyerEmail || undefined,
            buyerAddress: invoice.buyer,
            sellerAddress: invoice.seller || '',
            amount: invoice.amountRaw || BigInt(Math.round(invoice.amount * 1e6)),
            amountFormatted: invoice.amount.toFixed(2),
            dueDate: invoice.dueDate,
            createdAt: invoice.createdDate,
            paidAt,
            clearedAt,
            status: invoice.status,
            statusNumber,
            statusLabel: invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
            invoiceNumber: invoice.id, // Already formatted as INV-000000
            description: `Payment for ${invoice.id}`,
            tokenId: tokenId && BigInt(tokenId) > 0n ? tokenId.toString() : undefined,
            nftAddress,
            explorerLink,
          })
          toast.success("Invoice PDF downloaded")
        } catch (error: any) {
          console.error("Error generating PDF:", error)
          toast.error("Failed to generate PDF", {
            description: error?.message || "Please try again"
          })
        }
      }}
    >
      <Download className="mr-2 h-4 w-4" />
      Download PDF
    </DropdownMenuItem>
  )
}
