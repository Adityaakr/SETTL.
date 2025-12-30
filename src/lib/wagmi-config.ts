import { createConfig } from '@privy-io/wagmi';
import { http, webSocket, fallback } from 'viem';

// Mantle Sepolia Testnet configuration (matches privy-config.ts)
export const mantleTestnet = {
  id: 5003,
  name: 'Mantle Sepolia Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Mantle',
    symbol: 'MNT',
  },
  rpcUrls: {
    default: {
      // Primary RPC: Alchemy
      http: [
        'https://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX',
      ],
      webSocket: [
        'wss://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX',
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
} as const;

// Create Wagmi config using Privy's createConfig
// Strategy:
// - HTTP prioritized for reliability (WebSocket can be unstable)
// - Multiple HTTP endpoints with automatic failover
// - WebSocket as optional for event subscriptions (will fall back to HTTP polling)
// - Robust error handling and retries
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // Primary: Alchemy RPC (HTTP)
      http('https://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX', {
        batch: {
          wait: 50,
          batchSize: 10,
        },
      }),
      // Optional: WebSocket for event subscriptions (will fallback to HTTP if fails)
      // Only attempt WebSocket for real-time subscriptions
      webSocket('wss://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX', {
        reconnect: true,
      }),
    ], {
      retryCount: 3, // Retry up to 3 times before failing
      rank: true, // Rank by response time
    }),
  },
});

export const chains = [mantleTestnet];
