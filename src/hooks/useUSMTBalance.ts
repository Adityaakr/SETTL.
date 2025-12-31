import { useReadContract } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { USMTPlusABI } from '@/lib/abis';
import { formatUnits } from 'viem';

/**
 * Hook to fetch USMT+ token balance for the connected wallet
 */
export function useUSMTBalance() {
  const { address } = usePrivyAccount();

  const { data: balance, isLoading, error, refetch } = useReadContract({
    address: contractAddresses.USMTPlus as `0x${string}`,
    abi: USMTPlusABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddresses.USMTPlus,
      refetchInterval: 20000, // Reduced frequency to avoid rate limits
    },
  });

  return {
    balance: balance ? parseFloat(formatUnits(balance, 6)) : 0, // USMT+ has 6 decimals
    rawBalance: balance || BigInt(0),
    isLoading,
    error,
    refetch,
  };
}

