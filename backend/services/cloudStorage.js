const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class CloudStorageService {
    constructor() {
        this.initialized = false;
        this.bucket = null;
        this.initialize();
    }

    initialize() {
        try {
            const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './backend/firebase-key.json';
            const absolutePath = path.resolve(serviceAccountPath);

            if (fs.existsSync(absolutePath)) {
                const serviceAccount = require(absolutePath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
                });
                this.bucket = admin.storage().bucket();
                this.initialized = true;
                console.log('✅ Firebase Cloud Storage initialized');
            } else {
                console.warn('⚠️ Firebase service account key not found at:', absolutePath);
                console.warn('Cloud storage will operate in MOCK mode.');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Firebase:', error.message);
        }
    }

    async uploadRecord(filePath, patientId, fileName) {
        if (!this.initialized || !this.bucket) {
            console.log(`[MOCK CLOUD] Uploading ${fileName} for patient ${patientId}`);
            return {
                success: false,
                url: null,
                storagePath: null
            };
        }

        try {
            const destination = `records/${patientId}/${fileName}`;
            await this.bucket.upload(filePath, {
                destination: destination,
                metadata: {
                    contentType: 'application/octet-stream', // Multer should provide this, but fallback
                },
            });

            // Get a signed URL for temporary access (e.g., 1 hour)
            const [url] = await this.bucket.file(destination).getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            });

            return {
                success: true,
                url: url,
                storagePath: destination
            };
        } catch (error) {
            console.error('Cloud Upload Error:', error);
            throw new Error('Failed to upload record to cloud: ' + error.message);
        }
    }

    async getSignedUrl(storagePath) {
        if (!this.initialized || !this.bucket) {
            return null;
        }

        try {
            const [url] = await this.bucket.file(storagePath).getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
            });
            return url;
        } catch (error) {
            console.error('Error generating signed URL:', error);
            return null;
        }
    }
}

module.exports = new CloudStorageService();
