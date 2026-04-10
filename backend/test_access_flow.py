import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000/api"

def test_access_request_flow():
    print("--- Testing Blockchain Access Request Flow ---")
    
    # 1. Doctor requests access to Patient (patientId=4 for test)
    print("\n[1] Doctor requesting access to Patient ID: 4...")
    try:
        resp = requests.post(f"{BASE_URL}/doctor/request-access", json={"patientId": 4})
        print(f"Status Code: {resp.status_code}")
        data = resp.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        if not data.get('success'):
            print("Failed to request access.")
            return
            
        tx_hash = data.get('txHash')
        print(f"Transaction Hash: {tx_hash}")
        
    except Exception as e:
        print(f"Error: {e}")
        return

    # 2. Patient views pending requests
    print("\n[2] Patient viewing pending requests...")
    try:
        resp = requests.get(f"{BASE_URL}/patient/dashboard")
        data = resp.json()
        if data.get('success'):
            pending = data['data'].get('pendingRequests', [])
            print(f"Found {len(pending)} pending requests.")
            for req in pending:
                print(f"- From: {req['doctor']} (Dr. {req.get('doctorName', 'Unknown')})")
        else:
            print("Failed to fetch dashboard.")
    except Exception as e:
        print(f"Error: {e}")

    # 3. Patient responds (Approve)
    print("\n[3] Patient responding (Approve) to request...")
    if 'pending' in locals() and pending:
        doctor_addr = pending[0]['doctor']
        try:
            resp = requests.post(f"{BASE_URL}/patient/respond-access", json={
                "doctorAddress": doctor_addr,
                "approve": True
            })
            print(f"Status Code: {resp.status_code}")
            print(f"Response: {json.dumps(resp.json(), indent=2)}")
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("No pending requests to respond to.")

if __name__ == "__main__":
    test_access_request_flow()
