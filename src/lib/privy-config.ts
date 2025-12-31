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
      http: [
        'https://rpc.sepolia.mantle.xyz',
      ],
    },
    public: {
      http: [
        'https://rpc.sepolia.mantle.xyz',
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
    loginMethods: ['email', 'sms', 'google', 'twitter', 'github', 'wallet'], // Added 'wallet' to allow MetaMask and other external wallets
    embeddedWallets: {
      // Create embedded wallet on email/social login
      ethereum: {
        createOnLogin: 'all-users', // Create embedded wallet for ALL users on login
      },
      requireUserPasswordOnCreate: false,
      noPromptOnSignature: true, // CRITICAL: Disable transaction prompts for embedded wallets - transactions sign automatically
    },
    // Allow external wallets (MetaMask, etc.)
    externalWallets: {
      coinbaseWallet: {
        connectionOptions: 'all', // Allow both smart wallets and direct connections
      },
      walletConnect: {
        connectionOptions: 'all', // Allow both smart wallets and direct connections
      },
      metamask: {
        connectionOptions: 'all', // Allow MetaMask connections
      },
    },
    // Chain configuration - Mantle Sepolia Testnet (5003)
    // Note: Make sure Mantle Sepolia Testnet (5003) is enabled in your Privy dashboard
    // IMPORTANT: Add http://localhost:8080 to allowed origins in Privy dashboard to fix origin mismatch
    defaultChain: mantleTestnetChain,
    supportedChains: [mantleTestnetChain],
  },
}

