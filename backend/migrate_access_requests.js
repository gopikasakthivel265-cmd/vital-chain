// Migration: Create access_requests table
const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    let pool;
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'healthcare_blockchain',
            port: parseInt(process.env.DB_PORT) || 3306
        });

        const sql = `CREATE TABLE IF NOT EXISTS access_requests (
            request_id INT AUTO_INCREMENT PRIMARY KEY,
            doctor_id INT NOT NULL,
            patient_id INT NOT NULL,
            status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
            blockchain_tx_hash VARCHAR(66),
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            responded_at TIMESTAMP NULL,
            FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
            FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
            UNIQUE KEY unique_request (doctor_id, patient_id),
            INDEX idx_patient_id (patient_id),
            INDEX idx_doctor_id (doctor_id),
            INDEX idx_status (status)
        )`;

        await pool.execute(sql);
        console.log('✅ access_requests table created (or already exists).');

        const [rows] = await pool.execute('SHOW TABLES LIKE "access_requests"');
        if (rows.length > 0) {
            console.log('✅ Verified: access_requests table is present in the database.');
        } else {
            console.error('❌ Table NOT found after creation attempt!');
        }
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
    }
}

run();
