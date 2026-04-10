const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { pool, testConnection, userDB, patientDB, doctorDB, recordDB, permissionDB, auditDB, treatmentDB, accessRequestDB } = require('./services/database');
const blockchainService = require('./services/blockchain');
const cloudStorage = require('./services/cloudStorage');
const emailService = require('./services/emailService');
const { authenticateToken, requirePatient, requireDoctor, generateToken } = require('./middleware/auth');
const { generateFileHash, ensureUploadDir, generateUniqueFilename, validateFileType } = require('./utils/fileUtils');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Configure multer for file uploads
const uploadDir = ensureUploadDir();
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, generateUniqueFilename(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        if (validateFileType(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, images, and documents allowed.'));
        }
    }
});

// ============= AUTHENTICATION ROUTES =============

// Register new user
app.post('/api/auth/register', async (req, res) => {
    console.log('[DEBUG] Registration attempt body:', JSON.stringify(req.body, null, 2));
    try {
        const { username, email, password, role, fullName, ...roleSpecificData } = req.body;

        // Validate required fields
        if (!username || !email || !password || !role || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }

        // Check if user already exists
        const existingUser = await userDB.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const userId = await userDB.create(username, email, passwordHash, role);

        // Create role-specific profile
        if (role === 'patient') {
            const {
                dateOfBirth,
                gender,
                contactPhone = null,
                address = null,
                bloodGroup = null,
                emergencyContact = null,
                medicalHistory = null
            } = roleSpecificData;
            const patientId = await patientDB.create(userId, fullName, dateOfBirth, gender, contactPhone, address, bloodGroup, emergencyContact, medicalHistory);

            // Auto-link treating doctor if provided
            if (req.body.treatingDoctorId) {
                try {
                    const { treatmentDB } = require('./services/database');
                    await treatmentDB.add(patientId, req.body.treatingDoctorId, 'Initial Consultation');
                } catch (linkError) {
                    console.error('Failed to auto-link doctor:', linkError.message);
                }
            }

        } else if (role === 'doctor') {

            const {
                specialization,
                licenseNumber,
                hospitalAffiliation = null,
                contactPhone = null,
                yearsOfExperience = null
            } = roleSpecificData;
            await doctorDB.create(userId, fullName, specialization, licenseNumber, hospitalAffiliation, contactPhone, yearsOfExperience);
        }

        // Generate JWT token
        const token = generateToken(userId, email, role);

        // Log activity
        await auditDB.log(userId, 'USER_REGISTERED', 'user', userId, `New ${role} registered`, req.ip);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                userId,
                username,
                email,
                role,
                token
            }
        });
    } catch (error) {
        console.error('Registration error details:', error); // Enhanced logging
        res.status(500).json({
            success: false,
            message: 'Registration failed: ' + error.message,
            error: error.message
        });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    console.log('[DEBUG] Login attempt:', req.body.email);
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await userDB.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate a 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await userDB.setOTP(user.user_id, otpCode);

        // Send real OTP email
        const emailResult = await emailService.sendOTP(user.email, otpCode);
        if (!emailResult.success && !emailResult.mock) {
            console.error('Failed to send OTP email details:', emailResult.error);
        }

        console.log(`[AUTH] Login initiated for ${user.email}, isOtpRequired: true`);

        // Generate a temporary restricted token for OTP phase
        const tempToken = jwt.sign(
            { userId: user.user_id, email: user.email, role: user.role, isOtpPending: true },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Log activity
        await auditDB.log(user.user_id, 'USER_LOGIN_INIT', 'user', user.user_id, 'User started login (OTP pending)', req.ip);

        res.json({
            success: true,
            message: 'OTP sent to your registered email',
            data: {
                userId: user.user_id,
                email: user.email,
                role: user.role,
                token: tempToken, // Temporary token
                isOtpRequired: true
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { userId, otpCode } = req.body;

        if (!userId || !otpCode) {
            return res.status(400).json({ success: false, message: 'User ID and OTP code are required' });
        }

        const isValid = await userDB.verifyOTP(userId, otpCode);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Clear OTP after successful verification
        await userDB.clearOTP(userId);

        const user = await userDB.findById(userId);

        // Generate full access token
        const token = generateToken(user.user_id, user.email, user.role);

        // Get role-specific profile
        let profile = null;
        if (user.role === 'patient') {
            profile = await patientDB.getByUserId(user.user_id);
        } else if (user.role === 'doctor') {
            profile = await doctorDB.getByUserId(user.user_id);
        }

        // Log activity
        await auditDB.log(user.user_id, 'USER_LOGIN_SUCCESS', 'user', user.user_id, 'OTP verified, login successful', req.ip);

        res.json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                walletAddress: user.wallet_address,
                profile,
                token
            }
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ success: false, message: 'OTP verification failed' });
    }
});

// Update wallet address
app.post('/api/auth/update-wallet', authenticateToken, async (req, res) => {
    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: 'Wallet address is required'
            });
        }

        await userDB.updateWallet(req.user.userId, walletAddress);

        // Register user on blockchain
        try {
            await blockchainService.registerUser(walletAddress, req.user.role);
        } catch (blockchainError) {
            console.error('Blockchain registration failed:', blockchainError.message);
        }

        res.json({
            success: true,
            message: 'Wallet address updated successfully'
        });
    } catch (error) {
        console.error('Wallet update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update wallet address',
            error: error.message
        });
    }
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { userId, role } = req.user;
        let profileData = {};

        if (role === 'patient') {
            const [rows] = await pool.execute(
                `SELECT p.full_name, p.patient_id, d.full_name as treating_doctor 
                 FROM patients p 
                 LEFT JOIN treatments t ON p.patient_id = t.patient_id AND t.status = 'active'
                 LEFT JOIN doctors d ON t.doctor_id = d.doctor_id
                 WHERE p.user_id = ?`,
                [userId]
            );
            if (rows.length > 0) {
                profileData = {
                    name: rows[0].full_name,
                    registrationNumber: `P-${rows[0].patient_id.toString().padStart(5, '0')}`,
                    treatingDoctor: rows[0].treating_doctor || 'None assigned'
                };
            }
        } else if (role === 'doctor') {
            const [rows] = await pool.execute(
                'SELECT full_name, license_number FROM doctors WHERE user_id = ?',
                [userId]
            );
            if (rows.length > 0) {
                profileData = {
                    name: rows[0].full_name,
                    registrationNumber: rows[0].license_number,
                    treatingDoctor: null // Doctors don't have a treating doctor
                };
            }
        }

        res.json({
            success: true,
            data: profileData
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
});

// Get all registered patients
app.get('/api/patients/all', authenticateToken, async (req, res) => {
    try {
        const patients = await patientDB.getAll();
        res.json({
            success: true,
            data: patients
        });
    } catch (error) {
        console.error('Get all patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get patients list',
            error: error.message
        });
    }
});

// Search patients by name or email
app.get('/api/patients/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ success: false, message: 'Search query required' });
        }
        const patients = await patientDB.search(q);
        res.json({
            success: true,
            data: patients
        });
    } catch (error) {
        console.error('Search patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search patients',
            error: error.message
        });
    }
});

// ============= PATIENT ROUTES =============

// Get patient dashboard
app.get('/api/patient/dashboard', authenticateToken, requirePatient, async (req, res) => {
    try {
        const patient = await patientDB.getByUserId(req.user.userId);
        const records = await recordDB.getByPatientId(patient.patient_id);
        const doctors = await treatmentDB.getDoctorsByPatient(patient.patient_id);

        console.log(`[DEBUG] Dashboard load for user ${req.user.userId}, wallet: ${req.user.walletAddress}`);

        // Enhance records with signed cloud URLs
        const enhancedRecords = await Promise.all(records.map(async (record) => {
            if (record.file_path.startsWith('records/')) {
                record.download_url = await cloudStorage.getSignedUrl(record.file_path);
            }
            return record;
        }));

        // Get pending requests from DB (source of truth - blockchain not required)
        const pendingRequests = await accessRequestDB.getByPatient(patient.patient_id);
        const enhancedRequests = pendingRequests; // doctor_name already joined in DB query

        res.json({
            success: true,
            data: {
                patient,
                records: enhancedRecords,
                doctors,
                pendingRequests: enhancedRequests
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard',
            error: error.message
        });
    }
});

// Upload medical record
app.post('/api/patient/upload', authenticateToken, requirePatient, upload.single('file'), async (req, res) => {
    try {
        const { recordTitle, recordDescription, recordType } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        if (!recordTitle || !recordType) {
            return res.status(400).json({
                success: false,
                message: 'Record title and type are required'
            });
        }

        const patient = await patientDB.getByUserId(req.user.userId);
        if (!patient) {
            console.error(`❌ Upload failed: Patient profile not found for user ${req.user.userId}`);
            return res.status(404).json({
                success: false,
                message: 'Patient profile not found'
            });
        }

        console.log(`[DEBUG] Starting upload for patient ${patient.patient_id} (${req.user.email})`);

        // Generate file hash
        const recordHash = await generateFileHash(req.file.path);
        console.log(`[DEBUG] File hash generated: ${recordHash}`);

        // Upload to cloud storage
        let cloudData = { success: false };
        try {
            console.log(`[DEBUG] Attempting cloud upload for ${req.file.filename}...`);
            cloudData = await cloudStorage.uploadRecord(req.file.path, patient.patient_id, req.file.filename);
            console.log(`[DEBUG] Cloud upload result: ${JSON.stringify(cloudData)}`);
        } catch (cloudError) {
            console.error('Cloud upload failed:', cloudError.message);
        }

        // Save record to database
        const recordId = await recordDB.create(
            patient.patient_id,
            req.user.userId,
            recordTitle,
            recordDescription || '',
            recordType,
            cloudData.success ? cloudData.storagePath : req.file.path,
            req.file.originalname,
            req.file.size,
            req.file.mimetype,
            recordHash
        );

        // Store hash on blockchain (if wallet is configured)
        let blockchainTxHash = null;
        if (req.user.walletAddress) {
            try {
                console.log(`[DEBUG] Storing hash on blockchain for wallet: ${req.user.walletAddress}`);
                blockchainTxHash = await blockchainService.storeRecordHash(recordId, recordHash, req.user.walletAddress);
                console.log(`[DEBUG] Blockchain storage success! TX: ${blockchainTxHash}`);
                await recordDB.updateBlockchainTx(recordId, blockchainTxHash);
            } catch (blockchainError) {
                console.error('Blockchain storage failed:', blockchainError.message);
                console.error('Details:', {
                    wallet: req.user.walletAddress,
                    recordId,
                    hash: recordHash
                });
            }
        } else {
            console.warn(`[DEBUG] Skipping blockchain storage: No wallet address for user ${req.user.userId}`);
        }

        // Auto-grant access to doctor if provided
        const { doctorId } = req.body;
        if (doctorId) {
            try {
                const doctor = await doctorDB.getById(doctorId);
                const doctorUser = await userDB.findById(doctor.user_id);

                // Grant access on blockchain if both have wallets
                if (req.user.walletAddress && doctorUser.wallet_address) {
                    try {
                        await blockchainService.grantAccess(recordId, doctorUser.wallet_address, req.user.walletAddress);
                    } catch (bcGrantError) {
                        console.error('Auto-grant blockchain failed:', bcGrantError.message);
                    }
                }

                // Grant access in database
                await permissionDB.grant(recordId, patient.patient_id, doctorId, null);
            } catch (grantError) {
                console.error('Auto-grant to doctor failed:', grantError.message);
            }
        }

        // Log activity
        await auditDB.log(req.user.userId, 'RECORD_UPLOADED', 'medical_record', recordId, `Uploaded ${recordType}${doctorId ? ' and shared with doctor ' + doctorId : ''}`, req.ip);

        res.status(201).json({
            success: true,
            message: 'Record uploaded successfully',
            data: {
                recordId,
                recordHash,
                blockchainTxHash,
                isVerified: blockchainTxHash !== null
            }
        });
    } catch (error) {
        console.error('Upload error:', error);

        // Delete uploaded file if database operation failed
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            success: false,
            message: 'File upload failed',
            error: error.message
        });
    }
});

// Grant doctor access to record
app.post('/api/patient/grant-access', authenticateToken, requirePatient, async (req, res) => {
    try {
        const { recordId, doctorId } = req.body;

        if (!recordId || !doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Record ID and Doctor ID are required'
            });
        }

        const patient = await patientDB.getByUserId(req.user.userId);
        const record = await recordDB.getById(recordId);

        // Verify patient owns the record
        if (record.patient_id !== patient.patient_id) {
            return res.status(403).json({
                success: false,
                message: 'You do not own this record'
            });
        }

        const doctor = await doctorDB.getById(doctorId);
        const doctorUser = await userDB.findById(doctor.user_id);

        // Grant access on blockchain
        let blockchainTxHash = null;
        if (req.user.walletAddress && doctorUser.wallet_address) {
            try {
                blockchainTxHash = await blockchainService.grantAccess(recordId, doctorUser.wallet_address, req.user.walletAddress);
            } catch (blockchainError) {
                console.error('Blockchain grant access failed:', blockchainError.message);
            }
        }

        // Grant access in database
        await permissionDB.grant(recordId, patient.patient_id, doctorId, blockchainTxHash);

        // Log activity
        await auditDB.log(req.user.userId, 'ACCESS_GRANTED', 'access_permission', recordId, `Granted access to doctor ${doctorId}`, req.ip);

        res.json({
            success: true,
            message: 'Access granted successfully',
            data: {
                recordId,
                doctorId,
                blockchainTxHash
            }
        });
    } catch (error) {
        console.error('Grant access error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to grant access',
            error: error.message
        });
    }
});

// Revoke doctor access
app.post('/api/patient/revoke-access', authenticateToken, requirePatient, async (req, res) => {
    try {
        const { recordId, doctorId } = req.body;

        if (!recordId || !doctorId) {
            return res.status(400).json({
                success: false,
                message: 'Record ID and Doctor ID are required'
            });
        }

        const patient = await patientDB.getByUserId(req.user.userId);
        const record = await recordDB.getById(recordId);

        // Verify patient owns the record
        if (record.patient_id !== patient.patient_id) {
            return res.status(403).json({
                success: false,
                message: 'You do not own this record'
            });
        }

        await permissionDB.revoke(recordId, doctorId);

        // Log activity
        await auditDB.log(req.user.userId, 'ACCESS_REVOKED', 'access_permission', recordId, `Revoked access from doctor ${doctorId}`, req.ip);

        res.json({
            success: true,
            message: 'Access revoked successfully'
        });
    } catch (error) {
        console.error('Revoke access error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to revoke access',
            error: error.message
        });
    }
});

// Get access permissions for a record
app.get('/api/patient/record/:recordId/permissions', authenticateToken, requirePatient, async (req, res) => {
    try {
        const { recordId } = req.params;
        const patient = await patientDB.getByUserId(req.user.userId);
        const record = await recordDB.getById(recordId);

        if (record.patient_id !== patient.patient_id) {
            return res.status(403).json({
                success: false,
                message: 'You do not own this record'
            });
        }

        const permissions = await permissionDB.getByRecordId(recordId);

        res.json({
            success: true,
            data: permissions
        });
    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get permissions',
            error: error.message
        });
    }
});

// ============= DOCTOR ROUTES =============

// Get doctor dashboard
app.get('/api/doctor/dashboard', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const doctor = await doctorDB.getByUserId(req.user.userId);
        const patients = await treatmentDB.getPatientsByDoctor(doctor.doctor_id);
        const accessibleRecords = await recordDB.getAccessibleByDoctor(doctor.doctor_id);

        res.json({
            success: true,
            data: {
                doctor,
                patients,
                accessibleRecords
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard',
            error: error.message
        });
    }
});

// Alias for get-patients to fix frontend mismatch
app.get('/api/doctor/patients', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const doctor = await doctorDB.getByUserId(req.user.userId);
        const patients = await treatmentDB.getPatientsByDoctor(doctor.doctor_id);
        res.json({
            success: true,
            data: patients
        });
    } catch (error) {
        console.error('Get patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get patients list',
            error: error.message
        });
    }
});

// Get all records for a specific patient (for treating doctors)
app.get('/api/doctor/patient/:patientId/records', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { patientId } = req.params;
        const doctor = await doctorDB.getByUserId(req.user.userId);



        let hasBlockchainAccess = false;
        const patientData = await patientDB.getById(patientId);
        const patientUser = await userDB.findById(patientData.user_id);

        if (patientUser && patientUser.wallet_address && req.user.walletAddress) {
            try {
                const accessRequest = await blockchainService.getAccessRequest(req.user.walletAddress, patientUser.wallet_address);
                if (accessRequest && accessRequest.status === 'APPROVED') {
                    hasBlockchainAccess = true;
                    console.log(`[DEBUG] Blockchain access verified for Dr ${req.user.walletAddress} to Patient ${patientUser.wallet_address}`);
                }
            } catch (bcError) {
                console.error('Blockchain access check failed:', bcError.message);
            }
        }

        // Check if there is an approved access request in the database
        const isDbApproved = await accessRequestDB.isApproved(doctor.doctor_id, patientId);

        if (!hasBlockchainAccess && !isDbApproved) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You need an approved access request from the patient.'
            });
        }

        const records = await recordDB.getByPatientId(patientId);

        // Enhance with signed URLs
        const enhancedRecords = await Promise.all(records.map(async (record) => {
            if (record.file_path.startsWith('records/')) {
                record.download_url = await cloudStorage.getSignedUrl(record.file_path);
            }
            return record;
        }));

        res.json({ success: true, data: enhancedRecords });
    } catch (error) {
        console.error('Fetch records error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch records' });
    }
});

// Add patient to treatment list
app.post('/api/doctor/treat-patient', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { patientId, diagnosisCategory } = req.body;
        console.log(`[DEBUG] Treat patient attempt: patientId=${patientId}, doctorUserId=${req.user.userId}`);

        const doctor = await doctorDB.getByUserId(req.user.userId);
        if (!doctor) {
            console.error(`❌ Treat patient failed: Doctor profile not found for user ${req.user.userId}`);
            return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        }

        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }

        await treatmentDB.add(patientId, doctor.doctor_id, diagnosisCategory);

        // Log activity
        await auditDB.log(req.user.userId, 'TREATMENT_STARTED', 'patient', patientId, `Doctor started treating patient`, req.ip);

        res.json({
            success: true,
            message: 'Patient added to treatment list'
        });
    } catch (error) {
        console.error('Treat patient error:', error);
        res.status(500).json({ success: false, message: 'Failed to add patient', error: error.message });
    }
});

// Alias for frontend addPatientToDashboard search function
app.post('/api/doctor/add-patient', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { patientId } = req.body;
        console.log(`[DEBUG] Add patient attempt: patientId=${patientId}, doctorUserId=${req.user.userId}`);

        const doctor = await doctorDB.getByUserId(req.user.userId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        }

        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }

        await treatmentDB.add(patientId, doctor.doctor_id, 'General');

        await auditDB.log(req.user.userId, 'TREATMENT_STARTED', 'patient', patientId, `Doctor added patient from search`, req.ip);

        res.json({
            success: true,
            message: 'Patient added successfully'
        });
    } catch (error) {
        console.error('Add patient error:', error);
        res.status(500).json({ success: false, message: 'Failed to add patient', error: error.message });
    }
});

// Get critical patients for the logged-in doctor
app.get('/api/doctor/critical-patients', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const doctor = await doctorDB.getByUserId(req.user.userId);
        const criticalPatients = await treatmentDB.getCriticalPatientsByDoctor(doctor.doctor_id);

        res.json({
            success: true,
            data: criticalPatients
        });
    } catch (error) {
        console.error('Fetch critical patients error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch critical patients' });
    }
});

// Update patient treatment status (e.g., mark as critical)
app.post('/api/doctor/update-patient-status', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { patientId, status, reason } = req.body;
        const doctor = await doctorDB.getByUserId(req.user.userId);

        if (!patientId || !status) {
            return res.status(400).json({ success: false, message: 'Patient ID and status are required' });
        }

        await treatmentDB.updateStatus(patientId, doctor.doctor_id, status, reason);

        // Log activity
        await auditDB.log(req.user.userId, 'STATUS_UPDATED', 'patient', patientId, `Patient status updated to ${status}`, req.ip);

        res.json({
            success: true,
            message: `Patient status updated to ${status}`
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update patient status' });
    }
});


// Get list of all doctors (for patient to select)
app.get('/api/doctors', authenticateToken, async (req, res) => {
    try {
        const doctors = await doctorDB.getAll();
        res.json({
            success: true,
            data: doctors
        });
    } catch (error) {
        console.error('Get doctors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get doctors list',
            error: error.message
        });
    }
});

// View specific record (with permission check)
app.get('/api/doctor/record/:recordId', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { recordId } = req.params;
        const doctor = await doctorDB.getByUserId(req.user.userId);

        // Check if doctor has permission or is treating the patient
        const record = await recordDB.getById(recordId);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        const hasPermission = await permissionDB.hasAccess(recordId, doctor.doctor_id);

        // Check blockchain access if treatment/database permission fails
        let hasBlockchainAccess = false;
        if (!hasPermission) {
            const patient = await patientDB.getById(record.patient_id);
            const patientUser = await userDB.findById(patient.user_id);
            if (patientUser && patientUser.wallet_address && req.user.walletAddress) {
                try {
                    const accessRequest = await blockchainService.getAccessRequest(req.user.walletAddress, patientUser.wallet_address);
                    if (accessRequest && accessRequest.status === 'APPROVED') {
                        hasBlockchainAccess = true;
                    }
                } catch (bcError) {
                    console.error('Blockchain check in view record failed:', bcError.message);
                }
            }
        }

        const isDbApproved = await accessRequestDB.isApproved(doctor.doctor_id, record.patient_id);

        if (!hasPermission && !hasBlockchainAccess && !isDbApproved) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this record. Please request access from the patient.'
            });
        }

        const patient = await patientDB.getById(record.patient_id);

        // Log activity
        await auditDB.log(req.user.userId, 'RECORD_VIEWED', 'medical_record', recordId, `Doctor viewed patient record`, req.ip);

        res.json({
            success: true,
            data: {
                record,
                patient
            }
        });
    } catch (error) {
        console.error('View record error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to view record',
            error: error.message
        });
    }
});

// Download record file
app.get('/api/record/:recordId/download', authenticateToken, async (req, res) => {
    try {
        const { recordId } = req.params;
        const record = await recordDB.getById(recordId);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found'
            });
        }

        // Check if user has permission
        let hasPermission = false;

        if (req.user.role === 'patient') {
            const patient = await patientDB.getByUserId(req.user.userId);
            hasPermission = record.patient_id === patient.patient_id;
        } else if (req.user.role === 'doctor') {
            const doctor = await doctorDB.getByUserId(req.user.userId);
            hasPermission = await permissionDB.hasAccess(recordId, doctor.doctor_id);

            // Check blockchain if DB permission fails
            if (!hasPermission) {
                const patient = await patientDB.getById(record.patient_id);
                const patientUser = await userDB.findById(patient.user_id);
                if (patientUser && patientUser.wallet_address && req.user.walletAddress) {
                    try {
                        const accessRequest = await blockchainService.getAccessRequest(req.user.walletAddress, patientUser.wallet_address);
                        if (accessRequest && accessRequest.status === 'APPROVED') {
                            hasPermission = true;
                        }
                    } catch (bcError) {
                        console.error('Blockchain check in download failed:', bcError.message);
                    }
                }

                if (!hasPermission) {
                    const isDbApproved = await accessRequestDB.isApproved(doctor.doctor_id, record.patient_id);
                    if (isDbApproved) {
                        hasPermission = true;
                    }
                }
            }
        }

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to download this record'
            });
        }

        // Send file
        let filePathToDownload = record.file_path;
        if (!fs.existsSync(filePathToDownload)) {
            const fileName = path.basename(filePathToDownload);
            const fallbackPath = path.join(uploadDir, fileName); // ensureUploadDir is `uploadDir` here? Wait, uploadDir is defined at the top of server.js
            if (fs.existsSync(fallbackPath)) {
                filePathToDownload = fallbackPath;
            } else {
                // If it's still missing, try 'uploads' explicitly
                const hardFallback = path.join(__dirname, '..', 'uploads', fileName);
                if (fs.existsSync(hardFallback)) {
                    filePathToDownload = hardFallback;
                }
            }
        }
        res.download(filePathToDownload, record.file_name);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download file',
            error: error.message
        });
    }
});

// Modify record (for doctors with access)
app.put('/api/doctor/record/:recordId', authenticateToken, requireDoctor, upload.single('file'), async (req, res) => {
    try {
        const { recordId } = req.params;
        const { recordTitle, recordDescription, recordType } = req.body;
        const doctor = await doctorDB.getByUserId(req.user.userId);

        // 1. Verify access: Permission, DB-approved request, or Blockchain
        const record = await recordDB.getById(recordId);
        
        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        let isAuthorized = await permissionDB.hasAccess(recordId, doctor.doctor_id);
        
        if (!isAuthorized) {
            // Check blockchain access
            const patient = await patientDB.getById(record.patient_id);
            const patientUser = await userDB.findById(patient.user_id);
            if (patientUser && patientUser.wallet_address && req.user.walletAddress) {
                try {
                    const accessRequest = await blockchainService.getAccessRequest(req.user.walletAddress, patientUser.wallet_address);
                    if (accessRequest && accessRequest.status === 'APPROVED') {
                        isAuthorized = true;
                    }
                } catch (bcError) {
                    console.error('Blockchain check in modify record failed:', bcError.message);
                }
            }
            
            // If still not authorized, check DB-approved access requests
            if (!isAuthorized) {
                const isDbApproved = await accessRequestDB.isApproved(doctor.doctor_id, record.patient_id);
                if (isDbApproved) {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to modify this record. Please request access from the patient.'
            });
        }

        // 2. Process modification
        let updatedFilePath = record.file_path;
        let updatedFileName = record.file_name;
        let updatedFileSize = record.file_size;
        let updatedMimeType = record.mime_type;
        let updatedHash = record.record_hash;

        if (req.file) {
            // New file uploaded
            updatedHash = await generateFileHash(req.file.path);
            
            // Upload to cloud if needed
            try {
                const cloudData = await cloudStorage.uploadRecord(req.file.path, record.patient_id, req.file.filename);
                if (cloudData.success) {
                    updatedFilePath = cloudData.storagePath;
                } else {
                    updatedFilePath = req.file.path;
                }
            } catch (cloudError) {
                console.error('Cloud upload during modification failed:', cloudError.message);
                updatedFilePath = req.file.path;
            }
            
            updatedFileName = req.file.originalname;
            updatedFileSize = req.file.size;
            updatedMimeType = req.file.mimetype;
            
            // Delete old local file if replaced and not in cloud
            if (record.file_path !== updatedFilePath && !record.file_path.startsWith('records/')) {
                if (fs.existsSync(record.file_path)) {
                    fs.unlinkSync(record.file_path);
                }
            }
        }

        // 3. Update in database
        await recordDB.update(recordId, {
            recordTitle: recordTitle || record.record_title,
            recordDescription: recordDescription || record.record_description,
            recordType: recordType || record.record_type,
            filePath: updatedFilePath,
            fileName: updatedFileName,
            fileSize: updatedFileSize,
            mimeType: updatedMimeType,
            recordHash: updatedHash
        });

        // 4. Update blockchain hash if file changed
        let blockchainTxHash = record.blockchain_tx_hash;
        if (req.file && req.user.walletAddress) {
            try {
                // Use the new updateRecordHash on blockchain
                blockchainTxHash = await blockchainService.updateRecordHash(recordId, updatedHash, req.user.walletAddress);
                await recordDB.updateBlockchainTx(recordId, blockchainTxHash);
            } catch (bcError) {
                console.error('Blockchain update during modification failed:', bcError.message);
            }
        }

        // Log activity
        await auditDB.log(req.user.userId, 'RECORD_MODIFIED', 'medical_record', recordId, `Doctor ${doctor.doctor_id} modified record`, req.ip);

        res.json({
            success: true,
            message: 'Record modified successfully',
            data: {
                recordId,
                modificationCount: (record.modification_count || 0) + 1,
                blockchainTxHash
            }
        });

    } catch (error) {
        console.error('Modify record error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to modify record',
            error: error.message
        });
    }
});

// ============= BLOCKCHAIN ROUTES =============

// Verify record integrity
app.post('/api/blockchain/verify/:recordId', authenticateToken, async (req, res) => {
    try {
        const { recordId } = req.params;
        const record = await recordDB.getById(recordId);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found'
            });
        }

        // Calculate current hash of the file
        const currentHash = await generateFileHash(record.file_path);

        // Compare with stored hash
        const dbHashMatch = currentHash === record.record_hash;

        // Verify on blockchain
        let blockchainValid = false;
        if (record.blockchain_tx_hash) {
            try {
                blockchainValid = await blockchainService.verifyRecordIntegrity(recordId, record.record_hash);
            } catch (error) {
                console.error('Blockchain verification failed:', error.message);
            }
        }

        res.json({
            success: true,
            data: {
                recordId,
                fileIntact: dbHashMatch,
                blockchainVerified: blockchainValid,
                isVerified: dbHashMatch && blockchainValid,
                storedHash: record.record_hash,
                currentHash,
                blockchainTxHash: record.blockchain_tx_hash
            }
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
});

// ============= BLOCKCHAIN ACCESS REQUESTS =============

// Doctor requests access to patient
app.post('/api/doctor/request-access', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { patientId } = req.body;
        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }

        const doctor = await doctorDB.getByUserId(req.user.userId);
        const patient = await patientDB.getById(patientId);

        if (!doctor || !patient) {
            return res.status(404).json({ success: false, message: 'Doctor or patient not found' });
        }

        // Save to database FIRST (always works, no blockchain needed)
        await accessRequestDB.create(doctor.doctor_id, patient.patient_id);

        // Try blockchain optionally (best-effort, won't fail the request)
        let txHash = null;
        try {
            const patientUser = await userDB.findById(patient.user_id);
            if (patientUser && patientUser.wallet_address && req.user.walletAddress) {
                txHash = await blockchainService.requestAccess(patientUser.wallet_address, req.user.walletAddress);
                console.log(`[BLOCKCHAIN] Access request tx: ${txHash}`);
            } else {
                console.warn('[BLOCKCHAIN] Skipping requestAccess: doctor or patient wallet missing');
            }
        } catch (bcError) {
            console.warn('[BLOCKCHAIN] requestAccess failed (non-fatal):', bcError.message);
        }

        // Log activity
        await auditDB.log(req.user.userId, 'ACCESS_REQUESTED', 'patient', patientId, `Doctor requested access to patient records`, req.ip);

        res.json({ success: true, message: 'Access request sent to patient', data: { txHash } });
    } catch (error) {
        console.error('Request access error:', error);
        res.status(500).json({ success: false, message: 'Failed to request access', error: error.message });
    }
});

// Doctor fetch record by hash
app.get('/api/doctor/record/hash/:recordHash', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { recordHash } = req.params;
        const record = await recordDB.getByHash(recordHash);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }
        const doctor = await doctorDB.getByUserId(req.user.userId);
        const hasPermission = await permissionDB.hasAccess(record.record_id, doctor.doctor_id);
        if (!hasPermission) {
            return res.status(403).json({ success: false, message: 'Access denied for this record' });
        }
        res.json({ success: true, data: record });
    } catch (error) {
        console.error('Doctor fetch record by hash error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch record', error: error.message });
    }
});

// Patient views pending requests (reads from DB - always works)
app.get('/api/patient/access-requests', authenticateToken, requirePatient, async (req, res) => {
    try {
        const patient = await patientDB.getByUserId(req.user.userId);
        if (!patient) {
            return res.json({ success: true, data: [] });
        }

        // Read from DB (doctor_name, specialization, etc. already joined)
        const pending = await accessRequestDB.getByPatient(patient.patient_id);

        res.json({ success: true, data: pending });
    } catch (error) {
        console.error('Fetch requests error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch requests' });
    }
});

// Patient responds to access request
app.post('/api/patient/respond-access', authenticateToken, requirePatient, async (req, res) => {
    try {
        const { requestId, approve } = req.body;

        if (!requestId) {
            return res.status(400).json({ success: false, message: 'Request ID is required' });
        }

        const newStatus = approve ? 'approved' : 'rejected';

        // Update DB (source of truth)
        await accessRequestDB.updateStatus(requestId, newStatus);

        // Try blockchain optionally
        let txHash = null;
        try {
            const patient = await patientDB.getByUserId(req.user.userId);
            const user = await userDB.findById(req.user.userId);
            // Get doctor wallet from the request record
            const [rows] = await pool.execute(
                'SELECT u.wallet_address FROM access_requests ar JOIN doctors d ON ar.doctor_id = d.doctor_id JOIN users u ON d.user_id = u.user_id WHERE ar.request_id = ?',
                [requestId]
            );
            const doctorWallet = rows[0]?.wallet_address;
            if (user.wallet_address && doctorWallet) {
                txHash = await blockchainService.respondToAccessRequest(doctorWallet, user.wallet_address, approve);
            }
        } catch (bcError) {
            console.warn('[BLOCKCHAIN] respondToAccessRequest failed (non-fatal):', bcError.message);
        }

        // Log activity
        await auditDB.log(req.user.userId, 'ACCESS_REQUEST_RESPONDED', 'access_request', requestId, `Patient ${approve ? 'approved' : 'rejected'} access request`, req.ip);

        res.json({ success: true, message: `Access request ${approve ? 'approved' : 'rejected'}`, data: { txHash } });
    } catch (error) {
        console.error('Respond access error:', error);
        res.status(500).json({ success: false, message: 'Failed to respond to request', error: error.message });
    }
});

// Alias for add-patient to fix frontend mismatch
app.post('/api/doctor/add-patient', authenticateToken, requireDoctor, async (req, res) => {
    try {
        const { patientId, diagnosisCategory, status, criticalReason } = req.body;
        console.log(`[DEBUG] Add patient attempt: patientId=${patientId}, doctorUserId=${req.user.userId}`);

        const doctor = await doctorDB.getByUserId(req.user.userId);
        if (!doctor) {
            console.error(`❌ Add patient failed: Doctor profile not found for user ${req.user.userId}`);
            return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        }

        if (!patientId) {
            return res.status(400).json({ success: false, message: 'Patient ID is required' });
        }

        await treatmentDB.add(patientId, doctor.doctor_id, diagnosisCategory || 'General', status || 'active', criticalReason);

        // Log activity
        await auditDB.log(req.user.userId, 'TREATMENT_STARTED', 'patient', patientId, `Doctor added patient to treatment list (${status || 'active'})`, req.ip);

        res.json({
            success: true,
            message: 'Patient added to treatment list'
        });
    } catch (error) {
        console.error('Add patient error:', error);
        res.status(500).json({ success: false, message: 'Failed to add patient', error: error.message });
    }
});

// ============= SERVER INITIALIZATION =============

async function startServer() {
    try {
        console.log('🚀 Starting Healthcare Blockchain Server...\n');

        // Test database connection
        const dbConnected = await testConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }

        // Initialize blockchain service
        try {
            await blockchainService.initialize();
        } catch (error) {
            console.warn('⚠️ Blockchain service not initialized. Deploy contract first.');
            console.warn('Server will start but blockchain features will be unavailable.\n');
        }

        // Start server
        app.listen(PORT, () => {
            console.log(`\n✅ Server running on http://localhost:${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`\n🏥 Healthcare Blockchain System Ready!\n`);
        });
    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        process.exit(1);
    }
}

startServer();

module.exports = app;
