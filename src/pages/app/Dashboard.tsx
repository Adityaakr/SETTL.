import { motion } from "framer-motion"
import { useMemo, useEffect } from "react"
import { 
  FileText, 
  Plus, 
  TrendingUp, 
  ArrowUpRight, 
  Clock,
  DollarSign,
  CheckCircle2,
  Zap,
  Loader2
} from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { WaterfallAnimation } from "@/components/features/WaterfallAnimation"
import { useSellerInvoicesWithData, InvoiceStatus } from "@/hooks/useInvoice"
import { useReputation } from "@/hooks/useReputation"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { formatUnits } from "viem"

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

  // Calculate score from cleared invoices: base 450 + (20 points per cleared invoice)
  // This ensures the UI shows the correct score even if chain data is outdated
  const clearedInvoicesForScore = useMemo(() => {
    if (!invoices) return []
    return invoices.filter(inv => inv.status === 3) // Status 3 = Cleared
  }, [invoices])

  const calculatedScoreFromInvoices = useMemo(() => {
    const baseScore = 450 // Starting score (Tier C minimum)
    const pointsPerInvoice = 20
    return baseScore + (clearedInvoicesForScore.length * pointsPerInvoice)
  }, [clearedInvoicesForScore.length])

  // Use the higher of: hook score (from chain/frontend tracking) or calculated from invoices
  // This ensures we show the most accurate score
  // Convert score to number if it's a bigint
  const scoreNumber = score ? (typeof score === 'bigint' ? Number(score) : score) : 0
  const displayScore = useMemo(() => {
    const calculated = calculatedScoreFromInvoices
    const hookScore = scoreNumber > 0 ? scoreNumber : 450
    const finalScore = Math.max(hookScore, calculated)
    console.log('📊 Dashboard displayScore calculation:', { hookScore, calculated, finalScore, clearedCount: clearedInvoicesForScore.length })
    return finalScore
  }, [scoreNumber, calculatedScoreFromInvoices, clearedInvoicesForScore.length])
  
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

  // Get recent invoices (8 most recent to fit in the box)
  const recentInvoices = useMemo(() => {
    if (!invoices || invoices.length === 0) return []
    
    return invoices.slice(0, 8).map(invoice => {
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
    </motion.div>
  )
}
