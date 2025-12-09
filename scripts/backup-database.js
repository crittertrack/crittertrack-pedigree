/**
 * MongoDB Database Backup Script
 * 
 * This script creates a backup of the MongoDB database using mongodump.
 * 
 * Prerequisites:
 * 1. Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
 * 2. Add mongodump to your system PATH
 * 3. Set MONGODB_URI in your .env file
 * 
 * Usage:
 * node scripts/backup-database.js
 */

require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI environment variable is not set.');
    console.log('Please ensure you have a .env file with MONGODB_URI defined.');
    process.exit(1);
}

// Create backups directory if it doesn't exist
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
const backupPath = path.join(backupsDir, `backup-${timestamp}`);

console.log('🔄 Starting MongoDB backup...');
console.log(`📁 Backup location: ${backupPath}`);

// Build mongodump command
const command = `mongodump --uri="${MONGODB_URI}" --out="${backupPath}"`;

// Execute mongodump
exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Backup failed:', error.message);
        if (stderr) console.error('Error details:', stderr);
        
        // Check if mongodump is installed
        exec('mongodump --version', (versionError) => {
            if (versionError) {
                console.log('\n💡 Tip: It looks like mongodump is not installed or not in your PATH.');
                console.log('   Download MongoDB Database Tools from:');
                console.log('   https://www.mongodb.com/try/download/database-tools');
            }
        });
        
        process.exit(1);
    }

    if (stdout) console.log(stdout);
    if (stderr && !stderr.includes('writing')) console.warn(stderr);

    console.log('✅ Backup completed successfully!');
    console.log(`📦 Backup saved to: ${backupPath}`);
    
    // List backup contents
    console.log('\n📋 Backup contents:');
    try {
        const dbDirs = fs.readdirSync(backupPath);
        dbDirs.forEach(dbDir => {
            const dbPath = path.join(backupPath, dbDir);
            if (fs.statSync(dbPath).isDirectory()) {
                const collections = fs.readdirSync(dbPath);
                console.log(`   📂 ${dbDir}:`);
                collections.forEach(file => {
                    if (file.endsWith('.bson')) {
                        const stats = fs.statSync(path.join(dbPath, file));
                        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
                        console.log(`      - ${file} (${sizeInMB} MB)`);
                    }
                });
            }
        });
    } catch (err) {
        console.warn('Could not list backup contents:', err.message);
    }

    console.log('\n💡 To restore this backup, run:');
    console.log(`   mongorestore --uri="YOUR_MONGODB_URI" "${backupPath}"`);
});
