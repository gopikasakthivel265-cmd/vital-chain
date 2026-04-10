
import requests

API_URL = "http://127.0.0.1:5000/api"

def test_search():
    try:
        print("Testing patient search with query 'test'...")
        response = requests.get(f"{API_URL}/patients/search?q=test")
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_search()
