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
// Optimized RPC Strategy:
// - WebSocket (WSS) for fast real-time event subscriptions (useWatchContractEvent)
// - HTTP for reliable reads (useReadContract) and writes (transactions)
// - Automatic fallback with multiple RPC endpoints for redundancy
// - Batching and retry logic for optimal performance
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // Primary: WebSocket for event subscriptions (fastest for real-time data)
      // Wagmi automatically uses WebSocket for useWatchContractEvent
      webSocket('wss://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX', {
        reconnect: true,
        retryCount: 3,
      }),
      // Primary: HTTP for reads and writes (more reliable, required for transactions)
      // Wagmi automatically uses HTTP for useReadContract and useSendTransaction
      http('https://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX', {
        batch: {
          wait: 50, // Batch requests within 50ms
          batchSize: 10, // Max 10 requests per batch
        },
        fetchOptions: {
          timeout: 10000, // 10s timeout for HTTP requests
        },
      }),
      // Fallback: Additional HTTP endpoint for redundancy
      http('https://rpc.sepolia.mantle.xyz', {
        batch: {
          wait: 50,
          batchSize: 10,
        },
        fetchOptions: {
          timeout: 10000,
        },
      }),
    ], {
      retryCount: 2, // Retry up to 2 times before failing
      rank: true, // Rank by response time (fastest first)
    }),
  },
});

export const chains = [mantleTestnet];
