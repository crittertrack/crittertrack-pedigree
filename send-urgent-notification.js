#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

/**
 * Send an urgent alert notification to all users
 * Notifies about fixes after latest update
 */
const sendUrgentNotification = async () => {
  try {
    // Determine server URL from environment or use production server
    const serverUrl = process.env.SERVER_URL || 'https://crittertrack-pedigree-production.up.railway.app';
    const adminToken = process.env.ADMIN_TOKEN;
    
    console.log(`📢 Sending urgent notification to ${serverUrl}...`);
    
    const payload = {
      title: '⚠️ SYSTEM MAINTENANCE IN PROGRESS',
      message: 'We are currently working on critical fixes following the latest update. Services may be temporarily unavailable or unstable. Thank you for your patience.',
      type: 'alert', // This will display as a red urgent popup
    };

    const config = {
      headers: {
        'Content-Type': 'application/json',
      }
    };

    // Add admin token if available
    if (adminToken) {
      config.headers['Authorization'] = `Bearer ${adminToken}`;
    }

    const response = await axios.post(
      `${serverUrl}/api/moderation/broadcast`,
      payload,
      config
    );
    
    console.log('✅ SUCCESS: Urgent notification sent!');
    console.log(`📊 Recipients: ${response.data.affectedUsers || 'All active users'}`);
    console.log(`📝 Message: "${payload.message}"`);
    console.log(`🔔 Type: ALERT (Red urgent banner)`);
    console.log(`⏰ Sent at: ${new Date().toLocaleString('en-GB')}`);
    
  } catch (error) {
    if (error.response?.status === 403) {
      console.error('❌ ERROR: Admin authentication failed');
      console.error('   Please provide valid ADMIN_TOKEN in environment');
    } else if (error.response?.status === 401) {
      console.error('❌ ERROR: Not authenticated');
      console.error('   Set ADMIN_TOKEN environment variable');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ ERROR: Cannot connect to server');
      console.error(`   Server not running at ${process.env.SERVER_URL || 'http://localhost:5000'}`);
      console.error('   Make sure the backend is running');
    } else {
      console.error('❌ ERROR sending notification:');
      console.error(`   Status: ${error.response?.status || error.code}`);
      console.error(`   Message: ${error.response?.data?.error || error.message}`);
    }
    process.exit(1);
  }
};

// Run immediately
sendUrgentNotification();
