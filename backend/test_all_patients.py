
import requests

API_URL = "http://127.0.0.1:5000/api"

def test_all_patients():
    try:
        print("Testing all patients endpoint...")
        response = requests.get(f"{API_URL}/patients/all")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print(f"Data received: {len(response.json()['data'])} patients")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_all_patients()
