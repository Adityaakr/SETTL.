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
// Prioritize HTTP for reliability, with WebSocket as optional for subscriptions
// fallback provides automatic failover between endpoints
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // Primary: HTTP for reads (more reliable than WebSocket)
      // Primary: Mantle official RPC
      http('https://rpc.sepolia.mantle.xyz', {
        batch: {
          multicall: true, // Enable multicall batching
        },
        fetchOptions: {
          timeout: 30000, // 30 second timeout
        },
      }),
      // Fallback: dRPC HTTP endpoint
      http('https://mantle-sepolia.drpc.org', {
        batch: {
          multicall: true,
        },
        fetchOptions: {
          timeout: 30000,
        },
      }),
      // Optional: WebSocket for event subscriptions (may fail, HTTP will be used instead)
      webSocket('wss://mantle-sepolia.drpc.org', {
        reconnect: true, // Auto-reconnect on disconnect
      }),
    ], {
      retryCount: 3, // Retry failed requests up to 3 times
      rank: ({ latency, success }) => {
        // Rank by success rate first, then latency
        if (success) return latency;
        return Number.MAX_SAFE_INTEGER;
      },
    }),
  },
});

export const chains = [mantleTestnet];
