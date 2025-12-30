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
      // Multiple RPC endpoints for redundancy and failover
      http: [
        'https://rpc.sepolia.mantle.xyz',
        'https://mantle-sepolia.drpc.org',
      ],
      webSocket: [
        'wss://mantle-sepolia.drpc.org',
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
      // Primary: HTTP endpoints (most reliable)
      // Primary HTTP: Mantle official RPC
      http('https://rpc.sepolia.mantle.xyz', {
        batch: {
          wait: 50,
          batchSize: 10,
        },
      }),
      // Secondary HTTP: dRPC endpoint (backup)
      http('https://mantle-sepolia.drpc.org', {
        batch: {
          wait: 50,
          batchSize: 10,
        },
      }),
      // Optional: WebSocket for event subscriptions (will fallback to HTTP if fails)
      // Only attempt WebSocket for real-time subscriptions
      webSocket('wss://mantle-sepolia.drpc.org', {
        reconnect: true,
      }),
    ], {
      retryCount: 3, // Retry up to 3 times before failing
      rank: true, // Rank by response time
    }),
  },
});

export const chains = [mantleTestnet];
