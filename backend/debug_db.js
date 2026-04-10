const { pool } = require('./services/database');

async function debugDB() {
    try {
        const [users] = await pool.execute('SELECT user_id, username, role, wallet_address FROM users');
        const [patients] = await pool.execute('SELECT patient_id, user_id, full_name FROM patients');

        const data = {
            users: users,
            patients: patients
        };

        console.log('---DATA_START---');
        console.log(JSON.stringify(data));
        console.log('---DATA_END---');
        process.exit(0);
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debugDB();
