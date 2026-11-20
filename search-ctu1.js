const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://crittertrack_app_user_v2:xSmRuas3OVAZGUZD@crittertrack.artyose.mongodb.net/crittertrackdb';

async function findCtu1Accounts() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('crittertrackdb');
    const users = db.collection('users');
    
    console.log('🔍 Searching for CTU1 accounts...\n');
    
    // Search by different patterns
    const searches = [
      { field: 'email', pattern: /ctu1/i },
      { field: 'personalName', pattern: /CTU1/i },
      { field: 'username', pattern: /ctu1/i }
    ];
    
    for (const search of searches) {
      const results = await users.find({ [search.field]: search.pattern }).toArray();
      if (results.length > 0) {
        console.log(`📧 Found ${results.length} account(s) with ${search.field} matching "ctu1":`);
        for (const user of results) {
          console.log(JSON.stringify({
            _id: user._id,
            email: user.email,
            personalName: user.personalName,
            role: user.role,
            adminPassword: user.adminPassword ? 'SET' : 'NOT SET',
            accountStatus: user.accountStatus,
            primaryKey: user._id
          }, null, 2));
        }
      }
    }
    
    // Also search all users that might be staff
    const allUsers = await users.find({}).toArray();
    console.log(`\n📊 Total users in database: ${allUsers.length}`);
    
    // Look for users with admin or moderator role
    const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'moderator');
    if (admins.length > 0) {
      console.log('\n👥 Users with admin/moderator role:');
      for (const user of admins) {
        console.log(`  ${user.email} - role: ${user.role}, personalName: ${user.personalName}, ID: ${user._id}`);
      }
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findCtu1Accounts();