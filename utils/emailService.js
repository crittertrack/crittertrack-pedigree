const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'crittertrackowner@gmail.com',
        pass: process.env.EMAIL_PASSWORD // App password from Gmail
    }
});

/**
 * Send verification code email
 */
const sendVerificationEmail = async (email, code) => {
    const mailOptions = {
        from: process.env.EMAIL_USER || 'crittertrackowner@gmail.com',
        to: email,
        subject: 'CritterTrack - Email Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ec4899;">Welcome to CritterTrack!</h2>
                <p>Thank you for registering. Please use the following verification code to complete your registration:</p>
                <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #ec4899; letter-spacing: 5px; margin: 0;">${code}</h1>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">CritterTrack - Breeding Registry Management</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://crittertrack.app'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
        from: process.env.EMAIL_USER || 'crittertrackowner@gmail.com',
        to: email,
        subject: 'CritterTrack - Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ec4899;">Password Reset Request</h2>
                <p>We received a request to reset your CritterTrack password.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #6b7280;">Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
                <p style="color: #ef4444; margin-top: 20px;">This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">CritterTrack - Breeding Registry Management</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};

/**
 * Send bug report notification to admin
 */
const sendBugReportNotification = async (reportData) => {
    const { userEmail, userName, category, description, page, timestamp } = reportData;
    
    const mailOptions = {
        from: process.env.EMAIL_USER || 'crittertrackowner@gmail.com',
        to: 'crittertrackowner@gmail.com',
        subject: `CritterTrack - New ${category} Report`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #ef4444;">New ${category} Report</h2>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Reporter:</strong> ${userName} (${userEmail})</p>
                    <p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>
                    <p style="margin: 5px 0;"><strong>Page:</strong> ${page}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp}</p>
                </div>
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Description:</h3>
                    <p style="white-space: pre-wrap;">${description}</p>
                </div>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">CritterTrack Admin Notification</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending bug report notification:', error);
        throw error;
    }
};

/**
 * Send genetics feedback notification to admin
 */
const sendGeneticsFeedbackNotification = async (feedbackData) => {
    const { userEmail, userName, phenotype, genotype, feedback, timestamp } = feedbackData;
    
    const mailOptions = {
        from: process.env.EMAIL_USER || 'crittertrackowner@gmail.com',
        to: 'crittertrackowner@gmail.com',
        subject: 'CritterTrack - New Genetics Phenotype Feedback',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #8b5cf6;">New Genetics Phenotype Feedback</h2>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Reporter:</strong> ${userName} (${userEmail})</p>
                    <p style="margin: 5px 0;"><strong>Phenotype:</strong> ${phenotype}</p>
                    <p style="margin: 5px 0;"><strong>Genotype:</strong> ${genotype}</p>
                    <p style="margin: 5px 0;"><strong>Time:</strong> ${timestamp}</p>
                </div>
                <div style="background-color: #ffffff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 5px;">
                    <h3 style="margin-top: 0;">Feedback:</h3>
                    <p style="white-space: pre-wrap;">${feedback}</p>
                </div>
                <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px;">CritterTrack Admin Notification</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending genetics feedback notification:', error);
        throw error;
    }
};

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendBugReportNotification,
    sendGeneticsFeedbackNotification
};
