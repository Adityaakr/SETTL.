import { useState, useEffect, useCallback } from 'react';
import { useWatchContractEvent, usePublicClient } from 'wagmi';
import { usePrivyAccount } from './usePrivyAccount';
import { contractAddresses } from '@/lib/contracts';
import { InvoiceRegistryABI, AdvanceEngineABI, VaultABI, SettlementRouterABI, StakingABI } from '@/lib/abis';
import { formatUnits, formatEther } from 'viem';

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

  // Watch InvoiceCreated events
  useWatchContractEvent({
    address: contractAddresses.InvoiceRegistry as `0x${string}`,
    abi: InvoiceRegistryABI,
    eventName: 'InvoiceCreated',
    onLogs(logs) {
      logs.forEach((log) => {
        const { invoiceId, seller, buyer, amount } = log.args as any;
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
        const { invoiceId, buyer, amount } = log.args as any;
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
        const { invoiceId, seller, sellerAmount } = log.args as any;
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
        const { invoiceId, seller, sellerAmount } = log.args as any;
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
        const { invoiceId, seller, advanceAmount } = log.args as any;
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
        const { invoiceId, seller, repaymentAmount } = log.args as any;
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
        const { user, amount } = log.args as any;
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
        const { user, amount } = log.args as any;
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
        const { user, usmtAmount } = log.args as any;
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
        const { user, usmtAmount } = log.args as any;
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

  // Load past events on mount (optional - can be expensive, so we'll do it sparingly)
  useEffect(() => {
    if (!publicClient || !address) {
      setIsLoading(false);
      return;
    }

    // For now, we'll rely on live events
    // In production, you might want to fetch past events from a block explorer or indexer
    setIsLoading(false);
  }, [publicClient, address]);

  return {
    activities,
    isLoading,
  };
}

