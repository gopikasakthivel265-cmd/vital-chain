const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testUpload() {
    const API_URL = 'http://localhost:3000/api';

    // 1. Login to get token (assuming test user exists)
    // We'll use a known test user or skip auth if we can find a token in a log?
    // Actually, let's just use the database to find a patient user and mock a token if possible,
    // or just assume we need a real token.

    // Let's try to login as a patient. I'll check the database for a patient user first.
    console.log('Testing upload endpoint...');

    // Create a dummy file
    const testFile = path.join(__dirname, 'test_upload.txt');
    fs.writeFileSync(testFile, 'This is a test medical record content.');

    const formData = new FormData();
    formData.append('recordTitle', 'Test Diagnostic');
    formData.append('recordType', 'diagnosis');
    formData.append('file', fs.createReadStream(testFile));

    try {
        const response = await axios.post(`${API_URL}/patient/upload`, formData, {
            headers: {
                ...formData.getHeaders(),
                // 'Authorization': `Bearer ${TOKEN}` // We need a token here
            }
        });
        console.log('Successfully uploaded:', response.data);
    } catch (error) {
        if (error.response) {
            console.error('Upload failed with status:', error.response.status);
            console.error('Error data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
    } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    }
}

// Since I don't have a token, I'll write a script that bypasses auth or gets a user ID.
// Actually, I'll just check the server.js for any missing error catches.

// I'll run a script to see if there are any current users in the DB.
testUpload();
