const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetDb() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'healthcare_blockchain',
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('🗑️  Resetting database...');

        // Disable foreign key checks to drop tables easily
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

        const tables = [
            'audit_log',
            'access_permissions',
            'medical_records',
            'treatments',
            'patients',
            'doctors',
            'users',
            'sessions'
        ];

        for (const table of tables) {
            await pool.execute(`DROP TABLE IF EXISTS ${table}`);
            console.log(`- Dropped ${table}`);
        }

        await pool.execute('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Database cleared. Run "npm run dev" to re-initialize schema.');
    } catch (error) {
        console.error('❌ Reset failed:', error.message);
    } finally {
        await pool.end();
    }
}

resetDb();
