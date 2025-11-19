const mongoose = require('mongoose');

// --- 1. COUNTER SCHEMA (For Generating Unique Public Integer IDs) ---
// This schema ensures atomic incrementing of user and animal public IDs.
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // 'userId' or 'animalId'
    seq: { type: Number, default: 1000 } // Start from 1000 for cleaner public IDs
});
const Counter = mongoose.model('Counter', CounterSchema);

/**
 * Utility function to atomically increment a counter and get the next sequence number.
 * @param {string} counterName - 'userId' or 'animalId'
 * @returns {Promise<number>} The next unique integer ID.
 */
async function getNextSequence(counterName) {
    const counter = await Counter.findByIdAndUpdate(
        counterName,
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}


// --- 2. USER SCHEMA (Private/Authentication Data) ---
const UserSchema = new mongoose.Schema({
    // 1. _id: MongoDB's default ObjectId (the backend ID)

    // 2. integer ID for users to search
    id_public: { type: Number, required: true, unique: true, index: true },

    // 3. email (for register and login)
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // 4. password (for register and login)
    password: { type: String, required: true, select: false }, // Hidden by default

    // 5. personal name
    personalName: { type: String, required: true, trim: true },

    // 6. profile image
    profileImage: { type: String, default: null }, // URL to image

    // 7. breeder name (toggle, extra function)
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },

    // 8. creation date
    creationDate: { type: Date, default: Date.now }
});


// --- 3. PUBLIC PROFILE SCHEMA (View-Only/Searchable Data) ---
// This is redundant data optimized for public search, fulfilling the "public visual user profile" requirement.
const PublicProfileSchema = new mongoose.Schema({
    userId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_public: { type: Number, required: true, index: true },
    personalName: { type: String, required: true },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null }, // Only populated if user toggles it on
    
    // For efficient searching by personalName or breederName
    _searchableName: { type: String, index: true } 
});

// Update the searchable name field before saving
PublicProfileSchema.pre('save', function(next) {
    this._searchableName = `${this.personalName} ${this.breederName || ''}`.toLowerCase();
    next();
});


// --- 4. ANIMAL SCHEMA ---
const AnimalSchema = new mongoose.Schema({
    // 1. _id: MongoDB's default ObjectId (the backend ID)

    // 2. integer ID for search
    id_public: { type: Number, required: true, unique: true, index: true },

    // 3. owner id + names (denormalized for easy lookup)
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerPersonalName: { type: String, required: true },
    ownerBreederName: { type: String, default: null }, // Denormalized from user's profile at time of creation

    // 4. prefix + name
    prefix: { type: String, default: null, trim: true },
    name: { type: String, required: true, trim: true },

    // 5. in business "registry code"
    registryCode: { type: String, default: null, trim: true },

    // 6. gender
    gender: { type: String, enum: ['unknown', 'male', 'female'], default: 'unknown' },

    // 7. birthdate
    birthdate: { type: Date, required: true },

    // 8. a toggle and entry for deathdate
    deathdate: { type: Date, default: null },

    // 9. color / coat
    color: { type: String, default: null },
    coat: { type: String, default: null },

    // 10. sire + dam (integer IDs and denormalized names)
    sireId_public: { type: Number, default: null },
    sirePrefixName: { type: String, default: null },
    damId_public: { type: Number, default: null },
    damPrefixName: { type: String, default: null },

    // 11. remarks, genetic code, status
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    status: { type: String, default: 'Active' }, // e.g., Active, Retired, Sold

    // 12. Toggle to show on public profile (Function 2)
    showOnPublicProfile: { type: Boolean, default: false }
}, { timestamps: true });


// --- 5. PUBLIC ANIMAL SCHEMA (For Public Profile View) ---
// This collection stores *only* the animals a user has toggled as public.
const PublicAnimalSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }, // References the original Animal doc ID
    id_public: { type: Number, required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    
    // Key display data
    prefix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String },
    birthdate: { type: Date },
    color: { type: String, default: null },
    // Add any other fields you want to show on the public card
});


// --- 6. LITTER SCHEMA ---
const LitterSchema = new mongoose.Schema({
    // 1. _id: MongoDB's default ObjectId (the backend ID)

    // 2. owner reference
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // 3. breeding pair code + name
    breedingPairCodeName: { type: String, default: null },

    // 4. sire and dam public IDs and names
    sireId_public: { type: Number, required: true },
    sirePrefixName: { type: String, required: true },
    damId_public: { type: Number, required: true },
    damPrefixName: { type: String, required: true },

    // 5. pairing and birthdate
    pairingDate: { type: Date },
    birthdate: { type: Date, required: true },

    // 6. number born
    numberBorn: { type: Number, required: true, min: 0 },

    // 7. ability to register all offspring linked to parents
    offspringIds_public: { type: [Number], default: [] }
}, { timestamps: true });


// Export all models
module.exports = {
    User: mongoose.model('User', UserSchema),
    PublicProfile: mongoose.model('PublicProfile', PublicProfileSchema),
    Animal: mongoose.model('Animal', AnimalSchema),
    PublicAnimal: mongoose.model('PublicAnimal', PublicAnimalSchema),
    Litter: mongoose.model('Litter', LitterSchema),
    getNextSequence // Export the ID generation function
};
