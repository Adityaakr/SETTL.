import { createConfig } from '@privy-io/wagmi';
import { http, webSocket } from 'viem';

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
// Strategy:
// - WebSocket endpoint for realtime connections (subscriptions, event watching)
// - HTTP endpoint as fallback for reliability
export const wagmiConfig = createConfig({
  chains: [mantleTestnet],
  transports: {
    [mantleTestnet.id]: webSocket('wss://mantle-sepolia.g.alchemy.com/v2/H2xLs5teY1MdED6Fe0lSX'),
  },
});

export const chains = [mantleTestnet];
