const mysql = require('mysql2/promise');
require('dotenv').config();

async function diagnose() {
    console.log('🔍 Starting System Diagnosis...');

    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'healthcare_blockchain',
        port: process.env.DB_PORT || 3306
    };

    console.log('📡 Testing Database Connection...');
    let pool;
    try {
        pool = mysql.createPool(config);
        const [rows] = await pool.execute('SELECT 1');
        console.log('✅ Database connection successful.');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return;
    }

    try {
        console.log('\n📊 Checking Tables & Columns...');

        const tables = ['users', 'patients', 'doctors', 'medical_records', 'treatments'];
        for (const table of tables) {
            try {
                const [columns] = await pool.execute(`DESCRIBE ${table}`);
                console.log(`\nTable: ${table}`);
                columns.forEach(c => {
                    console.log(`  - ${c.Field} (${c.Type})`);
                });
            } catch (e) {
                console.error(`❌ Table "${table}" check failed:`, e.message);
            }
        }

        console.log('\n📧 Testing Email Config...');
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER.includes('your-email')) {
            console.warn('⚠️ SMTP credentials not set. Real OTP emails will not work.');
        } else {
            console.log('✅ SMTP credentials found.');
        }

    } catch (error) {
        console.error('❌ Diagnosis error:', error.message);
    } finally {
        await pool.end();
        console.log('\n🏁 Diagnosis complete.');
    }
}

diagnose();
