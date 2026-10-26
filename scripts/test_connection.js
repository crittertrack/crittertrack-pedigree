const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://crittertrack_app_user_v2:lu4IQ6lt83ZsuFVI@crittertrack-dev.ds9ribj.mongodb.net/crittertrackdb?appName=crittertrack-dev', {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
}).then(() => {
    console.log('Connected to MongoDB successfully');
    process.exit(0);
}).catch(err => {
    console.error('Connection error:', err.message);
    process.exit(1);
});
