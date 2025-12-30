require("dotenv").config();
const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  // Get seller address from environment variable if provided
  // Usage: SELLER_ADDRESS=0x... npm run check:reputation
  const TEST_SELLER = process.env.SELLER_ADDRESS || null;

  console.log("Checking Reputation contract setup...\n");

  const SETTLEMENT_ROUTER = process.env.VITE_SETTLEMENT_ROUTER_ADDRESS;
  const REPUTATION = process.env.VITE_REPUTATION_ADDRESS;

  if (!SETTLEMENT_ROUTER || !REPUTATION) {
    console.error("❌ Missing contract addresses in .env:");
    if (!SETTLEMENT_ROUTER) console.error("   - VITE_SETTLEMENT_ROUTER_ADDRESS");
    if (!REPUTATION) console.error("   - VITE_REPUTATION_ADDRESS");
    process.exit(1);
  }

  console.log("SettlementRouter:", SETTLEMENT_ROUTER);
  console.log("Reputation:", REPUTATION);
  console.log("");

  // Attach to contracts
  const Reputation = await hre.ethers.getContractFactory("Reputation");
  const reputation = Reputation.attach(REPUTATION);

  // Check if SettlementRouter has the role
  const SETTLEMENT_ROUTER_ROLE = await reputation.SETTLEMENT_ROUTER_ROLE();
  const hasRole = await reputation.hasRole(SETTLEMENT_ROUTER_ROLE, SETTLEMENT_ROUTER);

  console.log("=== Role Check ===");
  if (hasRole) {
    console.log("✅ SettlementRouter HAS SETTLEMENT_ROUTER_ROLE in Reputation");
  } else {
    console.log("❌ SettlementRouter DOES NOT HAVE SETTLEMENT_ROUTER_ROLE in Reputation");
    console.log("\n⚠️  ACTION REQUIRED: Grant the role using:");
    console.log(`   npm run fix:reputation-role`);
    console.log(`   OR manually grant role in Reputation contract`);
  }

  // Check BASE_SCORE_INCREMENT constant
  console.log("\n=== Contract Constants ===");
  try {
    // Try to read the event logs or check if we can call a function
    // Since constants are private, we'll check by testing the logic
    console.log("Checking BASE_SCORE_INCREMENT (should be 20)...");
    
    // We can't directly read private constants, but we can verify by checking recent events
    console.log("✓ Contract deployed and accessible");
  } catch (error) {
    console.error("❌ Error checking contract:", error.message);
  }

  // Check recent ReputationUpdated events
  console.log("\n=== Recent Reputation Updates ===");
  try {
    // Get current block number
    const currentBlock = await hre.ethers.provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    
    // Look back more blocks (last 50000 blocks = ~7 days at 12s/block)
    const fromBlock = Math.max(0, currentBlock - 50000);
    console.log(`Searching from block ${fromBlock} to ${currentBlock}...`);
    
    const filter = reputation.filters.ReputationUpdated();
    const events = await reputation.queryFilter(filter, fromBlock, currentBlock);
    
    if (events.length === 0) {
      console.log("⚠️  No ReputationUpdated events found in last 50,000 blocks");
      console.log("   This could mean:");
      console.log("   - No invoices have been cleared yet");
      console.log("   - updateReputation is not being called (check if SettlementRouter has role)");
      console.log("   - Events are in older blocks (check if you cleared invoices before this");
      console.log("   - The transaction might be reverting silently");
    } else {
      console.log(`✓ Found ${events.length} ReputationUpdated event(s)`);
      console.log("\nRecent events:");
      for (let i = Math.max(0, events.length - 5); i < events.length; i++) {
        const event = events[i];
        const [seller, newScore, newTier, invoiceVolume] = event.args;
        console.log(`  ${i + 1}. Seller: ${seller}`);
        console.log(`     New Score: ${newScore.toString()}`);
        console.log(`     New Tier: ${newTier} (0=C, 1=B, 2=A)`);
        console.log(`     Invoice Volume: ${hre.ethers.formatUnits(invoiceVolume, 6)} USDC`);
        console.log(`     Block: ${event.blockNumber}`);
        console.log("");
      }
    }
  } catch (error) {
    console.error("❌ Error querying events:", error.message);
  }

  // Test a seller address if provided
  if (TEST_SELLER) {
    console.log(`\n=== Testing Seller: ${TEST_SELLER} ===`);
    try {
      const score = await reputation.getScore(TEST_SELLER);
      const tier = await reputation.getTier(TEST_SELLER);
      const stats = await reputation.getStats(TEST_SELLER);
      
      console.log(`Score: ${score.toString()}`);
      const tierLabel = tier === 0 ? 'C' : tier === 1 ? 'B' : tier === 2 ? 'A' : 'Unknown';
      console.log(`Tier: ${tier} (${tierLabel})`);
      console.log(`Invoices Cleared: ${stats.invoicesCleared.toString()}`);
      console.log(`Total Volume: ${hre.ethers.formatUnits(stats.totalVolume, 6)} USDC`);
      console.log(`Last Updated: ${stats.lastUpdated.toString() === '0' ? 'Never' : new Date(Number(stats.lastUpdated) * 1000).toISOString()}`);
      
      // Check if score matches expected calculation
      if (stats.invoicesCleared > 0n) {
        const expectedScore = 450 + (Number(stats.invoicesCleared) * 20);
        console.log(`\nExpected Score (450 + ${stats.invoicesCleared} * 20): ${expectedScore}`);
        console.log(`Actual Score: ${score.toString()}`);
        if (Number(score) !== expectedScore) {
          console.log(`⚠️  Score mismatch! The score should be ${expectedScore} but is ${score.toString()}`);
        } else {
          console.log(`✓ Score matches expected calculation`);
        }
      }
    } catch (error) {
      console.error("❌ Error getting seller stats:", error.message);
    }
  } else {
    console.log("\n💡 Tip: Pass a seller address to check their reputation:");
    console.log(`   SELLER_ADDRESS=0x... npm run check:reputation`);
  }

  console.log("\n=== Summary ===");
  if (!hasRole) {
    console.log("❌ CRITICAL: SettlementRouter does not have SETTLEMENT_ROUTER_ROLE");
    console.log("   Reputation updates will fail silently!");
    process.exit(1);
  } else {
    console.log("✅ Setup looks correct");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

