import { useReadContract, useWatchContractEvent } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { ReputationABI, InvoiceRegistryABI, SettlementRouterABI } from '@/lib/abis';
import { useQueryClient } from '@tanstack/react-query';

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
  const queryClient = useQueryClient();

  const { data: score, isLoading: isLoadingScore, refetch: refetchScore } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getScore',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Background polling every 30s
    },
  });

  const { data: tier, isLoading: isLoadingTier, refetch: refetchTier } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getTier',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Background polling every 30s
    },
  });

  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useReadContract({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    functionName: 'getStats',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.Reputation,
      refetchInterval: 30000, // Background polling every 30s
    },
  });

  // Helper function to trigger immediate refetch of all reputation data
  const triggerRefetch = () => {
    // Refetch all reputation queries immediately
    refetchScore();
    refetchTier();
    refetchStats();
    
    // Also invalidate queries to force fresh data from chain
    if (seller) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            Array.isArray(queryKey) &&
            queryKey[0] === 'readContract' &&
            queryKey[1]?.address?.toLowerCase() === contractAddresses.Reputation?.toLowerCase()
          );
        },
      });
    }
  };

  // Primary: Watch for ReputationUpdated events - most direct signal
  useWatchContractEvent({
    address: contractAddresses.Reputation as `0x${string}`,
    abi: ReputationABI,
    eventName: 'ReputationUpdated',
    onLogs(logs) {
      logs.forEach((log) => {
        const [eventSeller, newScore, newTier, invoiceVolume] = log.args as any;
        if (eventSeller?.toLowerCase() === seller?.toLowerCase()) {
          console.log('🎯 Reputation updated automatically!', {
            seller: eventSeller,
            newScore: newScore?.toString(),
            newTier: newTier?.toString(),
            invoiceVolume: invoiceVolume?.toString(),
            blockNumber: log.blockNumber?.toString(),
          });
          // Immediate refetch - blockchain state is updated at this point
          triggerRefetch();
        }
      });
    },
  });

  // Secondary: Watch InvoiceSettled events from SettlementRouter
  // This catches the settlement transaction which triggers reputation update
  useWatchContractEvent({
    address: contractAddresses.SettlementRouter as `0x${string}`,
    abi: SettlementRouterABI,
    eventName: 'InvoiceSettled',
    onLogs(logs) {
      logs.forEach((log) => {
        const { seller: eventSeller } = log.args as any;
        if (eventSeller?.toLowerCase() === seller?.toLowerCase()) {
          console.log('💰 Invoice settled - reputation will update automatically...');
          // Reputation update happens in same transaction, refetch after a short delay
          setTimeout(() => triggerRefetch(), 1500);
        }
      });
    },
  });

  // Tertiary: Watch InvoiceCleared events as additional backup
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs(logs) {
      logs.forEach((log) => {
        const { seller: eventSeller } = log.args as any;
        if (eventSeller?.toLowerCase() === seller?.toLowerCase()) {
          console.log('📄 Invoice cleared - triggering reputation refetch...');
          // Backup trigger - reputation should already be updated in same tx
          setTimeout(() => triggerRefetch(), 2000);
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

