import { useState, useEffect } from 'react';
import { useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { usePublicClient } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { InvoiceRegistryABI } from '@/lib/abis';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';

export type InvoiceStatus = 0 | 1 | 2 | 3; // Issued | Financed | Paid | Cleared

export interface Invoice {
  invoiceId: bigint;
  seller: string;
  buyer: string;
  amount: bigint;
  dueDate: bigint;
  status: InvoiceStatus;
  metadataHash: string;
  createdAt: bigint;
  paidAt: bigint;
  clearedAt: bigint;
}

export function useInvoice(invoiceId: bigint | string | undefined) {
  const { address } = usePrivyAccount();
  
  const {
    data: invoice,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    functionName: 'getInvoice',
    args: invoiceId ? [BigInt(invoiceId.toString())] : undefined,
    query: {
      enabled: !!invoiceId && !!contractAddresses.InvoiceRegistry,
      refetchInterval: false, // Disable polling - rely on event subscriptions for real-time updates
    },
  });

  // Watch for invoice events - simplified to just refetch on any event
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoicePaid',
    onLogs() {
      refetch();
    },
  });

  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs() {
      refetch();
    },
  });

  return {
    invoice: invoice as Invoice | undefined,
    isLoading,
    error,
    refetch,
  };
}

export function useCreateInvoice() {
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
  const [lastSubmittedData, setLastSubmittedData] = useState<string | null>(null); // Prevent duplicate submissions
  const [txSubmittedNoHash, setTxSubmittedNoHash] = useState(false); // Flag when tx submitted but hash unknown

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash: hash as `0x${string}` | undefined,
    chainId: 5003, // Explicitly set Mantle Sepolia chain ID
    query: {
      enabled: !!hash, // Only watch when hash exists
      retry: 3, // Retry a few times
      retryDelay: 2000, // Wait 2 seconds between retries
    },
  });

  const createInvoice = async (
    buyer: string,
    amount: string, // Amount in USDC (6 decimals)
    dueDate: number, // Unix timestamp
    metadataHash?: string
  ) => {
    if (!contractAddresses.InvoiceRegistry) {
      throw new Error('InvoiceRegistry address not configured');
    }

    if (!embeddedWallet) {
      throw new Error('No wallet available. Please connect your Privy embedded wallet.');
    }

    setIsPending(true);
    setError(null);

    try {
      // Convert amount to 6 decimals (USDC format)
      const amountInWei = BigInt(Math.floor(parseFloat(amount) * 1e6));
      
      // Encode function data
      const data = encodeFunctionData({
        abi: InvoiceRegistryABI,
        functionName: 'createInvoice',
        args: [
          buyer as `0x${string}`,
          amountInWei,
          BigInt(dueDate),
          metadataHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        ],
      });

      // Create a unique key for this transaction to prevent duplicates
      const txKey = `${buyer}-${amountInWei}-${dueDate}`;
      
      // Prevent duplicate submissions
      if (lastSubmittedData === txKey && hash) {
        console.log('Transaction already submitted, returning existing hash');
        setIsPending(false);
        return { hash: hash as `0x${string}` };
      }
      
      setLastSubmittedData(txKey);

      // Send transaction using Privy's sendTransaction (uses embedded wallet)
      // With noPromptOnSignature: true in config, transactions should sign automatically without pop-ups
      // Explicitly set chainId to Mantle Sepolia (5003)
      let transactionResult;
      try {
        // First attempt: Let Privy estimate gas automatically
        transactionResult = await sendTransaction(
        {
          to: contractAddresses.InvoiceRegistry as `0x${string}`,
          data: data,
          value: 0n,
          chainId: 5003,
        },
        {
          address: embeddedWallet.address, // Explicitly use embedded wallet
          uiOptions: {
            showWalletUIs: false, // CRITICAL: Hide transaction modal - transactions should auto-sign for embedded wallets
          },
        }
      );

        // Success! Set hash and return
        setHash(transactionResult.hash);
      setIsPending(false);
        return transactionResult;
    } catch (err: any) {
        // Transaction might have been submitted even if error was thrown
        // Try to extract hash from result (some libraries return result before throwing)
        const resultHash = transactionResult?.hash;
        
        // Also check error object for hash
        const errorHash = err?.hash || 
          err?.transactionHash || 
          err?.data?.hash || 
          err?.receipt?.transactionHash ||
          err?.transaction?.hash ||
          err?.txHash ||
          err?.result?.hash ||
          err?.response?.hash ||
          (err?.data && typeof err.data === 'object' ? err.data.hash : null);
        
        const txHash = resultHash || errorHash;
        
        // Handle gas estimation errors - RPC might not support eth_estimateGas
        // Or the transaction might be reverting due to contract state issues
        if (err?.message?.includes('eth_estimateGas') || 
            err?.message?.includes('EstimateGasExecutionError') ||
            err?.message?.includes('execution reverted') ||
            err?.code === -32601) {
          
          // If it's an execution revert, provide helpful error message
          if (err?.message?.includes('execution reverted')) {
            console.error('❌ Transaction would revert:', err);
            setIsPending(false);
            setError(new Error(
              'Transaction would fail. Possible causes: ' +
              '1) InvoiceNFT contract not properly configured (MINTER_ROLE or invoiceRegistry not set), ' +
              '2) Invalid invoice parameters, ' +
              '3) Contract address mismatch. Please verify contract deployment.'
            ));
            throw err;
          }
          
          // If gas estimation fails with unreasonable values, try with a reasonable manual limit
          if (err?.message?.includes('intrinsic gas too low') || 
              err?.message?.includes('gas too low')) {
            console.warn('⚠️ Gas estimation issue detected. Retrying with reasonable gas limit...');
            try {
              // Retry with a reasonable gas limit for invoice creation + NFT minting
              transactionResult = await sendTransaction(
              {
                to: contractAddresses.InvoiceRegistry as `0x${string}`,
                data: data,
                value: 0n,
                chainId: 5003,
                gas: 3000000n, // 3M gas should be more than enough for invoice creation + NFT mint
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
            } catch (retryErr: any) {
              console.error('❌ Retry with manual gas also failed:', retryErr);
              setIsPending(false);
              setError(new Error('Transaction failed. Please try again or check contract configuration.'));
              throw retryErr;
            }
          }
          
          console.warn('⚠️ Gas estimation failed (RPC may not support it). Transaction may still work if sent directly.');
          setIsPending(false);
          setError(new Error('Gas estimation failed. Please try again or check if the transaction was submitted.'));
          throw err;
        }
        
        // Handle "already known" error - transaction WAS submitted successfully
        if (err?.message?.includes('already known') || 
            err?.message?.includes('nonce too low') || 
            err?.message?.includes('replacement transaction underpriced') ||
            err?.message?.includes('Transaction appears to have been submitted')) {
          
          console.warn('⚠️ RPC returned "already known" - transaction was submitted successfully', {
            error: err,
            resultHash,
            errorHash,
            txHash,
          });
          
      if (txHash) {
            // Found the hash! Transaction was submitted
            console.log('✅ Found transaction hash, transaction was submitted:', txHash);
        setHash(txHash);
            setIsPending(false);
            setError(null);
        return { hash: txHash };
      }
      
          // No hash found, but transaction was submitted
          // Set flag so component can try to find it via alternative methods
          console.warn('⚠️ Transaction was submitted but hash not found. Will attempt to find it.');
          setIsPending(false);
        setError(null);
          setTxSubmittedNoHash(true); // Set flag so component can handle it
          // Return undefined hash but transaction was submitted
          return { hash: undefined };
        }
        
        // If we have a hash from anywhere, transaction was submitted
        if (txHash) {
          console.log('✅ Transaction submitted successfully with hash:', txHash);
          setHash(txHash);
        setIsPending(false);
          setError(null);
          return { hash: txHash };
        }
        
        // Handle user rejection
        if (err?.message?.includes('user rejected') || err?.message?.includes('User denied')) {
        setError(new Error('Transaction was rejected. Please try again.'));
          setIsPending(false);
        throw err;
        }
        
        // Other errors
        setError(err);
        setIsPending(false);
        throw err;
      }
    } catch (err: any) {
      // Final catch for any unexpected errors
      setIsPending(false);
      setError(err);
      throw err;
    }
  };

  // Log state changes for debugging
  useEffect(() => {
    if (hash) {
      console.log('📝 Invoice creation state:', {
        hash,
        isPending,
        isConfirming,
        isSuccess,
        receiptStatus: receipt?.status,
        error: error?.message,
      });
    }
  }, [hash, isPending, isConfirming, isSuccess, receipt, error]);

  return {
    createInvoice,
    hash: hash as `0x${string}` | undefined,
    isPending,
    isConfirming,
    isSuccess: isSuccess || (receipt?.status === 'success'), // Fallback check
    error,
    receipt, // Expose receipt for additional checks
    txSubmittedNoHash, // Expose flag for component to handle missing hash case
  };
}

export function useSellerInvoices(sellerAddress?: string) {
  const { address } = usePrivyAccount();
  const seller = sellerAddress || address;

  const {
    data: invoiceIds,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    functionName: 'getSellerInvoices',
    args: seller ? [seller as `0x${string}`] : undefined,
    query: {
      enabled: !!seller && !!contractAddresses.InvoiceRegistry,
      refetchInterval: 10000, // Poll every 10 seconds for invoice updates
    },
  });

  return {
    invoiceIds: invoiceIds as bigint[] | undefined,
    isLoading,
    error,
    refetch,
  };
}

// Hook to fetch all seller invoices with full data
export function useSellerInvoicesWithData(sellerAddress?: string) {
  const { invoiceIds, isLoading: isLoadingIds, error: idsError, refetch: refetchIds } = useSellerInvoices(sellerAddress);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const publicClient = usePublicClient({ chainId: 5003 });

  // Fetch invoice data for each ID
  useEffect(() => {
    if (!invoiceIds || invoiceIds.length === 0 || !contractAddresses.InvoiceRegistry || !publicClient) {
      setInvoices([]);
      setIsLoadingInvoices(false);
      return;
    }

    setIsLoadingInvoices(true);
    setError(null);

    const fetchInvoices = async () => {
      try {
        // Fetch all invoices in parallel with timeout
        const invoicePromises = invoiceIds.map(async (invoiceId) => {
          try {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            
            const fetchPromise = publicClient.readContract({
              address: contractAddresses.InvoiceRegistry as `0x${string}`,
              abi: InvoiceRegistryABI,
              functionName: 'getInvoice',
              args: [invoiceId],
            }) as Promise<Invoice>;
            
            const invoice = await Promise.race([fetchPromise, timeoutPromise]) as Invoice;
            return invoice;
          } catch (err) {
            console.error(`Error fetching invoice ${invoiceId}:`, err);
            return null;
          }
        });

        const fetchedInvoices = await Promise.all(invoicePromises);
        // Filter out null values and sort by createdAt (newest first)
        const validInvoices = fetchedInvoices
          .filter((inv): inv is Invoice => inv !== null)
          .sort((a, b) => {
            const aTime = Number(a.createdAt);
            const bTime = Number(b.createdAt);
            return bTime - aTime; // Newest first
          });

        setInvoices(validInvoices);
      } catch (err) {
        console.error('Error fetching invoices:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch invoices'));
      } finally {
        setIsLoadingInvoices(false);
      }
    };

    // Add a small delay to batch requests
    const timeoutId = setTimeout(fetchInvoices, 100);
    return () => clearTimeout(timeoutId);
  }, [invoiceIds, publicClient]);

  // Watch for invoice events to refetch (simplified to reduce load)
  // Only watch for critical events and debounce refetches
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCreated',
    onLogs() {
      // Debounce refetch to avoid rapid calls
      setTimeout(() => refetchIds(), 1000);
    },
  });

  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs() {
      // Debounce refetch to avoid rapid calls
      setTimeout(() => refetchIds(), 2000);
    },
  });

  return {
    invoices,
    isLoading: isLoadingIds || isLoadingInvoices,
    error: idsError || error,
    refetch: refetchIds,
  };
}

