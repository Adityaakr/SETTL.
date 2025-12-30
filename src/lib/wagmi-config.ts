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
// Use WebSocket for frequent reads/subscriptions (real-time data)
// Use HTTP for writes/transactions (on-chain operations)
// fallback provides automatic failover between endpoints
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // Primary: WebSocket for reads/subscriptions (frequent data fetching)
      // WebSocket is more efficient for real-time data and event subscriptions
      webSocket('wss://mantle-sepolia.drpc.org'),
      // HTTP for writes/transactions (on-chain operations)
      // Primary: Mantle official RPC
      http('https://rpc.sepolia.mantle.xyz', {
        batch: true, // Enable batch requests for better performance
      }),
      // Fallback: dRPC HTTP endpoint
      http('https://mantle-sepolia.drpc.org', {
        batch: true,
      }),
    ]),
  },
});

export const chains = [mantleTestnet];
