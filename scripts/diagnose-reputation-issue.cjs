require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const SETTLEMENT_ROUTER = process.env.VITE_SETTLEMENT_ROUTER_ADDRESS;
  const REPUTATION = process.env.VITE_REPUTATION_ADDRESS;
  const TEST_SELLER = "0xa836dDd7c55f1Cf548fdD4f23395Ab75418fBbBf";

  console.log("=== Diagnosing Reputation Update Issue ===\n");

  const [deployer] = await hre.ethers.getSigners();
  const Reputation = await hre.ethers.getContractFactory("Reputation");
  const reputation = Reputation.attach(REPUTATION);
  const SettlementRouter = await hre.ethers.getContractFactory("SettlementRouter");
  const settlementRouter = SettlementRouter.attach(SETTLEMENT_ROUTER);

  // Get a recent InvoiceSettled transaction
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 1000);
  const filter = settlementRouter.filters.InvoiceSettled(null, null, TEST_SELLER);
  const events = await settlementRouter.queryFilter(filter, fromBlock, currentBlock);
  
  if (events.length === 0) {
    console.log("❌ No InvoiceSettled events found for seller");
    return;
  }

  const recentEvent = events[events.length - 1];
  console.log("Found recent settlement:");
  console.log("  Invoice ID:", recentEvent.args.invoiceId.toString());
  console.log("  Transaction:", recentEvent.transactionHash);
  console.log("  Block:", recentEvent.blockNumber);

  // Get transaction receipt
  const receipt = await hre.ethers.provider.getTransactionReceipt(recentEvent.transactionHash);
  console.log("\n=== Transaction Analysis ===");
  console.log("Status:", receipt.status === 1 ? "Success ✅" : "Failed ❌");
  console.log("Gas used:", receipt.gasUsed.toString());

  // Parse all logs
  const repInterface = new hre.ethers.Interface([
    "event ReputationUpdated(address indexed seller, uint256 newScore, uint8 newTier, uint256 invoiceVolume)"
  ]);

  let foundRepEvent = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === REPUTATION.toLowerCase()) {
      try {
        const parsed = repInterface.parseLog(log);
        console.log("\n✅ Found ReputationUpdated event!");
        console.log("  Seller:", parsed.args.seller);
        console.log("  New Score:", parsed.args.newScore.toString());
        console.log("  New Tier:", parsed.args.newTier.toString());
        foundRepEvent = true;
      } catch (e) {
        // Not a ReputationUpdated event
      }
    }
  }

  if (!foundRepEvent) {
    console.log("\n❌ NO ReputationUpdated event found in transaction!");
    console.log("This means updateReputation() was NOT called or failed silently.");
    
    // Check if SettlementRouter has the role
    const SETTLEMENT_ROUTER_ROLE = await reputation.SETTLEMENT_ROUTER_ROLE();
    const hasRole = await reputation.hasRole(SETTLEMENT_ROUTER_ROLE, SETTLEMENT_ROUTER);
    console.log("\nRole check:");
    console.log("  SettlementRouter has role:", hasRole ? "YES ✅" : "NO ❌");
    
    if (hasRole) {
      console.log("\n⚠️  SettlementRouter has role but updateReputation is not being called!");
      console.log("   Possible causes:");
      console.log("   1. The code path is not reaching the updateReputation call");
      console.log("   2. The call is failing before emitting event");
      console.log("   3. There's a revert happening that's being caught somewhere");
    }
  }

  // Check current reputation state
  console.log("\n=== Current Reputation State ===");
  const score = await reputation.getScore(TEST_SELLER);
  const tier = await reputation.getTier(TEST_SELLER);
  const stats = await reputation.getStats(TEST_SELLER);
  console.log("Score:", score.toString());
  console.log("Tier:", tier.toString());
  console.log("Invoices Cleared:", stats.invoicesCleared.toString());
  console.log("Total Volume:", hre.ethers.formatUnits(stats.totalVolume, 6), "USDC");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

