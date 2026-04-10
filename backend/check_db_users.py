import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def check_users():
    config = {
        'host': 'localhost',
        'user': 'root',
        'password': 'Sgops@1820',
        'database': 'healthcare_blockchain',
        'port': 3306
    }
    
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT user_id, username, role, wallet_address FROM users WHERE user_id IN (14, 15)")
    users = cursor.fetchall()
    
    print("--- User Check ---")
    for u in users:
        print(f"ID: {u['user_id']}, Name: {u['username']}, Role: {u['role']}, Wallet: {u['wallet_address']}")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_users()
