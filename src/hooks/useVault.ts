import { useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { useWallets, useSendTransaction } from '@privy-io/react-auth';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { DemoUSDCABI, VaultABI } from '@/lib/abis';
import { formatUnits, parseUnits, encodeFunctionData } from 'viem';
import { useState } from 'react';

export function useVault() {
  const { address } = usePrivyAccount();

  const { data: totalLiquidity, isLoading: isLoadingLiquidity, refetch: refetchLiquidity } = useReadContract({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    functionName: 'getTotalLiquidity',
    query: {
      enabled: !!contractAddresses.Vault,
      refetchInterval: false, // Disable polling - rely on event subscriptions
    },
  });

  const { data: totalBorrowed, isLoading: isLoadingBorrowed, refetch: refetchBorrowed } = useReadContract({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    functionName: 'getTotalBorrowed',
    query: {
      enabled: !!contractAddresses.Vault,
      refetchInterval: false, // Disable polling - rely on event subscriptions
    },
  });

  const { data: utilizationRate, isLoading: isLoadingUtilization } = useReadContract({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    functionName: 'getUtilizationRate',
    query: {
      enabled: !!contractAddresses.Vault,
      refetchInterval: false, // Disable polling - rely on event subscriptions
    },
  });

  const { data: userShares, isLoading: isLoadingShares } = useReadContract({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    functionName: 'getShares',
    args: address ? [address] : undefined,
    query: {
      enabled: !!contractAddresses.Vault && !!address,
      refetchInterval: false, // Disable polling - rely on event subscriptions
    },
  });

  const { data: userBalance, isLoading: isLoadingBalance } = useReadContract({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    functionName: 'getBalance',
    args: address ? [address] : undefined,
    query: {
      enabled: !!contractAddresses.Vault && !!address,
      refetchInterval: false, // Disable polling - rely on event subscriptions
    },
  });

  const { data: totalShares } = useReadContract({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    functionName: 'totalShares',
    query: {
      enabled: !!contractAddresses.Vault,
      refetchInterval: false, // Disable polling - rely on event subscriptions
    },
  });

  // Note: Event watching removed due to RPC limitations (501 errors)
  // Data is refreshed via refetchInterval instead

  const isLoading = isLoadingLiquidity || isLoadingBorrowed || isLoadingUtilization || (!!address && (isLoadingShares || isLoadingBalance));

  return {
    totalLiquidity: totalLiquidity ? parseFloat(formatUnits(totalLiquidity, 6)) : 0,
    totalBorrowed: totalBorrowed ? parseFloat(formatUnits(totalBorrowed, 6)) : 0,
    utilizationRate: utilizationRate ? Number(utilizationRate) / 100 : 0, // Convert from basis points
    userShares: userShares || BigInt(0),
    userBalance: userBalance ? parseFloat(formatUnits(userBalance, 6)) : 0,
    totalShares: totalShares || BigInt(0),
    isLoading,
  };
}

export function useDepositVault() {
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  
  // Find embedded wallet - prioritize it over any other wallet
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || 
           wct === 'privy' ||
           ct.includes('privy') ||
           ct.includes('embedded');
  }) || wallets[0]; // Fallback to first wallet if no embedded found

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

  const deposit = async (amount: string) => {
    if (!contractAddresses.Vault || !contractAddresses.DemoUSDC) {
      throw new Error('Vault or DemoUSDC address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);
    setError(null);

    try {
      const amountInWei = parseUnits(amount, 6); // USDC has 6 decimals

      // Encode function data
      const data = encodeFunctionData({
        abi: VaultABI,
        functionName: 'deposit',
        args: [amountInWei],
      });

      // Send transaction using Privy's sendTransaction (uses embedded wallet)
      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.Vault as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address,
          uiOptions: {
            showWalletUIs: false, // Hide transaction modal - transactions auto-sign for embedded wallets
          },
        }
      );

      setHash(transactionResult.hash);
      setIsPending(false);
      return transactionResult;
    } catch (err: any) {
      setError(err);
      setIsPending(false);
      
      // Enhanced error handling for allowance issues
      // "Execution reverted" during gas estimation almost always means insufficient allowance
      const errorMessage = err?.message || err?.shortMessage || String(err);
      const errorMsgLower = errorMessage.toLowerCase();
      
      // Check if using old contract addresses
      const OLD_VAULT = '0xdA8FA5C4Eda1006501F377852BE04cf9beB7Cde9';
      if (contractAddresses.Vault?.toLowerCase() === OLD_VAULT.toLowerCase()) {
        const enhancedError = new Error(
          '❌ Using OLD contract addresses! Please update your .env file with the NEW contract addresses and restart your dev server. ' +
          'NEW Vault: 0x6a8B044A517B8e8f8B8F074bd981FA5149108BCb, ' +
          'NEW Token: 0x2De86556c08Df11E1D35223F0741791fBD847567'
        );
        enhancedError.cause = err;
        throw enhancedError;
      }
      
      // Check for allowance issues first (most common)
      if (errorMsgLower.includes('allowance') ||
          errorMsgLower.includes('insufficient allowance') ||
          errorMsgLower.includes('transferfrom')) {
        const enhancedError = new Error(
          'Insufficient allowance. Please approve USDC spending for the Vault contract first, then try depositing again.'
        );
        enhancedError.cause = err;
        throw enhancedError;
      }
      
      // Check for execution reverted (could be allowance OR missing MINTER_ROLE)
      if (errorMsgLower.includes('execution reverted')) {
        const enhancedError = new Error(
          'Transaction reverted. This could be due to:\n' +
          '1. Missing USDC approval - Click "Approve USDC" button first\n' +
          '2. Missing MINTER_ROLE - Vault may not have permission to mint USMT+. Run: npm run fix:vault-minter'
        );
        enhancedError.cause = err;
        throw enhancedError;
      }
      
      throw err;
    }
  };

  return {
    deposit,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useWithdrawVault() {
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();
  
  // Find embedded wallet - prioritize it over any other wallet
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || 
           wct === 'privy' ||
           ct.includes('privy') ||
           ct.includes('embedded');
  }) || wallets[0]; // Fallback to first wallet if no embedded found

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

  const withdraw = async (usmtAmount: bigint) => {
    if (!contractAddresses.Vault) {
      throw new Error('Vault address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);
    setError(null);

    try {
      // Encode function data - withdraw accepts USMT+ amount (1:1 with USDC)
      const data = encodeFunctionData({
        abi: VaultABI,
        functionName: 'withdraw',
        args: [usmtAmount],
      });

      // Send transaction using Privy's sendTransaction (uses embedded wallet)
      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.Vault as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address,
          uiOptions: {
            showWalletUIs: false, // Hide transaction modal - transactions auto-sign for embedded wallets
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
    withdraw,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useUSDCAllowance(spender?: string) {
  const { address } = usePrivyAccount();
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();

  // Find embedded wallet - prioritize it over any other wallet
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || 
           wct === 'privy' ||
           ct.includes('privy') ||
           ct.includes('embedded');
  }) || wallets[0];

  const { data: allowance, refetch } = useReadContract({
    address: contractAddresses.DemoUSDC as `0x${string}`,
    abi: DemoUSDCABI,
    functionName: 'allowance',
    args: address && spender ? [address, spender as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!spender && !!contractAddresses.DemoUSDC,
      refetchInterval: 15000, // Reduced frequency to avoid rate limits
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

  const approveUSDC = async (amount: bigint) => {
    if (!spender || !contractAddresses.DemoUSDC) {
      throw new Error('Spender or DemoUSDC address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);

    try {
      // Encode function data
      const data = encodeFunctionData({
        abi: DemoUSDCABI,
        functionName: 'approve',
        args: [spender as `0x${string}`, amount],
      });

      // Send transaction using Privy's sendTransaction (uses embedded wallet)
      const transactionResult = await sendTransaction(
        {
          to: contractAddresses.DemoUSDC as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address,
          uiOptions: {
            showWalletUIs: false, // Hide transaction modal - transactions auto-sign for embedded wallets
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
    approve: approveUSDC,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess,
    refetch,
  };
}

