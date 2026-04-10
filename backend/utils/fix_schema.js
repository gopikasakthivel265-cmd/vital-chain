const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixSchema() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'healthcare_blockchain',
        port: process.env.DB_PORT || 3306
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log('--- Altering medical_records table ---');
        await connection.execute('ALTER TABLE medical_records MODIFY COLUMN record_hash VARCHAR(255)');
        console.log('✅ Column record_hash increased to VARCHAR(255)');

        // Also check if any other hash columns need increasing
        await connection.execute('ALTER TABLE access_permissions MODIFY COLUMN blockchain_tx_hash VARCHAR(255)');
        console.log('✅ Column blockchain_tx_hash in access_permissions increased to VARCHAR(255)');

        await connection.end();
    } catch (error) {
        console.error('❌ Error altering table:', error.message);
    }
}

fixSchema();
