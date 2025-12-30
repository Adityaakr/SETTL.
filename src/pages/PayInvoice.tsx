import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  DollarSign,
  Loader2,
  ExternalLink,
  Copy,
  AlertCircle,
  Calendar,
  User,
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInvoice } from "@/hooks/useInvoice"
import { useInvoiceNFT } from "@/hooks/useInvoiceNFT"
import { useReadContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi"
import { useSendTransaction, useWallets, usePrivy } from "@privy-io/react-auth"
import { usePrivyAccount } from "@/hooks/usePrivyAccount"
import { contractAddresses } from "@/lib/contracts"
import { DemoUSDCABI, SettlementRouterABI, InvoiceRegistryABI } from "@/lib/abis"
import { formatUnits, parseUnits, isAddress, encodeFunctionData, encodeFunctionResult, decodeFunctionResult } from "viem"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { WaterfallAnimation } from "@/components/features/WaterfallAnimation"

const STATUS_LABELS = {
  0: "Issued",
  1: "Financed",
  2: "Paid",
  3: "Cleared",
}

export default function PayInvoice() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const { address } = usePrivyAccount()
  const { invoice, isLoading: isLoadingInvoice } = useInvoice(invoiceId)
  const { tokenId, nftAddress, isLoading: isLoadingNFT } = useInvoiceNFT(invoiceId ? BigInt(invoiceId) : undefined)
  const { sendTransaction } = useSendTransaction()
  const { wallets } = useWallets()
  const { login, ready, authenticated } = usePrivy()
  const publicClient = usePublicClient({ chainId: 5003 })
  
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || wct === 'privy' || ct.includes('privy') || ct.includes('embedded');
  }) || wallets[0];
  
  const [step, setStep] = useState<"approve" | "pay" | "complete">("approve")
  const [approveHash, setApproveHash] = useState<`0x${string}` | null>(null)
  const [payHash, setPayHash] = useState<`0x${string}` | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  
  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: contractAddresses.DemoUSDC as `0x${string}`,
    abi: DemoUSDCABI,
    functionName: "allowance",
    args: address && contractAddresses.SettlementRouter 
      ? [address, contractAddresses.SettlementRouter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!address && !!contractAddresses.SettlementRouter && !!invoice,
      refetchInterval: 3000,
    },
  })
  
  const { isLoading: isApprovalConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  const { isLoading: isPaymentConfirming } = useWaitForTransactionReceipt({
    hash: payHash,
  })

  // Determine if approval is needed
  const needsApproval = invoice && allowance !== undefined && 
    allowance < invoice.amount && (invoice.status === 0 || invoice.status === 1)

  // Watch for status changes
  useEffect(() => {
    if (invoice?.status === 2 || invoice?.status === 3) {
      setStep("complete")
    }
  }, [invoice?.status])

  // Handle approval success
  useEffect(() => {
    if (approveHash && !isApprovalConfirming) {
      toast.success("USDC approved!", {
        description: "You can now pay the invoice",
      })
      refetchAllowance()
      setStep("pay")
    }
  }, [approveHash, isApprovalConfirming, refetchAllowance])

  // Handle payment success
  useEffect(() => {
    if (payHash && !isPaymentConfirming) {
      toast.success("Invoice paid!", {
        description: "Settlement is processing...",
      })
      setStep("complete")
    }
  }, [payHash, isPaymentConfirming])

  const handleApprove = async () => {
    if (!invoice || !contractAddresses.DemoUSDC || !contractAddresses.SettlementRouter) {
      toast.error("Missing contract addresses")
      return
    }

    if (!embeddedWallet) {
      toast.error("No wallet available", {
        description: "Please connect your Privy embedded wallet",
      })
      return
    }

    setIsApproving(true)
    try {
      const data = encodeFunctionData({
        abi: DemoUSDCABI,
        functionName: "approve",
        args: [
          contractAddresses.SettlementRouter as `0x${string}`,
          invoice.amount, // Approve full invoice amount
        ],
      })

      const result = await sendTransaction(
        {
          to: contractAddresses.DemoUSDC as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address,
          uiOptions: {
            showWalletUIs: false,
          },
        }
      )

      setApproveHash(result.hash)
      toast.success("Approval transaction submitted!")
    } catch (error: any) {
      toast.error("Approval failed", {
        description: error.message || "Please try again",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handlePay = async () => {
    if (!invoice || !invoiceId || !contractAddresses.SettlementRouter) {
      toast.error("Invoice not found")
      return
    }

    if (!embeddedWallet) {
      toast.error("No wallet available", {
        description: "Please connect your Privy embedded wallet",
      })
      return
    }

    // Pre-flight checks
    if (invoice.status === 3) {
      toast.error("Invoice already cleared", {
        description: "This invoice has already been paid and cleared.",
      })
      return
    }

    if (address?.toLowerCase() !== invoice.buyer.toLowerCase()) {
      toast.error("Not the invoice buyer", {
        description: "Only the buyer address can pay this invoice.",
      })
      return
    }

    // Check allowance one more time before attempting payment
    if (allowance !== undefined && allowance < invoice.amount) {
      toast.error("Insufficient USDC allowance", {
        description: "Please approve USDC spending first. The approval may still be processing.",
      })
      // Refetch allowance in case it just updated
      refetchAllowance()
      return
    }

    setIsPaying(true)
    try {
      // Pre-flight validation: Check real contract state before attempting transaction
      if (publicClient && address && invoice) {
        try {
          // 1. Check USDC balance
          const balance = await publicClient.readContract({
            address: contractAddresses.DemoUSDC as `0x${string}`,
            abi: DemoUSDCABI,
            functionName: "balanceOf",
            args: [address],
          }) as bigint

          // 2. Check USDC allowance
          const currentAllowance = await publicClient.readContract({
            address: contractAddresses.DemoUSDC as `0x${string}`,
            abi: DemoUSDCABI,
            functionName: "allowance",
            args: [address, contractAddresses.SettlementRouter as `0x${string}`],
          }) as bigint

          // 3. Check invoice status directly from contract
          const InvoiceRegistryABI = [
            {
              inputs: [{ name: "invoiceId", type: "uint256" }],
              name: "getInvoice",
              outputs: [
                {
                  components: [
                    { name: "invoiceId", type: "uint256" },
                    { name: "seller", type: "address" },
                    { name: "buyer", type: "address" },
                    { name: "amount", type: "uint256" },
                    { name: "dueDate", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "createdAt", type: "uint256" },
                    { name: "paidAt", type: "uint256" },
                    { name: "clearedAt", type: "uint256" },
                  ],
                  name: "",
                  type: "tuple",
                },
              ],
              stateMutability: "view",
              type: "function",
            },
          ] as const

          const onChainInvoice = await publicClient.readContract({
            address: contractAddresses.InvoiceRegistry as `0x${string}`,
            abi: InvoiceRegistryABI,
            functionName: "getInvoice",
            args: [BigInt(invoiceId)],
          }) as any

          console.log("[Payment Pre-flight Check]", {
            balance: balance.toString(),
            allowance: currentAllowance.toString(),
            invoiceAmount: invoice.amount.toString(),
            invoiceStatus: onChainInvoice.status,
            invoiceBuyer: onChainInvoice.buyer,
            connectedAddress: address,
          })

          // Validate checks
          if (onChainInvoice.status === 3) {
            toast.error("Invoice already cleared", {
              description: "This invoice has already been paid and cleared.",
            })
            setIsPaying(false)
            return
          }

          if (onChainInvoice.buyer.toLowerCase() !== address.toLowerCase()) {
            toast.error("Not the invoice buyer", {
              description: "Only the buyer address can pay this invoice. Please connect the correct wallet.",
            })
            setIsPaying(false)
            return
          }

          if (balance < invoice.amount) {
            toast.error("Insufficient USDC balance", {
              description: `You have ${formatUnits(balance, 6)} USDC, but need ${formatUnits(invoice.amount, 6)} USDC to pay this invoice.`,
            })
            setIsPaying(false)
            return
          }

          if (currentAllowance < invoice.amount) {
            toast.error("Insufficient USDC allowance", {
              description: `You have approved ${formatUnits(currentAllowance, 6)} USDC, but need ${formatUnits(invoice.amount, 6)} USDC. Please click 'Approve USDC' first.`,
              duration: 8000,
            })
            refetchAllowance()
            setIsPaying(false)
            return
          }

          console.log("[Payment Pre-flight Check] ✓ All checks passed, proceeding with transaction")
        } catch (preFlightError: any) {
          console.error("[Payment Pre-flight Check] Error:", preFlightError)
          // If pre-flight check fails, continue anyway (don't block the user)
          // The transaction will fail with a clearer error if there's an issue
        }
      }

      // Pre-flight checks have passed - proceed directly with real transaction
      // We skip simulation as it can fail even when the real transaction succeeds
      // (due to state differences, gas estimation, or nested contract call complexities)

      const data = encodeFunctionData({
        abi: SettlementRouterABI,
        functionName: "payInvoice",
        args: [BigInt(invoiceId)],
      })

      const result = await sendTransaction(
        {
          to: contractAddresses.SettlementRouter as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address,
          uiOptions: {
            showWalletUIs: false,
          },
        }
      )

      setPayHash(result.hash)
      toast.success("Payment transaction submitted!")
    } catch (error: any) {
      console.error("Payment error:", error)
      
      // Provide more specific error messages
      let errorMessage = "Payment failed"
      let errorDescription = error.message || "Please try again"
      
      if (error.message?.includes("Not invoice buyer") || error.message?.includes("buyer")) {
        errorMessage = "Not the invoice buyer"
        errorDescription = "Only the buyer address can pay this invoice. Please connect the correct wallet."
      } else if (error.message?.includes("Already cleared") || error.message?.includes("cleared")) {
        errorMessage = "Invoice already cleared"
        errorDescription = "This invoice has already been paid and cleared."
      } else if (error.message?.includes("Execution reverted")) {
        errorMessage = "Transaction failed"
        errorDescription = "The transaction was rejected. Common causes: insufficient USDC allowance (try approving again), insufficient balance, or invoice already paid. Please check and try again."
      }
      
      toast.error(errorMessage, {
        description: errorDescription,
        duration: 8000,
      })
    } finally {
      setIsPaying(false)
    }
  }

  const copyPaymentLink = () => {
    const link = `${window.location.origin}/pay/${invoiceId}`
    navigator.clipboard.writeText(link)
    toast.success("Payment link copied!")
  }

  if (isLoadingInvoice) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Invoice Not Found</h1>
        <p className="text-muted-foreground">This invoice does not exist or has been removed.</p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    )
  }

  const amountDisplay = parseFloat(formatUnits(invoice.amount, 6))
  const isBuyer = address?.toLowerCase() === invoice.buyer.toLowerCase()
  const isPastDue = Number(invoice.dueDate) < Math.floor(Date.now() / 1000)
  const dueDate = new Date(Number(invoice.dueDate) * 1000)
  const createdAt = new Date(Number(invoice.createdAt) * 1000)
  
  // Get buyer metadata from localStorage
  const getBuyerMetadata = () => {
    try {
      const stored = localStorage.getItem(`invoice_metadata_${invoiceId}`)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.error('Error reading buyer metadata:', e)
    }
    return { buyerName: '', buyerEmail: '' }
  }
  
  const buyerMetadata = invoice ? getBuyerMetadata() : { buyerName: '', buyerEmail: '' }
  const buyerName = buyerMetadata.buyerName || ''

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Compact Header */}
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={copyPaymentLink}>
                <Copy className="h-4 w-4" />
              </Button>
              {invoice && (
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href={`https://explorer.testnet.mantle.xyz/address/${contractAddresses.InvoiceRegistry}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Invoice Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
            {/* Header: Invoice ID, Tokenized Badge, Status */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">Invoice #{invoiceId}</h1>
                  {tokenId && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3 w-3" />
                      Tokenized #{tokenId.toString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  {buyerName && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {buyerName}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                  invoice.status === 3 ? "bg-success/10 text-success" :
                  invoice.status === 2 ? "bg-primary/10 text-primary" :
                  invoice.status === 1 ? "bg-warning/10 text-warning" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {invoice.status === 3 && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {invoice.status === 2 && <Clock className="h-3.5 w-3.5" />}
                  <span className="font-medium">{STATUS_LABELS[invoice.status]}</span>
                </div>
              </div>
            </div>

            {/* Amount - More Compact */}
            <div className="mb-4 rounded-lg bg-secondary/50 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount Due</p>
              <p className="mt-1 text-3xl font-bold">
                ${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="ml-2 text-lg font-normal text-muted-foreground">USDC</span>
              </p>
            </div>

            {/* Payment Actions */}
            {isBuyer && invoice.status < 2 && (
              <div className="space-y-3">
                {step === "approve" && needsApproval && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <span className="text-sm font-medium">Approve USDC to continue</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleApprove}
                      disabled={isApproving || isApprovalConfirming}
                      className="w-full"
                      size="lg"
                      variant="hero"
                    >
                      {isApproving || isApprovalConfirming ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {isApproving ? "Waiting for wallet..." : "Confirming..."}
                        </>
                      ) : (
                        <>
                          Approve ${amountDisplay.toLocaleString()} USDC
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {(step === "pay" || !needsApproval) && (
                  <div className="space-y-3">
                    {!needsApproval && (
                      <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-sm font-medium">USDC Approved</span>
                        </div>
                      </div>
                    )}
                    <Button
                      onClick={handlePay}
                      disabled={isPaying || isPaymentConfirming || needsApproval}
                      className="w-full"
                      size="lg"
                      variant="hero"
                    >
                      {isPaying || isPaymentConfirming ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {isPaying ? "Waiting for wallet..." : "Confirming payment..."}
                        </>
                      ) : (
                        <>
                          <DollarSign className="mr-2 h-5 w-5" />
                          Pay ${amountDisplay.toLocaleString()} USDC
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {step === "complete" && (
                  <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
                    <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
                    <h3 className="mt-3 text-lg font-semibold">Payment Complete!</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Settlement is being finalized on-chain.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isBuyer && invoice.status < 2 && (
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-8 w-8 mx-auto text-warning" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Connect Wallet to Pay</h3>
                    <p className="text-muted-foreground mb-3">
                      This invoice is for a different address. Please connect the buyer wallet to proceed.
                    </p>
                    <div className="bg-muted/50 rounded-md p-3 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Buyer address:</p>
                      <p className="font-mono text-sm break-all">{invoice.buyer}</p>
                    </div>
                  </div>
                  
                  {ready && !authenticated && (
                    <Button 
                      onClick={async () => {
                        try {
                          await login()
                          toast.success("Please connect your wallet to pay this invoice")
                        } catch (error: any) {
                          console.error("Login error:", error)
                          toast.error("Failed to connect wallet", {
                            description: error?.message || "Please try again"
                          })
                        }
                      }}
                      variant="hero"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      Connect Wallet with Privy
                    </Button>
                  )}
                  
                  {ready && authenticated && address && (
                    <div className="space-y-3">
                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs text-muted-foreground mb-1">Currently connected:</p>
                        <p className="font-mono text-sm break-all">{address}</p>
                      </div>
                      <p className="text-sm text-warning">
                        The connected wallet doesn't match the buyer address. Please connect the correct wallet.
                      </p>
                      <Button 
                        onClick={async () => {
                          try {
                            await login()
                          } catch (error: any) {
                            console.error("Login error:", error)
                            toast.error("Failed to connect wallet", {
                              description: error?.message || "Please try again"
                            })
                          }
                        }}
                        variant="outline"
                        size="lg"
                        className="w-full sm:w-auto"
                      >
                        Switch Wallet
                      </Button>
                    </div>
                  )}
                  
                  {ready && authenticated && !address && (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Wallet connection in progress...
                      </p>
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {invoice.status >= 2 && (
              <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-2 font-semibold">
                  {invoice.status === 3 ? "Invoice Cleared" : "Invoice Paid"}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

