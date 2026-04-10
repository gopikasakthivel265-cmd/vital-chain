
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def check_wallets():
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "healthcare_blockchain")
        )
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT user_id, username, role, wallet_address FROM users")
        users = cursor.fetchall()
        
        print(f"{'ID':<5} | {'Username':<15} | {'Role':<10} | {'Wallet':<42}")
        print("-" * 80)
        for user in users:
            print(f"{user['user_id']:<5} | {user['username']:<15} | {user['role']:<10} | {user['wallet_address']}")
            
        cursor.close()
        connection.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_wallets()
