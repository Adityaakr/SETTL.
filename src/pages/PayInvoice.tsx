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
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInvoice } from "@/hooks/useInvoice"
import { useReadContract, useWaitForTransactionReceipt } from "wagmi"
import { useSendTransaction, useWallets } from "@privy-io/react-auth"
import { usePrivyAccount } from "@/hooks/usePrivyAccount"
import { contractAddresses } from "@/lib/contracts"
import { DemoUSDCABI, SettlementRouterABI } from "@/lib/abis"
import { formatUnits, parseUnits, isAddress, encodeFunctionData } from "viem"
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
  const { sendTransaction } = useSendTransaction()
  const { wallets } = useWallets()
  
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

    setIsPaying(true)
    try {
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
      toast.error("Payment failed", {
        description: error.message || "Please try again",
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

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyPaymentLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              {invoice && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://explorer.testnet.mantle.xyz/address/${contractAddresses.InvoiceRegistry}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on Explorer
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Invoice Card */}
          <div className="rounded-xl border border-border bg-card p-8 shadow-lg">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold">Invoice #{invoiceId}</h1>
                <p className="mt-2 text-muted-foreground">
                  Created {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${
                  invoice.status === 3 ? "bg-success/10 text-success" :
                  invoice.status === 2 ? "bg-primary/10 text-primary" :
                  invoice.status === 1 ? "bg-warning/10 text-warning" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {invoice.status === 3 && <CheckCircle2 className="h-4 w-4" />}
                  {invoice.status === 2 && <Clock className="h-4 w-4" />}
                  <span className="font-medium">{STATUS_LABELS[invoice.status]}</span>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="mb-6 rounded-lg bg-secondary/50 p-6">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="mt-2 text-4xl font-bold">
                ${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                <span className="ml-2 text-xl font-normal text-muted-foreground">USDC</span>
              </p>
            </div>

            {/* Payment Actions */}
            {isBuyer && invoice.status < 2 && (
              <div className="space-y-4">
                {step === "approve" && needsApproval && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-warning" />
                        <div>
                          <h3 className="font-semibold">Step 1: Approve USDC</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Approve the Settlement Router to spend your USDC for payment.
                          </p>
                        </div>
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
                  <div className="space-y-4">
                    {!needsApproval && (
                      <div className="rounded-lg border border-success/20 bg-success/5 p-4">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <span className="font-medium">USDC Approved</span>
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
                  <div className="rounded-lg border border-success/20 bg-success/5 p-6 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
                    <h3 className="mt-4 text-xl font-semibold">Payment Complete!</h3>
                    <p className="mt-2 text-muted-foreground">
                      Your payment has been processed. Settlement is being finalized on-chain.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isBuyer && invoice.status < 2 && (
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-4">
                <p className="text-center text-muted-foreground">
                  This invoice is for a different address. Please connect the buyer wallet.
                </p>
              </div>
            )}

            {invoice.status >= 2 && (
              <div className="rounded-lg border border-success/20 bg-success/5 p-6">
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                  <span className="text-lg font-semibold">
                    {invoice.status === 3 ? "Invoice Cleared" : "Invoice Paid"}
                  </span>
                </div>
              </div>
            )}

            {/* Settlement Waterfall Preview */}
            {invoice.status >= 2 && (
              <div className="mt-8">
                <h3 className="mb-4 font-semibold">Settlement Breakdown</h3>
                <WaterfallAnimation
                  total={amountDisplay}
                  fee={amountDisplay * 0.005} // 0.5% fee
                  repayAmount={0} // TODO: Fetch from advance engine if financed
                  isFinanced={invoice.status === 1 || invoice.status === 2}
                  feePercentage={0.5}
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

