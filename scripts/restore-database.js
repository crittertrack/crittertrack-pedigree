/**
 * MongoDB Database Restore Script
 * 
 * This script restores a MongoDB database backup using mongorestore.
 * 
 * Prerequisites:
 * 1. Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
 * 2. Add mongorestore to your system PATH
 * 3. Set MONGODB_URI in your .env file
 * 
 * Usage:
 * node scripts/restore-database.js <backup-directory>
 * 
 * Example:
 * node scripts/restore-database.js backups/backup-2025-12-09T10-30-00
 */

require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI environment variable is not set.');
    console.log('Please ensure you have a .env file with MONGODB_URI defined.');
    process.exit(1);
}

// Get backup directory from command line argument
const backupDir = process.argv[2];

if (!backupDir) {
    console.error('❌ ERROR: Please specify a backup directory.');
    console.log('\nUsage: node scripts/restore-database.js <backup-directory>');
    console.log('\nAvailable backups:');
    
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (fs.existsSync(backupsDir)) {
        const backups = fs.readdirSync(backupsDir)
            .filter(f => f.startsWith('backup-'))
            .sort()
            .reverse();
        
        backups.forEach((backup, index) => {
            const backupPath = path.join(backupsDir, backup);
            const stats = fs.statSync(backupPath);
            console.log(`  ${index + 1}. ${backup} (Created: ${stats.birthtime.toLocaleString()})`);
        });
    } else {
        console.log('  No backups found.');
    }
    
    process.exit(1);
}

// Resolve backup path
const backupPath = path.isAbsolute(backupDir) 
    ? backupDir 
    : path.join(__dirname, '..', backupDir);

if (!fs.existsSync(backupPath)) {
    console.error(`❌ ERROR: Backup directory not found: ${backupPath}`);
    process.exit(1);
}

console.log('⚠️  WARNING: This will restore the database from the backup.');
console.log('   This operation will replace existing data!');
console.log(`\n📁 Backup source: ${backupPath}`);
console.log(`🎯 Target database: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

// Create readline interface for confirmation
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('\nAre you sure you want to continue? (yes/no): ', (answer) => {
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Restore cancelled.');
        process.exit(0);
    }
    
    console.log('\n🔄 Starting database restore...');
    
    // Build mongorestore command
    // --drop flag will drop collections before restoring
    const command = `mongorestore --uri="${MONGODB_URI}" --drop "${backupPath}"`;
    
    // Execute mongorestore
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Restore failed:', error.message);
            if (stderr) console.error('Error details:', stderr);
            
            // Check if mongorestore is installed
            exec('mongorestore --version', (versionError) => {
                if (versionError) {
                    console.log('\n💡 Tip: It looks like mongorestore is not installed or not in your PATH.');
                    console.log('   Download MongoDB Database Tools from:');
                    console.log('   https://www.mongodb.com/try/download/database-tools');
                }
            });
            
            process.exit(1);
        }
        
        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes('restoring')) console.warn(stderr);
        
        console.log('✅ Database restore completed successfully!');
    });
});
