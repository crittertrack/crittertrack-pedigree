/**
 * Script to analyze if TEMP_1773763712783_kq2zmqlpd and CTU69 are the same person
 * 
 * This script analyzes multiple data points:
 * - IP addresses from login history
 * - Creation dates/timestamps
 * - User agent patterns (device, browser)
 * - Email domains and patterns
 * - Activity patterns
 * - Geographic location data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('./database/models');
const { LoginAuditLog } = require('./database/2faModels');

// Connect to database
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack');
        console.log('✓ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

/**
 * Analyze two user accounts to determine if they might be the same person
 */
async function analyzeDuplicateUsers(userId1, userId2) {
    console.log('\n========================================');
    console.log('DUPLICATE USER ANALYSIS');
    console.log('========================================\n');

    // Fetch both users
    const [user1, user2] = await Promise.all([
        User.findOne({ id_public: userId1 }).select('+resetPasswordToken +resetPasswordExpires').lean(),
        User.findOne({ id_public: userId2 }).select('+resetPasswordToken +resetPasswordExpires').lean()
    ]);

    if (!user1) {
        console.log(`❌ User ${userId1} not found`);
        return;
    }
    if (!user2) {
        console.log(`❌ User ${userId2} not found`);
        return;
    }

    console.log(`User 1: ${user1.id_public || user1._id}`);
    console.log(`  Name: ${user1.personalName}`);
    console.log(`  Email: ${user1.email}`);
    console.log(`  Created: ${user1.creationDate || 'Not set'}`);
    console.log(`  Verified: ${user1.emailVerified}\n`);

    console.log(`User 2: ${user2.id_public || user2._id}`);
    console.log(`  Name: ${user2.personalName}`);
    console.log(`  Email: ${user2.email}`);
    console.log(`  Created: ${user2.creationDate || 'Not set'}`);
    console.log(`  Verified: ${user2.emailVerified}\n`);

    // Analysis object
    const analysis = {
        matchScore: 0,
        maxScore: 0,
        indicators: []
    };

    // 1. Name similarity
    console.log('--- Name Analysis ---');
    const name1 = user1.personalName.toLowerCase();
    const name2 = user2.personalName.toLowerCase();
    if (name1 === name2) {
        console.log(`✓ Exact name match: "${user1.personalName}"`);
        analysis.matchScore += 30;
        analysis.indicators.push('Exact name match');
    } else if (name1.includes(name2) || name2.includes(name1)) {
        console.log(`⚠ Partial name match: "${user1.personalName}" ~ "${user2.personalName}"`);
        analysis.matchScore += 15;
        analysis.indicators.push('Partial name match');
    } else {
        console.log(`✗ No name match: "${user1.personalName}" vs "${user2.personalName}"`);
    }
    analysis.maxScore += 30;

    // 2. Email domain analysis
    console.log('\n--- Email Analysis ---');
    const email1Domain = user1.email.split('@')[1];
    const email2Domain = user2.email.split('@')[1];
    const email1User = user1.email.split('@')[0];
    const email2User = user2.email.split('@')[0];

    if (user1.email === user2.email) {
        console.log(`✓ Same email address`);
        analysis.matchScore += 50;
        analysis.indicators.push('Same email');
    } else if (email1Domain === email2Domain) {
        console.log(`⚠ Same email domain: ${email1Domain}`);
        analysis.matchScore += 10;
        analysis.indicators.push(`Same domain (${email1Domain})`);
        
        // Check if username parts are similar
        if (email1User.includes(email2User.slice(0, 4)) || email2User.includes(email1User.slice(0, 4))) {
            console.log(`  ⚠ Similar email usernames`);
            analysis.matchScore += 10;
            analysis.indicators.push('Similar email prefixes');
        }
    } else {
        console.log(`✗ Different email domains: ${email1Domain} vs ${email2Domain}`);
    }
    analysis.maxScore += 50;

    // 3. Creation date analysis
    console.log('\n--- Creation Date Analysis ---');
    if (user1.creationDate && user2.creationDate) {
        const timeDiff = Math.abs(user1.creationDate - user2.creationDate);
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        console.log(`Time between registrations: ${daysDiff.toFixed(2)} days`);
        
        if (daysDiff < 1) {
            console.log(`✓ Registered on same day`);
            analysis.matchScore += 15;
            analysis.indicators.push('Registered same day');
        } else if (daysDiff < 7) {
            console.log(`⚠ Registered within same week`);
            analysis.matchScore += 8;
            analysis.indicators.push('Registered same week');
        } else if (daysDiff < 30) {
            console.log(`⚠ Registered within same month`);
            analysis.matchScore += 4;
            analysis.indicators.push('Registered same month');
        } else {
            console.log(`✗ Registered ${daysDiff.toFixed(0)} days apart`);
        }
    } else {
        console.log(`⚠ Missing creation date for one or both users`);
    }
    analysis.maxScore += 15;

    // 4. Login history analysis (IP addresses, devices, location)
    console.log('\n--- Login History Analysis ---');
    const [loginHistory1, loginHistory2] = await Promise.all([
        LoginAuditLog.find({ user_id: user1._id }).sort({ created_at: -1 }).limit(20).lean(),
        LoginAuditLog.find({ user_id: user2._id }).sort({ created_at: -1 }).limit(20).lean()
    ]);

    console.log(`User 1 login records: ${loginHistory1.length}`);
    console.log(`User 2 login records: ${loginHistory2.length}`);

    if (loginHistory1.length > 0 && loginHistory2.length > 0) {
        // Extract IP addresses
        const ips1 = new Set(loginHistory1.map(l => l.ip_address));
        const ips2 = new Set(loginHistory2.map(l => l.ip_address));
        
        // Find common IPs
        const commonIPs = [...ips1].filter(ip => ips2.has(ip));
        
        if (commonIPs.length > 0) {
            console.log(`✓ COMMON IP ADDRESSES (${commonIPs.length}):`);
            commonIPs.forEach(ip => console.log(`  - ${ip}`));
            
            // Strong evidence if multiple common IPs
            const ipScore = Math.min(commonIPs.length * 10, 40);
            analysis.matchScore += ipScore;
            analysis.indicators.push(`${commonIPs.length} shared IP address(es)`);
        } else {
            console.log(`✗ No common IP addresses found`);
        }
        
        analysis.maxScore += 40;

        // Analyze locations
        const locations1 = new Set(loginHistory1.map(l => l.location).filter(Boolean));
        const locations2 = new Set(loginHistory2.map(l => l.location).filter(Boolean));
        const commonLocations = [...locations1].filter(loc => locations2.has(loc));
        
        if (commonLocations.length > 0) {
            console.log(`✓ Common locations: ${commonLocations.join(', ')}`);
            analysis.matchScore += 10;
            analysis.indicators.push(`Shared location(s): ${commonLocations.join(', ')}`);
        }
        analysis.maxScore += 10;

        // Analyze user agents (device patterns)
        const userAgents1 = loginHistory1.map(l => l.user_agent).filter(Boolean);
        const userAgents2 = loginHistory2.map(l => l.user_agent).filter(Boolean);
        
        // Check for similar devices/browsers
        const devices1 = new Set(loginHistory1.map(l => l.device_name).filter(Boolean));
        const devices2 = new Set(loginHistory2.map(l => l.device_name).filter(Boolean));
        const commonDevices = [...devices1].filter(d => devices2.has(d));
        
        if (commonDevices.length > 0) {
            console.log(`⚠ Similar device names: ${commonDevices.join(', ')}`);
            analysis.matchScore += 5;
            analysis.indicators.push(`Similar devices: ${commonDevices.join(', ')}`);
        }
        analysis.maxScore += 5;

        // Check timezones
        const timezones1 = new Set(loginHistory1.map(l => l.timezone).filter(Boolean));
        const timezones2 = new Set(loginHistory2.map(l => l.timezone).filter(Boolean));
        const commonTimezones = [...timezones1].filter(tz => timezones2.has(tz));
        
        if (commonTimezones.length > 0) {
            console.log(`⚠ Same timezone: ${commonTimezones.join(', ')}`);
            analysis.matchScore += 5;
            analysis.indicators.push(`Same timezone: ${commonTimezones.join(', ')}`);
        }
        analysis.maxScore += 5;

    } else {
        console.log(`⚠ Insufficient login history for comparison`);
        analysis.maxScore += 60; // IP + location + device + timezone
    }

    // 5. Last login IP check (from User model)
    console.log('\n--- Last Login IP (from User model) ---');
    if (user1.last_login_ip && user2.last_login_ip) {
        if (user1.last_login_ip === user2.last_login_ip) {
            console.log(`✓ Same last login IP: ${user1.last_login_ip}`);
            analysis.matchScore += 20;
            analysis.indicators.push(`Same last login IP: ${user1.last_login_ip}`);
        } else {
            console.log(`✗ Different last login IPs: ${user1.last_login_ip} vs ${user2.last_login_ip}`);
        }
    } else {
        console.log(`⚠ Last login IP not available for one or both users`);
    }
    analysis.maxScore += 20;

    // Calculate final score percentage
    const percentage = analysis.maxScore > 0 ? (analysis.matchScore / analysis.maxScore * 100) : 0;

    // Final Assessment
    console.log('\n========================================');
    console.log('FINAL ASSESSMENT');
    console.log('========================================');
    console.log(`Match Score: ${analysis.matchScore} / ${analysis.maxScore} (${percentage.toFixed(1)}%)\n`);

    console.log('Matching Indicators:');
    if (analysis.indicators.length > 0) {
        analysis.indicators.forEach(indicator => console.log(`  ✓ ${indicator}`));
    } else {
        console.log('  (None)');
    }

    console.log('\nConclusion:');
    if (percentage >= 70) {
        console.log('🔴 HIGH CONFIDENCE: These accounts likely belong to the same person');
        console.log('   Recommendation: Merge accounts or contact user for clarification');
    } else if (percentage >= 40) {
        console.log('🟡 MODERATE CONFIDENCE: Possible duplicate, requires investigation');
        console.log('   Recommendation: Review manually and contact user if needed');
    } else {
        console.log('🟢 LOW CONFIDENCE: Likely different users');
        console.log('   Recommendation: No action needed unless other evidence emerges');
    }

    console.log('\n========================================\n');

    return analysis;
}

// Main execution
async function main() {
    await connectDB();

    // Analyze the two accounts in question
    await analyzeDuplicateUsers('TEMP_1773763712783_kq2zmqlpd', 'CTU69');

    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = { analyzeDuplicateUsers };
