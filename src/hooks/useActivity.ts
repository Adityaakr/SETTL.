import { useState, useEffect, useCallback } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { InvoiceRegistryABI, AdvanceEngineABI, VaultABI, SettlementRouterABI, StakingABI } from '@/lib/abis';
import { formatUnits, formatEther, parseEventLogs } from 'viem';
import { useSellerInvoicesWithData, Invoice } from './useInvoice';

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
  const { invoices } = useSellerInvoicesWithData(address);
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

  // Watch InvoiceCreated events
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCreated',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, seller, buyer, amount } = (log as any).args;
        if (seller?.toLowerCase() === address?.toLowerCase() || buyer?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `invoice-created-${invoiceId}-${log.transactionHash}-${log.logIndex}`,
            type: 'invoice_created',
            title: `Invoice INV-${invoiceId.toString().padStart(3, '0')} Created`,
            description: seller?.toLowerCase() === address?.toLowerCase() 
              ? `Issued to ${buyer?.slice(0, 6)}...${buyer?.slice(-4)}`
              : `Received from ${seller?.slice(0, 6)}...${seller?.slice(-4)}`,
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: null,
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch InvoicePaid events
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoicePaid',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, buyer, amount } = (log as any).args;
        if (buyer?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `invoice-paid-${invoiceId}-${log.transactionHash}-${log.logIndex}`,
            type: 'invoice_paid',
            title: `Invoice INV-${invoiceId.toString().padStart(3, '0')} Paid`,
            description: 'Payment submitted',
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: 'out',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch InvoiceCleared events (from InvoiceRegistry)
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCleared',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, seller, sellerAmount } = (log as any).args;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `invoice-cleared-${invoiceId}-${log.transactionHash}-${log.logIndex}`,
            type: 'invoice_cleared',
            title: `Invoice INV-${invoiceId.toString().padStart(3, '0')} Cleared`,
            description: 'Payment received and settled',
            amount: parseFloat(formatUnits(sellerAmount || 0n, 6)),
            direction: 'in',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch InvoiceSettled events (from SettlementRouter - more complete info)
  useWatchContractEvent({
    address: contractAddresses.SettlementRouter as `0x${string}`,
    abi: SettlementRouterABI,
    eventName: 'InvoiceSettled',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, seller, sellerAmount } = (log as any).args;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          // Update or add activity for invoice cleared
          addActivity({
            id: `invoice-settled-${invoiceId}-${log.transactionHash}-${log.logIndex}`,
            type: 'invoice_cleared',
            title: `Invoice INV-${invoiceId.toString().padStart(3, '0')} Cleared`,
            description: 'Payment received and settled',
            amount: parseFloat(formatUnits(sellerAmount || 0n, 6)),
            direction: 'in',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch AdvanceRequested events
  useWatchContractEvent({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    eventName: 'AdvanceRequested',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, seller, advanceAmount } = (log as any).args;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `advance-requested-${invoiceId}-${log.transactionHash}-${log.logIndex}`,
            type: 'advance_received',
            title: 'Advance Received',
            description: `On invoice INV-${invoiceId.toString().padStart(3, '0')}`,
            amount: parseFloat(formatUnits(advanceAmount || 0n, 6)),
            direction: 'in',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch AdvanceRepaid events
  useWatchContractEvent({
    address: contractAddresses.AdvanceEngine as `0x${string}`,
    abi: AdvanceEngineABI,
    eventName: 'AdvanceRepaid',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, seller, repaymentAmount } = (log as any).args;
        if (seller?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `advance-repaid-${invoiceId}-${log.transactionHash}-${log.logIndex}`,
            type: 'advance_repaid',
            title: 'Advance Repaid',
            description: `Invoice INV-${invoiceId.toString().padStart(3, '0')} cleared`,
            amount: parseFloat(formatUnits(repaymentAmount || 0n, 6)),
            direction: 'out',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch Vault Deposit events
  useWatchContractEvent({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    eventName: 'Deposit',
    onLogs(logs) {
      logs.forEach((log) => {
        const { user, amount } = (log as any).args;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `vault-deposit-${log.transactionHash}-${log.logIndex}`,
            type: 'vault_deposit',
            title: 'Vault Deposit',
            description: 'Added liquidity to funding pool',
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: 'out',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch Vault Withdraw events
  useWatchContractEvent({
    address: contractAddresses.Vault as `0x${string}`,
    abi: VaultABI,
    eventName: 'Withdraw',
    onLogs(logs) {
      logs.forEach((log) => {
        const { user, amount } = (log as any).args;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `vault-withdraw-${log.transactionHash}-${log.logIndex}`,
            type: 'vault_withdraw',
            title: 'Vault Withdrawal',
            description: 'Withdrew liquidity from funding pool',
            amount: parseFloat(formatUnits(amount || 0n, 6)),
            direction: 'in',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch Staking Stake events
  useWatchContractEvent({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    eventName: 'Stake',
    onLogs(logs) {
      logs.forEach((log) => {
        const { user, usmtAmount } = (log as any).args;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `stake-${log.transactionHash}-${log.logIndex}`,
            type: 'stake',
            title: 'Staked USMT+',
            description: 'Staked USMT+ to earn yield',
            amount: parseFloat(formatUnits(usmtAmount || 0n, 6)),
            direction: 'out',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Watch Staking Unstake events
  useWatchContractEvent({
    address: contractAddresses.Staking as `0x${string}`,
    abi: StakingABI,
    eventName: 'Unstake',
    onLogs(logs) {
      logs.forEach((log) => {
        const { user, usmtAmount } = (log as any).args;
        if (user?.toLowerCase() === address?.toLowerCase()) {
          addActivity({
            id: `unstake-${log.transactionHash}-${log.logIndex}`,
            type: 'unstake',
            title: 'Unstaked USMT+',
            description: 'Unstaked USMT+ from staking',
            amount: parseFloat(formatUnits(usmtAmount || 0n, 6)),
            direction: 'in',
            timestamp: Date.now(),
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          });
        }
      });
    },
  });

  // Load past events on mount
  useEffect(() => {
    if (!publicClient || !address) {
      setIsLoading(false);
      return;
    }

    const fetchPastEvents = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 Fetching past events for activity feed...', { address });
        
        const currentBlock = await publicClient.getBlockNumber();
        console.log('📦 Current block:', currentBlock.toString());
        
        // Fetch events from last ~10k blocks (roughly last day on Mantle)
        // Reduced further to improve performance and reliability
        const BLOCKS_TO_SEARCH = 10000n;
        const fromBlock = currentBlock > BLOCKS_TO_SEARCH ? currentBlock - BLOCKS_TO_SEARCH : 0n;
        console.log('🔎 Searching blocks:', fromBlock.toString(), 'to', currentBlock.toString());
        
        const allActivities: Activity[] = [];

        // Helper to get block timestamp
        const getBlockTimestamp = async (blockNumber: bigint) => {
          try {
            const block = await publicClient.getBlock({ blockNumber });
            return Number(block.timestamp) * 1000; // Convert to milliseconds
          } catch {
            return Date.now(); // Fallback to current time
          }
        };

        // Helper to create activity from event log
        const createActivityFromLog = async (
          log: any,
          type: Activity['type'],
          title: string,
          description: string,
          amount: bigint | null,
          direction: Activity['direction'],
          invoiceId?: bigint
        ): Promise<Activity | null> => {
          const timestamp = await getBlockTimestamp(log.blockNumber || 0n);
          const activityId = invoiceId 
            ? `${type}-${invoiceId}-${log.transactionHash}-${log.logIndex || 0}`
            : `${type}-${log.transactionHash}-${log.logIndex || 0}`;
          
          return {
            id: activityId,
            type,
            title,
            description,
            amount: amount ? parseFloat(formatUnits(amount, 6)) : null,
            direction,
            timestamp,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber || 0n,
          };
        };

        // Fetch InvoiceSettled events (most important - shows cleared invoices)
        if (contractAddresses.SettlementRouter) {
          try {
            console.log('📋 Fetching InvoiceSettled events from SettlementRouter...');
            const rawLogs = await publicClient.getLogs({
              address: contractAddresses.SettlementRouter as `0x${string}`,
              fromBlock,
              toBlock: currentBlock,
            });
            console.log('📋 Raw logs fetched:', rawLogs.length);

            try {
              const parsedLogs = parseEventLogs({
                abi: SettlementRouterABI,
                logs: rawLogs,
                eventName: 'InvoiceSettled',
              });
              console.log('✅ Parsed InvoiceSettled logs:', parsedLogs.length);

              for (const log of parsedLogs) {
                const decoded = log.args as any;
                console.log('🔍 Checking log:', { seller: decoded.seller, address });
                if (decoded.seller?.toLowerCase() === address?.toLowerCase()) {
                  console.log('✅ Match found for InvoiceSettled event');
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'invoice_cleared',
                    `Invoice INV-${decoded.invoiceId?.toString().padStart(3, '0') || 'N/A'} Cleared`,
                    'Payment received and settled',
                    decoded.sellerAmount || null,
                    'in',
                    decoded.invoiceId
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added activity:', activity.title);
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing InvoiceSettled logs:', parseErr);
            }
          } catch (err) {
            console.error('❌ Error fetching SettlementRouter events:', err);
          }
        } else {
          console.warn('⚠️ SettlementRouter address not configured');
        }

        // Fetch InvoiceCreated events
        if (contractAddresses.InvoiceRegistry) {
          try {
            console.log('📋 Fetching InvoiceCreated events from InvoiceRegistry...');
            const rawLogs = await publicClient.getLogs({
              address: contractAddresses.InvoiceRegistry as `0x${string}`,
              fromBlock,
              toBlock: currentBlock,
            });
            console.log('📋 Raw InvoiceRegistry logs fetched:', rawLogs.length);

            // Parse InvoiceCreated events
            try {
              const createdLogs = parseEventLogs({
                abi: InvoiceRegistryABI,
                logs: rawLogs,
                eventName: 'InvoiceCreated',
              });
              console.log('✅ Parsed InvoiceCreated logs:', createdLogs.length);

              for (const log of createdLogs) {
                const decoded = (log as any).args;
                if (decoded?.seller?.toLowerCase() === address?.toLowerCase() || decoded?.buyer?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'invoice_created',
                    `Invoice INV-${decoded.invoiceId?.toString().padStart(3, '0') || 'N/A'} Created`,
                    decoded.seller?.toLowerCase() === address?.toLowerCase()
                      ? `Issued to ${decoded.buyer?.slice(0, 6)}...${decoded.buyer?.slice(-4)}`
                      : `Received from ${decoded.seller?.slice(0, 6)}...${decoded.seller?.slice(-4)}`,
                    decoded.amount || null,
                    null,
                    decoded.invoiceId
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added InvoiceCreated activity:', activity.title);
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing InvoiceCreated logs:', parseErr);
            }

            // Parse InvoicePaid events
            try {
              const paidLogs = parseEventLogs({
                abi: InvoiceRegistryABI,
                logs: rawLogs,
                eventName: 'InvoicePaid',
              });
              console.log('✅ Parsed InvoicePaid logs:', paidLogs.length);

              for (const log of paidLogs) {
                const decoded = (log as any).args;
                if (decoded?.buyer?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'invoice_paid',
                    `Invoice INV-${decoded.invoiceId?.toString().padStart(3, '0') || 'N/A'} Paid`,
                    'Payment submitted',
                    decoded.amount || null,
                    'out',
                    decoded.invoiceId
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added InvoicePaid activity:', activity.title);
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing InvoicePaid logs:', parseErr);
            }
          } catch (err) {
            console.error('❌ Error fetching InvoiceRegistry events:', err);
          }
        } else {
          console.warn('⚠️ InvoiceRegistry address not configured');
        }

        // Fetch AdvanceRequested events
        if (contractAddresses.AdvanceEngine) {
          try {
            console.log('📋 Fetching AdvanceRequested events...');
            const rawLogs = await publicClient.getLogs({
              address: contractAddresses.AdvanceEngine as `0x${string}`,
              fromBlock,
              toBlock: currentBlock,
            });
            console.log('📋 Raw AdvanceEngine logs fetched:', rawLogs.length);

            try {
              const parsedLogs = parseEventLogs({
                abi: AdvanceEngineABI,
                logs: rawLogs,
                eventName: 'AdvanceRequested',
              });
              console.log('✅ Parsed AdvanceRequested logs:', parsedLogs.length);

              for (const log of parsedLogs) {
                const decoded = (log as any).args;
                if (decoded?.seller?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'advance_received',
                    'Advance Received',
                    `On invoice INV-${decoded.invoiceId?.toString().padStart(3, '0') || 'N/A'}`,
                    decoded.advanceAmount || null,
                    'in',
                    decoded.invoiceId
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added AdvanceRequested activity:', activity.title);
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing AdvanceRequested logs:', parseErr);
            }

            // Parse AdvanceRepaid events
            try {
              const repaidLogs = parseEventLogs({
                abi: AdvanceEngineABI,
                logs: rawLogs,
                eventName: 'AdvanceRepaid',
              });
              console.log('✅ Parsed AdvanceRepaid logs:', repaidLogs.length);

              for (const log of repaidLogs) {
                const decoded = (log as any).args;
                if (decoded?.seller?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'advance_repaid',
                    'Advance Repaid',
                    `Invoice INV-${decoded.invoiceId?.toString().padStart(3, '0') || 'N/A'} cleared`,
                    decoded.repaymentAmount || null,
                    'out',
                    decoded.invoiceId
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added AdvanceRepaid activity:', activity.title);
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing AdvanceRepaid logs:', parseErr);
            }
          } catch (err) {
            console.error('❌ Error fetching AdvanceEngine events:', err);
          }
        }

        // Fetch Vault Deposit/Withdraw events
        if (contractAddresses.Vault) {
          try {
            console.log('📋 Fetching Vault events...');
            const rawLogs = await publicClient.getLogs({
              address: contractAddresses.Vault as `0x${string}`,
              fromBlock,
              toBlock: currentBlock,
            });
            console.log('📋 Raw Vault logs fetched:', rawLogs.length);

            // Parse Deposit events
            try {
              const depositLogs = parseEventLogs({
                abi: VaultABI,
                logs: rawLogs,
                eventName: 'Deposit',
              });
              console.log('✅ Parsed Vault Deposit logs:', depositLogs.length);

              for (const log of depositLogs) {
                const decoded = (log as any).args;
                if (decoded?.user?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'vault_deposit',
                    'Vault Deposit',
                    'Added liquidity to funding pool',
                    decoded.amount || null,
                    'out',
                    undefined
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added Vault Deposit activity');
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing Vault Deposit logs:', parseErr);
            }

            // Parse Withdraw events
            try {
              const withdrawLogs = parseEventLogs({
                abi: VaultABI,
                logs: rawLogs,
                eventName: 'Withdraw',
              });
              console.log('✅ Parsed Vault Withdraw logs:', withdrawLogs.length);

              for (const log of withdrawLogs) {
                const decoded = (log as any).args;
                if (decoded?.user?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'vault_withdraw',
                    'Vault Withdrawal',
                    'Withdrew liquidity from funding pool',
                    decoded.amount || null,
                    'in',
                    undefined
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added Vault Withdraw activity');
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing Vault Withdraw logs:', parseErr);
            }
          } catch (err) {
            console.error('❌ Error fetching Vault events:', err);
          }
        }

        // Fetch Staking Stake/Unstake events
        if (contractAddresses.Staking) {
          try {
            console.log('📋 Fetching Staking events...');
            const rawLogs = await publicClient.getLogs({
              address: contractAddresses.Staking as `0x${string}`,
              fromBlock,
              toBlock: currentBlock,
            });
            console.log('📋 Raw Staking logs fetched:', rawLogs.length);

            // Parse Stake events
            try {
              const stakeLogs = parseEventLogs({
                abi: StakingABI,
                logs: rawLogs,
                eventName: 'Stake',
              });
              console.log('✅ Parsed Stake logs:', stakeLogs.length);

              for (const log of stakeLogs) {
                const decoded = (log as any).args;
                if (decoded?.user?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'stake',
                    'Staked USMT+',
                    'Staked USMT+ to earn yield',
                    decoded.usmtAmount || null,
                    'out',
                    undefined
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added Stake activity');
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing Stake logs:', parseErr);
            }

            // Parse Unstake events
            try {
              const unstakeLogs = parseEventLogs({
                abi: StakingABI,
                logs: rawLogs,
                eventName: 'Unstake',
              });
              console.log('✅ Parsed Unstake logs:', unstakeLogs.length);

              for (const log of unstakeLogs) {
                const decoded = (log as any).args;
                if (decoded?.user?.toLowerCase() === address?.toLowerCase()) {
                  const activity = await createActivityFromLog(
                    { ...log, transactionHash: log.transactionHash, blockNumber: log.blockNumber, logIndex: log.logIndex },
                    'unstake',
                    'Unstaked USMT+',
                    'Unstaked USMT+ from staking',
                    decoded.usmtAmount || null,
                    'in',
                    undefined
                  );
                  if (activity) {
                    allActivities.push(activity);
                    console.log('➕ Added Unstake activity');
                  }
                }
              }
            } catch (parseErr) {
              console.error('❌ Error parsing Unstake logs:', parseErr);
            }
          } catch (err) {
            console.error('❌ Error fetching Staking events:', err);
          }
        }


        // Sort by timestamp (newest first) and set activities
        const sortedActivities = allActivities.sort((a, b) => b.timestamp - a.timestamp);
        console.log('✅ Total activities from events:', sortedActivities.length);
        setActivities(sortedActivities);
      } catch (err) {
        console.error('❌ Error fetching past events:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPastEvents();
  }, [publicClient, address]);

  // Also create activities from invoice data (fallback/supplement)
  useEffect(() => {
    if (!invoices || invoices.length === 0) return;

    console.log('📄 Creating activities from invoices:', invoices.length);
    const invoiceActivities: Activity[] = [];

    invoices.forEach((invoice: Invoice) => {
      // Add invoice created activity
      if (invoice.createdAt && invoice.createdAt > 0n) {
        const createdAt = Number(invoice.createdAt) * 1000; // Convert to milliseconds
        invoiceActivities.push({
          id: `invoice-created-${invoice.invoiceId}-from-data`,
          type: 'invoice_created',
          title: `Invoice INV-${invoice.invoiceId.toString().padStart(3, '0')} Created`,
          description: invoice.seller?.toLowerCase() === address?.toLowerCase()
            ? `Issued to ${invoice.buyer?.slice(0, 6)}...${invoice.buyer?.slice(-4)}`
            : `Received from ${invoice.seller?.slice(0, 6)}...${invoice.seller?.slice(-4)}`,
          amount: parseFloat(formatUnits(invoice.amount || 0n, 6)),
          direction: null,
          timestamp: createdAt,
          txHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
          blockNumber: 0n,
        });
      }

      // Add invoice cleared activity if cleared
      if (invoice.status === 3 && invoice.clearedAt && invoice.clearedAt > 0n) {
        const clearedAt = Number(invoice.clearedAt) * 1000; // Convert to milliseconds
        invoiceActivities.push({
          id: `invoice-cleared-${invoice.invoiceId}-from-data`,
          type: 'invoice_cleared',
          title: `Invoice INV-${invoice.invoiceId.toString().padStart(3, '0')} Cleared`,
          description: 'Payment received and settled',
          amount: parseFloat(formatUnits(invoice.amount || 0n, 6)),
          direction: 'in',
          timestamp: clearedAt,
          txHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
          blockNumber: 0n,
        });
      }
    });

    // Merge with existing activities, avoiding duplicates
    setActivities((prev) => {
      const merged = [...prev];
      invoiceActivities.forEach((newActivity) => {
        const exists = merged.some((a) => 
          a.id === newActivity.id || 
          (a.type === newActivity.type && a.title === newActivity.title)
        );
        if (!exists) {
          merged.push(newActivity);
        }
      });
      // Sort by timestamp (newest first)
      return merged.sort((a, b) => b.timestamp - a.timestamp);
    });
    console.log('✅ Added', invoiceActivities.length, 'activities from invoice data');
  }, [invoices, address]);

  return {
    activities,
    isLoading,
  };
}

