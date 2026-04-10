const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }

    async sendOTP(toEmail, otpCode) {
        // Fallback for missing credentials
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_USER === 'your-email@gmail.com') {
            console.log(`[AUTH-MOCK] Skipping real email to ${toEmail}. OTP: ${otpCode}`);
            return { success: true, mock: true };
        }

        const mailOptions = {
            from: `"Heliotrope Healthcare" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: 'Your Secure Access OTP Code',
            html: `
                <div style="font-family: 'Outfit', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                    <h2 style="color: #6366f1;">Heliotrope Healthcare</h2>
                    <p>Hello,</p>
                    <p>Your identity verification code is:</p>
                    <div style="background: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px;">
                        <h1 style="letter-spacing: 5px; color: #1f2937; margin: 0;">${otpCode}</h1>
                    </div>
                    <p>This code will expire in 10 minutes.</p>
                    <p style="color: #6b7280; font-size: 0.9rem;">If you did not request this, please ignore this email.</p>
                </div>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[AUTH] Email sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[AUTH] Email delivery failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
