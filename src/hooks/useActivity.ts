import { useState, useEffect, useCallback } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { InvoiceRegistryABI, AdvanceEngineABI, VaultABI, SettlementRouterABI, StakingABI } from '@/lib/abis';
import { formatUnits, formatEther, parseAbiItem } from 'viem';

export interface Activity {
  id: string;
  type: 'invoice_created' | 'invoice_paid' | 'invoice_cleared' | 'advance_received' | 'advance_repaid' | 'vault_deposit' | 'vault_withdraw' | 'stake' | 'unstake';
  title: string;
  description: string;
  amount: number | null;
  direction: 'in' | 'out' | null;
  timestamp: number;
  txHash: string;
  blockNumber: bigint;
}

export function useActivity() {
  const { address } = usePrivyAccount();
  const publicClient = usePublicClient({ chainId: 5003 });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to add activity
  const addActivity = useCallback((activity: Activity) => {
    setActivities((prev) => {
      // Avoid duplicates by checking id (txHash + logIndex if available)
      const exists = prev.some((a) => a.id === activity.id);
      if (exists) return prev;
      
      // Add to beginning and sort by timestamp (newest first)
      const updated = [activity, ...prev];
      return updated.sort((a, b) => b.timestamp - a.timestamp);
    });
  }, []);

  // Watch InvoiceCreated events - real-time
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCreated',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { invoiceId, seller, buyer, amount } = log.args as any;
        if (seller?.toLowerCase() === address?.toLowerCase() || buyer?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `invoice-created-${invoiceId}-${log.transactionHash}-${log.index}`,
            type: 'invoice_created',
            title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Created`,
            description: seller?.toLowerCase() === address?.toLowerCase() 
              ? `Issued to ${buyer?.slice(0, 6)}...${buyer?.slice(-4)}`
              : `Received from ${seller?.slice(0, 6)}...${seller?.slice(-4)}`,
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: null,
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch InvoicePaid events - real-time
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoicePaid',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { invoiceId, buyer, amount } = log.args as any;
        if (buyer?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `invoice-paid-${invoiceId}-${log.transactionHash}-${log.index}`,
            type: 'invoice_paid',
            title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Paid`,
            description: 'Payment submitted',
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: 'out',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch InvoiceCleared events (from InvoiceRegistry) - real-time
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { invoiceId, seller, sellerAmount } = log.args as any;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `invoice-cleared-${invoiceId}-${log.transactionHash}-${log.index}`,
            type: 'invoice_cleared',
            title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Cleared`,
            description: 'Payment received and settled',
            amount: parseFloat(formatUnits(sellerAmount || 0n, 6)),
            direction: 'in',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch InvoiceSettled events (from SettlementRouter - more complete info) - real-time
  useWatchContractEvent({
    address: contractAddresses.SettlementRouter as `0x${string}`,
    abi: SettlementRouterABI,
    eventName: 'InvoiceSettled',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { invoiceId, seller, sellerAmount } = log.args as any;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          // Update or add activity for invoice cleared
          addActivity({
            id: `invoice-settled-${invoiceId}-${log.transactionHash}-${log.index}`,
            type: 'invoice_cleared',
            title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Cleared`,
            description: 'Payment received and settled',
            amount: parseFloat(formatUnits(sellerAmount || 0n, 6)),
            direction: 'in',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch AdvanceRequested events - real-time
  useWatchContractEvent({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    eventName: 'AdvanceRequested',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { invoiceId, seller, advanceAmount } = log.args as any;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `advance-requested-${invoiceId}-${log.transactionHash}-${log.index}`,
            type: 'advance_received',
            title: 'Advance Received',
            description: `On invoice INV-${invoiceId.toString().padStart(10, '0')}`,
            amount: parseFloat(formatUnits(advanceAmount || 0n, 6)),
            direction: 'in',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch AdvanceRepaid events - real-time
  useWatchContractEvent({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    eventName: 'AdvanceRepaid',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { invoiceId, seller, repaymentAmount } = log.args as any;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `advance-repaid-${invoiceId}-${log.transactionHash}-${log.index}`,
            type: 'advance_repaid',
            title: 'Advance Repaid',
            description: `Invoice INV-${invoiceId.toString().padStart(10, '0')} cleared`,
            amount: parseFloat(formatUnits(repaymentAmount || 0n, 6)),
            direction: 'out',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch Vault Deposit events - real-time
  useWatchContractEvent({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    eventName: 'Deposit',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { user, amount } = log.args as any;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `vault-deposit-${log.transactionHash}-${log.index}`,
            type: 'vault_deposit',
            title: 'Vault Deposit',
            description: 'Added liquidity to funding pool',
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: 'out',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch Vault Withdraw events - real-time
  useWatchContractEvent({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    eventName: 'Withdraw',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { user, amount } = log.args as any;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `vault-withdraw-${log.transactionHash}-${log.index}`,
            type: 'vault_withdraw',
            title: 'Vault Withdrawal',
            description: 'Withdrew liquidity from funding pool',
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: 'in',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch Staking Stake events - real-time
  useWatchContractEvent({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    eventName: 'Stake',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { user, usmtAmount } = log.args as any;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `stake-${log.transactionHash}-${log.index}`,
            type: 'stake',
            title: 'Staked USMT+',
            description: 'Staked USMT+ to earn yield',
            amount: parseFloat(formatUnits(usmtAmount || 0n, 6)),
            direction: 'out',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Watch Staking Unstake events - real-time
  useWatchContractEvent({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    eventName: 'Unstake',
    onLogs: async (logs) => {
      for (const log of logs) {
        const { user, usmtAmount } = log.args as any;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          const block = await publicClient?.getBlock({ blockNumber: log.blockNumber });
          addActivity({
            id: `unstake-${log.transactionHash}-${log.index}`,
            type: 'unstake',
            title: 'Unstaked USMT+',
            description: 'Unstaked USMT+ from staking',
            amount: parseFloat(formatUnits(usmtAmount || 0n, 6)),
            direction: 'in',
            timestamp: block ? Number(block.timestamp) * 1000 : Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      }
    },
  });

  // Load past events on mount to show historical activity
  useEffect(() => {
    if (!publicClient || !address) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const fetchPastEvents = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        // Fetch events from last 5,000 blocks (~12-24 hours on Mantle Sepolia) to avoid RPC limits
        const fromBlock = Math.max(0n, currentBlock - BigInt(5000));
        
        const pastActivities: Activity[] = [];
        const blockCache = new Map<string, number>(); // Cache block timestamps for performance
        
        // Helper to get block timestamp (cached)
        const getBlockTimestamp = async (blockNumber: bigint): Promise<number> => {
          const blockKey = blockNumber.toString();
          if (blockCache.has(blockKey)) {
            return blockCache.get(blockKey)!;
          }
          const block = await publicClient.getBlock({ blockNumber });
          const timestamp = Number(block.timestamp) * 1000;
          blockCache.set(blockKey, timestamp);
          return timestamp;
        };

        // Fetch InvoiceCreated events
        try {
          const invoiceCreatedEvents = await publicClient.getLogs({
            address: contractAddresses.InvoiceRegistry as `0x${string}`,
            event: parseAbiItem('event InvoiceCreated(uint256 indexed invoiceId, address indexed seller, address indexed buyer, uint256 amount)'),
            args: {
              seller: address as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of invoiceCreatedEvents) {
            const { invoiceId, seller, buyer, amount } = log.args as any;
            // Only include if user is seller or buyer
            if (seller?.toLowerCase() === address?.toLowerCase() || buyer?.toLowerCase() === address?.toLowerCase()) {
              const timestamp = await getBlockTimestamp(log.blockNumber);
              pastActivities.push({
                id: `invoice-created-${invoiceId}-${log.transactionHash}-${log.index}`,
                type: 'invoice_created',
                title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Created`,
                description: seller?.toLowerCase() === address?.toLowerCase() 
                  ? `Issued to ${buyer?.slice(0, 6)}...${buyer?.slice(-4)}`
                  : `Received from ${seller?.slice(0, 6)}...${seller?.slice(-4)}`,
                amount: parseFloat(formatUnits(amount || 0n, 6)),
                direction: null,
                timestamp,
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            }
          }
        } catch (error) {
          console.warn('Error fetching InvoiceCreated events:', error);
        }

        // Fetch InvoicePaid events
        try {
          const invoicePaidEvents = await publicClient.getLogs({
            address: contractAddresses.InvoiceRegistry as `0x${string}`,
            event: parseAbiItem('event InvoicePaid(uint256 indexed invoiceId, address indexed buyer, uint256 amount)'),
            args: {
              buyer: address as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of invoicePaidEvents) {
            const { invoiceId, buyer, amount } = log.args as any;
            const timestamp = await getBlockTimestamp(log.blockNumber);
            pastActivities.push({
              id: `invoice-paid-${invoiceId}-${log.transactionHash}-${log.index}`,
              type: 'invoice_paid',
              title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Paid`,
              description: 'Payment submitted',
              amount: parseFloat(formatUnits(amount || 0n, 6)),
              direction: 'out',
              timestamp,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          }
        } catch (error) {
          console.warn('Error fetching InvoicePaid events:', error);
        }

        // Fetch InvoiceCleared events
        try {
          const invoiceClearedEvents = await publicClient.getLogs({
            address: contractAddresses.InvoiceRegistry as `0x${string}`,
            event: parseAbiItem('event InvoiceCleared(uint256 indexed invoiceId, address indexed seller, uint256 sellerAmount, uint256 feeAmount, uint256 repaymentAmount)'),
            args: {
              seller: address as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of invoiceClearedEvents) {
            const { invoiceId, seller, sellerAmount } = log.args as any;
            const timestamp = await getBlockTimestamp(log.blockNumber);
            pastActivities.push({
              id: `invoice-cleared-${invoiceId}-${log.transactionHash}-${log.index}`,
              type: 'invoice_cleared',
              title: `Invoice INV-${invoiceId.toString().padStart(10, '0')} Cleared`,
              description: 'Payment received and settled',
              amount: parseFloat(formatUnits(sellerAmount || 0n, 6)),
              direction: 'in',
              timestamp,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          }
        } catch (error) {
          console.warn('Error fetching InvoiceCleared events:', error);
        }

        // Fetch AdvanceRequested events
        try {
          const advanceRequestedEvents = await publicClient.getLogs({
            address: contractAddresses.AdvanceEngine as `0x${string}`,
            event: parseAbiItem('event AdvanceRequested(uint256 indexed invoiceId, address indexed seller, uint256 advanceAmount, uint256 ltvBps, uint256 aprBps)'),
            args: {
              seller: address as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of advanceRequestedEvents) {
            const { invoiceId, seller, advanceAmount } = log.args as any;
            const timestamp = await getBlockTimestamp(log.blockNumber);
            pastActivities.push({
              id: `advance-requested-${invoiceId}-${log.transactionHash}-${log.index}`,
              type: 'advance_received',
              title: 'Advance Received',
              description: `On invoice INV-${invoiceId.toString().padStart(10, '0')}`,
              amount: parseFloat(formatUnits(advanceAmount || 0n, 6)),
              direction: 'in',
              timestamp,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          }
        } catch (error) {
          console.warn('Error fetching AdvanceRequested events:', error);
        }

        // Fetch Vault Deposit events
        try {
          const depositEvents = await publicClient.getLogs({
            address: contractAddresses.Vault as `0x${string}`,
            event: parseAbiItem('event Deposit(address indexed user, uint256 amount, uint256 shares)'),
            args: {
              user: address as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of depositEvents) {
            const { user, amount } = log.args as any;
            const timestamp = await getBlockTimestamp(log.blockNumber);
            pastActivities.push({
              id: `vault-deposit-${log.transactionHash}-${log.index}`,
              type: 'vault_deposit',
              title: 'Vault Deposit',
              description: 'Added liquidity to funding pool',
              amount: parseFloat(formatUnits(amount || 0n, 6)),
              direction: 'out',
              timestamp,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          }
        } catch (error) {
          console.warn('Error fetching Deposit events:', error);
        }

        // Fetch Vault Withdraw events
        try {
          const withdrawEvents = await publicClient.getLogs({
            address: contractAddresses.Vault as `0x${string}`,
            event: parseAbiItem('event Withdraw(address indexed user, uint256 amount, uint256 shares)'),
            args: {
              user: address as `0x${string}`,
            },
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of withdrawEvents) {
            const { user, amount } = log.args as any;
            const timestamp = await getBlockTimestamp(log.blockNumber);
            pastActivities.push({
              id: `vault-withdraw-${log.transactionHash}-${log.index}`,
              type: 'vault_withdraw',
              title: 'Vault Withdrawal',
              description: 'Withdrew liquidity from funding pool',
              amount: parseFloat(formatUnits(amount || 0n, 6)),
              direction: 'in',
              timestamp,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          }
        } catch (error) {
          console.warn('Error fetching Withdraw events:', error);
        }

        // Fetch Stake events
        if (contractAddresses.Staking) {
          try {
            const stakeEvents = await publicClient.getLogs({
              address: contractAddresses.Staking as `0x${string}`,
              event: parseAbiItem('event Stake(address indexed user, uint256 usmtAmount, uint256 susmtAmount)'),
              args: {
                user: address as `0x${string}`,
              },
              fromBlock,
              toBlock: currentBlock,
            });

            for (const log of stakeEvents) {
              const { user, usmtAmount } = log.args as any;
              const timestamp = await getBlockTimestamp(log.blockNumber);
              pastActivities.push({
                id: `stake-${log.transactionHash}-${log.index}`,
                type: 'stake',
                title: 'Staked USMT+',
                description: 'Staked USMT+ to earn yield',
                amount: parseFloat(formatUnits(usmtAmount || 0n, 6)),
                direction: 'out',
                timestamp,
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            }
          } catch (error) {
            console.warn('Error fetching Stake events:', error);
          }
        }

        // Fetch Unstake events
        if (contractAddresses.Staking) {
          try {
            const unstakeEvents = await publicClient.getLogs({
              address: contractAddresses.Staking as `0x${string}`,
              event: parseAbiItem('event Unstake(address indexed user, uint256 usmtAmount, uint256 susmtAmount)'),
              args: {
                user: address as `0x${string}`,
              },
              fromBlock,
              toBlock: currentBlock,
            });

            for (const log of unstakeEvents) {
              const { user, usmtAmount } = log.args as any;
              const timestamp = await getBlockTimestamp(log.blockNumber);
              pastActivities.push({
                id: `unstake-${log.transactionHash}-${log.index}`,
                type: 'unstake',
                title: 'Unstaked USMT+',
                description: 'Unstaked USMT+ from staking',
                amount: parseFloat(formatUnits(usmtAmount || 0n, 6)),
                direction: 'in',
                timestamp,
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
              });
            }
          } catch (error) {
            console.warn('Error fetching Unstake events:', error);
          }
        }

        // Set all past activities, sorted by timestamp (newest first)
        if (pastActivities.length > 0) {
          setActivities((prev) => {
            const combined = [...prev, ...pastActivities];
            // Remove duplicates and sort
            const unique = combined.filter((activity, index, self) => 
              index === self.findIndex((a) => a.id === activity.id)
            );
            return unique.sort((a, b) => b.timestamp - a.timestamp);
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching past events:', error);
        setIsLoading(false);
      }
    };

    fetchPastEvents();
  }, [publicClient, address, addActivity]);

  return {
    activities,
    isLoading,
  };
}

