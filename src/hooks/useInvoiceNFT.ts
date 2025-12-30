import { useReadContract } from 'wagmi'
import { contractAddresses } from '@/lib/contracts'
import { Address } from 'viem'

// InvoiceNFT ABI (simplified - only functions we need)
const INVOICE_NFT_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'invoiceId', type: 'uint256' }],
    name: 'getTokenId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

/**
 * Hook to get InvoiceNFT token ID for an invoice
 */
export function useInvoiceNFT(invoiceId?: bigint) {
  const { data: tokenId, isLoading, error } = useReadContract({
    address: contractAddresses.InvoiceNFT as Address,
    abi: INVOICE_NFT_ABI,
    functionName: 'getTokenId',
    args: invoiceId ? [invoiceId] : undefined,
    query: {
      enabled: !!invoiceId && !!contractAddresses.InvoiceNFT,
    },
  })

  return {
    tokenId: tokenId as bigint | undefined,
    isLoading,
    error,
    nftAddress: contractAddresses.InvoiceNFT as Address | undefined,
  }
}

