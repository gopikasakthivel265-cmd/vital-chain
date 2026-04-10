const blockchainService = require('./services/blockchain');
const { pool } = require('./services/database');
const { ethers } = require('ethers');

async function simulateDashboard() {
    try {
        await blockchainService.initialize();

        // Find the most recent patient with a wallet
        const [patients] = await pool.execute(`
            SELECT u.user_id, u.username, u.wallet_address, p.patient_id
            FROM users u
            JOIN patients p ON u.user_id = p.user_id
            WHERE u.wallet_address IS NOT NULL AND u.wallet_address != ''
            ORDER BY u.user_id DESC
            LIMIT 5
        `);

        if (patients.length === 0) {
            console.log('No patients with wallets found in DB.');
            process.exit(0);
        }

        for (const pt of patients) {
            console.log(`\nChecking Patient: ${pt.username} (ID: ${pt.patient_id}, Wallet: ${pt.wallet_address})`);

            const pending = await blockchainService.getPendingRequests(pt.wallet_address);
            console.log(`Pending Requests count: ${pending.length}`);
            if (pending.length > 0) {
                console.log('Requests:', JSON.stringify(pending, null, 2));
            }

            const requestors = await blockchainService.contract.getPatientRequestors(pt.wallet_address);
            console.log(`Total Requestors on chain: ${requestors.length}`);
            if (requestors.length > 0) {
                console.log('Requestor Addresses:', requestors);
                for (const drAddr of requestors) {
                    const req = await blockchainService.getAccessRequest(drAddr, pt.wallet_address);
                    console.log(`Request Status from ${drAddr}: ${req.status}`);
                }
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Simulation failed:', error);
        process.exit(1);
    }
}

simulateDashboard();
