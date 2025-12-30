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
// Use WebSocket for subscriptions/reads (data fetching) and HTTP for writes (transactions)
// fallback provides automatic failover between endpoints
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // WebSocket for reads/subscriptions (data fetching) - primary
      webSocket('wss://mantle-sepolia.drpc.org'),
      // HTTP for writes/transactions (more reliable for submissions)
      // Primary: Mantle official RPC
      http('https://rpc.sepolia.mantle.xyz'),
      // Fallback: dRPC HTTP endpoint
      http('https://mantle-sepolia.drpc.org'),
    ]),
  },
});

export const chains = [mantleTestnet];
