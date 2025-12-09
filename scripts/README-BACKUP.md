# MongoDB Database Backup & Restore

This directory contains scripts for backing up and restoring your MongoDB database.

## Prerequisites

1. **Install MongoDB Database Tools**
   - Download from: https://www.mongodb.com/try/download/database-tools
   - Windows: Download the ZIP file and extract it
   - Add the `bin` folder to your system PATH
   - Verify installation: `mongodump --version`

2. **Environment Variables**
   - Ensure your `.env` file has `MONGODB_URI` set

## Backup Database

To create a backup of your database:

```bash
node scripts/backup-database.js
```

This will:
- Create a `backups` folder in your project root
- Generate a timestamped backup folder (e.g., `backup-2025-12-09T10-30-00`)
- Export all collections from your database
- Display backup size and contents

## Restore Database

To restore from a backup:

```bash
node scripts/restore-database.js backups/backup-2025-12-09T10-30-00
```

**⚠️ WARNING**: This will replace your current database with the backup data!

The script will:
- Ask for confirmation before proceeding
- Drop existing collections
- Restore all data from the backup

## Backup Schedule Recommendations

- **Before major updates**: Always create a backup before deploying significant changes
- **Daily backups**: For production databases with frequent updates
- **Weekly backups**: For development databases
- **Before migrations**: Always backup before running database migrations

## Backup Storage

- Backups are stored locally in the `backups` folder
- **Important**: Add backups to cloud storage or external backup for safety
- Consider using automated backup services like MongoDB Atlas automated backups

## MongoDB Atlas Cloud Backups

If you're using MongoDB Atlas (which you likely are), you also have:

1. **Point-in-Time Backups**: Atlas automatically creates snapshots
2. **On-Demand Snapshots**: Create manual snapshots from the Atlas dashboard
3. **Continuous Backups**: Available on M10+ clusters

To access Atlas backups:
1. Go to https://cloud.mongodb.com
2. Select your cluster
3. Click "Backup" tab

## Troubleshooting

### "mongodump is not recognized"
- MongoDB Database Tools are not installed or not in PATH
- Download from: https://www.mongodb.com/try/download/database-tools
- Add the `bin` folder to your system PATH

### "Authentication failed"
- Check your MONGODB_URI in .env file
- Ensure your MongoDB user has proper permissions

### Large backup times
- Database size affects backup duration
- Consider compressing backups: The tools create BSON files that compress well

## Alternative: Manual Export/Import

For specific collections, you can use:

```bash
# Export single collection
mongoexport --uri="YOUR_MONGODB_URI" --collection=animals --out=animals.json

# Import single collection
mongoimport --uri="YOUR_MONGODB_URI" --collection=animals --file=animals.json
```

## .gitignore

Make sure `backups/` is in your `.gitignore` file to avoid committing large backup files to Git.
