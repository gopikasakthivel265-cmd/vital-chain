const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class BlockchainService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.contractAddress = process.env.CONTRACT_ADDRESS;
    }

    // Initialize blockchain connection
    async initialize() {
        try {
            // Connect to local Hardhat node
            const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Get signer (first account from Hardhat node)
            this.signer = await this.provider.getSigner();

            // Load contract ABI and address
            const contractPath = path.join(__dirname, '../../blockchain/artifacts/blockchain/contracts/MedicalRecords.sol/MedicalRecords.json');
            const contractJson = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
            const abi = contractJson.abi;

            if (!this.contractAddress) {
                throw new Error('Contract address not set. Deploy contract first.');
            }

            // Create contract instance
            this.contract = new ethers.Contract(this.contractAddress, abi, this.signer);

            // Verify contract deployment
            const code = await this.provider.getCode(this.contractAddress);
            if (code === '0x' || code === '0x0') {
                console.warn('⚠️ Warning: No contract code found at address:', this.contractAddress);
                console.warn('   Blockchain interaction may fail. Ensure the contract is deployed correctly.');
            } else {
                console.log('✅ Contract code verified at address');
            }

            console.log('✅ Blockchain service initialized');
            console.log('📝 Contract address:', this.contractAddress);
            console.log('👤 Signer address:', await this.signer.getAddress());

            return true;
        } catch (error) {
            console.error('❌ Blockchain initialization failed:', error.message);
            console.error('🔍 Details:', {
                rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
                contractAddress: this.contractAddress,
                errorStack: error.stack
            });
            throw error;
        }
    }

    // Register a new user on blockchain
    async registerUser(userAddress, role) {
        try {
            if (!this.contract) {
                console.warn('⚠️ Skipping blockchain registration: Contract not initialized');
                return null;
            }
            // role: 1 for PATIENT, 2 for DOCTOR
            const roleEnum = role === 'patient' ? 1 : 2;
            const tx = await this.contract.registerUser(userAddress, roleEnum);
            const receipt = await tx.wait();

            console.log('✅ User registered on blockchain:', userAddress);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Blockchain user registration failed:', error.message);
            throw error;
        }
    }

    // Store medical record hash on blockchain
    async storeRecordHash(recordId, recordHash, patientWallet) {
        try {
            if (!this.contract) {
                console.warn('⚠️ Skipping blockchain hash storage: Contract not initialized');
                return null;
            }
            // Create contract instance with patient's wallet
            const patientSigner = await this.getSignerForAddress(patientWallet);
            const contractWithPatientSigner = this.contract.connect(patientSigner);

            // Convert hash to bytes32 format
            const hashBytes32 = ethers.zeroPadValue(recordHash, 32);

            const tx = await contractWithPatientSigner.storeRecordHash(recordId, hashBytes32);
            const receipt = await tx.wait();

            console.log('✅ Record hash stored on blockchain. Record ID:', recordId);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Failed to store record hash:', error.message);
            throw error;
        }
    }

    // Update an existing record hash on blockchain
    async updateRecordHash(recordId, recordHash, signerWallet) {
        try {
            if (!this.contract) {
                console.warn('⚠️ Skipping blockchain hash update: Contract not initialized');
                return null;
            }
            const signer = await this.getSignerForAddress(signerWallet);
            const contractWithSigner = this.contract.connect(signer);

            const hashBytes32 = ethers.zeroPadValue(recordHash, 32);

            const tx = await contractWithSigner.updateRecordHash(recordId, hashBytes32);
            const receipt = await tx.wait();

            console.log('✅ Record hash updated on blockchain. Record ID:', recordId);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Failed to update record hash:', error.message);
            throw error;
        }
    }

    // Grant access to a doctor
    async grantAccess(recordId, doctorAddress, patientWallet) {
        try {
            const patientSigner = await this.getSignerForAddress(patientWallet);
            const contractWithPatientSigner = this.contract.connect(patientSigner);

            const tx = await contractWithPatientSigner.grantAccess(recordId, doctorAddress);
            const receipt = await tx.wait();

            console.log('✅ Access granted to doctor:', doctorAddress);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Failed to grant access:', error.message);
            throw error;
        }
    }

    // Revoke access from a doctor
    async revokeAccess(recordId, doctorAddress, patientWallet) {
        try {
            const patientSigner = await this.getSignerForAddress(patientWallet);
            const contractWithPatientSigner = this.contract.connect(patientSigner);

            const tx = await contractWithPatientSigner.revokeAccess(recordId, doctorAddress);
            const receipt = await tx.wait();

            console.log('✅ Access revoked from doctor:', doctorAddress);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Failed to revoke access:', error.message);
            throw error;
        }
    }

    // Request access to patient data
    async requestAccess(patientAddress, doctorWallet) {
        try {
            const doctorSigner = await this.getSignerForAddress(doctorWallet);
            const contractWithDoctorSigner = this.contract.connect(doctorSigner);

            const tx = await contractWithDoctorSigner.requestAccess(patientAddress);
            const receipt = await tx.wait();

            console.log('✅ Access requested from patient:', patientAddress);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Failed to request access:', error.message);
            throw error;
        }
    }

    // Get access request details
    async getAccessRequest(doctorAddress, patientAddress) {
        try {
            if (!ethers.isAddress(doctorAddress) || !ethers.isAddress(patientAddress)) {
                return { doctor: doctorAddress, patient: patientAddress, status: 'NONE', exists: false };
            }
            const request = await this.contract.accessRequests(doctorAddress, patientAddress);
            const statusIndex = Number(request.status);
            return {
                doctor: request.doctor,
                patient: request.patient,
                status: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'][statusIndex] || 'NONE',
                requestedAt: request.requestedAt.toString(),
                respondedAt: request.respondedAt.toString(),
                exists: request.doctor !== ethers.ZeroAddress
            };
        } catch (error) {
            console.error(`❌ Failed to get access request (Dr: ${doctorAddress}, Pt: ${patientAddress}):`, error.message);
            return { doctor: doctorAddress, patient: patientAddress, status: 'NONE', exists: false };
        }
    }

    // Respond to access request
    async respondToAccessRequest(doctorAddress, patientWallet, approve) {
        try {
            const patientSigner = await this.getSignerForAddress(patientWallet);
            const contractWithPatientSigner = this.contract.connect(patientSigner);

            const tx = await contractWithPatientSigner.respondToAccessRequest(doctorAddress, approve);
            const receipt = await tx.wait();

            console.log(`✅ Access request from ${doctorAddress} ${approve ? 'APPROVED' : 'REJECTED'}`);
            return receipt.hash;
        } catch (error) {
            console.error('❌ Failed to respond to access request:', error.message);
            throw error;
        }
    }

    // Get all pending requests for a patient
    async getPendingRequests(patientWallet) {
        try {
            if (!patientWallet || !ethers.isAddress(patientWallet)) {
                console.warn('⚠️ Skipping getPendingRequests: Invalid patient wallet address');
                return [];
            }

            let doctors = [];
            try {
                doctors = await this.contract.getPatientRequestors(patientWallet);
            } catch (callError) {
                console.warn(`⚠️ Blockchain call to getPatientRequestors failed for ${patientWallet}:`, callError.message);
                return [];
            }

            const pending = [];
            for (const doctorAddr of doctors) {
                const req = await this.getAccessRequest(doctorAddr, patientWallet);
                if (req && req.status === 'PENDING') {
                    pending.push(req);
                }
            }
            return pending;
        } catch (error) {
            console.error('❌ Failed to get pending requests:', error);
            return []; // Return empty array instead of throwing to prevent crashing the dashboard
        }
    }

    // Verify record integrity
    async verifyRecordIntegrity(recordId, recordHash) {
        try {
            const hashBytes32 = ethers.zeroPadValue(recordHash, 32);
            const isValid = await this.contract.verifyRecordIntegrity(recordId, hashBytes32);

            console.log(`✅ Record ${recordId} integrity check:`, isValid ? 'VALID' : 'INVALID');
            return isValid;
        } catch (error) {
            console.error('❌ Failed to verify record integrity:', error.message);
            throw error;
        }
    }

    // Check if doctor has access to a record
    async hasAccess(recordId, doctorAddress) {
        try {
            if (!this.contract) return false;
            const hasAccess = await this.contract.hasAccess(recordId, doctorAddress);
            return hasAccess;
        } catch (error) {
            console.error('❌ Failed to check access:', error.message);
            return false;
        }
    }

    // Get record hash from blockchain
    async getRecordHash(recordId) {
        try {
            if (!this.contract) return { exists: false };
            const recordHash = await this.contract.getRecordHash(recordId);
            return {
                recordId: recordHash.recordId.toString(),
                hash: recordHash.recordHash,
                patient: recordHash.patient,
                timestamp: recordHash.timestamp.toString(),
                exists: recordHash.exists
            };
        } catch (error) {
            console.error('❌ Failed to get record hash:', error.message);
            return { exists: false };
        }
    }

    // Get all records for a patient
    async getPatientRecords(patientAddress) {
        try {
            if (!this.contract) return [];
            const recordIds = await this.contract.getPatientRecords(patientAddress);
            return recordIds.map(id => id.toString());
        } catch (error) {
            console.error('❌ Failed to get patient records:', error.message);
            return [];
        }
    }

    // Helper function to get signer for a specific address
    async getSignerForAddress(address) {
        if (!address) return this.signer;

        try {
            const accounts = await this.provider.listAccounts();
            for (const account of accounts) {
                const accAddress = await account.getAddress();
                if (accAddress.toLowerCase() === address.toLowerCase()) {
                    return account;
                }
            }
        } catch (error) {
            console.warn('⚠️ Error listing accounts while getting signer:', error.message);
        }

        console.warn(`⚠️ Signer for ${address} not found in provider accounts. Falling back to default signer.`);
        return this.signer;
    }

    // Get user details from blockchain
    async getUserDetails(userAddress) {
        try {
            if (!this.contract) return { isRegistered: false };
            const user = await this.contract.getUserDetails(userAddress);
            return {
                address: user.userAddress,
                role: user.role === 1 ? 'patient' : user.role === 2 ? 'doctor' : 'none',
                isRegistered: user.isRegistered,
                registeredAt: user.registeredAt.toString()
            };
        } catch (error) {
            console.error('❌ Failed to get user details:', error.message);
            return { isRegistered: false };
        }
    }
}

// Create singleton instance
const blockchainService = new BlockchainService();

module.exports = blockchainService;
