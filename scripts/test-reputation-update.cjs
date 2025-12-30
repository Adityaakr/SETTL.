require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const SETTLEMENT_ROUTER = process.env.VITE_SETTLEMENT_ROUTER_ADDRESS;
  const REPUTATION = process.env.VITE_REPUTATION_ADDRESS;
  const TEST_SELLER = process.env.SELLER_ADDRESS || "0xa836dDd7c55f1Cf548fdD4f23395Ab75418fBbBf";

  console.log("Testing reputation update call...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Using account:", deployer.address);

  const Reputation = await hre.ethers.getContractFactory("Reputation");
  const reputation = Reputation.attach(REPUTATION);

  const SettlementRouter = await hre.ethers.getContractFactory("SettlementRouter");
  const settlementRouter = SettlementRouter.attach(SETTLEMENT_ROUTER);

  // Check current stats
  console.log("\n=== Before Update ===");
  const scoreBefore = await reputation.getScore(TEST_SELLER);
  const tierBefore = await reputation.getTier(TEST_SELLER);
  const statsBefore = await reputation.getStats(TEST_SELLER);
  console.log("Score:", scoreBefore.toString());
  console.log("Tier:", tierBefore.toString());
  console.log("Invoices Cleared:", statsBefore.invoicesCleared.toString());
  console.log("Total Volume:", hre.ethers.formatUnits(statsBefore.totalVolume, 6), "USDC");

  // Try to call updateReputation directly (should fail due to role)
  console.log("\n=== Testing Direct Call (should fail) ===");
  try {
    const testAmount = hre.ethers.parseUnits("1000", 6); // $1000 USDC
    const tx = await reputation.updateReputation(TEST_SELLER, testAmount);
    console.log("❌ Unexpected: Direct call succeeded!");
    await tx.wait();
  } catch (error) {
    console.log("✓ Expected: Direct call failed (AccessControl)", error.message.substring(0, 100));
  }

  // Try to simulate the call from SettlementRouter
  console.log("\n=== Testing via SettlementRouter (simulate) ===");
  try {
    // Use staticCall to simulate without actually executing
    const testAmount = hre.ethers.parseUnits("1000", 6);
    const result = await settlementRouter.payInvoice.staticCall(999999); // Use non-existent invoice ID to trigger revert
    console.log("Result:", result);
  } catch (error) {
    console.log("Error (expected for invalid invoice):", error.message.substring(0, 200));
  }

  // Check if SettlementRouter can call updateReputation
  console.log("\n=== Checking if SettlementRouter can call updateReputation ===");
  const SETTLEMENT_ROUTER_ROLE = await reputation.SETTLEMENT_ROUTER_ROLE();
  const hasRole = await reputation.hasRole(SETTLEMENT_ROUTER_ROLE, SETTLEMENT_ROUTER);
  console.log("SettlementRouter has role:", hasRole);

  if (hasRole) {
    // Try to call updateReputation as SettlementRouter using delegatecall or staticcall
    console.log("\n=== Testing updateReputation via interface ===");
    try {
      // Create interface to call through SettlementRouter context
      const testAmount = hre.ethers.parseUnits("1000", 6);
      
      // Get the encoded function call
      const reputationInterface = new hre.ethers.Interface([
        "function updateReputation(address seller, uint256 invoiceAmount)"
      ]);
      const data = reputationInterface.encodeFunctionData("updateReputation", [TEST_SELLER, testAmount]);
      
      // Try staticcall to see if it would succeed
      console.log("Checking if call would succeed...");
      // Can't easily test this without a real transaction, but we can verify the role
    } catch (error) {
      console.log("Error:", error.message);
    }
  }

  console.log("\n=== Checking Recent Transactions ===");
  // Check a specific InvoiceSettled event and see if we can trace it
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 1000);
  const filter = settlementRouter.filters.InvoiceSettled();
  const events = await settlementRouter.queryFilter(filter, fromBlock, currentBlock);
  
  if (events.length > 0) {
    const recentEvent = events[events.length - 1];
    console.log("\nMost recent InvoiceSettled:");
    console.log("  Invoice ID:", recentEvent.args.invoiceId.toString());
    console.log("  Seller:", recentEvent.args.seller);
    console.log("  Block:", recentEvent.blockNumber);
    console.log("  Transaction:", recentEvent.transactionHash);
    
    // Try to get the transaction receipt
    try {
      const receipt = await hre.ethers.provider.getTransactionReceipt(recentEvent.transactionHash);
      console.log("\n  Transaction receipt:");
      console.log("    Status:", receipt.status === 1 ? "Success" : "Failed");
      console.log("    Gas used:", receipt.gasUsed.toString());
      
      // Check logs for ReputationUpdated
      const reputationInterface = new hre.ethers.Interface([
        "event ReputationUpdated(address indexed seller, uint256 newScore, uint8 newTier, uint256 invoiceVolume)"
      ]);
      const repLogs = receipt.logs.filter(log => {
        try {
          const parsed = reputationInterface.parseLog(log);
          return parsed !== null;
        } catch {
          return false;
        }
      });
      
      if (repLogs.length > 0) {
        console.log("    ✓ Found ReputationUpdated event in transaction!");
        for (const log of repLogs) {
          try {
            const parsed = reputationInterface.parseLog(log);
            console.log("      Seller:", parsed.args.seller);
            console.log("      New Score:", parsed.args.newScore.toString());
            console.log("      New Tier:", parsed.args.newTier.toString());
          } catch (e) {
            console.log("      (Could not parse log)");
          }
        }
      } else {
        console.log("    ❌ NO ReputationUpdated event found in transaction!");
        console.log("    This confirms updateReputation is not being called or is failing.");
      }
    } catch (error) {
      console.log("  Error getting receipt:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

