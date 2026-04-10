import json
import os
from web3 import Web3

class BlockchainService:
    def __init__(self):
        # Connect to local Hardhat node or Infura/Alchemy
        self.w3 = Web3(Web3.HTTPProvider(os.getenv("BLOCKCHAIN_URL", "http://127.0.0.1:8545")))
        
        # Load ABI
        abi_path = os.path.join(os.path.dirname(__file__), "../../blockchain/artifacts/blockchain/contracts/MedicalRecords.sol/MedicalRecords.json")
        try:
            with open(abi_path, 'r') as f:
                artifact = json.load(f)
                self.abi = artifact['abi']
            
            self.contract_address = os.getenv("CONTRACT_ADDRESS")
            if self.contract_address:
                self.contract = self.w3.eth.contract(address=self.contract_address, abi=self.abi)
            else:
                self.contract = None
        except Exception as e:
            print(f"Blockchain Service Initialization Warning: {e}")
            self.contract = None

    def store_record_hash(self, record_id, record_hash, from_address):
        """Calls the smart contract to store a record hash."""
        if not self.contract:
            return {"status": "error", "message": "Contract not deployed"}
        
        # Note: In a real app, we would sign this transaction with a private key
        # For simplicity, we assume the account is unlocked or handled by the provider
        try:
            tx_hash = self.contract.functions.storeRecordHash(record_id, record_hash).transact({'from': from_address})
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            return {"status": "success", "tx_hash": receipt.transactionHash.hex()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def check_access(self, record_id, doctor_address):
        """Checks if a doctor has access to a specific record on-chain."""
        if not self.contract:
            return False
        return self.contract.functions.hasAccess(record_id, doctor_address).call()

    def request_access(self, patient_address, doctor_address):
        """Calls the smart contract to request access to a patient's records."""
        if not self.contract:
            return {"status": "error", "message": "Contract not deployed"}
        
        try:
            tx_hash = self.contract.functions.requestAccess(patient_address).transact({'from': doctor_address})
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            return {"status": "success", "tx_hash": receipt.transactionHash.hex()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def respond_to_access_request(self, doctor_address, user_address, approve):
        """Calls the smart contract to respond to an access request."""
        if not self.contract:
            return {"status": "error", "message": "Contract not deployed"}
        
        try:
            tx_hash = self.contract.functions.respondToAccessRequest(doctor_address, approve).transact({'from': user_address})
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
            return {"status": "success", "tx_hash": receipt.transactionHash.hex()}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_pending_requests(self, patient_address):
        """Fetches pending access requests for a patient."""
        if not self.contract:
            return []
        
        try:
            doctor_addresses = self.contract.functions.getPatientRequestors(patient_address).call()
            pending = []
            for doc_addr in doctor_addresses:
                req = self.contract.functions.accessRequests(doc_addr, patient_address).call()
                # Status is index 2 in struct: NONE=0, PENDING=1, APPROVED=2, REJECTED=3
                if req[2] == 1: 
                    pending.append({
                        "doctor": doc_addr,
                        "status": "PENDING",
                        "requestedAt": req[3]
                    })
            return pending
        except Exception as e:
            print(f"Error getting pending requests: {e}")
            return []

    def get_access_status(self, doctor_address, patient_address):
        """Checks the status of an access request on-chain."""
        if not self.contract:
            return 0 # NONE
        
        try:
            req = self.contract.functions.accessRequests(doctor_address, patient_address).call()
            return req[2] # RequestStatus index
        except Exception as e:
            print(f"Error checking access status: {e}")
            return 0 # NONE
