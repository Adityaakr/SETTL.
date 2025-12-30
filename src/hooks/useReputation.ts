import { useReadContract, useWatchContractEvent } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { ReputationABI, InvoiceRegistryABI } from '@/lib/abis';

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

  const { data: score, isLoading: isLoadingScore, refetch: refetchScore } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getScore',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  const { data: tier, isLoading: isLoadingTier, refetch: refetchTier } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getTier',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getStats',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  // Watch for ReputationUpdated events to refetch immediately when reputation changes
  useWatchContractEvent({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    eventName: 'ReputationUpdated',
    onLogs(logs) {
      // Check if any event is for the current seller
      logs.forEach((log) => {
        const [eventSeller, newScore, newTier, invoiceVolume] = log.args as any;
        if (eventSeller?.toLowerCase() === seller?.toLowerCase()) {
          console.log('🎯 Reputation updated!', {
            seller: eventSeller,
            newScore: newScore?.toString(),
            newTier: newTier?.toString(),
            invoiceVolume: invoiceVolume?.toString(),
          });
          // Immediately refetch all reputation data after a short delay to ensure blockchain state is updated
          setTimeout(() => {
            refetchScore();
            refetchTier();
            refetchStats();
          }, 2000);
        }
      });
    },
  });

  // Also watch InvoiceCleared events as a backup trigger
  // Reputation is updated when invoice is cleared, so this ensures we catch it
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs(logs) {
      logs.forEach((log) => {
        const { seller: eventSeller } = log.args as any;
        if (eventSeller?.toLowerCase() === seller?.toLowerCase()) {
          console.log('📄 Invoice cleared for seller, will refetch reputation in 3s...');
          // Reputation update happens in the same transaction, so wait a bit for it to be confirmed
          setTimeout(() => {
            refetchScore();
            refetchTier();
            refetchStats();
          }, 3000);
        }
      });
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

