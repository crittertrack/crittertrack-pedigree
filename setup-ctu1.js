// CTU1 Admin Setup Script
// Run with: node setup-ctu1.js

const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

// MongoDB connection string from .env
const MONGODB_URI = 'mongodb+srv://crittertrack_app_user_v2:xSmRuas3OVAZGUZD@crittertrack.artyose.mongodb.net/crittertrackdb';

async function setupCTU1() {
  let client;
  try {
    console.log('📡 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('crittertrackdb');
    const usersCollection = db.collection('users');

    // Find CTU1
    const ctu1 = await usersCollection.findOne({ email: /ctu1/i });
    
    if (ctu1) {
      console.log('✅ Found CTU1 account:', ctu1.email);
      console.log('   ID:', ctu1._id);
      console.log('   Current role:', ctu1.role);
      console.log('   adminPassword set:', ctu1.adminPassword ? 'YES' : 'NO');
      
      // Update role to admin
      if (ctu1.role !== 'admin') {
        await usersCollection.updateOne(
          { _id: new ObjectId(ctu1._id) },
          { $set: { role: 'admin' } }
        );
        console.log('   ✅ Role updated to: admin');
      }
      
      // Set admin password if not already set
      if (!ctu1.adminPassword) {
        const password = 'CTU1AdminPass123';
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
        
        await usersCollection.updateOne(
          { _id: new ObjectId(ctu1._id) },
          { $set: { adminPassword: hash } }
        );
        
        console.log('   ✅ adminPassword set');
        console.log('   🔐 Password:', password);
      } else {
        console.log('   ℹ️ adminPassword already set');
      }
      
      // Fetch updated user
      const updatedCtu1 = await usersCollection.findOne({ _id: new ObjectId(ctu1._id) });
      console.log('\n✅ CTU1 Account Summary:');
      console.log('  Email:', updatedCtu1.email);
      console.log('  Role:', updatedCtu1.role);
      console.log('  adminPassword set:', updatedCtu1.adminPassword ? 'YES' : 'NO');
      console.log('  accountStatus:', updatedCtu1.accountStatus);
      console.log('\n✅ CTU1 is now ready for moderation access!');
      
      return true;
    } else {
      console.log('❌ CTU1 not found in database');
      console.log('   Creating new CTU1 account...');
      
      const password = 'CTU1AdminPass123';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.createHash('sha256').update(password + salt).digest('hex');
      
      const newCtu1 = {
        email: 'ctu1@crittertrack.net',
        personalName: 'CTU1',
        role: 'admin',
        password: hash,
        adminPassword: hash,
        accountStatus: 'normal',
        creationDate: new Date()
      };
      
      const result = await usersCollection.insertOne(newCtu1);
      console.log('✅ New CTU1 account created with ID:', result.insertedId);
      console.log('   Email:', newCtu1.email);
      console.log('   Role:', newCtu1.role);
      console.log('   🔐 Default password: ' + password);
      
      return true;
    }

  } catch (error) {
    console.error('❌ Error setting up CTU1:', error.message);
    if (error.message.includes('authentication') || error.message.includes('connection')) {
      console.log('\n💡 Tip: Make sure you are running this script in the correct environment.');
      console.log('   The database connection requires the MongoDB credentials from .env file.');
    }
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run the setup
setupCTU1().catch(console.error);
