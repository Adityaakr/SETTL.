# SETTL.

**Stripe-like invoices on-chain, instantly.**

<img width="1597" height="861" alt="Screenshot 2025-12-30 at 8 24 04 PM" src="https://github.com/user-attachments/assets/44c50d6d-37a0-4d79-93b3-f3112003f020" />
<img width="1710" height="864" alt="Screenshot 2025-12-30 at 9 36 14 PM" src="https://github.com/user-attachments/assets/fd448bbe-f006-4bcd-a567-a552233be2b1" />

<img width="1155" height="474" alt="Screenshot 2025-12-30 at 9 36 56 PM" src="https://github.com/user-attachments/assets/5d9df632-b154-41e3-8b4b-841c511f29b6" />
<img width="1151" height="311" alt="Screenshot 2025-12-30 at 9 37 47 PM" src="https://github.com/user-attachments/assets/34d937c4-9302-4045-9b16-59403c291b37" />
<img width="1269" height="779" alt="Screenshot 2025-12-30 at 9 39 05 PM" src="https://github.com/user-attachments/assets/46b079b9-1275-4b71-b6b1-7f0399e5cf8d" />
<img width="1703" height="960" alt="Screenshot 2025-12-30 at 9 41 44 PM" src="https://github.com/user-attachments/assets/e30f131a-d933-4f80-bc4e-d732ff400e72" />
<img width="1710" height="865" alt="Screenshot 2025-12-30 at 9 39 44 PM" src="https://github.com/user-attachments/assets/827a1849-3966-4d44-ab04-3450ce99b902" />
<img width="895" height="714" alt="Screenshot 2025-12-31 at 2 33 13 AM" src="https://github.com/user-attachments/assets/22284d59-2089-457d-a977-1592ed04547f" />

SETTL is a Stripe-like invoice link that turns accounts receivable into RealFi rails on Mantle: businesses get paid in stablecoins, unlock instant financing against invoices/cashflows, and build an on-chain reputation that improves terms over time.

For a detailed introduction, see [INTRO.md](./INTRO.md).

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph "User Layer"
        Seller[👤 Seller<br/>Business]
        Buyer[👤 Buyer<br/>Customer]
        LP[💰 Liquidity Provider<br/>LP]
        Admin[⚙️ Protocol Admin<br/>Treasury]
    end

    subgraph "Frontend Layer"
        React[⚛️ React + TypeScript]
        Privy[🔐 Privy<br/>Embedded Wallets]
        Wagmi[🔗 Wagmi<br/>Web3 Hooks]
        Reclaim[🔒 Reclaim Protocol<br/>zkTLS Proofs]
        
        React --> Privy
        React --> Wagmi
        React --> Reclaim
    end

    subgraph "Mantle Network (L2)"
        subgraph "Invoice System"
            InvoiceRegistry[📋 InvoiceRegistry<br/>State Management]
            InvoiceNFT[🎨 InvoiceNFT<br/>ERC721 NFT]
            
            InvoiceRegistry -->|Mints| InvoiceNFT
        end
        
        subgraph "Financing System"
            Vault[🏦 Vault<br/>Liquidity Pool]
            USMTPlus[🪙 USMT+<br/>ERC20 Receipt]
            Staking[📊 Staking<br/>Yield Position]
            AdvanceEngine[⚡ AdvanceEngine<br/>Instant Financing]
            
            Vault -->|Mints 1:1| USMTPlus
            USMTPlus -->|Stake| Staking
            AdvanceEngine -->|Borrows| Vault
            AdvanceEngine -.->|Uses as Collateral| InvoiceNFT
        end
        
        subgraph "Settlement System"
            SettlementRouter[💸 SettlementRouter<br/>Payment Waterfall]
            Reputation[⭐ Reputation<br/>Credit Score]
            
            SettlementRouter -->|Updates| InvoiceRegistry
            SettlementRouter -->|Updates| Reputation
            SettlementRouter -->|Repays| Vault
        end
        
        DemoUSDC[💵 DemoUSDC<br/>ERC20 Stablecoin]
    end

    Seller -->|Creates Invoice| React
    Buyer -->|Pays Invoice| React
    LP -->|Deposits/Stakes| React
    Admin -->|Manages| React

    React -->|Web3 Calls| InvoiceRegistry
    React -->|Web3 Calls| Vault
    React -->|Web3 Calls| Staking
    React -->|Web3 Calls| AdvanceEngine
    React -->|Web3 Calls| SettlementRouter

    InvoiceRegistry -.->|Checks Status| AdvanceEngine
    AdvanceEngine -.->|Updates Status| InvoiceRegistry
    SettlementRouter -.->|Updates Status| InvoiceRegistry
    
    SettlementRouter -->|Fee| Admin
    SettlementRouter -->|Remainder| Seller
    
    style Seller fill:#2563eb,stroke:#1e40af,stroke-width:2px,color:#fff
    style Buyer fill:#2563eb,stroke:#1e40af,stroke-width:2px,color:#fff
    style LP fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style Admin fill:#dc2626,stroke:#b91c1c,stroke-width:2px,color:#fff
    style React fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style Privy fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style Wagmi fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style Reclaim fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style InvoiceRegistry fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style InvoiceNFT fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style Vault fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style USMTPlus fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style Staking fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff
    style AdvanceEngine fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style SettlementRouter fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    style Reputation fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff
    style DemoUSDC fill:#6b7280,stroke:#4b5563,stroke-width:2px,color:#fff
```

### Invoice Lifecycle Flow

```mermaid
sequenceDiagram
    participant Seller
    participant InvoiceRegistry
    participant InvoiceNFT
    participant AdvanceEngine
    participant Vault
    participant Buyer
    participant SettlementRouter
    participant Reputation

    Note over Seller,Reputation: 1. CREATE INVOICE
    Seller->>InvoiceRegistry: createInvoice(buyer, amount, dueDate)
    InvoiceRegistry->>InvoiceNFT: mintInvoiceNFT(invoiceId, seller)
    InvoiceNFT-->>Seller: ERC721 NFT
    InvoiceRegistry-->>Seller: Invoice Created (Status: Issued)

    Note over Seller,Reputation: 2. [OPTIONAL] REQUEST ADVANCE
    Seller->>AdvanceEngine: requestAdvance(invoiceId, ltv, apr)
    AdvanceEngine->>InvoiceRegistry: getInvoice(invoiceId)
    AdvanceEngine->>InvoiceNFT: Verify ownership
    AdvanceEngine->>Vault: borrow(advanceAmount)
    Vault-->>AdvanceEngine: USDC
    AdvanceEngine->>InvoiceRegistry: markFinanced(invoiceId)
    AdvanceEngine-->>Seller: USDC (70-80% LTV)
    InvoiceRegistry-->>Seller: Status: Financed

    Note over Seller,Reputation: 3. PAY INVOICE
    Buyer->>SettlementRouter: payInvoice(invoiceId)
    SettlementRouter->>Buyer: Transfer USDC
    SettlementRouter->>InvoiceRegistry: updateStatus(Paid)
    
    Note over SettlementRouter: Settlement Waterfall (Atomic)
    SettlementRouter->>SettlementRouter: Calculate Fee (0.5%)
    SettlementRouter->>Treasury: Protocol Fee
    alt Invoice was Financed
        SettlementRouter->>AdvanceEngine: getRepaymentAmount()
        AdvanceEngine-->>SettlementRouter: repayment + interest
        SettlementRouter->>Vault: repay(amount)
    end
    SettlementRouter->>Seller: Remainder USDC
    SettlementRouter->>InvoiceRegistry: updateStatus(Cleared)
    SettlementRouter->>Reputation: updateReputation(seller, amount)
    
    Note over Seller,Reputation: 4. REPUTATION IMPROVES
    Reputation-->>Seller: Better Terms Unlocked<br/>(Higher LTV, Lower APR)
```

### Liquidity Provider Flow

```mermaid
flowchart LR
    Start([LP Starts]) --> Deposit[Deposit USDC<br/>to Vault]
    Deposit --> Receive[Receive USMT+<br/>1:1 Receipt Token]
    
    Receive --> Choice{Stake?}
    Choice -->|Yes| Stake[Stake USMT+]
    Choice -->|No| Hold[Hold USMT+<br/>Liquid Position]
    
    Stake --> ReceiveStake[Receive sUSMT+<br/>Staked Token]
    ReceiveStake --> Earn[Earn 15-25% APY<br/>From Borrower Repayments]
    
    Hold --> EarnSimple[Earn from<br/>Vault Utilization]
    
    Earn --> WithdrawStake[Unstake sUSMT+]
    EarnSimple --> Withdraw[Withdraw USDC]
    WithdrawStake --> Withdraw
    
    Withdraw --> Burn[Burn USMT+<br/>Receive USDC]
    Burn --> End([Exit])
    
    style Start fill:#6b7280,stroke:#4b5563,stroke-width:2px,color:#fff
    style Deposit fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style Receive fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style Choice fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style Stake fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff
    style Hold fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style ReceiveStake fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff
    style Earn fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    style EarnSimple fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style WithdrawStake fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style Withdraw fill:#2563eb,stroke:#1e40af,stroke-width:2px,color:#fff
    style Burn fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style End fill:#6b7280,stroke:#4b5563,stroke-width:2px,color:#fff
```

### Settlement Waterfall

```mermaid
flowchart TD
    Payment[Buyer Pays Invoice<br/>100% Invoice Amount] --> Settlement[SettlementRouter]
    
    Settlement --> CalcFee[Calculate Protocol Fee<br/>0.5%]
    CalcFee --> Fee[Protocol Fee<br/>→ Treasury]
    
    Settlement --> Check{Invoice<br/>Financed?}
    Check -->|Yes| CalcRepay[Calculate Repayment<br/>Principal + Interest]
    Check -->|No| NoRepay[No Repayment<br/>0 USDC]
    
    CalcRepay --> Repay[Repayment<br/>→ Vault]
    NoRepay --> CalcRemainder
    
    Fee --> CalcRemainder[Calculate Seller Remainder<br/>Invoice - Fee - Repayment]
    Repay --> CalcRemainder
    
    CalcRemainder --> Remainder[Seller Remainder<br/>→ Seller]
    
    Settlement --> UpdateStatus[Update Invoice Status<br/>Paid → Cleared]
    Settlement --> UpdateRep[Update Reputation<br/>Score + Tier]
    
    style Payment fill:#2563eb,stroke:#1e40af,stroke-width:2px,color:#fff
    style Settlement fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    style CalcFee fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style Fee fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style Check fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style CalcRepay fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff
    style NoRepay fill:#6b7280,stroke:#4b5563,stroke-width:2px,color:#fff
    style Repay fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style CalcRemainder fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style Remainder fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#fff
    style UpdateStatus fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style UpdateRep fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
```

---

##Quick Start

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Adityaakr/SETTL..git
cd SETTL.

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env  # Create .env file and fill in your values

# 4. Start development server
npm run dev
```

The development server will start on `http://localhost:8080`

---

## 📋 Detailed Setup Instructions

### Step 1: Clone Repository

```bash
git clone https://github.com/Adityaakr/SETTL..git
cd SETTL.
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Frontend dependencies (React, Vite, TypeScript, Wagmi, etc.)
- Smart contract dependencies (Hardhat, Ethers.js, OpenZeppelin)
- All required packages listed in `package.json`

### Step 3: Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Then fill in your environment variables. See `.env.example` for all required variables.

**Required Environment Variables:**

- `VITE_PRIVY_APP_ID` - Get from [Privy Dashboard](https://dashboard.privy.io/)
- `VITE_MANTLE_CHAIN_ID` - Set to `5003` for Mantle Sepolia
- `DEPLOYER_PRIVATE_KEY` - Your wallet private key for deploying contracts
- `VITE_RECLAIM_APP_ID` - (Optional) For zkTLS proofs via Reclaim Protocol

Contract addresses will be populated after deployment.

**Important:** Never commit your `.env` file to version control. It's already included in `.gitignore`.

### Step 4: Get Testnet ETH

To deploy contracts and interact with the protocol, you need Mantle Sepolia testnet ETH:

1. Get testnet ETH from [Mantle Faucet](https://faucet.sepolia.mantle.xyz/)
2. Add Mantle Sepolia network to your wallet:
   - **Network Name:** Mantle Sepolia
   - **RPC URL:** https://rpc.sepolia.mantle.xyz
   - **Chain ID:** 5003
   - **Currency Symbol:** ETH
   - **Block Explorer:** https://explorer.testnet.mantle.xyz

---

## 🏗️ Smart Contract Deployment

### Deploy All Contracts

Deploy all smart contracts to Mantle Sepolia testnet:

```bash
# Compile contracts first (optional, deploy script will compile)
npm run compile

# Deploy all contracts
npm run deploy
```

**What gets deployed:**
1. **DemoUSDC** - Demo USDC token for testing
2. **InvoiceNFT** - ERC721 NFT contract for tokenized invoices
3. **InvoiceRegistry** - Invoice creation and state management
4. **Vault** - Liquidity pool for invoice financing
5. **AdvanceEngine** - Instant financing engine
6. **Reputation** - On-chain credit scoring system
7. **SettlementRouter** - Automated payment settlement
8. **USMTPlus** - Receipt token for vault deposits
9. **Staking** - Staking contract for sUSMT+ tokens

**Deployment Output:**

The script will:
- Deploy all contracts in the correct order
- Configure roles and permissions between contracts
- Save contract addresses to `contracts.json`
- Display environment variables to add to `.env`

**Example Output:**

```
✅ Deployment complete!

Contract addresses saved to: contracts.json

VITE_INVOICE_NFT_ADDRESS=0x...
VITE_INVOICE_REGISTRY_ADDRESS=0x...
VITE_VAULT_ADDRESS=0x...
VITE_ADVANCE_ENGINE_ADDRESS=0x...
VITE_REPUTATION_ADDRESS=0x...
VITE_SETTLEMENT_ROUTER_ADDRESS=0x...
```

Copy these addresses to your `.env` file.

### Verify Contracts (Optional)

After deployment, verify contracts on Mantle Explorer:

```bash
# Set your Mantle Etherscan API key in .env
MANTLE_ETHERSCAN_API_KEY=your_api_key

# Verify contracts
npm run verify
```

This requires:
1. Mantle Etherscan API key (get from [Mantle Explorer](https://explorer.testnet.mantle.xyz))
2. Contracts to be fully confirmed on-chain

### Manual Deployment (Advanced)

For more control, deploy contracts individually:

```bash
# Using Hardhat console
npx hardhat console --network mantleSepolia

# Or create custom deployment script
# See scripts/deploy-all.ts for reference
```

---

## 🎨 Frontend Deployment

### Development Mode

```bash
npm run dev
```

Starts Vite dev server with hot reload on `http://localhost:8080`

### Production Build

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Deploy to Vercel

SETTL is configured for zero-config deployment to Vercel. The `vercel.json` file includes all necessary settings.

#### Quick Deploy via Vercel Dashboard

1. **Push to GitHub** (if not already):
   ```bash
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your GitHub repository `Adityaakr/SETTL.`
   - Vercel will auto-detect the Vite configuration

3. **Configure Environment Variables**:
   
   In Vercel project settings (Settings → Environment Variables), add:
   
   **Required:**
   ```
   VITE_PRIVY_APP_ID=your_privy_app_id
   VITE_MANTLE_CHAIN_ID=5003
   ```
   
   **Contract Addresses (after deployment):**
   ```
   VITE_DEMO_USDC_ADDRESS=0x...
   VITE_INVOICE_REGISTRY_ADDRESS=0x...
   VITE_INVOICE_NFT_ADDRESS=0x...
   VITE_VAULT_ADDRESS=0x...
   VITE_USMT_PLUS_ADDRESS=0x...
   VITE_STAKING_ADDRESS=0x...
   VITE_ADVANCE_ENGINE_ADDRESS=0x...
   VITE_REPUTATION_ADDRESS=0x...
   VITE_SETTLEMENT_ROUTER_ADDRESS=0x...
   ```
   
   **Optional (for Reclaim Protocol):**
   ```
   VITE_RECLAIM_APP_ID=your_reclaim_app_id
   VITE_RECLAIM_APP_SECRET=your_reclaim_secret
   VITE_RECLAIM_PROVIDER_ID=your_provider_id
   ```

4. **Deploy**:
   - Click "Deploy"
   - Your app will be live at `your-project.vercel.app`

#### Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

**Note:** Vercel automatically injects environment variables during build time. Make sure all `VITE_*` variables are set in the Vercel dashboard or via CLI.

### Testing the Complete Flow

1. **Deploy Contracts:**
   ```bash
   npm run deploy
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   ```

3. **Fund Wallets:**
   - Use Settings → Demo Setup to mint DemoUSDC
   - Fund test wallets with DemoUSDC

4. **Test Invoice Flow:**
   - Create invoice as Seller
   - Request advance (optional)
   - Pay invoice as Buyer
   - Verify settlement waterfall

---

## 📚 Architecture Overview

### Smart Contracts

```
InvoiceRegistry
    ├── Creates invoices
    └── Mints InvoiceNFT (ERC721)

InvoiceNFT
    └── Represents tokenized invoices

Vault
    ├── Accepts LP deposits (USDC)
    ├── Mints USMT+ (1:1 receipt token)
    └── Provides liquidity for advances

Staking
    ├── Accepts USMT+ deposits
    ├── Mints sUSMT+ (staked receipt token)
    └── Targets 15-25% APY yield

AdvanceEngine
    ├── Uses InvoiceNFT as collateral
    └── Borrows from Vault

SettlementRouter
    ├── Handles invoice payments
    ├── Executes settlement waterfall:
    │   ├── Protocol fee (0.5%)
    │   ├── Vault repayment (if financed)
    │   └── Seller remainder
    └── Updates Reputation

Reputation
    └── Tracks on-chain credit scores
```

### Frontend Architecture

```
React + TypeScript
    ├── Privy (Embedded Wallets)
    ├── Wagmi (Web3 Interactions)
    └── Reclaim Protocol (zkTLS proofs - optional)
```

## 🔐 Security Considerations

### For Users

- **Non-Custodial:** SETTL does not hold user funds; all transactions are on-chain
- **Smart Contracts:** All contracts use OpenZeppelin libraries and best practices
- **Audits:** Contracts should be audited before mainnet deployment
- **Testnet Only:** Current deployment is on Mantle Sepolia testnet

### For Developers

- **Private Keys:** Never commit private keys to version control
- **Environment Variables:** Keep `.env` secure and never share it
- **Contract Upgrades:** Current contracts are not upgradeable (immutable)
- **Access Control:** Uses OpenZeppelin's AccessControl for role-based permissions

---

## 🤝 Contributing

SETTL is currently in active development. For contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📄 License

© 2024 SETTL.. All rights reserved.

---

## 🌐 Learn More

- **Introduction:** See [INTRO.md](./INTRO.md) for project overview and pitch
- **Contact:** Telegram @Adityaakrx | Twitter @adityakrx
