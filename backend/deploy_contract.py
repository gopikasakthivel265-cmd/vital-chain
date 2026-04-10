
import json
import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

def deploy():
    w3 = Web3(Web3.HTTPProvider(os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")))
    if not w3.is_connected():
        print("Error: Could not connect to blockchain node.")
        return
    
    owner = w3.eth.accounts[0]
    
    # Load Artifact
    abi_path = os.path.join(os.path.dirname(__file__), "../blockchain/artifacts/blockchain/contracts/MedicalRecords.sol/MedicalRecords.json")
    with open(abi_path, 'r') as f:
        artifact = json.load(f)
        abi = artifact['abi']
        bytecode = artifact['bytecode']
    
    # Create Contract
    MedicalRecords = w3.eth.contract(abi=abi, bytecode=bytecode)
    
    # Deploy
    print("Deploying contract...")
    tx_hash = MedicalRecords.constructor().transact({'from': owner})
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    print(f"DEPLOYED_ADDRESS={tx_receipt.contractAddress}")

if __name__ == "__main__":
    deploy()
