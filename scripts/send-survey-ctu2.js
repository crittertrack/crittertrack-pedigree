/**
 * Send survey email to user CTU2
 * Usage: node scripts/send-survey-ctu2.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { sendEmail } = require('../utils/emailService');
const { User } = require('../database/models');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';

const surveyHtml = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #ec4899; font-size: 28px; margin: 0 0 10px 0;">Help improve CritterTrack</h1>
    <p style="color: #666; font-size: 16px; margin: 0;">Your feedback matters to us</p>
  </div>

  <!-- Main content -->
  <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
    <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0 0 16px 0;">
      We're working hard to make CritterTrack the best tool for breeders and animal managers. 
      Your feedback helps us understand what's working well and where we can improve.
    </p>
    <p style="font-size: 15px; color: #333; line-height: 1.6; margin: 0;">
      This quick survey has 15 questions and should take only a few minutes to complete.
    </p>
  </div>

  <!-- CTA Button -->
  <div style="text-align: center; margin: 32px 0;">
    <a href="https://forms.gle/7RofySsGci1E6pTEA"
       style="background-color: #ec4899; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
      Take the survey
    </a>
  </div>

  <!-- Fallback link -->
  <p style="font-size: 13px; color: #666; text-align: center; margin: 24px 0;">
    If the button doesn't work, copy and paste this link into your browser:<br />
    <a href="https://forms.gle/7RofySsGci1E6pTEA" style="color: #ec4899; text-decoration: none;">https://forms.gle/7RofySsGci1E6pTEA</a>
  </p>

  <!-- Divider -->
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />

  <!-- Footer -->
  <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
    This email was sent from CritterTrack &lt;noreply@crittertrack.net&gt;. Replies to this address are not monitored.
  </p>
</div>
`;

const main = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000
    });
    console.log('✓ Connected to MongoDB');

    // Find user CTU2
    console.log('Looking for user CTU2...');
    const user = await User.findOne({ id_public: 'CTU2' });
    
    if (!user) {
      console.error('✗ User CTU2 not found');
      process.exit(1);
    }

    if (!user.email) {
      console.error('✗ User CTU2 has no email address');
      process.exit(1);
    }

    console.log(`✓ Found user CTU2: ${user.email}`);

    // Send email
    console.log('Sending survey email...');
    const result = await sendEmail(
      user.email,
      'Help improve CritterTrack — 15 quick questions',
      surveyHtml
    );

    console.log('✓ Survey email sent successfully to CTU2');
    console.log('Resend response:', JSON.stringify(result, null, 2));
    process.exit(0);

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
};

main();
