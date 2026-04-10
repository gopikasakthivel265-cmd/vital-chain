import os
import firebase_admin
from firebase_admin import credentials, storage, firestore

class CloudService:
    def __init__(self):
        # Initialize Firebase Admin SDK
        # Note: Requires FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS env var
        try:
            if not firebase_admin._apps:
                cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred, {
                        'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET")
                    })
                else:
                    # Fallback to default credentials (useful for some environments)
                    firebase_admin.initialize_app(options={
                        'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET")
                    })
            
            self.db = firestore.client()
            self.bucket = storage.bucket()
        except Exception as e:
            print(f"Firebase Service Initialization Warning: {e}")
            self.db = None
            self.bucket = None

    def upload_record(self, file_obj, patient_id, case_name):
        """Uploads a file to Firebase Storage (or local mock) and records metadata."""
        if not self.bucket:
            # Mock mode: save to a local 'uploads' directory
            upload_dir = os.path.join(os.path.dirname(__file__), "../../uploads_mock")
            os.makedirs(upload_dir, exist_ok=True)
            
            filename = f"{patient_id}_{case_name}_{file_obj.filename}"
            filepath = os.path.join(upload_dir, filename)
            
            file_obj.save(filepath)
            
            return {
                "status": "success", 
                "message": "Mock Upload Successful (Local)",
                "path": filepath,
                "doc_id": "mock_doc_" + os.urandom(4).hex()
            }

        filename = f"records/{patient_id}/{case_name}_{file_obj.filename}"
        blob = self.bucket.blob(filename)
        
        # Upload from file object
        blob.upload_from_file(file_obj)
        # Optional: Make file public if needed, or use signed URLs
        # blob.make_public()
        
        # Save metadata to Firestore
        doc_ref = self.db.collection('records').document()
        doc_ref.set({
            'patientId': patient_id,
            'caseName': case_name,
            'gcsPath': filename,
            'storageUrl': blob.public_url, # public_url works if made public
            'timestamp': firestore.SERVER_TIMESTAMP,
            'status': 'Uploaded'
        })
        
        return {"status": "success", "path": filename, "doc_id": doc_ref.id}

    def get_patient_records(self, patient_id):
        """Fetches records for a specific patient from Firestore."""
        if not self.db:
            return []
        
        records_ref = self.db.collection('records')
        query = records_ref.where('patientId', '==', patient_id).stream()
        
        return [doc.to_dict() for doc in query]
