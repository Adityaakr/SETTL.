import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Lock,
  Database,
  Fingerprint,
  FileText,
  ArrowRight,
  Wallet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { availableProofs, initiateReclaimProof, type ReclaimProof } from "@/lib/reclaim"
import { toast } from "sonner"

const iconMap = {
  'wise-balance': Database,
  'credit-karma': FileText,
  'bybit-profile': Wallet,
  'wise-transaction': Fingerprint,
  'boa-verification': ShieldCheck,
  'credit-score': FileText,
  'stripe-transaction': Lock,
}

const activeAttestations = [
  {
    id: "PROOF-001",
    type: "Cashflow Verification",
    provider: "zkTLS Gateway",
    status: "verified" as const,
    expiry: "2025-03-15",
    verifiedAt: "2024-12-15",
    impact: "+25 reputation points",
  },
  {
    id: "PROOF-002",
    type: "Invoice History",
    provider: "Banking Connect",
    status: "expired" as const,
    expiry: "2024-12-01",
    verifiedAt: "2024-09-01",
    impact: "Renewal recommended",
  },
]

export default function Proofs() {
  const [loading, setLoading] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Handle callback from Reclaim after proof verification
  useEffect(() => {
    const proofParam = searchParams.get('proof')
    const reclaimProofId = searchParams.get('reclaimProofId')
    
    if (proofParam && reclaimProofId) {
      // User returned from Reclaim verification
      const proof = availableProofs.find((p) => p.type === proofParam)
      if (proof) {
        toast.success(`Verification successful for ${proof.title}!`, {
          description: "Your proof has been verified and stored.",
        })
      }
      
      // Clean up URL params
      setSearchParams({}, { replace: true })
    } else if (proofParam) {
      // Check if there's an error
      const error = searchParams.get('error')
      if (error) {
        toast.error('Verification failed', {
          description: error,
        })
        setSearchParams({}, { replace: true })
      }
    }
  }, [searchParams, setSearchParams])

  const handleVerify = async (proof: ReclaimProof) => {
    try {
      setLoading(proof.id)
      const url = await initiateReclaimProof(proof.type)
      
      // Open Reclaim verification in a new window
      const reclaimWindow = window.open(url, '_blank', 'width=600,height=700,scrollbars=yes')
      
      if (!reclaimWindow) {
        throw new Error('Please allow popups for this site to complete verification')
      }
      
      toast.success(`Starting verification for ${proof.title}`, {
        description: "Complete the verification in the popup window.",
      })
    } catch (error) {
      console.error('Error initiating proof:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start verification')
    } finally {
      setLoading(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">zkTLS Proofs</h1>
          <p className="text-muted-foreground">
            Verify your credentials privately using zero-knowledge proofs.
          </p>
        </div>
        <StatusBadge status="verified" className="bg-primary/10 text-primary border-primary/20">
          Privacy First
        </StatusBadge>
      </div>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Left: Available Proofs */}
        <div className="space-y-6">
          <div>
            <h2 className="mb-2 text-xl font-semibold">Available Proofs</h2>
            <p className="text-sm text-muted-foreground">
              Generate proofs to unlock better financing terms and lower fees.
            </p>
          </div>

          <div className="space-y-4">
            {availableProofs.map((proof) => {
              const Icon = iconMap[proof.type] || ShieldCheck
              return (
                <motion.div
                  key={proof.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card p-6 shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="rounded-lg bg-secondary p-3">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{proof.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {proof.description}
                        </p>
                        <div className="mt-3">
                          <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                            {proof.benefit}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      onClick={() => handleVerify(proof)}
                      disabled={loading === proof.id}
                      className="ml-4"
                    >
                      {loading === proof.id ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Right: Why zkTLS + Active Attestations */}
        <div className="space-y-6">
          {/* Why zkTLS */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Why zkTLS?</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Traditional financing requires sharing bank statements and PII. SETTL. uses zkTLS to prove your data is authentic without ever seeing it.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">NO PII STORED ON-CHAIN</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">CRYPTOGRAPHIC AUTHENTICITY</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">INSTANT VERIFICATION</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">REVOCABLE AT ANY TIME</span>
              </div>
            </div>
          </div>

          {/* Active Attestations */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-md">
            <h3 className="mb-4 font-semibold">Active Attestations</h3>
            {activeAttestations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active proofs yet.</p>
            ) : (
              <div className="space-y-4">
                {activeAttestations.map((proof) => (
                  <div
                    key={proof.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-1.5 ${
                          proof.status === "verified" 
                            ? "bg-success/10 text-success" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {proof.status === "verified" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{proof.type}</p>
                          <p className="text-xs text-muted-foreground">{proof.provider}</p>
                        </div>
                      </div>
                      <StatusBadge status={proof.status} className="text-xs">
                        {proof.status === "verified" ? "Verified" : "Expired"}
                      </StatusBadge>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{proof.status === "verified" ? "Expires" : "Expired"}: {proof.expiry}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Verified: {proof.verifiedAt}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`text-xs font-medium ${
                        proof.status === "verified" ? "text-success" : "text-warning"
                      }`}>
                        Impact: {proof.impact}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <ExternalLink className="mr-1 h-3 w-3" />
                        View on Explorer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </motion.div>
  )
}
