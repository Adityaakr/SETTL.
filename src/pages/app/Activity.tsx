import { motion } from "framer-motion"
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  FileText, 
  DollarSign,
  Zap,
  CheckCircle2,
  Filter,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"

const activities = [
  {
    id: "1",
    type: "invoice_cleared",
    title: "Invoice INV-001 Cleared",
    description: "Payment received from Acme Corp",
    amount: 5000,
    direction: "in" as const,
    timestamp: "2024-12-20 14:32",
    txHash: "0x1a2b...3c4d",
  },
  {
    id: "2",
    type: "advance_received",
    title: "Advance Received",
    description: "75% LTV on INV-002",
    amount: 9375,
    direction: "in" as const,
    timestamp: "2024-12-19 10:15",
    txHash: "0x5e6f...7g8h",
  },
  {
    id: "3",
    type: "vault_deposit",
    title: "Vault Deposit",
    description: "Added liquidity to funding pool",
    amount: 5000,
    direction: "out" as const,
    timestamp: "2024-12-18 16:45",
    txHash: "0x9i0j...1k2l",
  },
  {
    id: "4",
    type: "invoice_created",
    title: "Invoice INV-003 Created",
    description: "Issued to StartupXYZ",
    amount: 3200,
    direction: null,
    timestamp: "2024-12-18 09:20",
    txHash: null,
  },
  {
    id: "5",
    type: "reputation_update",
    title: "Reputation Score Updated",
    description: "+12 points from on-time payment",
    amount: null,
    direction: null,
    timestamp: "2024-12-17 18:00",
    txHash: "0x3m4n...5o6p",
  },
]

const getActivityIcon = (type: string) => {
  switch (type) {
    case "invoice_cleared":
      return CheckCircle2
    case "advance_received":
      return Zap
    case "vault_deposit":
      return DollarSign
    case "invoice_created":
      return FileText
    case "reputation_update":
      return ArrowUpRight
    default:
      return FileText
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case "invoice_cleared":
      return "bg-success/10 text-success"
    case "advance_received":
      return "bg-primary/10 text-primary"
    case "vault_deposit":
      return "bg-info/10 text-info"
    case "invoice_created":
      return "bg-muted text-muted-foreground"
    case "reputation_update":
      return "bg-warning/10 text-warning"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export default function Activity() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
          <p className="text-muted-foreground">
            Your unified transaction and activity ledger
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-border bg-card shadow-md">
        <div className="divide-y divide-border">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type)
            const colorClass = getActivityColor(activity.type)
            
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-5 transition-colors hover:bg-secondary/30"
              >
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{activity.timestamp}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {activity.amount !== null && (
                    <div className="text-right">
                      <div className={`flex items-center gap-1 font-semibold number-display ${
                        activity.direction === "in" 
                          ? "text-success" 
                          : activity.direction === "out" 
                          ? "text-foreground" 
                          : "text-muted-foreground"
                      }`}>
                        {activity.direction === "in" && <ArrowDownRight className="h-4 w-4" />}
                        {activity.direction === "out" && <ArrowUpRight className="h-4 w-4" />}
                        {activity.direction === "in" ? "+" : activity.direction === "out" ? "-" : ""}
                        ${activity.amount.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">USDC</p>
                    </div>
                  )}
                  
                  {activity.txHash && (
                    <Button variant="ghost" size="sm" className="text-xs">
                      {activity.txHash}
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Load more */}
      <div className="flex justify-center">
        <Button variant="outline">Load More</Button>
      </div>
    </motion.div>
  )
}
