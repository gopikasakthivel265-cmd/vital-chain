const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying MedicalRecords contract...\n");

    // Get the contract factory
    const MedicalRecords = await ethers.getContractFactory("MedicalRecords");

    // Deploy the contract
    console.log("📝 Deploying contract...");
    const medicalRecords = await MedicalRecords.deploy();

    await medicalRecords.waitForDeployment();

    const address = await medicalRecords.getAddress();

    console.log("✅ MedicalRecords contract deployed to:", address);
    console.log("\n📋 Next steps:");
    console.log("1. Copy the contract address above");
    console.log("2. Update CONTRACT_ADDRESS in your .env file");
    console.log("3. Restart your backend server");
    console.log("\nExample .env entry:");
    console.log(`CONTRACT_ADDRESS=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
