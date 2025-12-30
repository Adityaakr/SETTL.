import { useReadContract } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { ReputationABI } from '@/lib/abis';

export type ReputationTier = 0 | 1 | 2; // C | B | A

export interface SellerStats {
  score: bigint;
  tier: ReputationTier;
  invoicesCleared: bigint;
  totalVolume: bigint;
  lastUpdated: bigint;
}

const TIER_LABELS = {
  0: 'C',
  1: 'B',
  2: 'A',
};

export function useReputation(sellerAddress?: string) {
  const { address } = usePrivyAccount();
  const seller = sellerAddress || address;

  const { data: score, isLoading: isLoadingScore } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getScore',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  const { data: tier, isLoading: isLoadingTier } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getTier',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  const { data: stats, isLoading: isLoadingStats } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getStats',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  return {
    score: score ? Number(score) : 0,
    tier: (tier as ReputationTier | undefined) ?? 0,
    tierLabel: TIER_LABELS[(tier as ReputationTier | undefined) ?? 0],
    stats: stats as SellerStats | undefined,
    isLoading: isLoadingScore || isLoadingTier || isLoadingStats,
  };
}

