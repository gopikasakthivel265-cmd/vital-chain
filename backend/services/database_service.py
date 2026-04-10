import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

class DatabaseService:
    def __init__(self):
        self.config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'user': os.getenv('DB_USER', 'root'),
            'password': os.getenv('DB_PASSWORD', ''),
            'database': os.getenv('DB_NAME', 'healthcare_blockchain'),
            'port': int(os.getenv('DB_PORT', 3306))
        }

    def get_connection(self):
        return mysql.connector.connect(**self.config)

    def create_medical_record(self, record_data):
        """Inserts a new medical record into the database."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            INSERT INTO medical_records 
            (patient_id, uploaded_by_user_id, record_title, record_type, 
             file_path, file_name, file_size, mime_type, record_hash, 
             blockchain_tx_hash, is_verified)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        values = (
            record_data['patient_id'],
            record_data['uploaded_by_user_id'],
            record_data['record_title'],
            record_data['record_type'],
            record_data['file_path'],
            record_data['file_name'],
            record_data['file_size'],
            record_data['mime_type'],
            record_data['record_hash'],
            record_data.get('blockchain_tx_hash'),
            record_data.get('is_verified', False)
        )
        
        try:
            cursor.execute(query, values)
            connection.commit()
            return cursor.lastrowid
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()
            connection.close()

    def get_patient_id_by_user_id(self, user_id):
        """Retrieves patient_id for a given user_id."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT patient_id FROM patients WHERE user_id = %s"
        
        try:
            cursor.execute(query, (user_id,))
            result = cursor.fetchone()
            return result['patient_id'] if result else None
        finally:
            cursor.close()
            connection.close()
    def get_patient_medical_records(self, patient_id):
        """Fetches medical records for a specific patient."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT * FROM medical_records WHERE patient_id = %s ORDER BY created_at DESC"
        
        try:
            cursor.execute(query, (patient_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
            connection.close()

    def get_doctor_patients(self, doctor_id):
        """Fetches all patients for a specific doctor."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT p.*, t.status, t.diagnosis_category, t.critical_reason 
            FROM patients p
            JOIN treatments t ON p.patient_id = t.patient_id
            WHERE t.doctor_id = %s
        """
        
        try:
            cursor.execute(query, (doctor_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
            connection.close()

    def get_critical_patients(self, doctor_id):
        """Fetches only critical patients for a specific doctor."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT p.*, t.critical_reason, t.updated_at
            FROM patients p
            JOIN treatments t ON p.patient_id = t.patient_id
            WHERE t.doctor_id = %s AND t.status = 'critical'
        """
        
        try:
            cursor.execute(query, (doctor_id,))
            return cursor.fetchall()
        finally:
            cursor.close()
            connection.close()

    def update_treatment_status(self, patient_id, doctor_id, status, reason=None):
        """Updates the treatment status and critical reason for a patient."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            UPDATE treatments 
            SET status = %s, critical_reason = %s, updated_at = CURRENT_TIMESTAMP
            WHERE patient_id = %s AND doctor_id = %s
        """
        
        try:
            cursor.execute(query, (status, reason, patient_id, doctor_id))
            connection.commit()
            return cursor.rowcount > 0
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()
            connection.close()

    def get_doctor_id_by_user_id(self, user_id):
        """Retrieves doctor_id for a given user_id."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT doctor_id FROM doctors WHERE user_id = %s"
        
        try:
            cursor.execute(query, (user_id,))
            result = cursor.fetchone()
            return result['doctor_id'] if result else None
        finally:
            cursor.close()
            connection.close()

    def search_patients(self, query):
        """Searches for patients by name or email."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # Search by name in patients table or username/email in users table
        sql = """
            SELECT p.patient_id, p.full_name, u.email, u.username
            FROM patients p
            JOIN users u ON p.user_id = u.user_id
            WHERE p.full_name LIKE %s OR u.email LIKE %s OR u.username LIKE %s
            LIMIT 10
        """
        search_term = f"%{query}%"
        
        try:
            cursor.execute(sql, (search_term, search_term, search_term))
            return cursor.fetchall()
        finally:
            cursor.close()
            connection.close()

    def add_treatment_relationship(self, patient_id, doctor_id, diagnosis_category='General'):
        """Creates a new treatment relationship between a doctor and patient."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        # INSERT IGNORE to avoid duplicates
        query = """
            INSERT IGNORE INTO treatments (patient_id, doctor_id, diagnosis_category, status)
            VALUES (%s, %s, %s, 'active')
        """
        
        try:
            cursor.execute(query, (patient_id, doctor_id, diagnosis_category))
            connection.commit()
            return cursor.rowcount > 0
        except Exception as e:
            connection.rollback()
            raise e
        finally:
            cursor.close()
            connection.close()

    def get_all_doctors(self):
        """Fetches all doctors with their user emails."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = """
            SELECT d.*, u.email 
            FROM doctors d 
            JOIN users u ON d.user_id = u.user_id
        """
        
        try:
            cursor.execute(query)
            return cursor.fetchall()
        finally:
            cursor.close()
            connection.close()
    def get_user_wallet_address(self, user_id):
        """Retrieves wallet_address for a given user_id."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        
        query = "SELECT wallet_address FROM users WHERE user_id = %s"
        
        try:
            cursor.execute(query, (user_id,))
            result = cursor.fetchone()
            return result['wallet_address'] if result else None
        finally:
            cursor.close()
            connection.close()

    def get_user_id_by_wallet(self, wallet_address):
        """Retrieves user_id for a given wallet address."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        query = "SELECT user_id FROM users WHERE wallet_address = %s"
        try:
            cursor.execute(query, (wallet_address,))
            result = cursor.fetchone()
            return result['user_id'] if result else None
        finally:
            cursor.close()
            connection.close()

    def get_doctor_profile_by_user_id(self, user_id):
        """Retrieves doctor profile by user_id."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        query = "SELECT * FROM doctors WHERE user_id = %s"
        try:
            cursor.execute(query, (user_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            connection.close()

    def get_patient_profile(self, patient_id):
        """Retrieves patient profile by patient_id."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        query = "SELECT * FROM patients WHERE patient_id = %s"
        try:
            cursor.execute(query, (patient_id,))
            return cursor.fetchone()
        finally:
            cursor.close()
            connection.close()

    def get_all_patients(self):
        """Fetches all registered patients from the database."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        query = """
            SELECT p.patient_id, p.full_name, u.email 
            FROM patients p
            JOIN users u ON p.user_id = u.user_id
            ORDER BY p.full_name ASC
        """
        try:
            cursor.execute(query)
            return cursor.fetchall()
        finally:
            cursor.close()
            connection.close()

    def is_access_request_approved(self, doctor_id, patient_id):
        """Checks if there's an approved access request in the database."""
        connection = self.get_connection()
        cursor = connection.cursor(dictionary=True)
        query = "SELECT * FROM access_requests WHERE doctor_id = %s AND patient_id = %s AND status = 'approved'"
        try:
            cursor.execute(query, (doctor_id, patient_id))
            return cursor.fetchone() is not None
        finally:
            cursor.close()
            connection.close()
