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
        'https://mantle-sepolia.g.alchemy.com/v2/lA12jxcK7XSr4_xdTRtMG',
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
// Use WebSocket for subscriptions/reads (more efficient) and HTTP for writes
// fallback provides automatic failover between endpoints
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: fallback([
      // HTTP for writes/transactions (more reliable for submissions)
      // Primary: Mantle official RPC
      http('https://rpc.sepolia.mantle.xyz'),
      // Fallbacks
      http('https://mantle-sepolia.g.alchemy.com/v2/lA12jxcK7XSr4_xdTRtMG'),
      http('https://mantle-sepolia.drpc.org'),
    ]),
  },
});

export const chains = [mantleTestnet];
