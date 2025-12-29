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
    id_public: { type: String, required: false, unique: true, sparse: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Password MUST be selected manually in queries or explicitly included in update handlers
    password: { type: String, required: true, select: false }, 
    personalName: { type: String, required: true, trim: true },
    showPersonalName: { type: Boolean, default: false },
    profileImage: { type: String, default: null },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    websiteURL: { type: String, default: null },
    showWebsiteURL: { type: Boolean, default: false },
    showEmailPublic: { type: Boolean, default: false },
    showGeneticCodePublic: { type: Boolean, default: false },
    showRemarksPublic: { type: Boolean, default: false },
    creationDate: { type: Date, default: Date.now },
    // Email verification
    emailVerified: { type: Boolean, default: false },
    verificationCode: { type: String, default: null, select: false },
    verificationCodeExpires: { type: Date, default: null, select: false },
    // Password reset
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
    // Array of internal Animal and Litter IDs owned by this user for easy lookup
    ownedAnimals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Animal' }], 
    ownedLitters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Litter' }],
    // Messaging preferences
    allowMessages: { type: Boolean, default: true },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users blocked from messaging
    // Email notification preferences
    emailNotificationPreference: { 
        type: String, 
        enum: ['none', 'all', 'requestsOnly', 'messagesOnly'],
        default: 'none' 
    },
    // User location
    country: { type: String, default: null },
});
const User = mongoose.model('User', UserSchema);


// --- 3. PUBLIC PROFILE SCHEMA (View-Only/Searchable Data) ---
const PublicProfileSchema = new mongoose.Schema({
    userId_backend: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id_public: { type: String, required: true, unique: true, index: true },
    personalName: { type: String, required: true, trim: true },
    showPersonalName: { type: Boolean, default: false },
    breederName: { type: String, default: null, trim: true },
    showBreederName: { type: Boolean, default: false },
    showGeneticCodePublic: { type: Boolean, default: false },
    showRemarksPublic: { type: Boolean, default: false },
    profileImage: { type: String, default: null },
    createdAt: { type: Date, default: null }, // Member since date
    email: { type: String, default: null },
    showEmailPublic: { type: Boolean, default: false },
    websiteURL: { type: String, default: null },
    showWebsiteURL: { type: Boolean, default: false },
    allowMessages: { type: Boolean, default: true },
    emailNotificationPreference: { 
        type: String, 
        enum: ['none', 'all', 'requestsOnly', 'messagesOnly'],
        default: 'none' 
    },
    country: { type: String, default: null },
    completedTutorials: { type: [String], default: [] }, // Array of completed tutorial IDs
    hasCompletedOnboarding: { type: Boolean, default: false }, // Track if user completed initial onboarding
    hasCompletedAdvancedFeatures: { type: Boolean, default: false }, // Track if user completed advanced features
    hasSeenWelcomeBanner: { type: Boolean, default: false }, // Track if user has dismissed the welcome banner
}, { timestamps: true });
const PublicProfile = mongoose.model('PublicProfile', PublicProfileSchema, 'publicprofiles');


// --- 4. ANIMAL SCHEMA (Private Data) ---
const AnimalSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerId_public: { type: String, required: true }, // Denormalized public owner ID
    id_public: { type: String, required: true, unique: true, index: true }, // The unique public Animal ID
    
    // Transfer/Ownership tracking
    originalOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Original breeder/creator
    soldStatus: { type: String, enum: [null, 'sold', 'purchased'], default: null }, // null = not transferred
    viewOnlyForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users with view-only access
    hiddenForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who have hidden this view-only animal
    
    // Key display data
    species: { type: String, required: true },
    prefix: { type: String, default: null },
    suffix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Unknown'], default: 'Unknown' },
    birthDate: { type: Date, default: Date.now },
    deceasedDate: { type: Date, default: null },
    breederyId: { type: String, default: null },
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    earset: { type: String, default: null },
    
    // Breeder and owner info
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder (user)
    ownerName: { type: String, default: null }, // Custom owner name (only for local view)
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    
    // Tags for local organization (lines, enclosures, etc)
    tags: [{ type: String, trim: true }],
    
    // Image URLs (optional)
    imageUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },

    // Lineage linking (Links to the public ID of the ancestor)
    sireId_public: { type: String, default: null },
    damId_public: { type: String, default: null },
    
    // Optional Litter link (Links to the internal ID of the litter)
    litterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Litter', default: null },

    // SENSITIVE/OPTIONAL DATA (Default to private)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
    // Tab 2: Status & Privacy Fields
    currentOwner: { type: String, default: null },
    ownershipHistory: [{
        name: { type: String },
        startDate: { type: String },
        endDate: { type: String, default: null }
    }],
    
    // Tab 3: Physical Profile Fields
    coatPattern: { type: String, default: null },
    lifeStage: { type: String, default: null },
    
    // Tab 4: Identification Fields
    microchipNumber: { type: String, default: null },
    pedigreeRegistrationId: { type: String, default: null },
    breed: { type: String, default: null },
    strain: { type: String, default: null },
    
    // Tab 5: Lineage & Origin Fields
    origin: { type: String, default: 'Captive-bred' },
    
    // Tab 6: Reproduction & Breeding Fields
    isNeutered: { type: Boolean, default: false },
    heatStatus: { type: String, default: null },
    lastHeatDate: { type: Date, default: null },
    ovulationDate: { type: Date, default: null },
    matingDates: { type: String, default: null },
    expectedDueDate: { type: Date, default: null },
    litterCount: { type: String, default: null },
    nursingStartDate: { type: Date, default: null },
    weaningDate: { type: Date, default: null },
    
    // Tab 7: Health & Veterinary Fields
    vaccinations: { type: String, default: null },
    dewormingRecords: { type: String, default: null },
    parasiteControl: { type: String, default: null },
    medicalConditions: { type: String, default: null },
    allergies: { type: String, default: null },
    medications: { type: String, default: null },
    medicalProcedures: { type: String, default: null },
    labResults: { type: String, default: null },
    vetVisits: { type: String, default: null },
    primaryVet: { type: String, default: null },
    
    // Tab 8: Nutrition & Husbandry Fields
    dietType: { type: String, default: null },
    feedingSchedule: { type: String, default: null },
    supplements: { type: String, default: null },
    housingType: { type: String, default: null },
    bedding: { type: String, default: null },
    temperatureRange: { type: String, default: null },
    humidity: { type: String, default: null },
    lighting: { type: String, default: null },
    noise: { type: String, default: null },
    enrichment: { type: String, default: null },
    
    // Tab 9: Behavior & Welfare Fields
    temperament: { type: String, default: null },
    handlingTolerance: { type: String, default: null },
    socialStructure: { type: String, default: null },
    activityCycle: { type: String, default: null },
    
    // Tab 11: End of Life & Legal Fields
    causeOfDeath: { type: String, default: null },
    necropsyResults: { type: String, default: null },
    insurance: { type: String, default: null },
    legalStatus: { type: String, default: null },
    
    // Growth tracking
    growthRecords: [{ 
        id: { type: String },
        date: { type: String },
        weight: { type: String },
        length: { type: String },
        bcs: { type: String },
        notes: { type: String }
    }],
    measurementUnits: {
        weight: { type: String, default: 'g' },
        length: { type: String, default: 'cm' }
    },
    
    // Inbreeding coefficient (cached value)
    inbreedingCoefficient: { type: Number, default: null },
    
    // Public visibility toggles
    showOnPublicProfile: { type: Boolean, default: false, index: true },
    isDisplay: { type: Boolean, default: false }, // Main toggle for public profile visibility
    includeRemarks: { type: Boolean, default: false }, // If public, include remarks
    includeGeneticCode: { type: Boolean, default: false }, // If public, include genetic code
    
    // Section-level privacy settings (true = public, false = private)
    sectionPrivacy: {
        appearance: { type: Boolean, default: true },
        identification: { type: Boolean, default: true },
        health: { type: Boolean, default: true },
        reproductive: { type: Boolean, default: true },
        genetics: { type: Boolean, default: true },
        husbandry: { type: Boolean, default: true },
        behavior: { type: Boolean, default: true },
        records: { type: Boolean, default: true },
        endOfLife: { type: Boolean, default: true },
        remarks: { type: Boolean, default: true },
        owner: { type: Boolean, default: true },
        lifeStage: { type: Boolean, default: true },
        measurements: { type: Boolean, default: true },
        origin: { type: Boolean, default: true },
        medicalHistory: { type: Boolean, default: true },
        environment: { type: Boolean, default: true },
        activity: { type: Boolean, default: true }
    },

}, { timestamps: true });
const Animal = mongoose.model('Animal', AnimalSchema);


// --- 5. PUBLIC ANIMAL SCHEMA (Shared/View-Only Data) ---
const PublicAnimalSchema = new mongoose.Schema({
    ownerId_public: { type: String, required: true, index: true }, // The public owner link
    id_public: { type: String, required: true, unique: true, index: true }, // The unique public Animal ID
    
    // Key display data
    species: { type: String, required: true },
    prefix: { type: String, default: null },
    suffix: { type: String, default: null },
    name: { type: String, required: true },
    gender: { type: String },
    birthDate: { type: Date },
    deceasedDate: { type: Date, default: null },
    breederyId: { type: String, default: null },
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    earset: { type: String, default: null },
    
    // Breeder info (public)
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    
    // Tags for local organization (lines, enclosures, etc)
    tags: [{ type: String, trim: true }],

    // Public-facing image URLs
    imageUrl: { type: String, default: null },
    photoUrl: { type: String, default: null },

    // Lineage linking (Links to the public ID of the ancestor)
    sireId_public: { type: String, default: null },
    damId_public: { type: String, default: null },
    
    // SENSITIVE/OPTIONAL DATA (Copied if toggled on)
    remarks: { type: String, default: '' },
    geneticCode: { type: String, default: null },
    
    // Public display settings
    isDisplay: { type: Boolean, default: false }, // Main public visibility toggle
    sectionPrivacy: {
        appearance: { type: Boolean, default: true },
        identification: { type: Boolean, default: true },
        health: { type: Boolean, default: true },
        reproductive: { type: Boolean, default: true },
        genetics: { type: Boolean, default: true },
        husbandry: { type: Boolean, default: true },
        behavior: { type: Boolean, default: true },
        records: { type: Boolean, default: true },
        endOfLife: { type: Boolean, default: true },
        remarks: { type: Boolean, default: true },
        owner: { type: Boolean, default: true },
        lifeStage: { type: Boolean, default: true },
        measurements: { type: Boolean, default: true },
        origin: { type: Boolean, default: true },
        medicalHistory: { type: Boolean, default: true },
        environment: { type: Boolean, default: true },
        activity: { type: Boolean, default: true }
    },
    
    // Inbreeding coefficient (cached value)
    inbreedingCoefficient: { type: Number, default: null },
    
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
    sireId_public: { type: String, default: null },
    sirePrefixName: { type: String, default: null }, // Denormalized for display
    damId_public: { type: String, default: null },
    damPrefixName: { type: String, default: null }, // Denormalized for display
    
    pairingDate: { type: Date, default: null },
    birthDate: { type: Date, required: true },
    numberBorn: { type: Number, required: true, min: 0 },
    
    // Public IDs of offspring animals that came from this litter
    offspringIds_public: { type: [String], default: [] }, 
    
    // Inbreeding coefficient for this pairing (cached value)
    inbreedingCoefficient: { type: Number, default: null },
    
    // Remarks specific to the litter
    notes: { type: String, default: '' },
    
}, { timestamps: true });
const Litter = mongoose.model('Litter', LitterSchema);


// --- 6. NOTIFICATION SCHEMA ---
const NotificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userId_public: { type: String, index: true },
    type: { type: String, required: true, enum: ['breeder_request', 'parent_request', 'link_request', 'transfer_request', 'view_only_offer', 'transfer_accepted', 'transfer_declined', 'animal_returned'] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    
    // Request details
    requestedBy_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedBy_public: { type: String },
    requestedBy_name: { type: String, default: '' }, // Requester's personal or breeder name
    animalId_public: { type: String },
    animalName: { type: String },
    animalPrefix: { type: String, default: '' }, // Animal prefix
    animalImageUrl: { type: String, default: '' }, // Animal thumbnail
    
    // For parent requests: which parent (sire/dam)
    parentType: { type: String, enum: ['sire', 'dam', null], default: null },
    targetAnimalId_public: { type: String, default: null }, // The animal being used as parent
    
    // For transfer notifications
    transferId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnimalTransfer', default: null },
    
    // Metadata
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    message: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
    
}, { timestamps: true });
const Notification = mongoose.model('Notification', NotificationSchema);


// --- 7. GENETICS FEEDBACK SCHEMA ---
const GeneticsFeedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    phenotype: { type: String, required: true },
    genotype: { type: String, required: true },
    feedback: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    adminNotes: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const GeneticsFeedback = mongoose.model('GeneticsFeedback', GeneticsFeedbackSchema);


// --- 8. BUG REPORT SCHEMA ---
const BugReportSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['Bug', 'Feature Request', 'General Feedback'], 
        required: true 
    },
    description: { type: String, required: true },
    page: { type: String, default: null },
    status: { 
        type: String, 
        enum: ['pending', 'in-progress', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    adminNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const BugReport = mongoose.model('BugReport', BugReportSchema);


// --- 9. SPECIES SCHEMA (Global Species List) ---
const SpeciesSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, index: true },
    latinName: { type: String, default: null }, // Scientific name
    category: { 
        type: String, 
        enum: ['Rodent', 'Mammal', 'Reptile', 'Bird', 'Amphibian', 'Fish', 'Invertebrate', 'Other'], 
        default: 'Other',
        index: true 
    },
    isDefault: { type: Boolean, default: false, index: true },
    createdBy_public: { type: String, default: null }, // User ID who created this species (null for defaults)
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Species = mongoose.model('Species', SpeciesSchema);


// --- TRANSACTION SCHEMA (Budget Tracking) ---
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['sale', 'purchase'], required: true, index: true },
    animalId: { type: String, default: null }, // Public ID of the animal (optional)
    animalName: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, index: true },
    buyer: { type: String, default: null }, // For sales
    seller: { type: String, default: null }, // For purchases
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Buyer's user ID (for transfers)
    sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Seller's user ID (for transfers)
    notes: { type: String, default: null }
}, { timestamps: true });
const Transaction = mongoose.model('Transaction', TransactionSchema);


// --- ANIMAL TRANSFER SCHEMA (Ownership Transfers) ---
const AnimalTransferSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    animalId_public: { type: String, required: true, index: true }, // Public ID of the animal
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    transferType: { type: String, enum: ['sale', 'purchase'], required: true }, // sale = seller initiated, purchase = buyer initiated
    status: { 
        type: String, 
        enum: ['pending', 'accepted', 'declined'], 
        default: 'pending',
        index: true 
    },
    offerViewOnly: { type: Boolean, default: false }, // For purchases - offer seller view-only access
    createdAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null }
}, { timestamps: true });
const AnimalTransfer = mongoose.model('AnimalTransfer', AnimalTransferSchema);


// --- 12. MESSAGE SCHEMA ---
const MessageSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, index: true }, // Format: smaller_userId_larger_userId
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, maxlength: 5000 },
    read: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who deleted this message from their view
}, { timestamps: true });
MessageSchema.index({ conversationId: 1, createdAt: -1 }); // Efficient conversation queries
const Message = mongoose.model('Message', MessageSchema);


// --- 13. MESSAGE REPORT SCHEMA ---
const MessageReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    reason: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
}, { timestamps: true });
const MessageReport = mongoose.model('MessageReport', MessageReportSchema);


// --- EXPORTS ---
module.exports = {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Notification,
    GeneticsFeedback,
    BugReport,
    Counter,
    Species,
    Transaction,
    AnimalTransfer,
    Message,
    MessageReport
};