import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

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
    <div className={cn("mx-auto max-w-3xl", className)}>
      <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Settlement Waterfall</p>
          <p className="text-3xl font-bold number-display">
            ${totalAmount.toLocaleString()} <span className="text-lg text-muted-foreground">USDC</span>
          </p>
        </div>

        {/* Animated flow visualization */}
        <div className="relative mb-8">
          {/* Track background */}
          <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
            {/* Animated segments */}
            <div className="flex h-full">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${feePercent}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full bg-muted-foreground"
              />
              {isFinanced && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${repayPercent}%` }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="h-full bg-info"
                />
              )}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${sellerPercent}%` }}
                transition={{ duration: 0.8, delay: isFinanced ? 0.8 : 0.5 }}
                className="h-full bg-gradient-to-r from-primary to-accent"
              />
            </div>
          </div>

          {/* Flowing particle effect */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              className="absolute h-full w-8 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              initial={{ x: "-100%" }}
              animate={{ x: "500%" }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
            />
          </div>
        </div>

        {/* Breakdown cards */}
        {showLabels && (
          <div className={cn("grid gap-4", isFinanced ? "md:grid-cols-3" : "md:grid-cols-2")}>
            <WaterfallSegment
              label="Protocol Fee"
              amount={feeAmount}
              color="bg-muted-foreground"
              delay={0.2}
              description={`${feePercentage}% estimated protocol fee`}
            />
            {isFinanced && (
              <WaterfallSegment
                label="Pool Repayment (LPs)"
                amount={repayAmount}
                color="bg-info"
                delay={0.5}
                description="Repays funding pool (principal + interest)"
                principal={principal}
                interest={interest}
              />
            )}
            <WaterfallSegment
              label="Seller Receives (at Settlement)"
              amount={actualSellerAmount}
              color="bg-gradient-to-r from-primary to-accent"
              delay={isFinanced ? 0.8 : 0.5}
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
  label,
  amount,
  color,
  delay,
  description,
  highlight = false,
  principal,
  interest,
  advancePaid,
}: {
  label: string
  amount: number
  color: string
  delay: number
  description: string
  highlight?: boolean
  principal?: number
  interest?: number
  advancePaid?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "rounded-xl border p-4 transition-all",
        highlight 
          ? "border-primary/30 bg-primary/5 shadow-md" 
          : "border-border bg-secondary/50"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className={cn("h-3 w-3 rounded-full", color)} />
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn(
        "text-xl font-bold number-display",
        highlight && "text-primary"
      )}>
        ${amount.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      
      {/* Show principal and interest breakdown for pool repayment */}
      {principal !== undefined && interest !== undefined && (
        <div className="mt-2 space-y-1 border-t border-border/50 pt-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Principal:</span>
            <span className="font-medium">${principal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Interest:</span>
            <span className="font-medium">${interest.toLocaleString()}</span>
          </div>
        </div>
      )}
      
      {/* Show advance already paid for seller receives */}
      {advancePaid !== undefined && (
        <div className="mt-2 border-t border-border/50 pt-2 text-xs">
          <p className="text-muted-foreground">
            Advance already paid: <span className="font-medium">${advancePaid.toLocaleString()}</span>
          </p>
        </div>
      )}
      
      {/* Show no financing if seller receives but no advance */}
      {highlight && advancePaid === undefined && (
        <div className="mt-2 border-t border-border/50 pt-2 text-xs">
          <p className="text-muted-foreground">No financing used</p>
        </div>
      )}
    </motion.div>
  )
}
