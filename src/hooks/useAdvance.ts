import { useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { AdvanceEngineABI } from '@/lib/abis';
import { formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { useState } from 'react';

export interface Advance {
  invoiceId: bigint;
  seller: string;
  advanceAmount: bigint;
  principal: bigint;
  interest: bigint;
  totalRepayment: bigint;
  requestedAt: bigint;
  repaid: boolean;
}

/**
 * Hook to get advance details for a specific invoice
 */
export function useAdvance(invoiceId: bigint | string | undefined) {
  const {
    data: advance,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    functionName: 'getAdvance',
    args: invoiceId ? [BigInt(invoiceId.toString())] : undefined,
    query: {
      enabled: !!invoiceId && !!contractAddresses.AdvanceEngine,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  // Watch for advance events
  useWatchContractEvent({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    eventName: 'AdvanceRequested',
    onLogs() {
      refetch();
    },
  });

  useWatchContractEvent({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    eventName: 'AdvanceRepaid',
    onLogs() {
      refetch();
    },
  });

  return {
    advance: advance as Advance | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get total debt for a seller
 */
export function useTotalDebt(sellerAddress?: string) {
  const { address } = usePrivyAccount();
  const seller = sellerAddress || address;

  const {
    data: totalDebt,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    functionName: 'getTotalDebt',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.AdvanceEngine,
      refetchInterval: 30000, // Reduced frequency to avoid rate limits
    },
  });

  return {
    totalDebt: totalDebt as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to request an advance on an invoice
 * Uses Privy's embedded wallet for transaction signing
 */
export function useRequestAdvance() {
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || wct === 'privy' || ct.includes('privy') || ct.includes('embedded');
  }) || wallets[0];

  const [hash, setHash] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}` | undefined,
    chainId: 5003,
    query: {
      enabled: !!hash,
      retry: 3,
      retryDelay: 2000,
    },
  });

  const requestAdvance = async (
    invoiceId: bigint | string,
    ltvBps: number, // Loan-to-value in basis points (e.g., 7500 = 75%)
    aprBps: number  // APR in basis points (e.g., 1000 = 10%)
  ) => {
    if (!contractAddresses.AdvanceEngine) {
      throw new Error('AdvanceEngine address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);
    setError(null);

    try {
      const data = encodeFunctionData({
        abi: AdvanceEngineABI,
        functionName: 'requestAdvance',
        args: [BigInt(invoiceId.toString()), BigInt(ltvBps), BigInt(aprBps)],
      });

      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.AdvanceEngine as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address,
          uiOptions: {
            showWalletUIs: false,
          },
        }
      );

      setHash(transactionResult.hash);
      setIsPending(false);
      return transactionResult;
    } catch (err: any) {
      setError(err);
      setIsPending(false);
      throw err;
    }
  };

  return {
    requestAdvance,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

