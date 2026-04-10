const API_URL = 'http://localhost:3000/api';
let currentRole = 'patient';
let authData = null; // Store data from login response for OTP step

function switchRole(role) {
    currentRole = role;
    const patientTab = document.getElementById('patientTab');
    const doctorTab = document.getElementById('doctorTab');
    const doctorRegFields = document.getElementById('doctorRegFields');
    const patientRegFields = document.getElementById('patientRegFields');

    if (role === 'patient') {
        patientTab.classList.add('active');
        doctorTab.classList.remove('active');
        doctorRegFields?.classList.add('hidden');
        doctorRegFields?.classList.remove('visible');
        patientRegFields?.classList.add('visible');
        patientRegFields?.classList.remove('hidden');
    } else {
        doctorTab.classList.add('active');
        patientTab.classList.remove('active');
        doctorRegFields?.classList.add('visible');
        doctorRegFields?.classList.remove('hidden');
        patientRegFields?.classList.add('hidden');
        patientRegFields?.classList.remove('visible');
    }
}

function toggleAuth(type) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const otpScreen = document.getElementById('otpScreen');
    const subtitle = document.querySelector('.subtitle');
    const roleSelector = document.querySelector('.role-selector');

    if (type === 'register') {
        loginForm.classList.add('hidden');
        loginForm.classList.remove('visible');
        registerForm.classList.remove('hidden');
        registerForm.classList.add('visible');
        otpScreen.classList.add('hidden');
        roleSelector.classList.remove('hidden');
        subtitle.textContent = 'Create your secure healthcare account';
        loadDoctorsList(); // Load doctors when opening registration
    } else if (type === 'login') {

        registerForm.classList.add('hidden');
        registerForm.classList.remove('visible');
        loginForm.classList.remove('hidden');
        loginForm.classList.add('visible');
        otpScreen.classList.add('hidden');
        roleSelector.classList.remove('hidden');
        subtitle.textContent = 'Please choose your role and authenticate';
    } else if (type === 'otp') {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        roleSelector.classList.add('hidden');
        otpScreen.classList.remove('hidden');
        otpScreen.classList.add('visible');
        subtitle.textContent = 'Identity Verification Required';
    }
}

// Initial state
document.addEventListener('DOMContentLoaded', () => {
    toggleAuth('login');
});

// Registration Logic
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    const payload = {
        username: document.getElementById('regUsername').value,
        fullName: document.getElementById('regFullName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value,
        role: currentRole,
        address: document.getElementById('regAddress').value
    };

    if (currentRole === 'patient') {
        payload.dateOfBirth = document.getElementById('regDob').value;
        payload.gender = document.getElementById('regGender').value.toLowerCase();
        payload.contactPhone = document.getElementById('regPhone').value;
        payload.bloodGroup = document.getElementById('regBloodGroup').value;
        payload.treatingDoctorId = document.getElementById('regTreatingDoctor').value || null;
    } else if (currentRole === 'doctor') {

        payload.specialization = document.getElementById('regSpecialization').value;
        payload.licenseNumber = document.getElementById('regLicense').value;
        payload.hospitalAffiliation = document.getElementById('regHospital').value;
        payload.yearsOfExperience = document.getElementById('regExperience').value;
        payload.contactPhone = document.getElementById('regPhone').value; // Added missing phone
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            alert('Registration successful! Please login.');
            toggleAuth('login');
        } else {
            alert('Registration failed: ' + result.message);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('An error occurred during registration.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Secure Account';
    }
});

// Login Logic
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();

        if (result.success && result.data.isOtpRequired) {
            authData = result.data;
            toggleAuth('otp');
            // Store temp token if needed for resend, but verify endpoint uses userId
            localStorage.setItem('tempToken', result.data.token);
        } else {
            alert('Login failed: ' + result.message);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Secure Login';
    }
});

// Resend OTP
async function resendOTP() {
    alert('OTP resent! Check your inbox.');
    // In real app, call a resend endpoint
}

// OTP Verification Logic
async function verifyOTP() {
    const otpCode = document.getElementById('otpCode').value;
    if (otpCode.length !== 6) return alert('Please enter a 6-digit code');

    try {
        const response = await fetch(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authData.userId, otpCode })
        });
        const result = await response.json();

        if (result.success) {
            localStorage.setItem('token', result.data.token);
            localStorage.setItem('user', JSON.stringify(result.data));

            if (result.data.role === 'patient') {
                window.location.href = 'patient-dashboard.html';
            } else {
                window.location.href = 'doctor-dashboard.html';
            }
        } else {
            alert('Verification failed: ' + result.message);
        }
    } catch (error) {
        console.error('OTP verify error:', error);
    }
}

async function loadDoctorsList() {
    const doctorSelect = document.getElementById('regTreatingDoctor');
    if (!doctorSelect) return;

    try {
        const response = await fetch(`${API_URL}/doctors`);
        const result = await response.json();

        if (result.success) {
            const doctors = result.data;
            doctorSelect.innerHTML = '<option value="">Select a Doctor (None)</option>' +
                doctors.map(d => `<option value="${d.doctor_id}">Dr. ${d.full_name} (${d.specialization}) - ${d.email}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading doctors list:', error);
    }
}

