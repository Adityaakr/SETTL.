import { Bell, Search, ChevronDown, Wallet, User, Copy, LogOut, ExternalLink, DollarSign, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/ui/status-badge"
import { useState } from "react"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { toast } from "sonner"
import { useTokenBalance } from "@/hooks/useTokenBalance"

export function Topbar() {
  const privy = usePrivy()
  const { ready, authenticated, user, login, logout } = privy
  const { balance: usdcBalance, isLoading: isLoadingBalance } = useTokenBalance()
  // Check if linkWallet exists (may not be available in all Privy versions)
  const linkWallet = 'linkWallet' in privy ? (privy as any).linkWallet : undefined
  // Check if createWallet exists for programmatic embedded wallet creation
  const createWallet = 'createWallet' in privy ? (privy as any).createWallet : undefined
  const { wallets } = useWallets()
  
  // Determine how user logged in - check linked accounts
  const hasEmailLogin = user?.linkedAccounts?.some((acc: any) => 
    acc.type === 'email' || acc.type === 'sms' || acc.type === 'google_oauth' || acc.type === 'twitter_oauth' || acc.type === 'github_oauth'
  ) || false
  
  const hasWalletLogin = user?.linkedAccounts?.some((acc: any) => 
    acc.type === 'wallet'
  ) || false

  // Determine login method
  const loginMethods = user?.linkedAccounts?.map((acc: any) => acc.type) || []
  const loggedInWithEmail = loginMethods.some((type: string) => 
    ['email', 'sms', 'google_oauth', 'twitter_oauth', 'github_oauth'].includes(type)
  )
  const loggedInWithWallet = loginMethods.includes('wallet')
  
  // Find embedded wallet (Privy's embedded wallet)
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || ''
    const wct = w.walletClientType?.toLowerCase() || ''
    return ct === 'embedded' || 
           wct === 'privy' ||
           ct.includes('privy') ||
           ct.includes('embedded')
  })
  
  // Find external wallet (MetaMask, etc.)  
  const externalWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || ''
    const wct = w.walletClientType?.toLowerCase() || ''
    return ct === 'injected' || 
           wct === 'metamask' ||
           ct.includes('injected') ||
           wct.includes('metamask')
  })
  
  // CRITICAL: Email login = ONLY embedded wallet, COMPLETELY ignore MetaMask
  let activeWallet
  // If user logged in with email, prioritize embedded wallet regardless of wallet-linked account
  if (loggedInWithEmail) {
    if (embeddedWallet) {
      // Email login + embedded wallet exists = use embedded wallet
      activeWallet = embeddedWallet
      if (externalWallet) {
        console.log('✅ Email login: Using embedded wallet, ignoring MetaMask')
      }
    } else if (!loggedInWithWallet && wallets.length === 0) {
      // Email login + no wallets yet = wallet being created, show null (will trigger creation)
      activeWallet = null
      console.log('⏳ Email login: Waiting for embedded wallet to be created...')
    } else if (loggedInWithWallet && !embeddedWallet) {
      // User has wallet-linked account but no embedded wallet = need to create one
      activeWallet = null
      console.log('⚠️ Email login + wallet-linked account but no embedded wallet. Need to create embedded wallet.')
    } else {
      // Fallback: if somehow we have wallets but no embedded, prefer external only if no wallet-linked account
      activeWallet = loggedInWithWallet ? (externalWallet || null) : null
    }
  } else if (loggedInWithWallet) {
    // Only wallet login (no email) - use external wallet
    activeWallet = externalWallet || embeddedWallet
  } else {
    // Fallback: prefer embedded
    activeWallet = embeddedWallet || externalWallet
  }
  
  // Better connection detection - check authenticated, user exists, and has wallet
  const isConnected = authenticated && user && activeWallet && activeWallet.address
  const walletAddress = activeWallet?.address
  const truncatedAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null

  // Check wallet type - embedded vs external
  const walletType = activeWallet?.walletClientType || activeWallet?.connectorType || 'unknown'
  const isEmbeddedWallet = walletType === 'privy' || 
                          activeWallet?.connectorType === 'embedded' ||
                          (embeddedWallet && !externalWallet)
  const isExternalWallet = !isEmbeddedWallet && walletType !== 'unknown' && !!externalWallet

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Privy Wallet Detection:', { 
      ready, 
      authenticated, 
      loggedInWithEmail,
      loggedInWithWallet,
      loginMethods,
      totalWallets: wallets.length,
      embeddedWallet: embeddedWallet ? { 
        address: embeddedWallet.address, 
        connectorType: embeddedWallet.connectorType,
        walletClientType: embeddedWallet.walletClientType 
      } : null,
      externalWallet: externalWallet ? { 
        address: externalWallet.address, 
        connectorType: externalWallet.connectorType,
        walletClientType: externalWallet.walletClientType 
      } : null,
      activeWallet: activeWallet ? {
        address: activeWallet.address,
        connectorType: activeWallet.connectorType,
        walletClientType: activeWallet.walletClientType
      } : null,
      activeWalletAddress: walletAddress,
      activeWalletType: walletType,
      isEmbeddedWallet,
      isExternalWallet,
      allWallets: wallets.map(w => ({ 
        address: w.address, 
        walletClientType: w.walletClientType,
        connectorType: w.connectorType 
      })),
      userLinkedAccounts: user?.linkedAccounts?.map((acc: any) => ({ 
        type: acc.type, 
        address: acc.address 
      })),
    })
  }

  const handleWalletClick = async () => {
    console.log('handleWalletClick called:', { ready, authenticated, isConnected, user: !!user, walletsCount: wallets.length })
    
    if (!ready) {
      return
    }

    if (!authenticated) {
      // Not authenticated - open login modal
      try {
        console.log('Calling login() to open Privy modal...')
        
        // Check for origin errors before attempting login
        const originError = localStorage.getItem('privy:origin-error')
        if (originError) {
          toast.error(
            "Origin Configuration Required",
            {
              description: `Add ${originError} to allowed origins in Privy dashboard at dashboard.privy.io`,
              duration: 15000,
              action: {
                label: "Open Dashboard",
                onClick: () => window.open('https://dashboard.privy.io', '_blank')
              }
            }
          )
          return
        }
        
        await login()
        console.log('Login called successfully - modal should appear')
      } catch (error: any) {
        console.error('Login error:', error)
        
        if (error?.message?.includes('origin') || error?.message?.includes('Origin')) {
          localStorage.setItem('privy:origin-error', 'true')
          toast.error(
            "Origin Mismatch Error",
            {
              description: "Add http://localhost:8080 to allowed origins in Privy dashboard at dashboard.privy.io",
              duration: 15000,
            }
          )
        } else {
          toast.error("Failed to open login modal", {
            description: error?.message || "Check console for details",
          })
        }
      }
    } else if (authenticated && !isConnected) {
      // Authenticated but no wallet - try to create embedded wallet programmatically
      console.log('⚠️ User authenticated but no wallet found. Attempting to create embedded wallet...')
      console.log('Debug info:', { loggedInWithEmail, loggedInWithWallet, loginMethods, walletsCount: wallets.length })
      
      // Try programmatic wallet creation first
      if (createWallet && typeof createWallet === 'function') {
        try {
          console.log('Attempting to create embedded wallet programmatically...')
          toast.loading("Creating embedded wallet...", { id: 'create-wallet' })
          
          await createWallet()
          
          // Wait a moment for wallet to appear
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          toast.success("Embedded wallet created!", { id: 'create-wallet' })
          console.log('✅ Embedded wallet created successfully')
          return
        } catch (createError: any) {
          console.error('Failed to create wallet programmatically:', createError)
          toast.dismiss('create-wallet')
          
          // If programmatic creation fails, show error with logout option
          toast.error("Failed to Create Wallet", {
            description: `Could not create embedded wallet automatically: ${createError?.message || 'Unknown error'}. Please logout and login again with email only.`,
            duration: 15000,
            action: {
              label: "Logout & Try Again",
              onClick: async () => {
                try {
                  await logout()
                  localStorage.clear()
                  sessionStorage.clear()
                  toast.success("Logged out! Please click 'Login' and use email.")
                  setTimeout(() => {
                    window.location.href = '/'
                  }, 1000)
                } catch (e: any) {
                  localStorage.clear()
                  sessionStorage.clear()
                  window.location.href = '/'
                }
              }
            }
          })
          return
        }
      }
      
      // Fallback: if createWallet doesn't exist, use linkWallet (but warn user)
      if (linkWallet && typeof linkWallet === 'function') {
        console.log('⚠️ createWallet not available, using linkWallet as fallback...')
        toast.warning("Creating Wallet", {
          description: "Opening wallet creation modal. Look for 'Create embedded wallet' or 'Privy wallet' option. DO NOT select MetaMask or external wallets.",
          duration: 8000,
        })
        try {
          await linkWallet()
        } catch (error: any) {
          console.error('linkWallet error:', error)
          toast.error("Failed to open wallet modal", {
            description: error?.message || "Please logout and login again"
          })
        }
      } else {
        // Last resort: logout
        console.error('❌ No wallet creation method available')
        toast.error("Wallet Creation Unavailable", {
          description: "No method available to create wallet automatically. Please logout completely and login again with email only.",
          duration: 15000,
          action: {
            label: "Logout Now",
            onClick: async () => {
              try {
                await logout()
                localStorage.clear()
                sessionStorage.clear()
                toast.success("Logged out! Please click 'Login' and use email.")
                setTimeout(() => {
                  window.location.href = '/'
                }, 1000)
              } catch (e: any) {
                localStorage.clear()
                sessionStorage.clear()
                window.location.href = '/'
              }
            }
          }
        })
      }
    } else {
      console.log('Already connected, should show wallet dropdown')
    }
  }

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      toast.success("Address copied to clipboard")
    }
  }

  const handleLogout = async () => {
    try {
      console.log('COMPLETE LOGOUT - Clearing ALL state...')
      
      // Disconnect MetaMask if connected
      try {
        const ethereum = (window as any).ethereum
        if (ethereum && ethereum.isMetaMask && ethereum.request) {
          await ethereum.request({ 
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }]
          }).catch(() => {
            // Ignore - not all MetaMask versions support this
          })
        }
      } catch (e) {
        console.warn('MetaMask disconnect error (ignored):', e)
      }
      
      // First try normal logout
      await logout()
      
      // COMPLETE CLEAR - Remove EVERYTHING
      setTimeout(() => {
        try {
          // Clear ALL localStorage (complete reset)
          localStorage.clear()
          
          // Clear ALL sessionStorage
          sessionStorage.clear()
          
          console.log('✅ Complete reset - all storage cleared')
        } catch (e) {
          console.warn('Storage clear error:', e)
        }
        
        // Force reload with cache busting
        window.location.href = '/?reset=' + Date.now()
      }, 300)
    } catch (error) {
      console.error("Logout error:", error)
      toast.error("Failed to logout, forcing reset...")
      
      // Force reset if normal logout fails
      try {
        localStorage.clear()
        sessionStorage.clear()
        // Redirect to home page with cache busting
        window.location.href = '/?logout=' + Date.now()
      } catch (e) {
        window.location.reload()
      }
    }
  }

  const forceLogout = () => {
    try {
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      toast.info("Clearing session and reloading...")
      setTimeout(() => {
        window.location.href = '/'
      }, 500)
    } catch (error) {
      window.location.reload()
    }
  }

  const viewOnExplorer = () => {
    if (walletAddress) {
      window.open(`https://explorer.testnet.mantle.xyz/address/${walletAddress}`, '_blank')
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-xl">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search invoices, transactions..."
          className="h-10 w-full rounded-lg border-border bg-secondary/50 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:bg-background"
        />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* Network pill */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-xs font-medium">Mantle</span>
        </div>

        {/* Account */}
        <Button variant="outline" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          Your Account
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </Button>

        {/* Wallet status */}
        {isConnected && walletAddress ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="gap-2">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline font-mono">{truncatedAddress}</span>
                <StatusBadge status="verified" dot={false} className="px-2 py-0.5">
                  Connected
                </StatusBadge>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Wallet Address</p>
                    <p className="font-mono text-sm break-all">{walletAddress}</p>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">USDC Balance</p>
                    <div className="flex items-center gap-2">
                      {isLoadingBalance ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <DollarSign className="h-4 w-4 text-primary" />
                      )}
                      <p className="text-lg font-semibold">
                        {isLoadingBalance ? "..." : usdcBalance.toLocaleString(undefined, { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                        <span className="text-sm text-muted-foreground ml-1">USDC</span>
                      </p>
                    </div>
                  </div>
                  {isExternalWallet && (
                    <p className="text-xs text-warning mt-1">
                      ⚠️ External Wallet ({walletType === 'metamask' ? 'MetaMask' : walletType})
                    </p>
                  )}
                  {isEmbeddedWallet && (
                    <p className="text-xs text-success mt-1">
                      ✓ Embedded Wallet (Email Login)
                    </p>
                  )}
                  {wallets.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {wallets.length} wallets linked. Showing: {isEmbeddedWallet ? 'Embedded' : 'External'}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyAddress}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Address
              </DropdownMenuItem>
              <DropdownMenuItem onClick={viewOnExplorer}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View on Explorer
              </DropdownMenuItem>
              {isExternalWallet && linkWallet && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={async () => {
                      try {
                        await linkWallet()
                        toast.info("Create or link an embedded wallet in the modal")
                      } catch (e: any) {
                        toast.error("Failed to open wallet modal", {
                          description: e?.message
                        })
                      }
                    }}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Create Embedded Wallet
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : authenticated && user && !isConnected ? (
          // Authenticated but no wallet - need to create wallet
          <Button 
            variant="secondary" 
            className="gap-2"
            onClick={handleWalletClick}
            disabled={!ready}
          >
            <Wallet className="h-4 w-4" />
            <span>Create Wallet</span>
            {!ready && <span className="text-xs opacity-50 ml-2">(Loading...)</span>}
          </Button>
        ) : (
          // Not authenticated - login button
          <Button 
            variant="secondary" 
            className="gap-2"
            onClick={handleWalletClick}
            disabled={!ready}
          >
            <Wallet className="h-4 w-4" />
            <span>Login</span>
            {!ready && <span className="text-xs opacity-50 ml-2">(Loading...)</span>}
          </Button>
        )}
      </div>
    </header>
  )
}
