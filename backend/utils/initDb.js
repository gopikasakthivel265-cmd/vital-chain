const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDb() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'healthcare_blockchain',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('⏳ Initializing database...');

        // Helper to check if column exists
        const columnExists = async (table, column) => {
            const [cols] = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
            return cols.length > 0;
        };

        // Add OTP columns if they don't exist
        if (!(await columnExists('users', 'otp_code'))) {
            await pool.execute('ALTER TABLE users ADD COLUMN otp_code VARCHAR(6)');
            console.log('✅ Added otp_code to users table.');
        }
        if (!(await columnExists('users', 'otp_expires_at'))) {
            await pool.execute('ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP NULL');
            console.log('✅ Added otp_expires_at to users table.');
        }

        const [rows] = await pool.execute(`
            CREATE TABLE IF NOT EXISTS treatments (
                treatment_id INT AUTO_INCREMENT PRIMARY KEY,
                patient_id INT NOT NULL,
                doctor_id INT NOT NULL,
                diagnosis_category VARCHAR(100),
                status ENUM('active', 'completed', 'referred', 'critical') DEFAULT 'active',
                critical_reason TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
                FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
                UNIQUE KEY unique_treatment (patient_id, doctor_id),
                INDEX idx_patient_id (patient_id),
                INDEX idx_doctor_id (doctor_id),
                INDEX idx_status (status)
            )
        `);

        // Also ensure existing table has the columns/enum updates if it was already created
        if (!(await columnExists('treatments', 'critical_reason'))) {
            await pool.execute('ALTER TABLE treatments ADD COLUMN critical_reason TEXT AFTER status');
            console.log('✅ Added critical_reason to treatments table.');
        }

        // Update ENUM if it doesn't have critical (MySQL specific way to be safe)
        // Note: In a real migration we'd be more careful, but for this project we can re-apply the column definition
        await pool.execute("ALTER TABLE treatments MODIFY COLUMN status ENUM('active', 'completed', 'referred', 'critical') DEFAULT 'active'");
        console.log('✅ Updated treatments status ENUM.');

        console.log('✅ Treatments table ready.');
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
    } finally {
        await pool.end();
    }
}

initDb();
