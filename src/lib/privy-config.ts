// Privy configuration for Mantle Testnet

// Mantle Testnet chain configuration
const mantleTestnetChain = {
  id: 5003,
  name: 'Mantle Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: {
      // Multiple RPC endpoints for redundancy and failover
      http: [
        'https://rpc.sepolia.mantle.xyz',
        'https://mantle-sepolia.g.alchemy.com/v2/lA12jxcK7XSr4_xdTRtMG',
        'https://mantle-sepolia.drpc.org',
      ],
    },
    public: {
      // Multiple RPC endpoints for redundancy and failover
      http: [
        'https://rpc.sepolia.mantle.xyz',
        'https://mantle-sepolia.g.alchemy.com/v2/lA12jxcK7XSr4_xdTRtMG',
        'https://mantle-sepolia.drpc.org',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Mantle Explorer',
      url: 'https://explorer.testnet.mantle.xyz',
    },
  },
  testnet: true,
}

export const privyConfig = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    appearance: {
      theme: 'light',
      accentColor: '#22c55e', // Green theme to match SETTL. branding
      logo: '/set.png', // SETTL. logo
    },
    loginMethods: ['email', 'sms', 'google', 'twitter', 'github'], // Removed 'wallet' to prevent auto-linking
    embeddedWallets: {
      // CRITICAL: Force embedded wallet creation on email/social login
      ethereum: {
        createOnLogin: 'all-users', // Create embedded wallet for ALL users on login (including those with wallet-linked accounts)
      },
      // Only create embedded wallets - don't auto-link external wallets
      requireUserPasswordOnCreate: false,
      noPromptOnSignature: true, // CRITICAL: Disable transaction prompts for embedded wallets - transactions sign automatically
    },
    // Block external wallets from being used as primary connection
    externalWallets: {
      coinbaseWallet: {
        connectionOptions: 'smartWalletOnly', // Only allow smart wallets, not direct connections
      },
      walletConnect: {
        connectionOptions: 'smartWalletOnly',
      },
      // MetaMask and other injected wallets should be blocked for email logins
    },
    // Chain configuration - Mantle Sepolia Testnet (5003)
    // Note: Make sure Mantle Sepolia Testnet (5003) is enabled in your Privy dashboard
    // IMPORTANT: Add http://localhost:8080 to allowed origins in Privy dashboard to fix origin mismatch
    defaultChain: mantleTestnetChain,
    supportedChains: [mantleTestnetChain],
  },
}

