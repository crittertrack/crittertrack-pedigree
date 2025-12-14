// Quick fix script to remove CTU1 from CTC332's viewOnlyForUsers array
const mongoose = require('mongoose');
const { Animal, User, PublicProfile } = require('../database/models');

const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-uri-here';

async function fixAnimal() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the animal CTC332
        const animal = await Animal.findOne({ id_public: 'CTC332' });
        
        if (!animal) {
            console.log('Animal CTC332 not found');
            return;
        }

        console.log('Found animal:', {
            id_public: animal.id_public,
            name: animal.name,
            ownerId: animal.ownerId,
            viewOnlyForUsers: animal.viewOnlyForUsers
        });

        // Find CTU1's backend userId
        const ctu1Profile = await PublicProfile.findOne({ id_public: 'CTU1' });
        
        if (!ctu1Profile) {
            console.log('CTU1 profile not found');
            return;
        }

        const ctu1UserId = ctu1Profile.userId_backend;
        console.log('CTU1 userId_backend:', ctu1UserId);

        // Check if CTU1 is in viewOnlyForUsers
        const hasViewOnly = animal.viewOnlyForUsers.some(
            userId => userId.toString() === ctu1UserId.toString()
        );

        if (hasViewOnly) {
            console.log('Removing CTU1 from viewOnlyForUsers...');
            
            animal.viewOnlyForUsers = animal.viewOnlyForUsers.filter(
                userId => userId.toString() !== ctu1UserId.toString()
            );
            
            await animal.save();
            console.log('✓ Successfully removed CTU1 from viewOnlyForUsers');
            console.log('New viewOnlyForUsers:', animal.viewOnlyForUsers);
        } else {
            console.log('CTU1 is not in viewOnlyForUsers array');
        }

        await mongoose.disconnect();
        console.log('Done!');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixAnimal();
