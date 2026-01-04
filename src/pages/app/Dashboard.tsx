import { motion } from "framer-motion"
import { useMemo, useEffect, useState, useRef } from "react"
import { 
  FileText, 
  Plus, 
  TrendingUp, 
  ArrowUpRight, 
  Clock,
  DollarSign,
  CheckCircle2,
  Zap,
  Loader2,
  ArrowUpLeft,
  Copy,
  ExternalLink,
  Coins
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { WaterfallAnimation } from "@/components/features/WaterfallAnimation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSellerInvoicesWithData, InvoiceStatus } from "@/hooks/useInvoice"
import { useReputation } from "@/hooks/useReputation"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { usePrivyAccount } from "@/hooks/usePrivyAccount"
import { useSendTransaction, useWallets } from "@privy-io/react-auth"
import { useBalance, useWaitForTransactionReceipt } from "wagmi"
import { contractAddresses } from "@/lib/contracts"
import { DemoUSDCABI } from "@/lib/abis"
import { formatUnits, parseUnits, encodeFunctionData, isAddress } from "viem"
import { toast } from "sonner"

const STATUS_MAP: Record<InvoiceStatus, string> = {
  0: "issued",
  1: "financed",
  2: "paid",
  3: "cleared",
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export default function Dashboard() {
  const { invoices, isLoading: isLoadingInvoices, error: invoiceError } = useSellerInvoicesWithData()
  const { score, tierLabel, stats, isLoading: isLoadingReputation } = useReputation()
  const { balance: usdcBalance, isLoading: isLoadingBalance, error: balanceError } = useTokenBalance()
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)

  // Get cleared invoices (status === 3) - MUST BE BEFORE score calculation
  const clearedInvoices = useMemo(() => {
    if (!invoices) return []
    return invoices.filter(inv => inv.status === 3)
  }, [invoices])
  
  // Calculate score from cleared invoices count (more accurate than on-chain if reputation wasn't updated)
  // Formula: 450 (base) + (clearedCount × 20 points per invoice)
  const displayScore = useMemo(() => {
    const clearedCount = clearedInvoices.length
    const calculatedScoreFromInvoices = 450 + (clearedCount * 20)
    const hookScore = score > 0 ? score : 510
    const calculated = Math.max(hookScore, calculatedScoreFromInvoices)
    
    console.log('📊 Dashboard displayScore calculation:', {
      clearedCount,
      calculatedScoreFromInvoices,
      hookScore,
      finalDisplayScore: calculated,
      invoiceCount: invoices?.length,
      clearedInvoicesCount: clearedInvoices.length
    })
    
    return calculated
  }, [clearedInvoices, score, invoices?.length])
  
  // Calculate tier from score (score 510 should be Tier B)
  const displayTier = useMemo(() => {
    if (displayScore < 500) return 'C'
    if (displayScore < 850) return 'B'
    return 'A'
  }, [displayScore])
  
  // Use calculated tier for display (score 510 = Tier B)
  const effectiveTierLabel = displayTier

  // Log errors for debugging
  useEffect(() => {
    if (invoiceError) console.error('Dashboard: Invoice fetch error:', invoiceError)
    if (balanceError) console.error('Dashboard: Balance fetch error:', balanceError)
    console.log('Dashboard: Loading state', { isLoadingInvoices, isLoadingReputation, isLoadingBalance })
    console.log('Dashboard: Data state', { invoiceCount: invoices?.length, score, balance: usdcBalance })
  }, [invoiceError, balanceError, isLoadingInvoices, isLoadingReputation, isLoadingBalance, invoices, score, usdcBalance])

  // Calculate stats from invoices
  const statsData = useMemo(() => {
    if (!invoices || invoices.length === 0) {
      return {
        outstanding: 0,
        outstandingCount: 0,
        clearedVolume: 0,
        advanceEligible: 0,
      }
    }

    // Outstanding (only issued or financed that haven't been paid/cleared)
    // Status 0 = Issued, Status 1 = Financed (both are outstanding)
    // Status 2 = Paid (being settled, should NOT be in outstanding)
    // Status 3 = Cleared (settlement complete, should NOT be in outstanding)
    const outstandingInvoices = invoices.filter(
      inv => inv.status === 0 || inv.status === 1
    )
    const outstanding = outstandingInvoices.reduce((sum, inv) => {
      return sum + parseFloat(formatUnits(inv.amount, 6))
    }, 0)

    // Cleared volume (status === 3)
    const clearedInvoices = invoices.filter(inv => inv.status === 3)
    const clearedVolume = clearedInvoices.reduce((sum, inv) => {
      return sum + parseFloat(formatUnits(inv.amount, 6))
    }, 0)

    // Advance eligible (issued invoices, up to 90% LTV for tier A, 65% for tier B, 35% for tier C)
    const ltvMap: Record<string, number> = { A: 0.90, B: 0.65, C: 0.35 }
    const ltv = ltvMap[effectiveTierLabel] || 0.75
    const advanceEligible = outstandingInvoices.reduce((sum, inv) => {
      return sum + parseFloat(formatUnits(inv.amount, 6)) * ltv
    }, 0)

    return {
      outstanding,
      outstandingCount: outstandingInvoices.length,
      clearedVolume,
      advanceEligible,
    }
  }, [invoices, effectiveTierLabel])

  // Get recent invoices (4 most recent)
  const recentInvoices = useMemo(() => {
    if (!invoices || invoices.length === 0) return []
    
    return invoices.slice(0, 6).map(invoice => {
      const invoiceDate = new Date(Number(invoice.createdAt) * 1000)
      const amount = parseFloat(formatUnits(invoice.amount, 6))
      
      return {
        id: `INV-${invoice.invoiceId.toString().padStart(6, '0')}`,
        invoiceId: invoice.invoiceId,
        buyer: `${invoice.buyer.slice(0, 6)}...${invoice.buyer.slice(-4)}`,
        amount,
        status: STATUS_MAP[invoice.status] as "issued" | "financed" | "paid" | "cleared",
        date: invoiceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }
    })
  }, [invoices])
  
  // Calculate progress to next tier (Tier A for Tier B users)
  const progressToNextTier = useMemo(() => {
    const tierThresholds = { C: 450, B: 500, A: 850 }
    const currentThreshold = tierThresholds[effectiveTierLabel as keyof typeof tierThresholds] || 500
    const nextTier = effectiveTierLabel === 'C' ? 'B' : effectiveTierLabel === 'B' ? 'A' : null
    const nextThreshold = nextTier ? tierThresholds[nextTier as keyof typeof tierThresholds] : 1000
    
    if (!nextTier) return 100
    
    const progress = ((displayScore - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    return Math.max(0, Math.min(100, progress))
  }, [displayScore, effectiveTierLabel])

  const pointsToNextTier = useMemo(() => {
    const tierThresholds = { C: 450, B: 500, A: 850 }
    const currentThreshold = tierThresholds[effectiveTierLabel as keyof typeof tierThresholds] || 500
    const nextTier = effectiveTierLabel === 'C' ? 'B' : effectiveTierLabel === 'B' ? 'A' : null
    const nextThreshold = nextTier ? tierThresholds[nextTier as keyof typeof tierThresholds] : 1000
    
    if (!nextTier) return 0
    
    const needed = nextThreshold - displayScore
    return Math.max(0, needed)
  }, [displayScore, effectiveTierLabel])

  // Max LTV based on tier
  const maxLTV = useMemo(() => {
    const ltvMap: Record<string, number> = { A: 90, B: 65, C: 35 }
    return ltvMap[effectiveTierLabel] || 65
  }, [effectiveTierLabel])

  const isLoading = isLoadingInvoices || isLoadingReputation

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Page header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back. Here's an overview of your activity.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* USDC Balance */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-sm font-semibold">
                {isLoadingBalance ? "..." : `${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setWithdrawDialogOpen(true)}
            disabled={isLoadingBalance}
          >
            <ArrowUpLeft className="h-4 w-4 mr-2" />
            Withdraw
          </Button>
          <Button variant="hero" asChild>
            <Link to="/app/invoices/new">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={item} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Outstanding"
          value={isLoading ? "..." : `$${statsData.outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={isLoading ? "Loading..." : `${statsData.outstandingCount} invoice${statsData.outstandingCount !== 1 ? 's' : ''} pending`}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Cleared Volume"
          value={isLoading ? "..." : `$${statsData.clearedVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={isLoading ? "Loading..." : "All time"}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Advance Eligible"
          value={isLoading ? "..." : `$${statsData.advanceEligible.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          subtitle={isLoading ? "Loading..." : `Up to ${maxLTV}% LTV`}
          icon={Zap}
          variant="primary"
        />
        <StatCard
          title="Reputation Score"
          value={isLoading ? "..." : displayScore.toString()}
          subtitle={isLoading ? "Loading..." : `Tier ${effectiveTierLabel}`}
          icon={TrendingUp}
        />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent invoices */}
        <motion.div 
          variants={item}
          className="rounded-xl border border-border bg-card shadow-md"
        >
          <div className="flex items-center justify-between border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-secondary p-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">Recent Invoices</h2>
                <p className="text-sm text-muted-foreground">Your latest activity</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/invoices">
                View All
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          
          <div className="divide-y divide-border">
            {isLoadingInvoices ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading invoices...</span>
              </div>
            ) : recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No invoices yet</p>
                <Button asChild size="sm">
                  <Link to="/app/invoices/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Invoice
                  </Link>
                </Button>
              </div>
            ) : (
              recentInvoices.map((invoice) => (
                <Link 
                  key={invoice.id}
                  to={`/app/invoices/${invoice.invoiceId}`}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{invoice.buyer}</p>
                      <p className="text-sm text-muted-foreground">{invoice.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold number-display">${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-sm text-muted-foreground">{invoice.date}</p>
                    </div>
                    <StatusBadge status={invoice.status}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </StatusBadge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* Quick actions / Reputation preview */}
        <motion.div variants={item} className="space-y-6">
          {/* Reputation card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-md">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-semibold">Reputation Score</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/app/reputation">View Details</Link>
              </Button>
            </div>
            
            {isLoadingReputation ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-end gap-4">
                  <span className="text-5xl font-bold gradient-text">{displayScore}</span>
                  <span className="mb-2 text-sm text-muted-foreground">/ 1000</span>
                </div>

                {/* Progress bar */}
                {effectiveTierLabel !== 'A' && (
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress to Tier {effectiveTierLabel === 'C' ? 'B' : 'A'}</span>
                      <span className="font-medium">{pointsToNextTier} points to go</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-secondary">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${progressToNextTier}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 rounded-lg bg-secondary/50 p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Tier</p>
                    <p className="font-semibold">Tier {effectiveTierLabel}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Max LTV</p>
                    <p className="font-semibold">{maxLTV}%</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick financing */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 shadow-md">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">Need Cash Now?</h2>
                <p className="text-sm text-muted-foreground">Get instant advances on your invoices</p>
              </div>
            </div>
            
            <div className="mb-4 rounded-lg bg-card p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available to advance</span>
                <span className="font-bold text-primary">
                  {isLoading ? "..." : `$${statsData.advanceEligible.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated APR</span>
                <span className="font-medium">
                  {effectiveTierLabel === 'A' ? '6-8%' : effectiveTierLabel === 'B' ? '8-12%' : '18%'}
                </span>
              </div>
            </div>

            <Button variant="hero" className="w-full" asChild>
              <Link to="/app/financing">
                Request Advance
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Waterfall preview */}
      <motion.div variants={item}>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Settlement Waterfall</h2>
          <p className="text-muted-foreground">See how payments are automatically distributed</p>
        </div>
        <WaterfallAnimation 
          totalAmount={10000}
          feeAmount={50}
          repayAmount={2450}
          sellerAmount={7500}
        />
      </motion.div>

      {/* Withdraw Dialog */}
      <WithdrawDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        usdcBalance={usdcBalance}
        usdcRawBalance={0}
      />
    </motion.div>
  )
}

function WithdrawDialog({
  open,
  onOpenChange,
  usdcBalance,
  usdcRawBalance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  usdcBalance: number
  usdcRawBalance: number
}) {
  const { address } = usePrivyAccount()
  const { sendTransaction } = useSendTransaction()
  const { wallets } = useWallets()
  const [tokenType, setTokenType] = useState<"USDC" | "MNT">("USDC")
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [toAddress, setToAddress] = useState("")
  const [hash, setHash] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const withdrawSuccessToastShown = useRef<string | null>(null)

  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || ''
    const wct = w.walletClientType?.toLowerCase() || ''
    return ct === 'embedded' || wct === 'privy' || ct.includes('privy') || ct.includes('embedded')
  }) || wallets[0]

  // Get MNT native balance
  const { data: mntBalance, isLoading: isLoadingMNT } = useBalance({
    address: address as `0x${string}` | undefined,
    query: {
      enabled: !!address && tokenType === "MNT",
    },
  })

  const mntBalanceFormatted = mntBalance ? parseFloat(formatUnits(mntBalance.value, 18)) : 0

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}` | undefined,
    chainId: 5003,
    query: {
      enabled: !!hash,
      retry: 3,
      retryDelay: 2000,
    },
  })

  // Get current balance based on token type
  const currentBalance = tokenType === "USDC" ? usdcBalance : mntBalanceFormatted
  const isLoadingBalance = tokenType === "USDC" ? false : isLoadingMNT

  // Handle withdraw success
  useEffect(() => {
    if (hash && isSuccess && withdrawSuccessToastShown.current !== hash) {
      withdrawSuccessToastShown.current = hash
      
      const copyToClipboard = () => {
        navigator.clipboard.writeText(hash)
        toast.success("Transaction hash copied!")
      }
      
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-500 flex-shrink-0" />
          <span className="font-semibold">Withdrawal Successful!</span>
        </div>,
        {
          description: (
            <div className="space-y-3 mt-2">
               <p className="font-medium text-sm">Your withdrawal of {withdrawAmount} {tokenType} has been successfully sent to {toAddress.slice(0, 6)}...{toAddress.slice(-4)}.</p>
              
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">TRANSACTION HASH</span>
                  <div className="relative">
                    <Input
                      type="text"
                      value={hash}
                      readOnly
                      className="font-mono text-xs pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard();
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                <Button asChild className="w-full mt-4">
                  <a
                    href={`https://explorer.testnet.mantle.xyz/tx/${hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Explorer
                  </a>
                </Button>
                <Button variant="outline" className="w-full mt-2" onClick={() => {
                  setWithdrawAmount("")
                  setToAddress("")
                  onOpenChange(false)
                }}>
                  Done
                </Button>
              </div>
            </div>
          ),
          duration: 10000,
          id: 'withdraw-success',
        }
      )
      
      setWithdrawAmount("")
      setToAddress("")
      onOpenChange(false)
    }
  }, [hash, isSuccess, isConfirming, withdrawAmount, tokenType, toAddress, onOpenChange])

  const handleWithdraw = async () => {
    if (!withdrawAmount) {
      toast.error("Enter withdrawal amount")
      return
    }

    if (!toAddress || !isAddress(toAddress)) {
      toast.error("Invalid address", {
        description: "Please enter a valid Ethereum address",
      })
      return
    }

    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount", {
        description: "Amount must be greater than 0",
      })
      return
    }

    if (amount > currentBalance) {
       toast.error("Insufficient balance", {
         description: `You have ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenType} available`,
       })
      return
    }

    if (!embeddedWallet) {
      toast.error("No wallet available", {
        description: "Please connect your Privy embedded wallet",
      })
      return
    }

    setIsPending(true)
    setHash(null)

    try {
      if (tokenType === "USDC") {
        // Transfer USDC (ERC20 transfer)
        if (!contractAddresses.DemoUSDC) {
          throw new Error("USDC contract address not configured")
        }

        const amountBigInt = parseUnits(withdrawAmount, 6) // USDC has 6 decimals
        
        const data = encodeFunctionData({
          abi: DemoUSDCABI,
          functionName: "transfer",
          args: [toAddress as `0x${string}`, amountBigInt],
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

        setHash(result.hash)
      } else {
        // Transfer MNT (native token)
        const amountBigInt = parseUnits(withdrawAmount, 18) // MNT has 18 decimals
        
        const result = await sendTransaction(
          {
            to: toAddress as `0x${string}`,
            data: "0x" as `0x${string}`,
            value: amountBigInt,
            chainId: 5003,
          },
          {
            address: embeddedWallet.address,
            uiOptions: {
              showWalletUIs: false,
            },
          }
        )

        setHash(result.hash)
      }

      setIsPending(false)
    } catch (error: any) {
      setIsPending(false)
      toast.error("Withdrawal failed", {
        description: error.message || "Please try again",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Withdraw Funds</DialogTitle>
           <DialogDescription>
             Send tokens to any address. Gas fees are paid in MNT (Mantle).
           </DialogDescription>
         </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Token Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="tokenType">Token Type</Label>
            <Select value={tokenType} onValueChange={(value: "USDC" | "MNT") => {
              setTokenType(value)
              setWithdrawAmount("") // Reset amount when changing token type
            }}>
              <SelectTrigger id="tokenType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDC">USDC</SelectItem>
                <SelectItem value="MNT">MNT (Native)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Current Balance */}
          <div className="rounded-lg border border-border bg-secondary/50 p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Available Balance</span>
               <span className="text-lg font-semibold">
                 {isLoadingBalance ? "..." : `${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${tokenType}`}
               </span>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="toAddress">Recipient Address</Label>
            <Input
              id="toAddress"
              type="text"
              placeholder="0x..."
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              disabled={isPending || isConfirming}
            />
          </div>

          {/* Withdraw Amount Input */}
          <div className="space-y-2">
             <Label htmlFor="withdrawAmount">Amount to Withdraw</Label>
            <Input
              id="withdrawAmount"
              type="number"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              min="0"
              step="0.01"
              disabled={isPending || isConfirming || isLoadingBalance}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWithdrawAmount((currentBalance * 0.25).toFixed(2))}
                disabled={currentBalance === 0 || isLoadingBalance}
              >
                25%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWithdrawAmount((currentBalance * 0.5).toFixed(2))}
                disabled={currentBalance === 0 || isLoadingBalance}
              >
                50%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWithdrawAmount((currentBalance * 0.75).toFixed(2))}
                disabled={currentBalance === 0 || isLoadingBalance}
              >
                75%
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWithdrawAmount(currentBalance.toFixed(2))}
                disabled={currentBalance === 0 || isLoadingBalance}
              >
                Max
              </Button>
            </div>
          </div>

          {/* Withdraw Button */}
          <Button
            onClick={handleWithdraw}
            disabled={!withdrawAmount || !toAddress || isPending || isConfirming || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > currentBalance || isLoadingBalance}
            className="w-full"
            variant="default"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isPending ? "Waiting for wallet..." : "Processing..."}
              </>
            ) : (
               <>
                 <ArrowUpLeft className="mr-2 h-4 w-4" />
                 Send {withdrawAmount || "0"} {tokenType}
               </>
             )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
