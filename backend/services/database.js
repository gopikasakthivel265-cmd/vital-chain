const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'healthcare_blockchain',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// User operations
const userDB = {
    // Create new user
    async create(username, email, passwordHash, role, walletAddress = null) {
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, role, wallet_address) VALUES (?, ?, ?, ?, ?)',
            [username, email, passwordHash, role, walletAddress]
        );
        return result.insertId;
    },

    // Find user by email
    async findByEmail(email) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0];
    },

    // Find user by ID
    async findById(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    },

    // Find user by wallet address
    async findByWallet(walletAddress) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE wallet_address = ?',
            [walletAddress]
        );
        return rows[0];
    },

    // Update wallet address
    async updateWallet(userId, walletAddress) {
        await pool.execute(
            'UPDATE users SET wallet_address = ? WHERE user_id = ?',
            [walletAddress, userId]
        );
    },

    // Verify user
    async verify(userId) {
        await pool.execute(
            'UPDATE users SET is_verified = TRUE WHERE user_id = ?',
            [userId]
        );
    },

    // Set OTP for user
    async setOTP(userId, otpCode) {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        return pool.execute(
            'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE user_id = ?',
            [otpCode, expiresAt, userId]
        );
    },

    // Verify OTP
    async verifyOTP(userId, otpCode) {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE user_id = ? AND otp_code = ? AND otp_expires_at > NOW()',
            [userId, otpCode]
        );
        return rows.length > 0;
    },

    // Clear OTP after use
    async clearOTP(userId) {
        return pool.execute(
            'UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?',
            [userId]
        );
    }
};

// Patient operations
const patientDB = {
    // Create patient profile
    async create(userId, fullName, dateOfBirth, gender, contactPhone = null, address = null, bloodGroup = null, emergencyContact = null, medicalHistory = null) {
        const [result] = await pool.execute(
            'INSERT INTO patients (user_id, full_name, date_of_birth, gender, contact_phone, address, blood_group, emergency_contact, medical_history_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [userId, fullName, dateOfBirth, gender, contactPhone, address, bloodGroup, emergencyContact, medicalHistory]
        );
        return result.insertId;
    },

    // Get patient by user ID
    async getByUserId(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM patients WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    },

    // Get patient by patient ID
    async getById(patientId) {
        const [rows] = await pool.execute(
            'SELECT * FROM patients WHERE patient_id = ?',
            [patientId]
        );
        return rows[0];
    },

    // Get all registered patients
    async getAll() {
        const [rows] = await pool.execute(
            'SELECT p.*, u.email FROM patients p JOIN users u ON p.user_id = u.user_id ORDER BY p.full_name ASC'
        );
        return rows;
    },

    // Search patients by name or email
    async search(query) {
        const searchTerm = `%${query}%`;
        const [rows] = await pool.execute(
            `SELECT p.patient_id, p.full_name, u.email, u.username
             FROM patients p
             JOIN users u ON p.user_id = u.user_id
             WHERE p.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?
             LIMIT 10`,
            [searchTerm, searchTerm, searchTerm]
        );
        return rows;
    }
};

// Doctor operations
const doctorDB = {
    // Create doctor profile
    async create(userId, fullName, specialization, licenseNumber, hospitalAffiliation = null, contactPhone = null, yearsOfExperience = null) {
        const [result] = await pool.execute(
            'INSERT INTO doctors (user_id, full_name, specialization, license_number, hospital_affiliation, contact_phone, years_of_experience) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, fullName, specialization, licenseNumber, hospitalAffiliation, contactPhone, yearsOfExperience]
        );
        return result.insertId;
    },

    // Get doctor by user ID
    async getByUserId(userId) {
        const [rows] = await pool.execute(
            'SELECT * FROM doctors WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    },

    // Get doctor by doctor ID
    async getById(doctorId) {
        const [rows] = await pool.execute(
            'SELECT * FROM doctors WHERE doctor_id = ?',
            [doctorId]
        );
        return rows[0];
    },

    // Get all doctors
    async getAll() {
        const [rows] = await pool.execute(
            'SELECT d.*, u.email FROM doctors d JOIN users u ON d.user_id = u.user_id'
        );
        return rows;
    }
};

// Medical records operations
const recordDB = {
    // Create new medical record
    async create(patientId, uploadedByUserId, recordTitle, recordDescription, recordType, filePath, fileName, fileSize, mimeType, recordHash) {
        const [result] = await pool.execute(
            'INSERT INTO medical_records (patient_id, uploaded_by_user_id, record_title, record_description, record_type, file_path, file_name, file_size, mime_type, record_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [patientId, uploadedByUserId, recordTitle, recordDescription, recordType, filePath, fileName, fileSize, mimeType, recordHash]
        );
        return result.insertId;
    },

    // Update blockchain transaction hash
    async updateBlockchainTx(recordId, txHash) {
        await pool.execute(
            'UPDATE medical_records SET blockchain_tx_hash = ?, is_verified = TRUE WHERE record_id = ?',
            [txHash, recordId]
        );
    },

    // Get record by ID
    async getById(recordId) {
        const [rows] = await pool.execute(
            'SELECT * FROM medical_records WHERE record_id = ?',
            [recordId]
        );
        return rows[0];
    },

    // Get all records for a patient
    async getByPatientId(patientId) {
        const [rows] = await pool.execute(
            'SELECT * FROM medical_records WHERE patient_id = ? ORDER BY created_at DESC',
            [patientId]
        );
        return rows;
    },

    // Get accessible records for a doctor
    async getAccessibleByDoctor(doctorId) {
        const [rows] = await pool.execute(
            `SELECT mr.*, p.full_name as patient_name, ap.granted_at 
             FROM medical_records mr 
             JOIN access_permissions ap ON mr.record_id = ap.record_id 
             JOIN patients p ON mr.patient_id = p.patient_id 
             WHERE ap.doctor_id = ? AND ap.permission_status = 'active' 
             ORDER BY mr.created_at DESC`,
            [doctorId]
        );
        return rows;
    },
    // Get record by hash
    async getByHash(recordHash) {
        const [rows] = await pool.execute(
            'SELECT * FROM medical_records WHERE record_hash = ?',
            [recordHash]
        );
        return rows[0];
    },

    // Update record and increment modification count
    async update(recordId, { recordTitle, recordDescription, recordType, filePath, fileName, fileSize, mimeType, recordHash }) {
        await pool.execute(
            `UPDATE medical_records 
             SET record_title = ?, record_description = ?, record_type = ?, 
                 file_path = ?, file_name = ?, file_size = ?, 
                 mime_type = ?, record_hash = ?, 
                 modification_count = modification_count + 1,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE record_id = ?`,
            [recordTitle, recordDescription, recordType, filePath, fileName, fileSize, mimeType, recordHash, recordId]
        );
    }
};

// Access permissions operations
const permissionDB = {
    // Grant access
    async grant(recordId, patientId, doctorId, blockchainTxHash) {
        const [result] = await pool.execute(
            'INSERT INTO access_permissions (record_id, patient_id, doctor_id, blockchain_tx_hash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE permission_status = "active", granted_at = CURRENT_TIMESTAMP, blockchain_tx_hash = ?',
            [recordId, patientId, doctorId, blockchainTxHash, blockchainTxHash]
        );
        return result.insertId;
    },

    // Revoke access
    async revoke(recordId, doctorId) {
        await pool.execute(
            'UPDATE access_permissions SET permission_status = "revoked", revoked_at = CURRENT_TIMESTAMP WHERE record_id = ? AND doctor_id = ?',
            [recordId, doctorId]
        );
    },

    // Check if doctor has access
    async hasAccess(recordId, doctorId) {
        const [rows] = await pool.execute(
            'SELECT * FROM access_permissions WHERE record_id = ? AND doctor_id = ? AND permission_status = "active"',
            [recordId, doctorId]
        );
        return rows.length > 0;
    },

    // Get all permissions for a record
    async getByRecordId(recordId) {
        const [rows] = await pool.execute(
            `SELECT ap.*, d.full_name as doctor_name, d.specialization 
             FROM access_permissions ap 
             JOIN doctors d ON ap.doctor_id = d.doctor_id 
             WHERE ap.record_id = ?`,
            [recordId]
        );
        return rows;
    }
};

// Audit log operations
const auditDB = {
    async log(userId, action, entityType, entityId, details, ipAddress) {
        await pool.execute(
            'INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, action, entityType, entityId, details, ipAddress]
        );
    }
};

// Treatment operations
const treatmentDB = {
    // Add patient to doctor's treatment list
    async add(patientId, doctorId, diagnosisCategory = 'General', status = 'active', reason = null) {
        const [result] = await pool.execute(
            'INSERT INTO treatments (patient_id, doctor_id, diagnosis_category, status, critical_reason) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?, diagnosis_category = ?, critical_reason = ?',
            [patientId, doctorId, diagnosisCategory, status, reason, status, diagnosisCategory, reason]
        );
        return result.insertId;
    },

    // Get all patients for a doctor
    async getPatientsByDoctor(doctorId) {
        const [rows] = await pool.execute(
            `SELECT p.*, t.diagnosis_category, t.status, t.started_at 
             FROM patients p 
             JOIN treatments t ON p.patient_id = t.patient_id 
             WHERE t.doctor_id = ? AND t.status IN ('active', 'critical')`,
            [doctorId]
        );
        return rows;
    },

    // Get all doctors for a patient
    async getDoctorsByPatient(patientId) {
        const [rows] = await pool.execute(
            `SELECT d.*, t.diagnosis_category, t.status, t.started_at 
             FROM doctors d 
             JOIN treatments t ON d.doctor_id = t.doctor_id 
             WHERE t.patient_id = ? AND t.status = 'active'`,
            [patientId]
        );
        return rows;
    },

    // Remove patient from doctor's list
    async remove(patientId, doctorId) {
        await pool.execute(
            'UPDATE treatments SET status = "completed" WHERE patient_id = ? AND doctor_id = ?',
            [patientId, doctorId]
        );
    },

    // Get critical patients for a doctor
    async getCriticalPatientsByDoctor(doctorId) {
        const [rows] = await pool.execute(
            `SELECT p.*, t.diagnosis_category, t.status, t.critical_reason, t.started_at 
             FROM patients p 
             JOIN treatments t ON p.patient_id = t.patient_id 
             WHERE t.doctor_id = ? AND t.status = 'critical'`,
            [doctorId]
        );
        return rows;
    },

    // Update treatment status (e.g., mark as critical)
    async updateStatus(patientId, doctorId, status, reason = null) {
        await pool.execute(
            'UPDATE treatments SET status = ?, critical_reason = ? WHERE patient_id = ? AND doctor_id = ?',
            [status, reason, patientId, doctorId]
        );
    }
};


// Access request operations (DB-backed source of truth)
const accessRequestDB = {
    // Create a new access request (or reset if previously rejected)
    async create(doctorId, patientId) {
        const [result] = await pool.execute(
            `INSERT INTO access_requests (doctor_id, patient_id, status, requested_at)
             VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)
             ON DUPLICATE KEY UPDATE status = 'pending', requested_at = CURRENT_TIMESTAMP, responded_at = NULL, blockchain_tx_hash = NULL`,
            [doctorId, patientId]
        );
        return result.insertId || result.affectedRows;
    },

    // Get all pending requests for a patient, with doctor details
    async getByPatient(patientId) {
        const [rows] = await pool.execute(
            `SELECT ar.request_id, ar.doctor_id, ar.patient_id, ar.status,
                    ar.blockchain_tx_hash, ar.requested_at, ar.responded_at,
                    d.full_name AS doctor_name, d.specialization,
                    u.email AS doctor_email, u.wallet_address AS doctor_wallet
             FROM access_requests ar
             JOIN doctors d ON ar.doctor_id = d.doctor_id
             JOIN users u ON d.user_id = u.user_id
             WHERE ar.patient_id = ? AND ar.status = 'pending'
             ORDER BY ar.requested_at DESC`,
            [patientId]
        );
        return rows;
    },

    // Update the status of a request (approve or reject)
    async updateStatus(requestId, status) {
        await pool.execute(
            `UPDATE access_requests SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
            [status, requestId]
        );
    },

    // Save optional blockchain tx hash
    async updateBlockchainTx(requestId, txHash) {
        await pool.execute(
            `UPDATE access_requests SET blockchain_tx_hash = ? WHERE request_id = ?`,
            [txHash, requestId]
        );
    },

    // Check if an approved request exists between doctor and patient
    async isApproved(doctorId, patientId) {
        const [rows] = await pool.execute(
            `SELECT * FROM access_requests WHERE doctor_id = ? AND patient_id = ? AND status = 'approved'`,
            [doctorId, patientId]
        );
        return rows.length > 0;
    }
};

module.exports = {
    pool,
    testConnection,
    userDB,
    patientDB,
    doctorDB,
    recordDB,
    permissionDB,
    treatmentDB,
    auditDB,
    accessRequestDB
};
