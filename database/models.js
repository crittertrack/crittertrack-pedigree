const mongoose = require('mongoose');

// --- 1. COUNTER SCHEMA (For Generating Unique Public Integer IDs) ---\
const CounterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // 'userId' or 'animalId'
    seq: { type: Number, default: 1000 } // Start from 1000 for cleaner public IDs
});
const Counter = mongoose.model('Counter', CounterSchema);


// --- 2. USER SCHEMA (Private/Authentication Data) ---\
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
    // Array of internal Animal IDs owned by this user
    ownedAnimals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }], 
});
const User = mongoose.model('User', UserSchema);


// --- 3. PUBLIC PROFILE SCHEMA (View-Only/Searchable Data) ---\
const PublicProfileSchema = new mongoose.Schema({
    userId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_public: { type: Number, required: true, unique: true, index: true },
    personalName: { type: String, required: true, trim: true },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    // No creation date needed, relies on User creationDate
});
const PublicProfile = mongoose.model('PublicProfile', PublicProfileSchema, 'publicprofiles');


// --- 4. ANIMAL SCHEMA (Private Data) ---\
const AnimalSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    id_public: { type: Number, required: true, unique: true, index: true },

    // Key display data
    species: { type: String, enum: ['Mouse', 'Rat', 'Hamster'], required: true },
    prefix: { type: String, default: null }, // Kennel/Breeder Prefix
    name: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' },
    birthDate: { type: Date, required: true },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    
    // Pedigree Links (using Public IDs for inter-breeder linking)
    sireId_public: { type: Number, default: null },
    damId_public: { type: Number, default: null },
    litterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Litter', default: null },

    // SENSITIVE/OPTIONAL DATA (Private by default)
    showOnPublicProfile: { type: Boolean, default: false },
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
}, { timestamps: true });
const Animal = mongoose.model('Animal', AnimalSchema);


// --- 5. PUBLIC ANIMAL SCHEMA (View-Only Data) ---\
const PublicAnimalSchema = new mongoose.Schema({
    id_public: { type: Number, required: true, unique: true, index: true },
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


// --- 6. LITTER SCHEMA ---\
const LitterSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    breedingPairCodeName: { type: String, default: null },
    sireId_public: { type: Number, required: true },
    sirePrefixName: { type: String, required: true }, // Denormalized for display
    damId_public: { type: Number, required: true },
    damPrefixName: { type: String, required: true }, // Denormalized for display
    pairingDate: { type: Date, default: null },
    birthDate: { type: Date, required: true },
    numberBorn: { type: Number, required: true, min: 0 },
    // Public IDs of offspring animals that came from this litter
    offspringIds_public: { type: [Number], default: [] }, 
}, { timestamps: true });
const Litter = mongoose.model('Litter', LitterSchema);


// --- EXPORTS ---\
module.exports = {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Counter
};