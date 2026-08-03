/**
 * backup-database.js
 *
 * Full logical backup of every collection in the connected MongoDB database.
 * Dumps each collection to its own JSON file under the given output directory.
 * Intended as a manual, on-demand safety snapshot before running data migrations.
 *
 * Output is written OUTSIDE this git repo by default (../../_backups/<timestamp>)
 * so dumped production data is never accidentally committed/pushed.
 *
 * Usage:
 *   node migrations/backup-database.js [outputDir]
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crittertrack';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = process.argv[2] || path.resolve(__dirname, '../../_backups', timestamp, 'database');

async function backupDatabase() {
    let connection;
    try {
        fs.mkdirSync(outputDir, { recursive: true });

        connection = await mongoose.connect(MONGO_URI);
        console.log('Successfully connected to MongoDB.');
        console.log(`Database: ${mongoose.connection.name}`);
        console.log(`Output directory: ${outputDir}`);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`Found ${collections.length} collections to back up.`);

        let totalDocs = 0;
        for (const { name } of collections) {
            const docs = await mongoose.connection.db.collection(name).find({}).toArray();
            const filePath = path.join(outputDir, `${name}.json`);
            fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
            console.log(`- ${name}: ${docs.length} document(s) -> ${filePath}`);
            totalDocs += docs.length;
        }

        console.log('----------------------------------------');
        console.log('Backup finished.');
        console.log(`- Collections backed up: ${collections.length}`);
        console.log(`- Total documents: ${totalDocs}`);
        console.log(`- Location: ${outputDir}`);
        console.log('----------------------------------------');
    } catch (error) {
        console.error('An error occurred during the backup:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB.');
        }
    }
}

backupDatabase();
