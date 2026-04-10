
import mysql.connector
import os
import json
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

def register_users_on_chain():
    # Connect to Blockchain
    w3 = Web3(Web3.HTTPProvider(os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")))
    if not w3.is_connected():
        print("Error: Could not connect to blockchain node.")
        return
    
    owner = w3.eth.accounts[0]
    
    # Load ABI
    abi_path = os.path.join(os.path.dirname(__file__), "../blockchain/artifacts/blockchain/contracts/MedicalRecords.sol/MedicalRecords.json")
    with open(abi_path, 'r') as f:
        artifact = json.load(f)
        abi = artifact['abi']
    
    contract_address = os.getenv("CONTRACT_ADDRESS")
    if not contract_address:
        print("Error: CONTRACT_ADDRESS not found in .env")
        return
        
    contract = w3.eth.contract(address=contract_address, abi=abi)
    
    # Connect to Database
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "healthcare_blockchain")
        )
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT u.user_id, u.username, u.role, u.wallet_address, p.full_name as p_name, p.patient_id, d.full_name as d_name, d.specialization FROM users u LEFT JOIN patients p ON u.user_id = p.user_id LEFT JOIN doctors d ON u.user_id = d.user_id")
        users = cursor.fetchall()
        
        for user in users:
            if not user['wallet_address']:
                continue
                
            addr = w3.to_checksum_address(user['wallet_address'])
            
            # Check if already registered
            details = contract.functions.users(addr).call()
            if details[6]: # isRegistered
                print(f"Skipping {user['username']} - Already registered on chain.")
                continue
            
            role_enum = 1 if user['role'] == 'patient' else 2
            name = user['d_name'] if user['role'] == 'doctor' else ""
            p_id = user['patient_id'] if user['role'] == 'patient' else ""
            spec = user['specialization'] if user['role'] == 'doctor' else ""
            
            print(f"Registering {user['username']} as {user['role']} ({addr})...")
            tx_hash = contract.functions.registerUser(
                addr,
                role_enum,
                name or "",
                p_id or "",
                spec or ""
            ).transact({'from': owner})
            
            w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"Done.")
            
        cursor.close()
        connection.close()
        print("Success: All users registered on blockchain.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    register_users_on_chain()
