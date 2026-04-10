const jwt = require('jsonwebtoken');
const { userDB } = require('../services/database');
require('dotenv').config();

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            // Get user from database
            const user = await userDB.findById(decoded.userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Attach user info to request
            req.user = {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                walletAddress: user.wallet_address
            };

            next();
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
}

// Middleware to check if user is a patient
function requirePatient(req, res, next) {
    if (req.user.role !== 'patient') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Patient role required.'
        });
    }
    next();
}

// Middleware to check if user is a doctor
function requireDoctor(req, res, next) {
    if (req.user.role !== 'doctor') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Doctor role required.'
        });
    }
    next();
}

// Generate JWT token
function generateToken(userId, email, role) {
    const payload = {
        userId,
        email,
        role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
}

module.exports = {
    authenticateToken,
    requirePatient,
    requireDoctor,
    generateToken
};
