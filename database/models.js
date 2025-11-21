const mongoose = require('mongoose');

// --- 1. COUNTER SCHEMA (For Generating Unique Public Integer IDs) ---
// Note: We only export the model here. The getNextSequence function moves to db_service.js.
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // 'userId' or 'animalId'
    seq: { type: Number, default: 1000 } // Start from 1000 for cleaner public IDs
});
const Counter = mongoose.model('Counter', CounterSchema);


// --- 2. USER SCHEMA (Private/Authentication Data) ---
const UserSchema = new mongoose.Schema({
    id_public: { type: Number, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    personalName: { type: String, required: true, trim: true },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    creationDate: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);


// --- 3. PUBLIC PROFILE SCHEMA (View-Only/Searchable Data) ---
const PublicProfileSchema = new mongoose.Schema({
    userId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_public: { type: Number, required: true, index: true },
    personalName: { type: String, required: true },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null },
    _searchableName: { type: String, index: true }
});

PublicProfileSchema.pre('save', function(next) {
    this._searchableName = `${this.personalName} ${this.breederName || ''}`.toLowerCase();
    next();
});
const PublicProfile = mongoose.model('PublicProfile', PublicProfileSchema);


// --- 4. ANIMAL SCHEMA (CRITICAL FIXES APPLIED HERE) ---
const AnimalSchema = new mongoose.Schema({
    // ACCESS CONTROL (The user who can edit/delete this file)
    appUserId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, 

    // DISPLAY CONTROL (The public ID of the owner shown on pedigree/public view)
    id_public: { type: Number, required: true, unique: true, index: true },
    ownerId_public: { type: Number, required: true, index: true }, // The public ID of the displayed owner
    ownerPersonalName: { type: String, required: true },
    ownerBreederName: { type: String, default: null },

    // CORE DATA
    prefix: { type: String, default: null, trim: true },
    name: { type: String, required: true, trim: true },
    registryCode: { type: String, default: null, trim: true },
    gender: { type: String, enum: ['unknown', 'male', 'female', 'Not Selected'], default: 'Not Selected' },
    birthDate: { type: Date, required: true },
    deathDate: { type: Date, default: null },
    color: { type: String, default: null },
    coat: { type: String, default: null },

    // PEDIGREE
    sireId_public: { type: Number, default: null },
    damId_public: { type: Number, default: null },

    // NOTES & STATUS
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    status: { type: String, default: 'Active' }, 

    // Public Toggle
    showOnPublicProfile: { type: Boolean, default: false }
}, { timestamps: true });
const Animal = mongoose.model('Animal', AnimalSchema);


// --- 5. PUBLIC ANIMAL SCHEMA ---
const PublicAnimalSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true }, // Matches the original Animal doc ID
    id_public: { type: Number, required: true, index: true },
    ownerId_public: { type: Number, required: true, index: true }, // The public owner link
    
    // Key display data
    prefix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String },
    birthDate: { type: Date },
    color: { type: String, default: null },
    coat: { type: String, default: null },

    // SENSITIVE/OPTIONAL DATA (Copied if toggled on)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
});
const PublicAnimal = mongoose.model('PublicAnimal', PublicAnimalSchema, 'publicanimals');


// --- 6. LITTER SCHEMA ---
const LitterSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    breedingPairCodeName: { type: String, default: null },
    sireId_public: { type: Number, required: true },
    sirePrefixName: { type: String, required: true },
    damId_public: { type: Number, required: true },
    damPrefixName: { type: String, required: true },
    pairingDate: { type: Date },
    birthDate: { type: Date, required: true },
    numberBorn: { type: Number, required: true, min: 0 },
    offspringIds_public: { type: [Number], default: [] }
}, { timestamps: true });
const Litter = mongoose.model('Litter', LitterSchema);


// Export all models
module.exports = {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Counter // Export the Counter model
};
