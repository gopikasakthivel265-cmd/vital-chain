const http = require('http');

async function testEndpoint() {
    console.log('Testing /api/doctor/patients endpoint on port 3000...');

    // Note: Since we need authentication, this test will likely return 401/403
    // but it will confirm the route exists and is handled by the Node.js server.
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/doctor/patients',
        method: 'GET'
    };

    const req = http.request(options, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('Response:', data);
            if (res.statusCode === 401 || res.statusCode === 403) {
                console.log('✅ Route exists (protected by auth as expected)');
            } else if (res.statusCode === 200) {
                console.log('✅ Route exists and returned data successfully');
            } else {
                console.log('❌ Unexpected status code');
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Connection error:', error.message);
    });

    req.end();
}

testEndpoint();
