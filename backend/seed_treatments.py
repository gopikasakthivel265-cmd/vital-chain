import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def seed_treatments():
    print("--- Seeding Treatments ---")
    try:
        conn = mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'healthcare_blockchain'),
            port=int(os.getenv('DB_PORT', 3306))
        )
        cursor = conn.cursor(dictionary=True)
        
        # Get one doctor
        cursor.execute("SELECT doctor_id FROM doctors LIMIT 1")
        doctor = cursor.fetchone()
        if not doctor:
            print("No doctors found in DB.")
            return
            
        doctor_id = doctor['doctor_id']
        
        # Get all patients
        cursor.execute("SELECT patient_id FROM patients")
        patients = cursor.fetchall()
        
        if not patients:
            print("No patients found in DB.")
            return

        print(f"Linking {len(patients)} patients to doctor ID {doctor_id}...")
        
        for p in patients:
            patient_id = p['patient_id']
            # Using INSERT IGNORE to avoid duplicates
            query = """
                INSERT IGNORE INTO treatments (patient_id, doctor_id, diagnosis_category, status)
                VALUES (%s, %s, 'General Checkup', 'active')
            """
            cursor.execute(query, (patient_id, doctor_id))
            
        conn.commit()
        print("Seeding complete.")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error seeding database: {e}")

if __name__ == "__main__":
    seed_treatments()
