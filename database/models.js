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
    bio: { type: String, default: null, trim: true },
    showBio: { type: Boolean, default: true },
    showEmailPublic: { type: Boolean, default: false },
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
    // Admin/Moderator fields for 2FA
    role: { 
        type: String, 
        enum: ['user', 'moderator', 'admin'], 
        default: 'user', 
        index: true 
    },
    adminPassword: { type: String, default: null, select: false }, // Hashed admin-only password
    last_login: { type: Date, default: null },
    last_login_ip: { type: String, default: null },
    two_factor_enabled: { type: Boolean, default: true },
    
    // Moderation tracking fields
    warningCount: { type: Number, default: 0 },
    warnings: [{
        date: { type: Date, default: Date.now },
        reason: { type: String, default: 'No reason specified' },
        category: { type: String, default: 'general' },
        moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        isLifted: { type: Boolean, default: false }
    }],
    accountStatus: { 
        type: String, 
        enum: ['normal', 'suspended', 'banned'], 
        default: 'normal',
        index: true
    },
    suspensionReason: { type: String, default: null },
    suspensionDate: { type: Date, default: null },
    suspensionExpiry: { type: Date, default: null }, // When the suspension expires
    suspensionLiftedDate: { type: Date, default: null }, // Track when suspension was lifted
    banReason: { type: String, default: null },
    banDate: { type: Date, default: null },
    banType: { type: String, enum: ['banned', 'ip-ban'], default: null },
    bannedIP: { type: String, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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
    profileImage: { type: String, default: null },
    createdAt: { type: Date, default: null }, // Member since date
    email: { type: String, default: null },
    showEmailPublic: { type: Boolean, default: false },
    websiteURL: { type: String, default: null },
    showWebsiteURL: { type: Boolean, default: false },
    bio: { type: String, default: null, trim: true },
    showBio: { type: Boolean, default: true },
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
    gender: { type: String, enum: ['Male', 'Female', 'Intersex', 'Unknown'], default: 'Unknown' },
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
    
    // Breeding History (Historical Data)
    breedingRole: { type: String, enum: ['sire', 'dam', 'both', null], default: null },
    lastMatingDate: { type: Date, default: null },
    successfulMatings: { type: Number, default: null },
    lastPregnancyDate: { type: Date, default: null },
    offspringCount: { type: Number, default: null },
    
    // Stud/Fertility fields (sire role)
    isStudAnimal: { type: Boolean, default: false },
    availableForBreeding: { type: Boolean, default: false },
    studFeeCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },
    fertilityStatus: { type: String, default: 'Unknown' },
    fertilityNotes: { type: String, default: null },
    
    // Dam/Fertility fields (dam role)
    isDamAnimal: { type: Boolean, default: false },
    damFertilityStatus: { type: String, default: 'Unknown' },
    damFertilityNotes: { type: String, default: null },
    
    // Sale fields
    isForSale: { type: Boolean, default: false },
    salePriceCurrency: { type: String, default: 'USD' },
    salePriceAmount: { type: Number, default: null },
    isInfertile: { type: Boolean, default: false },
    
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
    
    // Availability for sale/stud (for showcase)
    isForSale: { type: Boolean, default: false },
    salePriceCurrency: { type: String, default: 'USD' },
    salePriceAmount: { type: Number, default: null },
    availableForBreeding: { type: Boolean, default: false },
    studFeeCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },
    
    // Section-level privacy settings (true = public, false = private)
    sectionPrivacy: {
        geneticCode: { type: Boolean, default: true },
        lifeStage: { type: Boolean, default: true },
        currentMeasurements: { type: Boolean, default: true },
        growthHistory: { type: Boolean, default: true },
        origin: { type: Boolean, default: true },
        estrusCycle: { type: Boolean, default: true },
        mating: { type: Boolean, default: true },
        studInformation: { type: Boolean, default: true },
        damInformation: { type: Boolean, default: true },
        preventiveCare: { type: Boolean, default: true },
        proceduresAndDiagnostics: { type: Boolean, default: true },
        activeMedicalRecords: { type: Boolean, default: true },
        veterinaryCare: { type: Boolean, default: true },
        nutrition: { type: Boolean, default: true },
        husbandry: { type: Boolean, default: true },
        environment: { type: Boolean, default: true },
        behavior: { type: Boolean, default: true },
        activity: { type: Boolean, default: true },
        remarks: { type: Boolean, default: true },
        endOfLife: { type: Boolean, default: true },
        legalAdministrative: { type: Boolean, default: true },
        breedingHistory: { type: Boolean, default: true },
        currentOwner: { type: Boolean, default: true }
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
    coatPattern: { type: String, default: null },
    earset: { type: String, default: null },
    lifeStage: { type: String, default: null },
    
    // Breeder info (public)
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    
    // Availability for sale/stud (for showcase)
    isForSale: { type: Boolean, default: false },
    salePriceCurrency: { type: String, default: 'USD' },
    salePriceAmount: { type: Number, default: null },
    availableForBreeding: { type: Boolean, default: false },
    studFeeCurrency: { type: String, default: 'USD' },
    studFeeAmount: { type: Number, default: null },
    
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
    
    // Identification fields
    microchipNumber: { type: String, default: null },
    pedigreeRegistrationId: { type: String, default: null },
    breed: { type: String, default: null },
    strain: { type: String, default: null },
    
    // Origin field
    origin: { type: String, default: null },
    
    // Reproduction fields
    isNeutered: { type: Boolean, default: false },
    heatStatus: { type: String, default: null },
    lastHeatDate: { type: Date, default: null },
    ovulationDate: { type: Date, default: null },
    matingDates: { type: Date, default: null },
    expectedDueDate: { type: Date, default: null },
    litterCount: { type: Number, default: null },
    nursingStartDate: { type: Date, default: null },
    weaningDate: { type: Date, default: null },
    
    // Growth and measurement data
    growthRecords: { type: [mongoose.Schema.Types.Mixed], default: [] },
    measurementUnits: { 
        weight: { type: String, default: 'g' },
        length: { type: String, default: 'cm' }
    },
    
    // Nutrition/Husbandry/Environment fields
    dietType: { type: String, default: null },
    feedingSchedule: { type: String, default: null },
    supplements: { type: String, default: null },
    housingType: { type: String, default: null },
    bedding: { type: String, default: null },
    enrichment: { type: String, default: null },
    temperatureRange: { type: String, default: null },
    humidity: { type: String, default: null },
    lighting: { type: String, default: null },
    noise: { type: String, default: null },
    
    // Health Records (stored as JSON strings)
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
    
    // Behavior fields
    temperament: { type: String, default: null },
    handlingTolerance: { type: String, default: null },
    socialStructure: { type: String, default: null },
    activityCycle: { type: String, default: null },
    
    // End of Life fields
    causeOfDeath: { type: String, default: null },
    necropsyResults: { type: String, default: null },
    insurance: { type: String, default: null },
    legalStatus: { type: String, default: null },
    
    // Public display settings
    isDisplay: { type: Boolean, default: false }, // Main public visibility toggle
    sectionPrivacy: {
        geneticCode: { type: Boolean, default: true },
        lifeStage: { type: Boolean, default: true },
        currentMeasurements: { type: Boolean, default: true },
        growthHistory: { type: Boolean, default: true },
        origin: { type: Boolean, default: true },
        estrusCycle: { type: Boolean, default: true },
        mating: { type: Boolean, default: true },
        studInformation: { type: Boolean, default: true },
        damInformation: { type: Boolean, default: true },
        preventiveCare: { type: Boolean, default: true },
        proceduresAndDiagnostics: { type: Boolean, default: true },
        activeMedicalRecords: { type: Boolean, default: true },
        veterinaryCare: { type: Boolean, default: true },
        nutrition: { type: Boolean, default: true },
        husbandry: { type: Boolean, default: true },
        environment: { type: Boolean, default: true },
        behavior: { type: Boolean, default: true },
        activity: { type: Boolean, default: true },
        remarks: { type: Boolean, default: true },
        endOfLife: { type: Boolean, default: true },
        legalAdministrative: { type: Boolean, default: true },
        breedingHistory: { type: Boolean, default: true },
        currentOwner: { type: Boolean, default: true }
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
    
    // Optional administrative breakdown of males/females
    maleCount: { type: Number, default: null },
    femaleCount: { type: Number, default: null },
    
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
    type: { type: String, required: true, enum: ['breeder_request', 'parent_request', 'link_request', 'transfer_request', 'view_only_offer', 'transfer_accepted', 'transfer_declined', 'animal_returned', 'moderator_warning', 'moderator_message', 'account_suspended', 'account_banned', 'content_edited', 'broadcast', 'announcement'] },
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
    
    // Broadcast-specific fields
    title: { type: String, default: null },
    broadcastType: { type: String, enum: ['info', 'warning', 'alert', 'announcement', null], default: null },
    sendAt: { type: Date, default: null },
    isPending: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    
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


// --- 9. MESSAGE SCHEMA ---
const MessageSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, index: true }, // Format: "userId1_userId2" (sorted)
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who have deleted this message
}, { timestamps: true });
const Message = mongoose.model('Message', MessageSchema);


// --- 10. MESSAGE REPORT SCHEMA ---
const MessageReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }, // For single message reports
    conversationMessages: [{ // For conversation reports - stores messages from last 24 hours
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: { type: String },
        createdAt: { type: Date }
    }],
    reportType: { type: String, enum: ['message', 'conversation'], default: 'message' },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    // Assignment fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const MessageReport = mongoose.model('MessageReport', MessageReportSchema);


// --- 11. PROFILE REPORT SCHEMA ---
const ProfileReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    // Assignment fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const ProfileReport = mongoose.model('ProfileReport', ProfileReportSchema);


// --- 12. ANIMAL REPORT SCHEMA ---
const AnimalReportSchema = new mongoose.Schema({
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedAnimalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true, index: true },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'in_progress', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    // Assignment fields
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });
const AnimalReport = mongoose.model('AnimalReport', AnimalReportSchema);


// --- 13. AUDIT LOG SCHEMA ---
const AuditLogSchema = new mongoose.Schema({
    moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    moderatorEmail: { type: String, default: null },
    action: { type: String, required: true }, // e.g., 'suspend_user', 'delete_animal_image'
    targetType: { type: String, required: true }, // e.g., 'User', 'Animal', 'Message', 'system'
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // Can be null for system actions
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    targetAnimalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', default: null, index: true },
    targetName: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g., { reason: 'Inappropriate content' }
    reason: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null }
}, { timestamps: true });
const AuditLog = mongoose.model('AuditLog', AuditLogSchema);


// --- 14. USER ACTIVITY LOG SCHEMA (separate from mod audit logs) ---
const UserActivityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    id_public: { type: String, index: true }, // User's public ID for quick lookup
    action: { type: String, required: true, index: true }, // e.g., 'login', 'animal_create', 'profile_update'
    targetType: { type: String, default: null }, // e.g., 'animal', 'profile', 'litter'
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    targetId_public: { type: String, default: null }, // Public ID of target (animal, etc.)
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // Action-specific details
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null }, // For edit actions
    newValue: { type: mongoose.Schema.Types.Mixed, default: null }, // For edit actions
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    success: { type: Boolean, default: true }
}, { timestamps: true });
// Index for efficient queries by user and time
UserActivityLogSchema.index({ userId: 1, createdAt: -1 });
UserActivityLogSchema.index({ action: 1, createdAt: -1 });
const UserActivityLog = mongoose.model('UserActivityLog', UserActivityLogSchema);


// --- 15. SPECIES SCHEMA ---
const SpeciesSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true, trim: true },
    latinName: { type: String, default: null, trim: true },
    category: { type: String, required: true, index: true }, // e.g., 'Rodent', 'Reptile', etc.
    isDefault: { type: Boolean, default: false, index: true }, // Built-in species vs user-added
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // User who added custom species
    createdAt: { type: Date, default: Date.now, index: true }
});
const Species = mongoose.model('Species', SpeciesSchema);


// --- 15. SYSTEM SETTINGS SCHEMA ---
const SystemSettingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be string, boolean, number, etc.
    type: { type: String, enum: ['string', 'boolean', 'number', 'object', 'array'], required: true },
    category: { type: String, default: 'general', index: true }, // e.g., 'maintenance', 'security', 'general'
    description: { type: String, default: null },
    lastModified: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema);


// --- 16. TRANSACTION SCHEMA (for budget tracking) ---
const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['sale', 'purchase'], required: true, index: true },
    animalId: { type: String, default: null }, // id_public of the animal
    animalName: { type: String, default: null },
    price: { type: Number, required: true, default: 0 },
    date: { type: Date, required: true, index: true },
    buyer: { type: String, default: null },
    seller: { type: String, default: null },
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Transaction = mongoose.model('Transaction', TransactionSchema);


// --- 17. ANIMAL TRANSFER SCHEMA ---
const AnimalTransferSchema = new mongoose.Schema({
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    animalId_public: { type: String, required: true, index: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    transferType: { type: String, enum: ['sale', 'purchase', 'gift'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', index: true },
    offerViewOnly: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null }
}, { timestamps: true });
const AnimalTransfer = mongoose.model('AnimalTransfer', AnimalTransferSchema);


// --- 18. MOD CHAT SCHEMA ---
const ModChatSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, maxlength: 2000 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });
const ModChat = mongoose.model('ModChat', ModChatSchema);


// --- 21. SPECIES CONFIG SCHEMA (field replacements per species) ---
const SpeciesConfigSchema = new mongoose.Schema({
    speciesName: { type: String, required: true, unique: true, index: true }, // e.g., 'Mouse', 'Rat'
    // Field label replacements for this species
    fieldReplacements: {
        type: Map,
        of: String,
        default: new Map()
        // Example: { "Coat Color": "Fur Pattern", "Eye Color": "Eye Type" }
    },
    // Custom fields specific to this species
    customFields: [{
        name: { type: String, required: true },
        type: { type: String, enum: ['text', 'select', 'number', 'boolean'], default: 'text' },
        options: [{ type: String }], // For select type fields
        required: { type: Boolean, default: false },
        order: { type: Number, default: 0 }
    }],
    // Hidden fields for this species
    hiddenFields: [{ type: String }],
    // Notes for admins
    adminNotes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
const SpeciesConfig = mongoose.model('SpeciesConfig', SpeciesConfigSchema);


// --- 22. GENETICS DATA SCHEMA (calculator data per species) ---
const GeneticsDataSchema = new mongoose.Schema({
    speciesName: { type: String, required: true, index: true }, // e.g., 'Mouse', 'Rat'
    isPublished: { type: Boolean, default: false, index: true }, // Draft vs Published
    version: { type: Number, default: 1 },
    // Gene loci for this species
    genes: [{
        symbol: { type: String, required: true }, // e.g., 'A', 'B', 'C'
        name: { type: String, required: true }, // e.g., 'Agouti', 'Brown', 'Albino'
        description: { type: String, default: null },
        order: { type: Number, default: 0 },
        // Allele combinations for this gene
        alleles: [{
            notation: { type: String, required: true }, // e.g., 'A/A', 'A/a', 'a/a'
            phenotype: { type: String, default: null }, // e.g., 'Agouti', 'Carrier', 'Non-agouti'
            isLethal: { type: Boolean, default: false }, // e.g., Ay/Ay
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant', 'incomplete'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }]
    }],
    // Phenotype calculation rules (for complex interactions)
    phenotypeRules: [{
        name: { type: String, required: true }, // e.g., 'Black'
        conditions: { type: mongoose.Schema.Types.Mixed }, // JSON conditions
        priority: { type: Number, default: 0 }
    }],
    // Marking genes (separate category)
    markingGenes: [{
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        alleles: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            order: { type: Number, default: 0 }
        }]
    }],
    // Admin notes and metadata
    adminNotes: { type: String, default: null },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
// Compound index for species + published status
GeneticsDataSchema.index({ speciesName: 1, isPublished: 1 });
const GeneticsData = mongoose.model('GeneticsData', GeneticsDataSchema);


// --- EXPORTS ---
module.exports = {
    Counter,
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Notification,
    GeneticsFeedback,
    BugReport,
    Message,
    MessageReport,
    ProfileReport,
    AnimalReport,
    AuditLog,
    UserActivityLog,
    SystemSettings,
    Species,
    SpeciesConfig,
    GeneticsData,
    Transaction,
    AnimalTransfer,
    ModChat
};