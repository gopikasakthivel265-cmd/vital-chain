
import mysql.connector
import os
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

def populate_wallets():
    # Connect to Blockchain
    w3 = Web3(Web3.HTTPProvider(os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")))
    if not w3.is_connected():
        print("Error: Could not connect to blockchain node.")
        return
    
    accounts = w3.eth.accounts
    if not accounts:
        print("Error: No accounts found on node.")
        return
    
    # Connect to Database
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "healthcare_blockchain")
        )
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT user_id, username, role FROM users")
        users = cursor.fetchall()
        
        print(f"Found {len(users)} users and {len(accounts)} accounts.")
        
        for i, user in enumerate(users):
            if i < len(accounts):
                address = accounts[i]
                cursor.execute(
                    "UPDATE users SET wallet_address = %s WHERE user_id = %s",
                    (address, user['user_id'])
                )
                print(f"Assigned {address} to {user['username']} ({user['role']})")
            else:
                print(f"Warning: No more accounts available for {user['username']}")
                
        connection.commit()
        cursor.close()
        connection.close()
        print("Success: Wallets updated in database.")
        
    except Exception as e:
        print(f"Database Error: {e}")

if __name__ == "__main__":
    populate_wallets()
