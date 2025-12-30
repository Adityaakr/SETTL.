require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy only AdvanceEngine contract with updated configuration
 * This script assumes all other contracts are already deployed
 */
async function main() {
  console.log("🚀 Deploying AdvanceEngine contract only...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString(), "wei\n");

  // Load existing contract addresses from .env or contracts.json
  const contractsPath = path.join(__dirname, "..", "contracts.json");
  let existingContracts = {};
  
  if (fs.existsSync(contractsPath)) {
    try {
      const contractsData = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
      existingContracts = contractsData.contracts || {};
    } catch (err) {
      console.log("Could not read contracts.json, will use .env addresses");
    }
  }

  // Get contract addresses from .env (priority) or contracts.json
  const invoiceRegistryAddress = 
    process.env.VITE_INVOICE_REGISTRY_ADDRESS || 
    existingContracts.InvoiceRegistry;
  const vaultAddress = 
    process.env.VITE_VAULT_ADDRESS || 
    existingContracts.Vault;

  if (!invoiceRegistryAddress || !vaultAddress) {
    throw new Error("Missing required contract addresses. Please ensure InvoiceRegistry and Vault are deployed and addresses are in .env");
  }

  console.log("Using existing contract addresses:");
  console.log("  InvoiceRegistry:", invoiceRegistryAddress);
  console.log("  Vault:", vaultAddress);
  console.log("");

  // Deploy AdvanceEngine
  console.log("📝 Deploying AdvanceEngine...");
  const AdvanceEngine = await hre.ethers.getContractFactory("AdvanceEngine");
  const advanceEngine = await AdvanceEngine.deploy(
    invoiceRegistryAddress,
    vaultAddress,
    deployer.address // defaultAdmin
  );
  await advanceEngine.waitForDeployment();
  const advanceEngineAddress = await advanceEngine.getAddress();
  console.log("✅ AdvanceEngine deployed to:", advanceEngineAddress);

  // Get Vault contract to grant BORROWER_ROLE to AdvanceEngine
  console.log("\n🔐 Setting up roles...");
  const Vault = await hre.ethers.getContractFactory("Vault");
  const vault = Vault.attach(vaultAddress);
  
  const BORROWER_ROLE = await vault.BORROWER_ROLE();
  const hasBorrowerRole = await vault.hasRole(BORROWER_ROLE, advanceEngineAddress);
  
  if (!hasBorrowerRole) {
    console.log("Granting BORROWER_ROLE to AdvanceEngine...");
    const grantTx = await vault.grantRole(BORROWER_ROLE, advanceEngineAddress);
    await grantTx.wait();
    console.log("✅ BORROWER_ROLE granted");
  } else {
    console.log("✅ AdvanceEngine already has BORROWER_ROLE");
  }

  // Get InvoiceRegistry contract to grant ADVANCE_ENGINE_ROLE
  const InvoiceRegistry = await hre.ethers.getContractFactory("InvoiceRegistry");
  const invoiceRegistry = InvoiceRegistry.attach(invoiceRegistryAddress);
  
  const ADVANCE_ENGINE_ROLE = await invoiceRegistry.ADVANCE_ENGINE_ROLE();
  const hasAdvanceEngineRole = await invoiceRegistry.hasRole(ADVANCE_ENGINE_ROLE, advanceEngineAddress);
  
  if (!hasAdvanceEngineRole) {
    console.log("Granting ADVANCE_ENGINE_ROLE to AdvanceEngine...");
    const grantTx = await invoiceRegistry.grantRole(ADVANCE_ENGINE_ROLE, advanceEngineAddress);
    await grantTx.wait();
    console.log("✅ ADVANCE_ENGINE_ROLE granted");
  } else {
    console.log("✅ AdvanceEngine already has ADVANCE_ENGINE_ROLE");
  }

  // Update contracts.json if it exists
  if (fs.existsSync(contractsPath)) {
    try {
      const contractsData = JSON.parse(fs.readFileSync(contractsPath, "utf8"));
      contractsData.contracts.AdvanceEngine = advanceEngineAddress;
      contractsData.updatedAt = new Date().toISOString();
      fs.writeFileSync(contractsPath, JSON.stringify(contractsData, null, 2));
      console.log("\n✅ Updated contracts.json with new AdvanceEngine address");
    } catch (err) {
      console.log("\n⚠️  Could not update contracts.json:", err.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 Deployment Summary");
  console.log("=".repeat(60));
  console.log("\n✅ AdvanceEngine deployed successfully!");
  console.log("\nContract Addresses:");
  console.log("  AdvanceEngine:", advanceEngineAddress);
  console.log("\n⚠️  IMPORTANT: Update your .env file with the new AdvanceEngine address:");
  console.log(`  VITE_ADVANCE_ENGINE_ADDRESS=${advanceEngineAddress}`);
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

