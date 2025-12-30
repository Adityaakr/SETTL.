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
  AlertCircle,
  Calendar,
  User,
  Sparkles,
  Wallet,
  CreditCard,
  Building2,
  Download,
  MoreHorizontal
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useInvoice } from "@/hooks/useInvoice"
import { useInvoiceNFT } from "@/hooks/useInvoiceNFT"
import { useReadContract, useWaitForTransactionReceipt, usePublicClient, useChainId, useSwitchChain } from "wagmi"
import { useSendTransaction, useWallets, usePrivy } from "@privy-io/react-auth"
import { usePrivyAccount } from "@/hooks/usePrivyAccount"
import { contractAddresses } from "@/lib/contracts"
import { DemoUSDCABI, SettlementRouterABI, InvoiceRegistryABI, AdvanceEngineABI, VaultABI } from "@/lib/abis"
import { formatUnits, parseUnits, isAddress, encodeFunctionData } from "viem"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { mantleTestnet } from "@/lib/wagmi-config"

const STATUS_LABELS = {
  0: "Issued",
  1: "Financed",
  2: "Paid",
  3: "Cleared",
}

type PaymentMethod = "privy" | "card" | "bank"

export default function PayInvoice() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const { address } = usePrivyAccount()
  const { invoice, isLoading: isLoadingInvoice } = useInvoice(invoiceId)
  const { tokenId, nftAddress, isLoading: isLoadingNFT } = useInvoiceNFT(invoiceId ? BigInt(invoiceId) : undefined)
  const { sendTransaction } = useSendTransaction()
  const { wallets } = useWallets()
  const { login, logout, ready, authenticated } = usePrivy()
  
  // Check if actually logged in - use address or wallets as the source of truth
  const isActuallyLoggedIn = authenticated && (address || wallets.length > 0)
  const publicClient = usePublicClient({ chainId: 5003 })
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  // Find the wallet that matches the currently connected address
  // This ensures we use the wallet the user actually connected (could be MetaMask, Privy, etc.)
  const connectedWallet = address 
    ? wallets.find(w => w.address.toLowerCase() === address.toLowerCase()) || wallets[0]
    : wallets[0]
  
  // Check if user is on the wrong network and automatically prompt to switch/add network
  useEffect(() => {
    if (authenticated && address && chainId !== 5003) {
      // User is connected but on wrong network - try to switch automatically
      const switchToMantle = async () => {
        try {
          if (switchChain) {
            await switchChain({ chainId: 5003 })
          } else {
            // If switchChain not available, try to add network via window.ethereum
            const ethereum = (window as any).ethereum
            if (ethereum && ethereum.request) {
              try {
                await ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: '0x138B' }], // 5003 in hex
                })
              } catch (switchError: any) {
                // This error code indicates that the chain has not been added to MetaMask
                if (switchError.code === 4902 || switchError.code === -32603) {
                  try {
                    await ethereum.request({
                      method: 'wallet_addEthereumChain',
                      params: [{
                        chainId: '0x138B', // 5003 in hex
                        chainName: 'Mantle Sepolia Testnet',
                        nativeCurrency: {
                          name: 'Mantle',
                          symbol: 'MNT',
                          decimals: 18,
                        },
                        rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
                        blockExplorerUrls: ['https://explorer.testnet.mantle.xyz'],
                      }],
                    })
                  } catch (addError) {
                    console.error("Failed to add network:", addError)
                    toast.error("Please add Mantle Sepolia Testnet manually", {
                      description: "Network details: Chain ID 5003, RPC: https://rpc.sepolia.mantle.xyz",
                      duration: 10000,
                    })
                  }
                } else {
                  throw switchError
                }
              }
            } else {
              toast.error("Please switch to Mantle Sepolia Testnet", {
                description: "Chain ID: 5003 | RPC: https://rpc.sepolia.mantle.xyz",
                duration: 8000,
              })
            }
          }
        } catch (error: any) {
          console.error("Failed to switch chain:", error)
          toast.error("Wrong Network - Please switch to Mantle Sepolia Testnet", {
            description: "Chain ID: 5003 | RPC: https://rpc.sepolia.mantle.xyz | Explorer: https://explorer.testnet.mantle.xyz",
            duration: 10000,
          })
        }
      }
      
      // Prompt user to switch network
      toast.warning("Switching to Mantle Sepolia Testnet...", {
        description: "Please confirm the network switch in MetaMask",
        duration: 3000,
      })
      
      switchToMantle()
    }
  }, [authenticated, address, chainId, switchChain])
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("privy")
  const [cardNumber, setCardNumber] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCVC, setCardCVC] = useState("")
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
      refetchInterval: 10000, // Reduced frequency to avoid rate limits
    },
  })
  
  const { isLoading: isApprovalConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  const { 
    isLoading: isPaymentConfirming, 
    isSuccess: isPaymentConfirmed,
    isError: isPaymentError,
    error: paymentError
  } = useWaitForTransactionReceipt({
    hash: payHash,
    query: {
      enabled: !!payHash, // Only wait if we have a transaction hash
    },
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

  // Handle payment transaction confirmation - ONLY show success when transaction is confirmed on-chain
  useEffect(() => {
    if (payHash && isPaymentConfirmed) {
      // Transaction is confirmed on-chain
      toast.success("Payment confirmed!", {
        description: "Settlement is being finalized on-chain.",
      })
      setStep("complete")
      // Refetch invoice to get updated status
      if (invoiceId) {
        setTimeout(() => {
          window.location.reload() // Force refresh to get latest invoice status
        }, 2000)
      }
    } else if (payHash && isPaymentError) {
      // Transaction failed on-chain
      console.error("Payment transaction failed:", paymentError)
      toast.error("Payment failed", {
        description: paymentError?.message || "Transaction was reverted. Please try again.",
        duration: 8000,
      })
      setIsPaying(false)
      setPayHash(undefined) // Reset so user can try again
    }
  }, [payHash, isPaymentConfirmed, isPaymentError, paymentError, invoiceId])

  const handleApprove = async () => {
    if (!invoice || !contractAddresses.DemoUSDC || !contractAddresses.SettlementRouter) {
      toast.error("Missing contract addresses")
      return
    }

    if (!address) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!connectedWallet) {
      toast.error("No wallet available")
      return
    }

    // Ensure the connected wallet address matches the active address
    if (connectedWallet.address.toLowerCase() !== address.toLowerCase()) {
      toast.error("Wallet address mismatch", {
        description: "Please ensure you're using the connected wallet"
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
          invoice.amount,
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
          address: connectedWallet.address,
          uiOptions: {
            showWalletUIs: false,
          },
        }
      )

      setApproveHash(result.hash)
      toast.success("Approval transaction submitted!")
    } catch (error: any) {
      console.error("Approval error:", error)
      toast.error("Approval failed", {
        description: error.message || "Please try again",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handlePay = async () => {
    if (!invoice || !contractAddresses.SettlementRouter || !invoiceId) {
      toast.error("Missing invoice data")
      return
    }

    if (!address) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!connectedWallet) {
      toast.error("No wallet available")
      return
    }

    // Ensure the connected wallet address matches the active address
    if (connectedWallet.address.toLowerCase() !== address.toLowerCase()) {
      toast.error("Wallet address mismatch", {
        description: "Please ensure you're using the connected wallet"
      })
      return
    }

    // Only allow Privy wallet payment for now (card/bank are demo)
    if (paymentMethod !== "privy") {
      toast.info("Card and bank transfer are demo only. Please use Privy wallet to pay.")
      return
    }

    setIsPaying(true)
    try {
      // Pre-flight checks
      if (publicClient && address && invoice) {
        try {
          // 1. Check USDC balance
          const balance = await publicClient.readContract({
            address: contractAddresses.DemoUSDC as `0x${string}`,
            abi: DemoUSDCABI,
            functionName: "balanceOf",
            args: [address],
          }) as bigint

          if (balance < invoice.amount) {
            toast.error("Insufficient USDC balance", {
              description: `You have ${formatUnits(balance, 6)} USDC, but need ${formatUnits(invoice.amount, 6)} USDC to pay this invoice.`,
              duration: 8000,
            })
            setIsPaying(false)
            return
          }

          // 2. Check USDC allowance
          const currentAllowance = await publicClient.readContract({
            address: contractAddresses.DemoUSDC as `0x${string}`,
            abi: DemoUSDCABI,
            functionName: "allowance",
            args: [address, contractAddresses.SettlementRouter as `0x${string}`],
          }) as bigint

          if (currentAllowance < invoice.amount) {
            toast.error("Insufficient USDC allowance", {
              description: `You have approved ${formatUnits(currentAllowance, 6)} USDC, but need ${formatUnits(invoice.amount, 6)} USDC. Please click 'Approve USDC' first.`,
              duration: 8000,
            })
            refetchAllowance()
            setIsPaying(false)
            return
          }

          // 3. Check invoice status directly from contract
          const onChainInvoice = await publicClient.readContract({
            address: contractAddresses.InvoiceRegistry as `0x${string}`,
            abi: InvoiceRegistryABI,
            functionName: "getInvoice",
            args: [BigInt(invoiceId)],
          }) as any

          if (onChainInvoice.status === 3) {
            toast.error("Invoice already cleared", {
              description: "This invoice has already been paid and cleared.",
              duration: 8000,
            })
            setIsPaying(false)
            return
          }

          // 4. Verify buyer address
          if (address.toLowerCase() !== onChainInvoice.buyer.toLowerCase()) {
            toast.error("Not the invoice buyer", {
              description: "Only the buyer address can pay this invoice. Please connect the correct wallet.",
              duration: 8000,
            })
            setIsPaying(false)
            return
          }

          // 5. Check if invoice has an advance and verify repayment is valid
          try {
            // First check if advance exists and get repayment amount
            let repaymentAmount = 0n
            let advanceExists = false
            
            try {
              repaymentAmount = await publicClient.readContract({
                address: contractAddresses.AdvanceEngine as `0x${string}`,
                abi: AdvanceEngineABI,
                functionName: "getRepaymentAmount",
                args: [BigInt(invoiceId)],
              }) as bigint
              
              if (repaymentAmount > 0n) {
                advanceExists = true
              }
            } catch (e) {
              // No advance exists - that's fine
              advanceExists = false
            }

            if (advanceExists && repaymentAmount > 0n) {
              // Invoice has an advance - get full advance details
              const advance = await publicClient.readContract({
                address: contractAddresses.AdvanceEngine as `0x${string}`,
                abi: AdvanceEngineABI,
                functionName: "getAdvance",
                args: [BigInt(invoiceId)],
              }) as any

              // Check if advance was already marked as repaid
              if (advance.repaid) {
                toast.error("Advance already repaid", {
                  description: "This invoice's advance has already been repaid. Payment may have already been processed.",
                  duration: 8000,
                })
                setIsPaying(false)
                return
              }

              // Get the principal amount that was actually borrowed from vault
              const principalBorrowed = advance.advanceAmount || advance.principal || 0n

              // Check vault's totalBorrowed
              // Note: Vault tracks only principal borrowed, but we repay principal + interest
              // The vault check requires: totalBorrowed >= repaymentAmount (which includes interest)
              // This will fail if another invoice was already repaid, reducing totalBorrowed
              const vaultTotalBorrowed = await publicClient.readContract({
                address: contractAddresses.Vault as `0x${string}`,
                abi: VaultABI,
                functionName: "getTotalBorrowed",
              }) as bigint

              // If vault's totalBorrowed is less than the repayment amount (principal + interest),
              // this advance was likely already repaid or partially repaid
              if (vaultTotalBorrowed < repaymentAmount) {
                // Check if at least the principal is still borrowed
                if (vaultTotalBorrowed < principalBorrowed) {
                  toast.error("Advance already repaid", {
                    description: `The advance principal has been repaid. This invoice may have already been paid. Please refresh and check the invoice status.`,
                    duration: 10000,
                  })
                } else {
                  toast.error("Repayment amount mismatch", {
                    description: `The vault cannot accept this repayment amount (${formatUnits(repaymentAmount, 6)} USDC) because it only has ${formatUnits(vaultTotalBorrowed, 6)} USDC borrowed. This may indicate the invoice was already paid. Please refresh the page.`,
                    duration: 10000,
                  })
                }
                setIsPaying(false)
                return
              }
            }
          } catch (advanceCheckError: any) {
            // If getAdvance/getRepaymentAmount throws, invoice doesn't have an advance - that's fine
            console.log("[Payment Pre-flight] Advance check:", advanceCheckError.message)
          }
        } catch (preFlightError: any) {
          console.error("[Payment Pre-flight Check] Error:", preFlightError)
        }
      }

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
          address: connectedWallet.address,
          uiOptions: {
            showWalletUIs: false,
          },
        }
      )

      setPayHash(result.hash)
      toast.info("Transaction submitted", {
        description: "Please confirm the transaction in your wallet, then wait for on-chain confirmation...",
        duration: 5000,
      })
    } catch (error: any) {
      console.error("Payment error:", error)
      
      let errorMessage = "Payment failed"
      let errorDescription = error.message || "Please try again"
      
      if (error.message?.includes("Not invoice buyer") || error.message?.includes("buyer")) {
        errorMessage = "Not the invoice buyer"
        errorDescription = "Only the buyer address can pay this invoice. Please connect the correct wallet."
      } else if (error.message?.includes("Already cleared") || error.message?.includes("cleared")) {
        errorMessage = "Invoice already cleared"
        errorDescription = "This invoice has already been paid and cleared."
      } else if (error.message?.includes("Execution reverted")) {
        errorMessage = "Transaction failed"
        errorDescription = "The transaction was rejected. Common causes: insufficient USDC allowance (try approving again), insufficient balance, or invoice already paid. Please check and try again."
      } else if (error.message?.includes("Repay exceeds borrowed")) {
        errorMessage = "Repayment error"
        errorDescription = "Cannot repay the advance - the amount exceeds what was borrowed. This invoice may have already been paid. Please refresh the page and check the invoice status."
      }
      
      toast.error(errorMessage, {
        description: errorDescription,
        duration: 8000,
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

  // Debug: Log wallet comparison (must be before early returns)
  useEffect(() => {
    if (address && invoice) {
      console.log('🔍 Wallet comparison:', {
        connectedAddress: address,
        invoiceBuyer: invoice.buyer,
        connectedLower: address.toLowerCase(),
        buyerLower: invoice.buyer.toLowerCase(),
        isMatch: address.toLowerCase() === invoice.buyer.toLowerCase(),
      })
    }
  }, [address, invoice])

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
  const dueDate = new Date(Number(invoice.dueDate) * 1000)
  
  // Get buyer metadata from localStorage
  const getInvoiceMetadata = () => {
    try {
      // Try invoice ID first
      const stored = localStorage.getItem(`invoice_metadata_${invoiceId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        console.log('📋 Invoice metadata found for invoice', invoiceId, ':', parsed)
        return parsed
      }
      
      // Try with BigInt version
      if (invoiceId) {
        const storedBigInt = localStorage.getItem(`invoice_metadata_${BigInt(invoiceId).toString()}`)
        if (storedBigInt) {
          const parsed = JSON.parse(storedBigInt)
          console.log('📋 Invoice metadata found (BigInt key):', parsed)
          return parsed
        }
      }
    } catch (e) {
      console.error('Error reading invoice metadata:', e)
    }
    
    console.log('⚠️ No invoice metadata found for invoice', invoiceId)
    console.log('🔍 Available localStorage keys:', Object.keys(localStorage).filter(k => k.includes('invoice_metadata')))
    return { buyerName: '', buyerEmail: '', sellerName: '' }
  }
  
  const metadata = getInvoiceMetadata()
  // Show buyer name if available, otherwise show formatted wallet address
  const buyerName = metadata.buyerName && metadata.buyerName.trim() !== '' 
    ? metadata.buyerName 
    : invoice.buyer.slice(0, 6) + '...' + invoice.buyer.slice(-4)
  const sellerName = metadata.sellerName && metadata.sellerName.trim() !== '' 
    ? metadata.sellerName 
    : 'SETTL. Business'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="mx-auto max-w-xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={copyPaymentLink} className="h-8 w-8 p-0">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  if (!authenticated && !address && wallets.length === 0) {
                    toast.info('Not logged in')
                    return
                  }
                  try {
                    console.log('🔴 Starting logout process...')
                    
                    // First, try to disconnect any connected wallets
                    try {
                      const ethereum = (window as any).ethereum
                      if (ethereum && ethereum.isMetaMask && ethereum.request) {
                        // Try to disconnect MetaMask if connected
                        try {
                          await ethereum.request({ 
                            method: 'wallet_revokePermissions',
                            params: [{ eth_accounts: {} }]
                          }).catch(() => {
                            // Ignore if not supported
                          })
                        } catch (e) {
                          console.log('MetaMask disconnect not needed:', e)
                        }
                      }
                    } catch (e) {
                      console.log('Wallet disconnect attempt failed:', e)
                    }
                    
                    // Logout from Privy
                    console.log('🔴 Calling Privy logout...')
                    await logout()
                    
                    // Give Privy a moment to process
                    await new Promise(resolve => setTimeout(resolve, 500))
                    
                    console.log('✅ Logout successful')
                    toast.success('Logged out successfully')
                    
                    // Optionally clear local storage if needed (but keep invoice metadata)
                    // localStorage.clear() // Don't clear as it might clear invoice data
                    
                    // Stay on the same page - user can reconnect their wallet to pay
                  } catch (error: any) {
                    console.error('❌ Logout error:', error)
                    toast.error('Failed to logout', {
                      description: error?.message || 'Please try again or refresh the page'
                    })
                  }
                }}
                className="h-8 text-sm font-semibold px-3 border-2 border-red-500 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-600 shadow-sm"
              >
                Logout
              </Button>
              <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                  <a
                    href={`https://explorer.testnet.mantle.xyz/address/${contractAddresses.InvoiceRegistry}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                  <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
            </div>
          </div>

          {/* Invoice Details Card */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
            {/* Amount Due - Prominent */}
            <div className="mb-4 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Amount Due</p>
              <p className="text-4xl font-bold">
                ${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Invoice Info */}
            <div className="mb-4 space-y-3 border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Due {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {tokenId && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3 w-3" />
                    Tokenized #{tokenId.toString()}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Bill to</p>
                  <p className="text-sm font-medium">{buyerName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">From</p>
                  <p className="text-sm font-medium">{sellerName}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mb-4 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Item / Service</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Description</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2.5 text-sm font-medium">Invoice Amount</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">Payment for INV-{invoice.invoiceId.toString().padStart(6, '0')}</td>
                    <td className="px-3 py-2.5 text-sm text-center">1</td>
                    <td className="px-3 py-2.5 text-sm text-right">${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold text-right">${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Method Selection */}
          {invoice.status < 2 && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-lg">
              <h2 className="text-base font-semibold mb-3">Select a payment method</h2>
              
              {/* Payment Method Options */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={async () => {
                    if (!isBuyer && (!authenticated || !ready)) {
                      try {
                        await login()
                        toast.success("Please connect your wallet to pay this invoice")
                      } catch (error: any) {
                        console.error("Login error:", error)
                        toast.error("Failed to connect wallet", {
                          description: error?.message || "Please try again"
                        })
                      }
                    } else {
                      setPaymentMethod("privy")
                    }
                  }}
                  className={`flex-1 rounded-lg border-2 p-3 transition-all ${
                    paymentMethod === "privy"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Wallet className="h-4 w-4" />
                    <span className="font-medium text-sm">Wallet</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 rounded-lg border-2 p-3 transition-all ${
                    paymentMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-medium text-sm">Card</span>
                  </div>
                </button>
                
                <button
                  onClick={() => setPaymentMethod("bank")}
                  className={`flex-1 rounded-lg border-2 p-3 transition-all ${
                    paymentMethod === "bank"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="font-medium text-sm">Bank transfer</span>
                  </div>
                </button>
                
                <button
                  className="rounded-lg border-2 border-border p-3 hover:border-primary/50 transition-all"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              {/* Payment Form */}
              {paymentMethod === "privy" && (
                <div className="space-y-3">
                  {!isBuyer && (
                    <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium mb-1">Connect the buyer wallet</p>
                          <p className="text-xs text-muted-foreground">
                            Buyer address: <span className="font-mono">{invoice.buyer.slice(0, 6)}...{invoice.buyer.slice(-4)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {isBuyer && (
                    <>
                      {step === "approve" && needsApproval && (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-warning/20 bg-warning/5 p-2">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-3.5 w-3.5 text-warning" />
                              <span className="text-xs font-medium">Approve USDC to continue</span>
                      </div>
                    </div>
                    <Button
                      onClick={handleApprove}
                      disabled={isApproving || isApprovalConfirming}
                      className="w-full"
                            size="default"
                      variant="hero"
                    >
                      {isApproving || isApprovalConfirming ? (
                        <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isApproving ? "Waiting..." : "Confirming..."}
                        </>
                      ) : (
                              `Approve $${amountDisplay.toLocaleString()} USDC`
                      )}
                    </Button>
                  </div>
                )}

                {(step === "pay" || !needsApproval) && (
                    <Button
                      onClick={handlePay}
                      disabled={isPaying || isPaymentConfirming || needsApproval}
                      className="w-full"
                          size="default"
                      variant="hero"
                    >
                      {isPaying || isPaymentConfirming ? (
                        <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {isPaying ? "Waiting for wallet confirmation..." : "Waiting for on-chain confirmation..."}
                        </>
                      ) : (
                        <>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Pay ${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </>
                      )}
                    </Button>
                      )}

                      {step === "complete" && (
                        <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
                          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                          <h3 className="mt-2 text-base font-semibold">Payment Complete!</h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Settlement is being finalized on-chain.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  </div>
                )}

              {paymentMethod === "card" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-muted bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">
                      Card payments are demo only. Please use Wallet to complete payment.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Card number</label>
                      <Input
                        placeholder="1234 1234 1234 1234"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        disabled
                        className="h-9"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <div className="h-5 w-8 bg-muted rounded"></div>
                        <div className="h-5 w-8 bg-muted rounded"></div>
                        <div className="h-5 w-8 bg-muted rounded"></div>
                        <div className="h-5 w-8 bg-muted rounded"></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Expiration date</label>
                        <Input
                          placeholder="MM / YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          disabled
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">CVC</label>
                        <Input
                          placeholder="CVC"
                          value={cardCVC}
                          onChange={(e) => setCardCVC(e.target.value)}
                          disabled
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      toast.info("Card payments are demo only. Please use Wallet to pay.")
                      setPaymentMethod("privy")
                    }}
                    className="w-full"
                    size="default"
                    variant="hero"
                    disabled
                  >
                    Pay ${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Button>
              </div>
            )}

              {paymentMethod === "bank" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-muted bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">
                      Bank transfers are demo only. Please use Wallet to complete payment.
                </p>
              </div>
                  <Button
                    onClick={() => {
                      toast.info("Bank transfers are demo only. Please use Wallet to pay.")
                      setPaymentMethod("privy")
                    }}
                    className="w-full"
                    size="default"
                    variant="hero"
                    disabled
                  >
                    Pay ${amountDisplay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Button>
                </div>
              )}
              </div>
            )}

            {invoice.status >= 2 && (
            <div className="rounded-lg border border-success/20 bg-success/5 p-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
              <h3 className="mt-2 text-base font-semibold">
                {invoice.status === 3 ? "Invoice Cleared" : "Invoice Paid"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.status === 3 
                  ? "This invoice has been fully settled on-chain."
                  : "Payment has been received and settlement is in progress."}
              </p>
              </div>
            )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-left text-xs text-muted-foreground">
              <p>Powered by SETTL.</p>
              <div className="flex items-center gap-3 mt-1">
                <a href="#" className="hover:text-foreground transition-colors">Terms</a>
                <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-current" style={{ 
                backgroundColor: isActuallyLoggedIn ? '#22c55e' : '#ef4444',
                opacity: isActuallyLoggedIn ? 1 : 0.5
              }} />
              <span>{isActuallyLoggedIn ? 'Connected' : 'Not connected'}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
