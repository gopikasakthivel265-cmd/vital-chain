import json
import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

def deploy():
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        print(f"Error: Could not connect to blockchain node at {rpc_url}.")
        print("Please ensure your local blockchain node (e.g., Hardhat) is running.")
        return
    
    if not w3.eth.accounts:
        print("Error: No accounts found on the blockchain node.")
        return

    owner = w3.eth.accounts[0]
    abi_path = os.path.join(os.path.dirname(__file__), "../blockchain/artifacts/blockchain/contracts/MedicalRecords.sol/MedicalRecords.json")
    with open(abi_path, 'r') as f:
        artifact = json.load(f)
        abi = artifact['abi']
        bytecode = artifact['bytecode']
    
    MedicalRecords = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = MedicalRecords.constructor().transact({'from': owner})
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    with open("new_address.txt", "w") as f:
        f.write(tx_receipt.contractAddress)
    print(f"Address saved to new_address.txt")

if __name__ == "__main__":
    deploy()
