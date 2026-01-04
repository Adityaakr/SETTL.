import { useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { StakingABI, USMTPlusABI } from '@/lib/abis';
import { formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { useState } from 'react';

export function useStaking() {
  const { address } = usePrivyAccount();

  const { data: stakedBalance, isLoading: isLoadingStaked } = useReadContract({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    functionName: 'getStakedBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!contractAddresses.Staking && !!address,
      refetchInterval: 30000,
    },
  });

  const { data: susmtBalance, isLoading: isLoadingSusmt } = useReadContract({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    functionName: 'getSusmtBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!contractAddresses.Staking && !!address,
      refetchInterval: 30000,
    },
  });

  const { data: totalStaked } = useReadContract({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    functionName: 'totalStaked',
    query: {
      enabled: !!contractAddresses.Staking,
      refetchInterval: 30000,
    },
  });

  const isLoading = isLoadingStaked || isLoadingSusmt;

  return {
    stakedBalance: stakedBalance ? parseFloat(formatUnits(stakedBalance, 6)) : 0,
    susmtBalance: susmtBalance ? parseFloat(formatUnits(susmtBalance, 6)) : 0,
    totalStaked: totalStaked ? parseFloat(formatUnits(totalStaked, 6)) : 0,
    isLoading,
  };
}

export function useStake() {
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
      retry: 5,
      retryDelay: 1000, // Reduced from 2000ms to 1000ms for faster polling
    },
  });

  const stake = async (amount: string) => {
    if (!contractAddresses.Staking) {
      throw new Error('Staking address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);
    setError(null);

    try {
      const amountInWei = parseUnits(amount, 6);

      const data = encodeFunctionData({
        abi: StakingABI,
        functionName: 'stake',
        args: [amountInWei],
      });

      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.Staking as `0x${string}`,
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
    stake,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useUnstake() {
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
      retry: 5,
      retryDelay: 1000, // Reduced from 2000ms to 1000ms for faster polling
    },
  });

  const unstake = async (amount: string) => {
    if (!contractAddresses.Staking) {
      throw new Error('Staking address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);
    setError(null);

    try {
      const amountInWei = parseUnits(amount, 6);

      const data = encodeFunctionData({
        abi: StakingABI,
        functionName: 'unstake',
        args: [amountInWei],
      });

      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.Staking as `0x${string}`,
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
    unstake,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useUSMTAllowance(spender?: string) {
  const { address } = usePrivyAccount();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || wct === 'privy' || ct.includes('privy') || ct.includes('embedded');
  }) || wallets[0];

  const { data: allowance, refetch } = useReadContract({
    address: contractAddresses.USMTPlus as `0x${string}`,
    abi: USMTPlusABI,
    functionName: 'allowance',
    args: address && spender ? [address, spender as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!spender && !!contractAddresses.USMTPlus,
      refetchInterval: 15000,
    },
  });

  const [hash, setHash] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}` | undefined,
    chainId: 5003,
    query: {
      enabled: !!hash,
    },
  });

  const approve = async (amount: bigint) => {
    if (!spender || !contractAddresses.USMTPlus) {
      throw new Error('Spender or USMTPlus address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);

    try {
      const data = encodeFunctionData({
        abi: USMTPlusABI,
        functionName: 'approve',
        args: [spender as `0x${string}`, amount],
      });

      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.USMTPlus as `0x${string}`,
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
      setIsPending(false);
      throw err;
    }
  };

  return {
    allowance: allowance || BigInt(0),
    approve,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    refetch,
  };
}

