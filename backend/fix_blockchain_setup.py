
import json
import os
import mysql.connector
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

def update_env(key, value):
    env_path = ".env"
    if not os.path.exists(env_path):
        print(f"Warning: {env_path} not found.")
        return
        
    with open(env_path, "r") as f:
        lines = f.readlines()
    
    with open(env_path, "w") as f:
        found = False
        for line in lines:
            if line.startswith(f"{key}="):
                f.write(f"{key}={value}\n")
                found = True
            else:
                f.write(line)
        if not found:
            f.write(f"{key}={value}\n")

def main():
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
    
    # 1. Deploy Contract
    abi_path = os.path.join(os.path.dirname(__file__), "../blockchain/artifacts/blockchain/contracts/MedicalRecords.sol/MedicalRecords.json")
    if not os.path.exists(abi_path):
        print(f"Error: ABI not found at {abi_path}")
        return
        
    with open(abi_path, 'r') as f:
        artifact = json.load(f)
        abi = artifact['abi']
        bytecode = artifact['bytecode']
    
    MedicalRecords = w3.eth.contract(abi=abi, bytecode=bytecode)
    print("Deploying contract...")
    tx_hash = MedicalRecords.constructor().transact({'from': owner})
    tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    new_address = tx_receipt.contractAddress
    print(f"Contract deployed at: {new_address}")
    
    # 2. Update .env
    update_env("CONTRACT_ADDRESS", new_address)
    print("Updated .env with new CONTRACT_ADDRESS")
    
    # 3. Register Users
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "Sgops@1820"),
            database=os.getenv("DB_NAME", "healthcare_blockchain")
        )
        cursor = connection.cursor(dictionary=True)
        # Use simple mapping for users, check for presence in patients/doctors tables
        cursor.execute("SELECT user_id, username, role, wallet_address FROM users")
        users = cursor.fetchall()
        
        contract = w3.eth.contract(address=new_address, abi=abi)
        
        for user in users:
            if not user['wallet_address']:
                print(f"Skipping {user['username']} - No wallet address.")
                continue
                
            addr = w3.to_checksum_address(user['wallet_address'])
            role_enum = 1 if user['role'] == 'patient' else 2
            
            # Fetch additional details manually to be safe
            name = ""
            p_id = ""
            spec = ""
            
            if user['role'] == 'patient':
                cursor.execute("SELECT patient_id, full_name FROM patients WHERE user_id = %s", (user['user_id'],))
                p = cursor.fetchone()
                if p:
                    p_id = str(p['patient_id'])
            elif user['role'] == 'doctor':
                cursor.execute("SELECT full_name, specialization FROM doctors WHERE user_id = %s", (user['user_id'],))
                d = cursor.fetchone()
                if d:
                    name = str(d['full_name'])
                    spec = str(d['specialization'])

            # Use more robust string passing
            # If the contract expects a string, passing "" should work
            name_val = str(name or "")
            pid_val = str(p_id or "")
            spec_val = str(spec or "")
            
            print(f"Registering {user['username']} as {user['role']} ({addr})...")
            tx_hash = contract.functions.registerUser(
                addr,
                role_enum,
                name_val,
                pid_val,
                spec_val
            ).transact({'from': owner})
            
            w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"Successfully registered {user['username']}")
            
        cursor.close()
        connection.close()
        print("Success: All users registered on blockchain.")
        
    except Exception as e:
        print(f"Database/Blockchain Error: {e}")

if __name__ == "__main__":
    main()
