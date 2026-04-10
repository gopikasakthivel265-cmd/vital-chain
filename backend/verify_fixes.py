
import jwt
import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = "http://127.0.0.1:5000/api"
JWT_SECRET = os.getenv("JWT_SECRET", "your_super_secret_jwt_key_change_this_in_production")

def verify_access_control():
    # Use existing doctor from DB (e.g., user_id=15)
    doctor_payload = {
        "userId": 15,
        "email": "doctor@example.com",
        "role": "doctor"
    }
    doctor_token = jwt.encode(doctor_payload, JWT_SECRET, algorithm="HS256")
    headers = {"Authorization": f"Bearer {doctor_token}"}
    
    print("1. Testing Patient Search...")
    search_resp = requests.get(f"{API_URL}/patients/search?q=a", headers=headers)
    print(f"Search Status: {search_resp.status_code}")
    if search_resp.status_code == 200:
        print(f"Results: {len(search_resp.json()['data'])} patients found")
    else:
        print(f"Search failed: {search_resp.text}")

    print("\n2. Testing Records Access (Expected 403 or 400 if wallets missing)...")
    # Using patient_id=1
    records_resp = requests.get(f"{API_URL}/doctor/patient/1/records", headers=headers)
    print(f"Records Status: {records_resp.status_code}")
    print(f"Records Response: {records_resp.text}")

if __name__ == "__main__":
    verify_access_control()
