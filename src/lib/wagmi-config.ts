import { createConfig } from '@privy-io/wagmi';
import { http } from 'viem';

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
      http: [
        'https://rpc.sepolia.mantle.xyz',
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
// - HTTP endpoint for reliability
// - Robust error handling and retries
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: http('https://rpc.sepolia.mantle.xyz', {
      batch: {
        wait: 50,
        batchSize: 10,
      },
    }),
  },
});

export const chains = [mantleTestnet];
