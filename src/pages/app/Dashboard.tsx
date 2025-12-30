import { motion } from "framer-motion"
import { useMemo } from "react"
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
  const { invoices, isLoading: isLoadingInvoices } = useSellerInvoicesWithData()
  const { score, tierLabel, stats, isLoading: isLoadingReputation } = useReputation()
  const { balance: usdcBalance, isLoading: isLoadingBalance } = useTokenBalance()

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

    // Outstanding (issued or financed)
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

    // Advance eligible (issued invoices, up to 85% LTV for tier A, 55% for tier B, 25% for tier C)
    const ltvMap: Record<string, number> = { A: 0.85, B: 0.55, C: 0.25 }
    const ltv = ltvMap[tierLabel] || 0.75
    const advanceEligible = outstandingInvoices.reduce((sum, inv) => {
      return sum + parseFloat(formatUnits(inv.amount, 6)) * ltv
    }, 0)

    return {
      outstanding,
      outstandingCount: outstandingInvoices.length,
      clearedVolume,
      advanceEligible,
    }
  }, [invoices, tierLabel])

  // Get recent invoices (4 most recent)
  const recentInvoices = useMemo(() => {
    if (!invoices || invoices.length === 0) return []
    
    return invoices.slice(0, 4).map(invoice => {
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

  // Calculate progress to next tier (simplified)
  const progressToNextTier = useMemo(() => {
    const tierThresholds = { C: 0, B: 500, A: 900 }
    const currentThreshold = tierThresholds[tierLabel as keyof typeof tierThresholds] || 0
    const nextTier = tierLabel === 'C' ? 'B' : tierLabel === 'B' ? 'A' : null
    const nextThreshold = nextTier ? tierThresholds[nextTier as keyof typeof tierThresholds] : 1000
    
    if (!nextTier) return 100
    
    const progress = ((score - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    return Math.max(0, Math.min(100, progress))
  }, [score, tierLabel])

  const pointsToNextTier = useMemo(() => {
    const tierThresholds = { C: 0, B: 500, A: 900 }
    const currentThreshold = tierThresholds[tierLabel as keyof typeof tierThresholds] || 0
    const nextTier = tierLabel === 'C' ? 'B' : tierLabel === 'B' ? 'A' : null
    const nextThreshold = nextTier ? tierThresholds[nextTier as keyof typeof tierThresholds] : 1000
    
    if (!nextTier) return 0
    
    const needed = nextThreshold - score
    return Math.max(0, needed)
  }, [score, tierLabel])

  // Max LTV based on tier
  const maxLTV = useMemo(() => {
    const ltvMap: Record<string, number> = { A: 85, B: 55, C: 25 }
    return ltvMap[tierLabel] || 55
  }, [tierLabel])

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
          value={isLoading ? "..." : score.toString()}
          subtitle={isLoading ? "Loading..." : `Tier ${tierLabel}`}
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
                  <span className="text-5xl font-bold gradient-text">{score}</span>
                  <span className="mb-2 text-sm text-muted-foreground">/ 1000</span>
                </div>

                {/* Progress bar */}
                {tierLabel !== 'A' && (
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress to Tier {tierLabel === 'C' ? 'B' : 'A'}</span>
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
                    <p className="font-semibold">Tier {tierLabel}</p>
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
                  {tierLabel === 'A' ? '6-8%' : tierLabel === 'B' ? '8-12%' : '12-16%'}
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
