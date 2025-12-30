import { useEffect } from 'react';
import { useAccount as useWagmiAccount } from 'wagmi';
import { useWallets, usePrivy } from '@privy-io/react-auth';

/**
 * Hook that ensures we use Privy embedded wallet instead of MetaMask
 * This wraps useAccount and forces the embedded wallet to be active
 */
export function usePrivyAccount() {
  const { wallets, setActiveWallet } = useWallets();
  const { authenticated, user } = usePrivy();
  const wagmiAccount = useWagmiAccount();

  // Find embedded wallet
  const embeddedWallet = wallets.find(w => {
    const ct = w.connectorType?.toLowerCase() || '';
    const wct = w.walletClientType?.toLowerCase() || '';
    return ct === 'embedded' || 
           wct === 'privy' ||
           ct.includes('privy') ||
           ct.includes('embedded');
  });

  // Check if user logged in with email/social (not just wallet)
  const loggedInWithEmail = user?.linkedAccounts?.some((acc: any) => 
    ['email', 'sms', 'google_oauth', 'twitter_oauth', 'github_oauth'].includes(acc.type)
  ) || false;

  // Force embedded wallet to be active if:
  // 1. User logged in with email/social AND
  // 2. Embedded wallet exists AND
  // 3. Current active wallet is NOT the embedded wallet
  useEffect(() => {
    if (authenticated && loggedInWithEmail && embeddedWallet && setActiveWallet) {
      const currentAddress = wagmiAccount.address?.toLowerCase();
      const embeddedAddress = embeddedWallet.address?.toLowerCase();
      
      // If current wallet is not the embedded wallet, switch to it
      if (currentAddress && embeddedAddress && currentAddress !== embeddedAddress) {
        console.log('🔄 Switching to embedded wallet:', embeddedAddress);
        setActiveWallet(embeddedWallet);
      } else if (!currentAddress && embeddedAddress) {
        // No wallet active, but embedded wallet exists - activate it
        console.log('✅ Activating embedded wallet:', embeddedAddress);
        setActiveWallet(embeddedWallet);
      }
    }
  }, [authenticated, loggedInWithEmail, embeddedWallet, wagmiAccount.address, setActiveWallet]);

  // Return the embedded wallet address if available and user logged in with email
  // Otherwise fall back to Wagmi account
  if (authenticated && loggedInWithEmail && embeddedWallet?.address) {
    return {
      ...wagmiAccount,
      address: embeddedWallet.address as `0x${string}`,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
    };
  }

  return wagmiAccount;
}

