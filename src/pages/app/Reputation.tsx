import { motion } from "framer-motion"
import { 
  Award, 
  TrendingUp, 
  FileCheck, 
  Clock, 
  AlertTriangle,
  Info,
  CheckCircle2,
  Lock,
  Loader2
} from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useReputation } from "@/hooks/useReputation"
import { useSellerInvoicesWithData } from "@/hooks/useInvoice"
import { formatUnits } from "viem"
import { useMemo } from "react"

// Tier definitions matching contract logic
const tiers = [
  { 
    name: "Tier C", 
    minScore: 0, 
    maxScore: 510,  // Tier C: 0-499 (actually 0-450 but showing up to 499)
    maxLTV: "35%", 
    apr: "18%",
  },
  { 
    name: "Tier B", 
    minScore: 510,  // Tier B: 500-850 (as shown in UI)
    maxScore: 850,
    maxLTV: "55%", 
    apr: "10-14%",
  },
  { 
    name: "Tier A", 
    minScore: 850,  // Tier A: 850-1000
    maxScore: 1000, 
    maxLTV: "85%", 
    apr: "6-10%",
  },
]

export default function Reputation() {
  const { score, tierLabel, stats, isLoading: isLoadingReputation } = useReputation()
  const { invoices, isLoading: isLoadingInvoices } = useSellerInvoicesWithData()
  
  // Use score from hook (includes frontend tracking updates for real-time score changes)
  // The useReputation hook now tracks cleared invoices in real-time and updates the score
  // Default to 510 (Tier B) for now, then updates from there
  const currentScore = score > 0 ? score : 510
  
  // Determine current tier based on score
  // Tier C: 0-450, Tier B: 500-850, Tier A: 850-1000
  // Note: Scores 451-499 are still Tier C (until they reach 500 for Tier B)
  const currentTier = useMemo(() => {
    if (currentScore < 500) return 'C'  // Tier C: 0-499 (but UI shows 0-450)
    if (currentScore < 850) return 'B'  // Tier B: 500-849
    return 'A'  // Tier A: 850-1000
  }, [currentScore])
  
  // Get next tier threshold
  const nextTierScore = useMemo(() => {
    if (currentTier === 'C') return 500  // Next is Tier B (starts at 500)
    if (currentTier === 'B') return 850  // Next is Tier A (starts at 850)
    return 1000  // Max tier
  }, [currentTier])
  
  // Get cleared invoices (status === 3) to calculate stats
  const clearedInvoices = useMemo(() => {
    if (!invoices) return []
    return invoices.filter(inv => inv.status === 3)
  }, [invoices])
  
  // Calculate stats from cleared invoices
  const calculatedStats = useMemo(() => {
    const clearedCount = clearedInvoices.length
    const totalVolume = clearedInvoices.reduce((sum, inv) => {
      return sum + parseFloat(formatUnits(inv.amount, 6))
    }, 0)
    
    return {
      invoicesCleared: clearedCount,
      totalVolume,
      // Use on-chain stats if available, otherwise use calculated
      score: stats?.score ? Number(stats.score) : currentScore,
      invoicesClearedCount: stats?.invoicesCleared ? Number(stats.invoicesCleared) : clearedCount,
      totalVolumeAmount: stats?.totalVolume ? Number(stats.totalVolume) / 1e6 : totalVolume, // stats stores in 6 decimals
    }
  }, [clearedInvoices, stats, currentScore])
  
  // Generate score history from cleared invoices (most recent first)
  const scoreHistory = useMemo(() => {
    const recentCleared = clearedInvoices
      .sort((a, b) => {
        const aTime = a.clearedAt ? Number(a.clearedAt) : 0
        const bTime = b.clearedAt ? Number(b.clearedAt) : 0
        return bTime - aTime
      })
      .slice(0, 5) // Show last 5 cleared invoices
    
    return recentCleared.map(inv => {
      const date = inv.clearedAt 
        ? new Date(Number(inv.clearedAt) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'N/A'
      
      return {
        event: `Invoice INV-${inv.invoiceId.toString().padStart(10, '0')} cleared`,
        change: 20, // 20 points per repayment
        date,
      }
    })
  }, [clearedInvoices])
  
  const isLoading = isLoadingReputation || isLoadingInvoices

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reputation</h1>
        <p className="text-muted-foreground">
          Your on-chain reputation score and unlock progression
        </p>
      </div>

      {/* Main score card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-8 shadow-md">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Your Reputation Score</p>
              <div className="flex items-end gap-4">
                {isLoading ? (
                  <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <span className="text-6xl font-bold gradient-text">{currentScore}</span>
                    <span className="mb-2 text-xl text-muted-foreground">/ 1000</span>
                  </>
                )}
              </div>
              {!isLoading && (
                <div className="mt-2 flex items-center gap-2 text-success">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Tier {currentTier} • {tierLabel}</span>
                </div>
              )}
            </div>
            <div className="rounded-xl bg-primary/10 p-4">
              <Award className="h-10 w-10 text-primary" />
            </div>
          </div>

          {/* Progress to next tier */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progress to Tier {currentTier === 'C' ? 'B' : currentTier === 'B' ? 'A' : 'A+'}</span>
              <span className="text-muted-foreground">
                {!isLoading && currentScore < nextTierScore ? `${nextTierScore - currentScore} points to go` : 'Max tier reached'}
              </span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-secondary">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(currentScore / 1000) * 100}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span className="text-primary font-medium">Tier C (450)</span>
              <span>Tier B (500)</span>
              <span>Tier A (850)</span>
              <span>1000</span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <StatCard
            title="Invoices Cleared"
            value={isLoading ? "..." : calculatedStats.invoicesClearedCount.toString()}
            icon={FileCheck}
            variant="success"
          />
          <StatCard
            title="Total Volume"
            value={isLoading ? "..." : `$${calculatedStats.totalVolumeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            variant="primary"
          />
          <StatCard
            title="Current Tier"
            value={isLoading ? "..." : `Tier ${currentTier}`}
            icon={Award}
          />
        </div>
      </div>

      {/* Tier ladder */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-md">
        <div className="mb-6 flex items-center gap-2">
          <h2 className="text-lg font-semibold">Unlock Ladder</h2>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-sm">
                Higher tiers unlock better financing terms including higher LTV and lower APR
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier, index) => {
            const isCurrentTier = currentTier === tier.name.replace('Tier ', '')
            const isUnlocked = currentScore >= tier.minScore
            
            return (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-xl border p-5 transition-all ${
                isCurrentTier
                  ? "border-primary bg-primary/5 shadow-md"
                  : isUnlocked
                  ? "border-border bg-card"
                  : "border-border bg-secondary/30"
              }`}
            >
              {isCurrentTier && (
                <div className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Current
                </div>
              )}
              
              <div className="mb-3 flex items-center justify-between">
                <span className="text-lg font-bold">{tier.name}</span>
                {isUnlocked ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <Lock className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Score Range</span>
                  <span className="font-medium">{tier.minScore}-{tier.maxScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max LTV</span>
                  <span className="font-medium">{tier.maxLTV}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">APR Range</span>
                  <span className="font-medium">{tier.apr}</span>
                </div>
              </div>
            </motion.div>
            )
          })}
        </div>
      </div>

      {/* Score history */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-md">
        <h2 className="mb-6 text-lg font-semibold">Recent Score Changes</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : scoreHistory.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No cleared invoices yet. Clear invoices to earn reputation points.
          </div>
        ) : (
        <div className="space-y-4">
          {scoreHistory.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between rounded-lg bg-secondary/30 p-4"
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-2 ${
                  item.change > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {item.change > 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <FileCheck className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{item.event}</p>
                  <p className="text-sm text-muted-foreground">{item.date}</p>
                </div>
              </div>
              {item.change !== 0 && (
                <span className={`font-bold ${
                  item.change > 0 ? "text-success" : "text-destructive"
                }`}>
                  {item.change > 0 ? "+" : ""}{item.change} pts
                </span>
              )}
            </motion.div>
          ))}
        </div>
        )}
      </div>

      {/* Score explanation */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <h3 className="mb-3 font-semibold">How Your Score is Calculated</h3>
        <p className="text-muted-foreground mb-4">
          Your reputation score is calculated transparently using the following on-chain metrics:
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-card p-4">
            <p className="text-sm font-medium text-primary">Invoices Cleared</p>
            <p className="text-2xl font-bold">{isLoading ? "..." : calculatedStats.invoicesClearedCount}</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-sm font-medium text-primary">Total Volume</p>
            <p className="text-2xl font-bold">
              {isLoading ? "..." : `$${calculatedStats.totalVolumeAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-sm font-medium text-primary">Reputation Score</p>
            <p className="text-2xl font-bold">{isLoading ? "..." : currentScore}</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-sm font-medium text-primary">Current Tier</p>
            <p className="text-2xl font-bold">{isLoading ? "..." : `Tier ${currentTier}`}</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-sm font-medium text-primary">Points per Repayment</p>
            <p className="text-2xl font-bold">+20</p>
          </div>
          <div className="rounded-lg bg-card p-4">
            <p className="text-sm font-medium text-primary">Next Tier</p>
            <p className="text-2xl font-bold text-success">
              {isLoading ? "..." : currentScore < nextTierScore ? `${nextTierScore - currentScore} pts` : "Max"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
