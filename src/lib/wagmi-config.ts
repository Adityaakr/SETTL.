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
// Use HTTP for both reads and writes (more reliable, WebSocket can be unstable)
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
      }),
      // Fallback: dRPC HTTP endpoint
      http('https://mantle-sepolia.drpc.org', {
        batch: {
          multicall: true,
        },
      }),
      // WebSocket as last resort (can be unreliable)
      webSocket('wss://mantle-sepolia.drpc.org'),
    ]),
  },
});

export const chains = [mantleTestnet];
