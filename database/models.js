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
    // Password MUST be selected manually in queries or explicitly included in update handlers
    password: { type: String, required: true, select: false }, 
    personalName: { type: String, required: true, trim: true },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    creationDate: { type: Date, default: Date.now },
    // Array of internal Animal and Litter IDs owned by this user for easy lookup
    ownedAnimals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }], 
    ownedLitters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Litter' }],
});
const User = mongoose.model('User', UserSchema);


// --- 3. PUBLIC PROFILE SCHEMA (View-Only/Searchable Data) ---
const PublicProfileSchema = new mongoose.Schema({
    userId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_public: { type: Number, required: true, unique: true, index: true },
    personalName: { type: String, required: true, trim: true },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    profileImage: { type: String, default: null },
    createdAt: { type: Date, default: null }, // Member since date
}, { timestamps: true });
const PublicProfile = mongoose.model('PublicProfile', PublicProfileSchema, 'publicprofiles');


// --- 4. ANIMAL SCHEMA (Private Data) ---
const AnimalSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerId_public: { type: Number, required: true }, // Denormalized public owner ID
    id_public: { type: Number, required: true, unique: true, index: true }, // The unique public Animal ID
    
    // Key display data
    species: { type: String, required: true, enum: ['Mouse', 'Rat', 'Hamster'] },
    prefix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' },
    birthDate: { type: Date, default: Date.now },
    breederyId: { type: String, default: null },
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    earset: { type: String, default: null },
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    
    // Image URLs (optional)
    imageUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },

    // Lineage linking (Links to the public ID of the ancestor)
    sireId_public: { type: Number, default: null },
    damId_public: { type: Number, default: null },
    
    // Optional Litter link (Links to the internal ID of the litter)
    litterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Litter', default: null },

    // SENSITIVE/OPTIONAL DATA (Default to private)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
    // Public visibility toggles
    showOnPublicProfile: { type: Boolean, default: false, index: true },
    includeRemarks: { type: Boolean, default: false }, // If public, include remarks
    includeGeneticCode: { type: Boolean, default: false }, // If public, include genetic code

}, { timestamps: true });
const Animal = mongoose.model('Animal', AnimalSchema);


// --- 5. PUBLIC ANIMAL SCHEMA (Shared/View-Only Data) ---
const PublicAnimalSchema = new mongoose.Schema({
    ownerId_public: { type: Number, required: true, index: true }, // The public owner link
    id_public: { type: Number, required: true, unique: true, index: true }, // The unique public Animal ID
    
    // Key display data
    species: { type: String, required: true },
    prefix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String },
    birthDate: { type: Date },
    breederyId: { type: String, default: null },
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    earset: { type: String, default: null },
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },

    // Public-facing image URLs
    imageUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },

    // Lineage linking (Links to the public ID of the ancestor)
    sireId_public: { type: Number, default: null },
    damId_public: { type: Number, default: null },
    
    // SENSITIVE/OPTIONAL DATA (Copied if toggled on)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
    // Settings used by db_service to know which fields to copy during update
    includeRemarks: { type: Boolean, default: false },
    includeGeneticCode: { type: Boolean, default: false },
});
const PublicAnimal = mongoose.model('PublicAnimal', PublicAnimalSchema, 'publicanimals');


// --- 6. LITTER SCHEMA ---
const LitterSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Code name for the breeding pair (optional for display)
    breedingPairCodeName: { type: String, default: null }, 
    
    // Sire/Dam data links to PublicAnimal records for lineage
    sireId_public: { type: Number, default: null },
    sirePrefixName: { type: String, default: null }, // Denormalized for display
    damId_public: { type: Number, default: null },
    damPrefixName: { type: String, default: null }, // Denormalized for display
    
    pairingDate: { type: Date, default: null },
    birthDate: { type: Date, required: true },
    numberBorn: { type: Number, required: true, min: 0 },
    
    // Public IDs of offspring animals that came from this litter
    offspringIds_public: { type: [Number], default: [] }, 
    
    // Remarks specific to the litter
    notes: { type: String, default: '' },
    
}, { timestamps: true });
const Litter = mongoose.model('Litter', LitterSchema);


// --- EXPORTS ---
module.exports = {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Counter
};