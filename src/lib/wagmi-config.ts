import { createConfig } from '@privy-io/wagmi';
import { http, fallback } from 'viem';

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
// Use HTTP only (most reliable, WebSocket can cause connection issues)
// fallback provides automatic failover between endpoints
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // Primary: Mantle official RPC (HTTP - most reliable)
      http('https://rpc.sepolia.mantle.xyz', {
        batch: {
          multicall: true, // Enable batch multicall for better performance
        },
        fetchOptions: {
          timeout: 10000, // 10 second timeout
        },
      }),
      // Fallback: dRPC HTTP endpoint
      http('https://mantle-sepolia.drpc.org', {
        batch: {
          multicall: true,
        },
        fetchOptions: {
          timeout: 10000,
        },
      }),
    ]),
  },
});

export const chains = [mantleTestnet];
