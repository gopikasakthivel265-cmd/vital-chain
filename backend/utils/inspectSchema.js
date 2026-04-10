const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function inspect() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'healthcare_blockchain',
        port: process.env.DB_PORT || 3306
    };

    let report = 'DATABASE INSPECTION REPORT\n==========================\n\n';
    let pool;
    try {
        pool = mysql.createPool(config);
        const tables = ['users', 'patients', 'doctors'];
        for (const table of tables) {
            const [columns] = await pool.execute(`DESCRIBE ${table}`);
            report += `TABLE: ${table}\n`;
            columns.forEach(c => {
                report += `  - ${c.Field}: ${c.Type} (${c.Null}, ${c.Key}, ${c.Default}, ${c.Extra})\n`;
            });
            report += '\n';
        }
        fs.writeFileSync('schema_report.txt', report);
        console.log('✅ Report saved to schema_report.txt');
    } catch (error) {
        console.error('❌ Inspection failed:', error.message);
    } finally {
        if (pool) await pool.end();
    }
}

inspect();
