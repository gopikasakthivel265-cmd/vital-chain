const blockchainService = require('./services/blockchain');
const { ethers } = require('ethers');

async function debugBlockchain() {
    try {
        await blockchainService.initialize();

        const accounts = await blockchainService.provider.listAccounts();
        console.log('--- BLOCKCHAIN ACCOUNTS ---');
        for (let i = 0; i < accounts.length; i++) {
            console.log(`Account ${i}: ${await accounts[i].getAddress()}`);
        }

        const patientWallet = process.argv[2];
        if (patientWallet) {
            console.log(`\n--- PENDING REQUESTS FOR ${patientWallet} ---`);
            const requests = await blockchainService.getPendingRequests(patientWallet);
            console.log(JSON.stringify(requests, null, 2));

            const requestors = await blockchainService.contract.getPatientRequestors(patientWallet);
            console.log('\n--- ALL REQUESTORS FOR PATIENT ---');
            console.log(requestors);
        }

        process.exit(0);
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debugBlockchain();
