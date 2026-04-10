const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDetailedSchema() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'healthcare_blockchain',
        port: process.env.DB_PORT || 3306
    };

    try {
        const connection = await mysql.createConnection(config);
        const [columns] = await connection.execute('DESCRIBE medical_records');
        console.log(JSON.stringify(columns, null, 2));
        await connection.end();
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkDetailedSchema();
