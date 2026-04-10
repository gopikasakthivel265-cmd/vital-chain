import mysql.connector
import os
from dotenv import load_dotenv
import json
from web3 import Web3

load_dotenv()

def check_db():
    print("--- Database Check ---")
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'healthcare_blockchain'),
            port=int(os.getenv('DB_PORT', 3306))
        )
        cursor = conn.cursor(dictionary=True)
        
        # Check users
        cursor.execute("SELECT user_id, username, email, role, wallet_address FROM users")
        users = cursor.fetchall()
        print(f"Users found: {len(users)}")
        for u in users:
            print(f"  ID: {u['user_id']}, Role: {u['role']}, Email: {u['email']}, Wallet: {u['wallet_address']}")
            
        # Check doctors
        cursor.execute("SELECT doctor_id, user_id, full_name FROM doctors")
        doctors = cursor.fetchall()
        print(f"\nDoctors found: {len(doctors)}")
        for d in doctors:
            print(f"  Dr ID: {d['doctor_id']}, User ID: {d['user_id']}, Name: {d['full_name']}")
            
        # Check patients
        cursor.execute("SELECT patient_id, user_id, full_name FROM patients")
        patients = cursor.fetchall()
        print(f"\nPatients found: {len(patients)}")
        for p in patients:
            print(f"  Patient ID: {p['patient_id']}, User ID: {p['user_id']}, Name: {p['full_name']}")
            
        # Check treatments
        cursor.execute("SELECT * FROM treatments")
        treatments = cursor.fetchall()
        print(f"\nTreatments found: {len(treatments)}")
        for t in treatments:
            print(f"  Doc ID: {t['doctor_id']}, Patient ID: {t['patient_id']}, Status: {t['status']}")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

def check_blockchain():
    print("\n--- Blockchain Check ---")
    contract_address = os.getenv("CONTRACT_ADDRESS")
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
    print(f"Contract Address in .env: {contract_address}")
    print(f"RPC URL: {rpc_url}")
    
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if w3.is_connected():
        print("Connected to blockchain.")
        if contract_address:
            code = w3.eth.get_code(contract_address)
            if code == b'' or code == '0x':
                print("WARNING: No contract code found at this address!")
            else:
                print("Contract code verified at address.")
        else:
            print("No contract address configured.")
    else:
        print("Failed to connect to blockchain.")

if __name__ == "__main__":
    check_db()
    check_blockchain()
