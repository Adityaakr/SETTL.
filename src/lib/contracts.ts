export interface ContractsData {
  network: string;
  chainId: string;
  deployer: string;
  contracts: {
    DemoUSDC?: string;
    USMTPlus?: string;
    InvoiceNFT?: string;
    InvoiceRegistry?: string;
    Vault?: string;
    Staking?: string;
    AdvanceEngine?: string;
    Reputation?: string;
    SettlementRouter?: string;
    Treasury?: string;
    ProtocolFeeBps?: string;
  };
  deployedAt: string;
}

// Load contract addresses from contracts.json or environment variables
function getContractAddresses(): ContractsData['contracts'] {
  // Priority: Environment variables > contracts.json
  // For now, use environment variables (can be updated to load from contracts.json dynamically)
  
  const addresses = {
    DemoUSDC: import.meta.env.VITE_DEMO_USDC_ADDRESS || '0x003aF3CFc2DeeE3751fe9e03083e45074ED493E4',
    USMTPlus: import.meta.env.VITE_USMT_PLUS_ADDRESS,
    InvoiceNFT: import.meta.env.VITE_INVOICE_NFT_ADDRESS,
    InvoiceRegistry: import.meta.env.VITE_INVOICE_REGISTRY_ADDRESS,
    Vault: import.meta.env.VITE_VAULT_ADDRESS,
    Staking: import.meta.env.VITE_STAKING_ADDRESS,
    AdvanceEngine: import.meta.env.VITE_ADVANCE_ENGINE_ADDRESS,
    Reputation: import.meta.env.VITE_REPUTATION_ADDRESS,
    SettlementRouter: import.meta.env.VITE_SETTLEMENT_ROUTER_ADDRESS,
  };

  // Warn if using old contract addresses (after redeployment)
  const OLD_VAULT = '0xdA8FA5C4Eda1006501F377852BE04cf9beB7Cde9';
  const NEW_VAULT = '0x6a8B044A517B8e8f8B8F074bd981FA5149108BCb';
  const OLD_TOKEN = '0x003aF3CFc2DeeE3751fe9e03083e45074ED493E4';
  const NEW_TOKEN = '0x2De86556c08Df11E1D35223F0741791fBD847567';

  if (addresses.Vault?.toLowerCase() === OLD_VAULT.toLowerCase()) {
    console.warn('⚠️ Using OLD Vault address! Please update .env with NEW addresses:');
    console.warn(`   VITE_VAULT_ADDRESS=${NEW_VAULT}`);
    console.warn(`   VITE_DEMO_USDC_ADDRESS=${NEW_TOKEN}`);
  }

  if (addresses.DemoUSDC?.toLowerCase() === OLD_TOKEN.toLowerCase()) {
    console.warn('⚠️ Using OLD Token address! Please update .env with NEW address:');
    console.warn(`   VITE_DEMO_USDC_ADDRESS=${NEW_TOKEN}`);
  }

  return addresses;
}

export const contractAddresses = getContractAddresses();

// Helper to check if contracts are configured
export function areContractsConfigured(): boolean {
  return !!(
    contractAddresses.DemoUSDC &&
    contractAddresses.USMTPlus &&
    contractAddresses.InvoiceRegistry &&
    contractAddresses.Vault &&
    contractAddresses.Staking &&
    contractAddresses.AdvanceEngine &&
    contractAddresses.Reputation &&
    contractAddresses.SettlementRouter
  );
}

