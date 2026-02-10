const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = 'CritterTrack <noreply@crittertrack.net>';

/**
 * Generic send email function
 */
const sendEmail = async (to, subject, htmlContent) => {
    try {
        console.log('Attempting to send email to:', to);
        console.log('Using Resend API key:', process.env.RESEND_API_KEY ? 'Set' : 'NOT SET');
        
        const result = await resend.emails.send({
            from: fromEmail,
            to: to,
            subject: subject,
            html: htmlContent
        });
        
        console.log('✓ Email sent successfully to:', to);
        return result;
    } catch (error) {
        console.error('Error sending email to', to, ':', error);
        console.error('Error details:', error.message);
        console.error('Error response:', error.response?.data);
        throw error;
    }
};

/**
 * Send verification code email
 */
const sendVerificationEmail = async (email, code) => {
    try {
        console.log('Attempting to send verification email to:', email);
        console.log('Using Resend API key:', process.env.RESEND_API_KEY ? 'Set' : 'NOT SET');
        
        const result = await resend.emails.send({
            from: fromEmail,
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
        });
        
        console.log('Resend API response:', result);
    } catch (error) {
        console.error('Error sending verification email:', error);
        console.error('Error details:', error.message);
        console.error('Error response:', error.response?.data);
        throw error;
    }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken) => {
    const resetUrl = `https://www.crittertrack.net/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    try {
        await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: 'CritterTrack - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ec4899;">Password Reset Request</h2>
                    <p>You requested to reset your password for your CritterTrack account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #ec4899; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="color: #6b7280; word-break: break-all;">${resetUrl}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this reset, please ignore this email.</p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">CritterTrack - Breeding Registry Management</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};

/**
 * Send bug report notification to admin
 */
const sendBugReportNotification = async (reportData) => {
    const { userName, userEmail, category, description, page, createdAt } = reportData;
    
    try {
        await resend.emails.send({
            from: fromEmail,
            to: 'crittertrackowner@gmail.com',
            subject: `[CritterTrack] New ${category} Submitted`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ec4899;">New ${category}</h2>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Reporter:</strong> ${userName} (${userEmail})</p>
                        <p><strong>Category:</strong> <span style="background-color: #ec4899; color: white; padding: 3px 10px; border-radius: 3px;">${category}</span></p>
                        <p><strong>Page:</strong> ${page}</p>
                        <p><strong>Submitted:</strong> ${new Date(createdAt).toLocaleString()}</p>
                    </div>
                    <h3>Description:</h3>
                    <p style="background-color: #f9fafb; padding: 15px; border-left: 3px solid #ec4899;">${description}</p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">CritterTrack Admin Notification</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error sending bug report notification:', error);
        throw error;
    }
};

/**
 * Send genetics feedback notification to admin
 */
const sendGeneticsFeedbackNotification = async (feedbackData) => {
    const { userName, userEmail, phenotype, genotype, feedback, createdAt } = feedbackData;
    
    try {
        await resend.emails.send({
            from: fromEmail,
            to: 'crittertrackowner@gmail.com',
            subject: '[CritterTrack] New Genetics Calculator Feedback',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ec4899;">New Genetics Calculator Feedback</h2>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Reporter:</strong> ${userName} (${userEmail})</p>
                        <p><strong>Submitted:</strong> ${new Date(createdAt).toLocaleString()}</p>
                    </div>
                    <h3>Phenotype Result:</h3>
                    <p style="background-color: #fef2f2; padding: 10px; border-left: 3px solid #ef4444;">${phenotype}</p>
                    <h3>Genotype Input:</h3>
                    <p style="background-color: #f9fafb; padding: 10px; border-left: 3px solid #6b7280; font-family: monospace;">${genotype}</p>
                    <h3>User Feedback:</h3>
                    <p style="background-color: #f9fafb; padding: 15px; border-left: 3px solid #ec4899;">${feedback}</p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">CritterTrack Admin Notification</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error sending genetics feedback notification:', error);
        throw error;
    }
};

/**
 * Send general feedback notification to admin
 */
const sendFeedbackNotification = async (feedbackData) => {
    const { userName, userEmail, userIdPublic, species, feedback, type, createdAt } = feedbackData;
    
    try {
        await resend.emails.send({
            from: fromEmail,
            to: 'crittertrackowner@gmail.com',
            subject: `[CritterTrack] New ${type === 'species-customization' ? 'Species' : 'General'} Feedback`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #ec4899;">New ${type === 'species-customization' ? 'Species Customization' : 'General'} Feedback</h2>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>From:</strong> ${userName} (${userEmail})</p>
                        <p><strong>User ID:</strong> ${userIdPublic}</p>
                        <p><strong>Type:</strong> <span style="background-color: #ec4899; color: white; padding: 3px 10px; border-radius: 3px;">${type}</span></p>
                        ${species ? `<p><strong>Species:</strong> ${species}</p>` : ''}
                        <p><strong>Submitted:</strong> ${new Date(createdAt).toLocaleString()}</p>
                    </div>
                    <h3>Feedback:</h3>
                    <p style="background-color: #f9fafb; padding: 15px; border-left: 3px solid #ec4899;">${feedback}</p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 12px;">CritterTrack Admin Notification</p>
                </div>
            `
        });
    } catch (error) {
        console.error('Error sending feedback notification:', error);
        throw error;
    }
};

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendBugReportNotification,
    sendGeneticsFeedbackNotification,
    sendFeedbackNotification
};
