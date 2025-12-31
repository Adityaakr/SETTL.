import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { TrendingUp, Coins, Wallet, ArrowRight } from "lucide-react"

interface WaterfallAnimationProps {
  totalAmount?: number
  feeAmount?: number
  repayAmount?: number
  sellerAmount?: number
  showLabels?: boolean
  className?: string
  // New props for clarity
  isFinanced?: boolean
  advanceAmount?: number
  principalAmount?: number
  interestAmount?: number
  feePercentage?: number
}

export function WaterfallAnimation({
  totalAmount = 10000,
  feeAmount = 50,
  repayAmount = 2450,
  sellerAmount = 7500,
  showLabels = true,
  className,
  isFinanced = true,
  advanceAmount,
  principalAmount,
  interestAmount,
  feePercentage = 0.5,
}: WaterfallAnimationProps) {
  // Calculate principal and interest if not provided
  const principal = principalAmount ?? (isFinanced && repayAmount > 0 ? repayAmount - (interestAmount ?? 50) : 0)
  const interest = interestAmount ?? (isFinanced && repayAmount > 0 ? repayAmount - principal : 0)
  
  // Use advanceAmount if provided, otherwise calculate from repayAmount
  const advancePaid = advanceAmount ?? (isFinanced && principal > 0 ? principal : undefined)
  
  // Calculate actual seller amount if not financed (should be totalAmount - feeAmount)
  const actualSellerAmount = isFinanced ? sellerAmount : (totalAmount - feeAmount)
  
  const total = feeAmount + (isFinanced ? repayAmount : 0) + actualSellerAmount
  const feePercent = total > 0 ? (feeAmount / total) * 100 : 0
  const repayPercent = total > 0 && isFinanced ? (repayAmount / total) * 100 : 0
  const sellerPercent = total > 0 ? (actualSellerAmount / total) * 100 : (feePercent < 100 ? 100 - feePercent : 100)

  return (
    <div className={cn("mx-auto max-w-4xl", className)}>
      <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card to-card/95 p-8 md:p-10 shadow-xl backdrop-blur-sm">
        {/* Enhanced Header */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Settlement Waterfall
            </p>
            <motion.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold number-display bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent"
            >
              ${totalAmount.toLocaleString()}
              <span className="ml-2 text-2xl md:text-3xl text-muted-foreground font-medium">USDC</span>
            </motion.p>
          </motion.div>
        </div>

        {/* Enhanced Animated Flow Visualization */}
        <div className="relative mb-10">
          {/* Flow arrows between segments */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-muted-foreground/50"
            >
              <ArrowRight className="h-5 w-5" />
            </motion.div>
            <div className="flex-1">
              {/* Enhanced progress bar with better styling */}
              <div className="relative h-8 w-full overflow-hidden rounded-2xl bg-secondary/80 shadow-inner">
                {/* Animated segments with gradients */}
                <div className="flex h-full">
                  {/* Protocol Fee Segment */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${feePercent}%` }}
                    transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
                    className="relative h-full overflow-hidden bg-gradient-to-r from-slate-500 to-slate-600"
                  >
                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
                    />
                  </motion.div>
                  
                  {/* Pool Repayment Segment */}
                  {isFinanced && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${repayPercent}%` }}
                      transition={{ duration: 1, delay: 0.7, ease: "easeOut" }}
                      className="relative h-full overflow-hidden bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        animate={{ x: "200%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 2, delay: 0.5 }}
                      />
                    </motion.div>
                  )}
                  
                  {/* Seller Receives Segment */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${sellerPercent}%` }}
                    transition={{ duration: 1, delay: isFinanced ? 1 : 0.7, ease: "easeOut" }}
                    className="relative h-full overflow-hidden bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 2, delay: 1 }}
                    />
                  </motion.div>
                </div>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-emerald-500"
            >
              <TrendingUp className="h-5 w-5" />
            </motion.div>
          </div>

          {/* Percentage labels below bar */}
          <div className="flex justify-between text-xs font-medium text-muted-foreground mt-2">
            {feePercent > 2 && (
              <span>{feePercent.toFixed(1)}%</span>
            )}
            {isFinanced && repayPercent > 2 && (
              <span>{repayPercent.toFixed(1)}%</span>
            )}
            {sellerPercent > 2 && (
              <span className="ml-auto">{sellerPercent.toFixed(1)}%</span>
            )}
          </div>
        </div>

        {/* Enhanced Breakdown Cards */}
        {showLabels && (
          <div className={cn("grid gap-6", isFinanced ? "md:grid-cols-3" : "md:grid-cols-2")}>
            <WaterfallSegment
              icon={<Coins className="h-5 w-5" />}
              label="Protocol Fee"
              amount={feeAmount}
              color="from-slate-500 to-slate-600"
              bgColor="bg-slate-500/10"
              borderColor="border-slate-500/30"
              delay={0.4}
              description={`${feePercentage}% estimated protocol fee`}
            />
            {isFinanced && (
              <WaterfallSegment
                icon={<Wallet className="h-5 w-5" />}
                label="Pool Repayment (LPs)"
                amount={repayAmount}
                color="from-blue-500 to-blue-600"
                bgColor="bg-blue-500/10"
                borderColor="border-blue-500/30"
                delay={0.7}
                description="Repays funding pool (principal + interest)"
                principal={principal}
                interest={interest}
              />
            )}
            <WaterfallSegment
              icon={<TrendingUp className="h-5 w-5" />}
              label="Seller Receives (at Settlement)"
              amount={actualSellerAmount}
              color="from-emerald-500 to-green-500"
              bgColor="bg-emerald-500/10"
              borderColor="border-emerald-500/30"
              delay={isFinanced ? 1 : 0.7}
              description="Net proceeds"
              highlight
              advancePaid={advancePaid}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function WaterfallSegment({
  icon,
  label,
  amount,
  color,
  bgColor,
  borderColor,
  delay,
  description,
  highlight = false,
  principal,
  interest,
  advancePaid,
}: {
  icon?: React.ReactNode
  label: string
  amount: number
  color: string
  bgColor: string
  borderColor: string
  delay: number
  description: string
  highlight?: boolean
  principal?: number
  interest?: number
  advancePaid?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 p-6 transition-all duration-300",
        highlight 
          ? `border-emerald-500/40 ${bgColor} shadow-lg shadow-emerald-500/10 hover:shadow-xl hover:shadow-emerald-500/20` 
          : `border-border/50 bg-card/50 hover:bg-card/80 shadow-md hover:shadow-lg`
      )}
    >
      {/* Subtle background gradient */}
      <div className={cn("absolute inset-0 opacity-5 bg-gradient-to-br", color)} />
      
      {/* Content */}
      <div className="relative">
        {/* Icon and Label */}
        <div className="mb-4 flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: delay + 0.1, type: "spring" }}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
              color,
              highlight ? "shadow-emerald-500/30" : "shadow-slate-500/20"
            )}
          >
            <div className="text-white">
              {icon || <div className={cn("h-3 w-3 rounded-full bg-white")} />}
            </div>
          </motion.div>
          <div className="flex-1">
            <p className={cn(
              "text-sm font-semibold",
              highlight ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            )}>
              {label}
            </p>
          </div>
        </div>

        {/* Amount */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay + 0.2 }}
          className={cn(
            "mb-2 text-3xl font-bold number-display",
            highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}
        >
          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </motion.p>

        {/* Description */}
        <p className="mb-4 text-xs font-medium text-muted-foreground">{description}</p>
        
        {/* Breakdown details */}
        {(principal !== undefined && interest !== undefined) || advancePaid !== undefined ? (
          <div className="space-y-2 border-t border-border/50 pt-4">
            {/* Principal and Interest Breakdown */}
            {principal !== undefined && interest !== undefined && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Principal:</span>
                  <span className="font-semibold text-foreground">
                    ${principal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Interest:</span>
                  <span className="font-semibold text-foreground">
                    ${interest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
            
            {/* Advance Already Paid */}
            {advancePaid !== undefined && (
              <div className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 border border-emerald-500/20">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    Advance already paid:
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    ${advancePaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : highlight && advancePaid === undefined && (
          <div className="mt-2 border-t border-border/50 pt-4">
            <p className="text-xs text-muted-foreground italic">No financing used</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
