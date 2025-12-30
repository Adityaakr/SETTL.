import { useReadContract, useWatchContractEvent } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { ReputationABI, InvoiceRegistryABI, SettlementRouterABI } from '@/lib/abis';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { formatUnits } from 'viem';

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

// Track cleared invoices to avoid double-counting
const clearedInvoicesCache = new Map<string, Set<string>>(); // seller address -> set of invoice IDs

export function useReputation(sellerAddress?: string) {
  const { address } = usePrivyAccount();
  const seller = sellerAddress || address;
  const queryClient = useQueryClient();
  
  // Local state for instant frontend updates
  const [frontendScore, setFrontendScore] = useState<number | null>(null);
  const [frontendTier, setFrontendTier] = useState<ReputationTier | null>(null);
  const clearedInvoicesRef = useRef<Set<string>>(new Set());
  
  // Initialize cache for this seller
  useEffect(() => {
    if (seller) {
      if (!clearedInvoicesCache.has(seller.toLowerCase())) {
        clearedInvoicesCache.set(seller.toLowerCase(), new Set());
      }
      clearedInvoicesRef.current = clearedInvoicesCache.get(seller.toLowerCase())!;
    }
  }, [seller]);

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

  // Sync frontend state with blockchain data
  useEffect(() => {
    if (score !== undefined && score !== null) {
      const chainScore = Number(score);
      // Always sync frontend score with chain score when chain updates
      // This ensures we show the latest on-chain value, but frontend updates take priority during real-time events
      if (frontendScore === null) {
        // Initialize from chain if not set
        setFrontendScore(chainScore);
      } else if (chainScore > frontendScore) {
        // Update if chain score is higher (more authoritative)
        setFrontendScore(chainScore);
      }
      // If frontendScore > chainScore, keep frontend score (it's a recent update that hasn't synced yet)
    } else if (frontendScore === null) {
      // Initialize to 450 (Tier C starting point) if no chain data yet
      setFrontendScore(450);
    }
  }, [score, frontendScore]);

  useEffect(() => {
    if (tier !== undefined && tier !== null) {
      // Always sync tier with chain data
      setFrontendTier(tier as ReputationTier);
    } else if (frontendTier === null && frontendScore !== null) {
      // Calculate tier from frontend score if chain tier not available
      const calculatedTier = calculateTier(frontendScore);
      setFrontendTier(calculatedTier);
    }
  }, [tier, frontendTier, frontendScore]);

  // Helper function to calculate score increment
  const calculateScoreIncrement = (invoiceAmount: bigint): number => {
    const BASE_INCREMENT = 20; // Base points per cleared invoice
    const VOLUME_BONUS_DIVISOR = BigInt('1000000000000'); // 1M USDC = 1 bonus point (1M * 1e6 decimals = 1e12)
    const volumeBonus = Number(invoiceAmount / VOLUME_BONUS_DIVISOR);
    return BASE_INCREMENT + volumeBonus;
  };

  // Helper function to determine tier from score
  const calculateTier = (score: number): ReputationTier => {
    if (score < 500) return 0; // Tier C
    if (score < 850) return 1; // Tier B
    return 2; // Tier A
  };

  // Helper function to update frontend score immediately
  const updateFrontendScore = (invoiceId: string, invoiceAmount: bigint) => {
    // Check if we've already counted this invoice
    if (clearedInvoicesRef.current.has(invoiceId)) {
      console.log('📊 Invoice already counted:', invoiceId);
      return;
    }

    // Mark as counted
    clearedInvoicesRef.current.add(invoiceId);
    
    // Calculate new score
    const increment = calculateScoreIncrement(invoiceAmount);
    const currentScore = frontendScore ?? (score ? Number(score) : 450);
    const newScore = Math.min(1000, currentScore + increment); // Cap at 1000
    const newTier = calculateTier(newScore);

    console.log('🚀 Frontend reputation update:', {
      invoiceId,
      invoiceAmount: formatUnits(invoiceAmount, 6),
      increment,
      oldScore: currentScore,
      newScore,
      oldTier: frontendTier ?? (tier as ReputationTier ?? 0),
      newTier,
    });

    // Update frontend state immediately
    setFrontendScore(newScore);
    setFrontendTier(newTier);
  };

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
          console.log('🎯 Reputation updated on-chain!', {
            seller: eventSeller,
            newScore: newScore?.toString(),
            newTier: newTier?.toString(),
            invoiceVolume: invoiceVolume?.toString(),
            blockNumber: log.blockNumber?.toString(),
          });
          // Sync frontend with chain data
          if (newScore) {
            setFrontendScore(Number(newScore));
          }
          if (newTier !== undefined && newTier !== null) {
            setFrontendTier(Number(newTier) as ReputationTier);
          }
          // Immediate refetch - blockchain state is updated at this point
          triggerRefetch();
        }
      });
    },
  });

  // Watch InvoiceCleared events - increment score immediately in frontend
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs(logs) {
      logs.forEach((log) => {
        const invoiceId = log.args?.invoiceId?.toString();
        const { seller: eventSeller } = log.args as any;
        
        if (eventSeller?.toLowerCase() === seller?.toLowerCase() && invoiceId) {
          console.log('📄 Invoice cleared detected:', {
            invoiceId,
            seller: eventSeller,
            blockNumber: log.blockNumber?.toString(),
          });
          
          // Fetch invoice amount from chain to calculate score increment
          // For now, use a reasonable estimate or fetch it
          // We'll trigger frontend update immediately, then sync with chain
          // Default to $1000 USDC (6 decimals) = 1000000000n
          const estimatedAmount = BigInt('1000000000'); // $1000 default
          
          // Update frontend score immediately
          updateFrontendScore(invoiceId, estimatedAmount);
          
          // Also trigger refetch to sync with chain (which has the actual amount)
          setTimeout(() => triggerRefetch(), 2000);
        }
      });
    },
  });

  // Watch InvoiceSettled events - get actual invoice amount
  useWatchContractEvent({
    address: contractAddresses.SettlementRouter as `0x${string}`,
    abi: SettlementRouterABI,
    eventName: 'InvoiceSettled',
    onLogs(logs) {
      logs.forEach((log) => {
        const invoiceId = log.args?.invoiceId?.toString();
        const { seller: eventSeller, invoiceAmount } = log.args as any;
        
        if (eventSeller?.toLowerCase() === seller?.toLowerCase() && invoiceId && invoiceAmount) {
          console.log('💰 Invoice settled with amount:', {
            invoiceId,
            invoiceAmount: invoiceAmount?.toString(),
            seller: eventSeller,
          });
          
          // Update frontend score with actual invoice amount
          updateFrontendScore(invoiceId, invoiceAmount as bigint);
          
          // Trigger refetch to ensure sync
          setTimeout(() => triggerRefetch(), 1500);
        }
      });
    },
  });

  // Use frontend score if available, otherwise fall back to chain score
  const displayScore = frontendScore !== null ? frontendScore : (score ? Number(score) : 0);
  const displayTier = frontendTier !== null ? frontendTier : ((tier as ReputationTier | undefined) ?? 0);

  return {
    score: displayScore,
    tier: displayTier,
    tierLabel: TIER_LABELS[displayTier],
    stats: stats as SellerStats | undefined,
    isLoading: isLoadingScore || isLoadingTier || isLoadingStats,
  };
}

