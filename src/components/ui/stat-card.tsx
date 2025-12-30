import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: {
    value: number
    label: string
  }
  variant?: "default" | "primary" | "success" | "warning"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, subtitle, icon: Icon, trend, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-card p-6 shadow-md transition-all duration-300 hover:shadow-lg",
          variant === "primary" && "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent",
          variant === "success" && "border-success/20 bg-gradient-to-br from-success/5 to-transparent",
          variant === "warning" && "border-warning/20 bg-gradient-to-br from-warning/5 to-transparent",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight number-display">{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-medium",
                    trend.value >= 0 ? "text-success" : "text-destructive"
                  )}
                >
                  {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "rounded-xl p-3",
                variant === "default" && "bg-secondary text-secondary-foreground",
                variant === "primary" && "bg-primary/10 text-primary",
                variant === "success" && "bg-success/10 text-success",
                variant === "warning" && "bg-warning/10 text-warning"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
