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
// - WebSocket prioritized for real-time event subscriptions (useWatchContractEvent)
//   - Wagmi automatically uses WebSocket for event subscriptions when available
//   - Falls back to HTTP polling if WebSocket fails
// - HTTP for reads/writes with automatic fallback
// - Multiple endpoints for redundancy and failover
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // Primary: WebSocket for real-time event subscriptions
      // This is critical for useWatchContractEvent hooks to work reliably
      // Wagmi will automatically use WebSocket for event subscriptions
      webSocket('wss://mantle-sepolia.drpc.org', {
        reconnect: true, // Auto-reconnect on disconnect
        reconnectTimeout: 3000, // Reconnect after 3 seconds (faster recovery)
      }),
      // Fallback: HTTP for reads and writes (more reliable for transactions)
      // Primary HTTP: Mantle official RPC (most reliable)
      http('https://rpc.sepolia.mantle.xyz', {
        batch: {
          wait: 50, // Wait 50ms to batch multiple requests
          batchCount: 10, // Batch up to 10 requests
        },
        fetchOptions: {
          timeout: 20000, // 20 second timeout for HTTP requests
        },
      }),
      // Secondary HTTP: dRPC endpoint (backup)
      http('https://mantle-sepolia.drpc.org', {
        batch: {
          wait: 50,
          batchCount: 10,
        },
        fetchOptions: {
          timeout: 20000,
        },
      }),
    ], {
      retryCount: 2, // Retry failed requests up to 2 times (faster failover)
      rank: true, // Rank transports by response time and reliability
    }),
  },
});

export const chains = [mantleTestnet];
