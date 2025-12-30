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
        // Initialize to 510 (Tier B) for now, then update from there
        // Use chain score if it's higher than 510, otherwise start at 510
        const initialScore = Math.max(510, chainScore);
        console.log('🎯 Initializing frontend score to:', initialScore, '(chain:', chainScore, ')');
        setFrontendScore(initialScore);
        // Also set tier to B if score is 510 or higher
        if (initialScore >= 500) {
          setFrontendTier(1); // Tier B
        }
      } else if (chainScore > frontendScore) {
        // Update if chain score is higher (more authoritative)
        console.log('🎯 Updating frontend score from chain:', chainScore, '(was:', frontendScore, ')');
        setFrontendScore(chainScore);
        // Update tier based on new score
        const newTier = calculateTier(chainScore);
        setFrontendTier(newTier);
      }
      // If frontendScore > chainScore, keep frontend score (it's a recent update that hasn't synced yet)
    } else if (frontendScore === null) {
      // Initialize to 510 (Tier B) if no chain data yet
      console.log('🎯 Initializing frontend score to default 510 (Tier B)');
      setFrontendScore(510);
      setFrontendTier(1); // Tier B
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

  // Debug: Log score changes
  useEffect(() => {
    const displayScore = frontendScore !== null ? frontendScore : (score ? Number(score) : 0);
    console.log('📊 Reputation score state:', {
      frontendScore,
      chainScore: score ? Number(score) : null,
      displayScore,
      frontendTier,
      chainTier: tier,
    });
  }, [frontendScore, score, frontendTier, tier]);

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
    
    // Calculate new score using functional setState to ensure we use latest values
    const increment = calculateScoreIncrement(invoiceAmount);
    setFrontendScore(prevScore => {
      const currentScore = prevScore !== null ? prevScore : (score ? Number(score) : 450);
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

      // Update tier when score changes
      setFrontendTier(newTier);
      
      return newScore;
    });
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
      
      // Invalidate after a short delay to catch any race conditions
      setTimeout(() => {
        refetchScore();
        refetchTier();
        refetchStats();
      }, 500);
    }
  };

  // Primary: Watch for ReputationUpdated events - most direct signal
  // This event is emitted by Reputation contract when SettlementRouter calls updateReputation
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
          // Immediately sync frontend with chain data
          if (newScore) {
            setFrontendScore(Number(newScore));
          }
          if (newTier !== undefined && newTier !== null) {
            setFrontendTier(Number(newTier) as ReputationTier);
          }
          // Immediate refetch to ensure UI is updated
          triggerRefetch();
        }
      });
    },
  });

  // Watch InvoiceCleared events - trigger reputation refetch
  // SettlementRouter calls reputation.updateReputation() when clearing invoice
  // So when invoice is cleared, reputation is already updated on-chain
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs(logs) {
      logs.forEach((log) => {
        const invoiceId = log.args?.invoiceId?.toString();
        const { seller: eventSeller } = log.args as any;
        
        if (eventSeller?.toLowerCase() === seller?.toLowerCase() && invoiceId) {
          console.log('📄 Invoice cleared - reputation should be updated:', {
            invoiceId,
            seller: eventSeller,
            blockNumber: log.blockNumber?.toString(),
          });
          
          // Reputation is already updated on-chain by SettlementRouter
          // Just trigger immediate refetch to sync with chain
          triggerRefetch();
        }
      });
    },
  });

  // Watch InvoiceSettled events - reputation updated right after this
  // SettlementRouter updates reputation after settlement, so trigger refetch
  useWatchContractEvent({
    address: contractAddresses.SettlementRouter as `0x${string}`,
    abi: SettlementRouterABI,
    eventName: 'InvoiceSettled',
    onLogs(logs) {
      logs.forEach((log) => {
        const invoiceId = log.args?.invoiceId?.toString();
        const { seller: eventSeller, invoiceAmount } = log.args as any;
        
        if (eventSeller?.toLowerCase() === seller?.toLowerCase() && invoiceId) {
          console.log('💰 Invoice settled - reputation updating...', {
            invoiceId,
            invoiceAmount: invoiceAmount?.toString(),
            seller: eventSeller,
          });
          
          // Reputation update happens atomically in same transaction
          // Wait a moment for block confirmation, then refetch
          setTimeout(() => triggerRefetch(), 1000);
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

