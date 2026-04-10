import mysql.connector
import os
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

def check_db():
    print("--- Database Counts ---")
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'healthcare_blockchain'),
            port=int(os.getenv('DB_PORT', 3306))
        )
        cursor = conn.cursor()
        
        tables = ['users', 'patients', 'doctors', 'treatments', 'medical_records']
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"Table {table}: {count} rows")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

def check_contract_at(address):
    print(f"\n--- Checking Address: {address} ---")
    rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if w3.is_connected():
        code = w3.eth.get_code(address)
        print(f"Code length at {address}: {len(code)}")
        if len(code) > 2:
            print("Contract code FOUND.")
        else:
            print("Contract code NOT FOUND.")
    else:
        print("Blockchain not connected.")

if __name__ == "__main__":
    check_db()
    
    # Check current .env address
    check_contract_at(os.getenv("CONTRACT_ADDRESS"))
    
    # Check address in new_address.txt
    if os.path.exists("new_address.txt"):
        with open("new_address.txt", "r") as f:
            addr = f.read().strip()
            check_contract_at(addr)
