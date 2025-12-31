import { useReadContract } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { DemoUSDCABI } from '@/lib/abis';
import { formatUnits } from 'viem';

/**
 * Hook to fetch USDC balance for the connected wallet
 */
export function useTokenBalance() {
  const { address } = usePrivyAccount();

  const { data: balance, isLoading, error, refetch } = useReadContract({
    address: contractAddresses.DemoUSDC as `0x${string}`,
    abi: DemoUSDCABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddresses.DemoUSDC,
      refetchInterval: 20000, // Reduced frequency to avoid rate limits
    },
  });

  return {
    balance: balance ? parseFloat(formatUnits(balance, 6)) : 0, // USDC has 6 decimals
    rawBalance: balance || BigInt(0),
    isLoading,
    error,
    refetch,
  };
}

