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
    state: { type: String, default: null }, // US state code when country === 'US'
    // Breeding status for species (for breeder directory)
    breedingStatus: { 
        type: Map, 
        of: String, // Values: 'breeder', 'retired', 'hobbyist', or null
        default: new Map()
    },
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
    state: { type: String, default: null }, // US state code when country === 'US'
    breedingStatus: { 
        type: Map, 
        of: String, // Values: 'breeder', 'retired', 'hobbyist', or null
        default: new Map()
    },
    completedTutorials: { type: [String], default: [] }, // Array of completed tutorial IDs
    hasCompletedOnboarding: { type: Boolean, default: false }, // Track if user completed initial onboarding
    hasCompletedAdvancedFeatures: { type: Boolean, default: false }, // Track if user completed advanced features
    hasSeenWelcomeBanner: { type: Boolean, default: false }, // Track if user has dismissed the welcome banner
    hasSeenProfileSetupGuide: { type: Boolean, default: false }, // Track if user has seen the one-time profile setup guide
    speciesOrder: { type: [String], default: [] }, // User's custom order for species display
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
    breederAssignedId: { type: String, default: null },
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    earset: { type: String, default: null },
    
    // Breeder and owner info
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder (user)
    manualBreederName: { type: String, default: null }, // Manual breeder name when no user is selected
    ownerName: { type: String, default: null }, // Custom owner name (only for local view)
    
    // Ownership and breeding status
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    isQuarantine: { type: Boolean, default: false }, // Animal is in quarantine/isolation

    // Feeding schedule tracking (for Management view)
    lastFedDate: { type: Date, default: null },
    feedingFrequencyDays: { type: Number, default: null }, // Feed every N days

    // Maintenance schedule tracking (for Management view)
    lastMaintenanceDate: { type: Date, default: null },
    maintenanceFrequencyDays: { type: Number, default: null }, // Maintenance every N days

    // Flexible per-animal care tasks (nail trim, weight check, health check, etc.)
    careTasks: [{
        taskName: { type: String, required: true, trim: true },
        lastDoneDate: { type: Date, default: null },
        frequencyDays: { type: Number, default: null },
    }],
    
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
    currentOwnerDisplay: { type: String, default: null }, // Display name for current owner
    groupRole: { type: String, default: null }, // Role in group/colony (e.g., alpha, beta, omega)
    ownershipHistory: [{
        name: { type: String },
        startDate: { type: String },
        endDate: { type: String, default: null }
    }],
    
    // Tab 3: Physical Profile Fields
    coatPattern: { type: String, default: null },
    lifeStage: { type: String, default: null },
    carrierTraits: { type: String, default: null }, // Genetic traits the animal carries
    // Universal animal appearance fields
    phenotype: { type: String, default: null }, // Observable traits
    morph: { type: String, default: null }, // Mutation/Morph (esp. reptiles/invertebrates)
    markings: { type: String, default: null }, // Body markings/patterns
    eyeColor: { type: String, default: null }, // Eye color
    nailColor: { type: String, default: null }, // Nail/claw color (mammals)
    // Current measurements (snapshot - growth records track history)
    weight: { type: String, default: null }, // Current weight
    length: { type: String, default: null }, // Current length/wingspan/snout-vent length
    // Physical measurements (Dog/Cat specific)
    heightAtWithers: { type: String, default: null },
    bodyLength: { type: String, default: null },
    chestGirth: { type: String, default: null },
    adultWeight: { type: String, default: null },
    bodyConditionScore: { type: String, default: null }, // 1-9 canine / 1-5 feline
    
    // Tab 4: Identification Fields
    microchipNumber: { type: String, default: null },
    pedigreeRegistrationId: { type: String, default: null },
    colonyId: { type: String, default: null }, // Colony or group identifier
    breed: { type: String, default: null },
    strain: { type: String, default: null }, // "Bloodline" for dogs/cats
    // Dog/Cat specific identification
    licenseNumber: { type: String, default: null },
    licenseJurisdiction: { type: String, default: null },
    rabiesTagNumber: { type: String, default: null },
    tattooId: { type: String, default: null },
    akcRegistrationNumber: { type: String, default: null },
    fciRegistrationNumber: { type: String, default: null },
    cfaRegistrationNumber: { type: String, default: null },
    workingRegistryIds: { type: String, default: null }, // herding, hunting, service
    
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
    litterSizeBorn: { type: Number, default: null }, // Number of offspring born
    litterSizeWeaned: { type: Number, default: null }, // Number of offspring successfully weaned
    stillbornCount: { type: Number, default: null }, // Number of stillborn offspring
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
    // Dog/Cat specific reproduction fields
    estrusCycleLength: { type: Number, default: null }, // days
    gestationLength: { type: Number, default: null }, // days
    artificialInseminationUsed: { type: Boolean, default: null },
    whelpingDate: { type: Date, default: null }, // Dog delivery
    queeningDate: { type: Date, default: null }, // Cat delivery
    deliveryMethod: { type: String, default: null }, // Natural, C-section
    reproductiveComplications: { type: String, default: null },
    reproductiveClearances: { type: String, default: null },
    
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
    // Dog/Cat specific health fields
    spayNeuterDate: { type: Date, default: null },
    parasitePreventionSchedule: { type: String, default: null },
    heartwormStatus: { type: String, default: null },
    hipElbowScores: { type: String, default: null },
    geneticTestResults: { type: String, default: null },
    eyeClearance: { type: String, default: null },
    cardiacClearance: { type: String, default: null },
    dentalRecords: { type: String, default: null },
    chronicConditions: { type: String, default: null },
    
    // Tab 8: Nutrition & Husbandry Fields
    dietType: { type: String, default: null },
    feedingSchedule: { type: String, default: null },
    supplements: { type: String, default: null },
    housingType: { type: String, default: null },
    enclosureId: { type: String, default: null }, // References Enclosure._id
    bedding: { type: String, default: null },
    temperatureRange: { type: String, default: null },
    humidity: { type: String, default: null },
    lighting: { type: String, default: null },
    noise: { type: String, default: null },
    enrichment: { type: String, default: null },
    // Dog/Cat specific husbandry
    exerciseRequirements: { type: String, default: null },
    dailyExerciseMinutes: { type: Number, default: null },
    groomingNeeds: { type: String, default: null },
    sheddingLevel: { type: String, default: null },
    crateTrained: { type: Boolean, default: null },
    litterTrained: { type: Boolean, default: null },
    leashTrained: { type: Boolean, default: null },
    
    // Tab 9: Behavior & Welfare Fields
    temperament: { type: String, default: null },
    handlingTolerance: { type: String, default: null },
    socialStructure: { type: String, default: null },
    activityCycle: { type: String, default: null },
    // Dog/Cat specific training & behavior
    trainingLevel: { type: String, default: null },
    trainingDisciplines: { type: String, default: null },
    certifications: { type: String, default: null },
    workingRole: { type: String, default: null },
    behavioralIssues: { type: String, default: null },
    biteHistory: { type: String, default: null },
    reactivityNotes: { type: String, default: null },
    
    // Tab 10: Show Tab (Universal for all species)
    showTitles: { type: String, default: null },
    showRatings: { type: String, default: null },
    judgeComments: { type: String, default: null },
    workingTitles: { type: String, default: null },
    performanceScores: { type: String, default: null },
    
    // Tab 11: End of Life & Legal Fields
    causeOfDeath: { type: String, default: null },
    necropsyResults: { type: String, default: null },
    insurance: { type: String, default: null },
    legalStatus: { type: String, default: null },
    endOfLifeCareNotes: { type: String, default: null }, // Dog/Cat specific
    // Legal & Ownership extensions (Dog/Cat specific)
    coOwnership: { type: String, default: null },
    transferHistory: { type: String, default: null },
    breedingRestrictions: { type: String, default: null },
    exportRestrictions: { type: String, default: null },
    
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
        currentOwner: { type: Boolean, default: true },
        showTab: { type: Boolean, default: true } // Show titles, ratings, performance
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
    breederAssignedId: { type: String, default: null },
    status: { type: String, default: 'Pet' },
    color: { type: String, default: null },
    coat: { type: String, default: null },
    coatPattern: { type: String, default: null },
    earset: { type: String, default: null },
    lifeStage: { type: String, default: null },
    carrierTraits: { type: String, default: null }, // Genetic traits the animal carries
    // Universal animal appearance fields
    phenotype: { type: String, default: null },
    morph: { type: String, default: null },
    markings: { type: String, default: null },
    eyeColor: { type: String, default: null },
    nailColor: { type: String, default: null },
    // Current measurements
    weight: { type: String, default: null },
    length: { type: String, default: null },
    
    // Breeder info (public)
    breederId_public: { type: String, default: null, index: true }, // Public ID of the breeder
    manualBreederName: { type: String, default: null }, // Manual breeder name when no user is selected
    
    // Ownership and breeding status
    currentOwnerDisplay: { type: String, default: null }, // Display name for current owner
    groupRole: { type: String, default: null }, // Role in group/colony
    isOwned: { type: Boolean, default: true },
    isPregnant: { type: Boolean, default: false },
    isNursing: { type: Boolean, default: false },
    isInMating: { type: Boolean, default: false },
    isQuarantine: { type: Boolean, default: false }, // Animal is in quarantine/isolation

    // Feeding schedule tracking (for Management view)
    lastFedDate: { type: Date, default: null },
    feedingFrequencyDays: { type: Number, default: null },

    // Maintenance schedule tracking (for Management view)
    lastMaintenanceDate: { type: Date, default: null },
    maintenanceFrequencyDays: { type: Number, default: null },
    
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
    colonyId: { type: String, default: null }, // Colony or group identifier
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
    litterSizeBorn: { type: Number, default: null }, // Number of offspring born
    litterSizeWeaned: { type: Number, default: null }, // Number of offspring successfully weaned
    stillbornCount: { type: Number, default: null }, // Number of stillborn offspring
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
    enclosureId: { type: String, default: null }, // References Enclosure._id
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
    type: { type: String, required: true, enum: ['breeder_request', 'parent_request', 'link_request', 'transfer_request', 'view_only_offer', 'transfer_accepted', 'transfer_declined', 'animal_returned', 'moderator_warning', 'moderator_message', 'account_suspended', 'account_banned', 'content_edited', 'broadcast', 'announcement', 'marketplace_inquiry'] },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'read'], default: 'pending', index: true },
    
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
    broadcastType: { type: String, enum: ['info', 'warning', 'alert', 'announcement', 'poll', null], default: null },
    sendAt: { type: Date, default: null },
    isPending: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    
    // Poll-specific fields
    pollQuestion: { type: String, default: null },
    pollOptions: [{
        text: { type: String, required: true },
        votes: { type: Number, default: 0 },
        voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    pollEndsAt: { type: Date, default: null },
    allowMultipleChoices: { type: Boolean, default: false },
    isAnonymous: { type: Boolean, default: false },
    userVote: { type: mongoose.Schema.Types.Mixed, default: null }, // For user-specific vote tracking
    
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


// --- 9. FEEDBACK SCHEMA (General Feedback: Species, UI, etc.) ---
const FeedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userIdPublic: { type: String, required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    species: { type: String, default: null },
    feedback: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['species-customization', 'ui-feedback', 'feature-request', 'general'], 
        default: 'general' 
    },
    status: { 
        type: String, 
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'], 
        default: 'pending',
        index: true 
    },
    adminNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Feedback = mongoose.model('Feedback', FeedbackSchema);


// --- 10. MESSAGE SCHEMA ---
const MessageSchema = new mongoose.Schema({
    conversationId: { type: String, required: true, index: true }, // Format: "userId1_userId2" (sorted)
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who have deleted this message
    // Moderator message fields
    isModeratorMessage: { type: Boolean, default: false, index: true }, // Flag for admin/mod initiated conversations
    senderRole: { type: String, enum: ['user', 'moderator', 'admin', null], default: null }, // Role of sender if mod/admin
    sentBy: { type: String, default: null }, // Public ID of sender for internal logging (CTU-XXX)
    displayName: { type: String, default: null }, // What users see: "Admin" or "Moderator"
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
    adminNotes: { type: String, default: null }, // Legacy single note field
    discussionNotes: [{
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null }
    }],
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
    adminNotes: { type: String, default: null }, // Legacy single note field
    discussionNotes: [{
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null }
    }],
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
    adminNotes: { type: String, default: null }, // Legacy single note field
    discussionNotes: [{
        text: { type: String, required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        editedAt: { type: Date, default: null }
    }],
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


// --- 14.5. FIELD TEMPLATE SCHEMA ---
// Defines reusable field configurations for species forms
// This separates biological taxonomy from UI field requirements
const FieldTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true, trim: true }, // e.g., 'Full Mammal Template', 'Small Mammal Template'
    description: { type: String, default: null }, // Description of what this template is for
    isDefault: { type: Boolean, default: false, index: true }, // System default templates vs custom
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // User who created custom template
    
    // Field configuration - defines what fields appear in forms and with what labels/requirements
    // Structure: { enabled: Boolean, label: String, required: Boolean }
    fields: {
        // ===== TAB 1: OVERVIEW / IDENTITY =====
        // Core identity fields (always required, not configurable)
        prefix: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Prefix' },
            required: { type: Boolean, default: false }
        },
        suffix: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Suffix' },
            required: { type: Boolean, default: false }
        },
        breederAssignedId: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breeder ID' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 2: OWNERSHIP =====
        currentOwner: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Current Owner' },
            required: { type: Boolean, default: false }
        },
        ownershipHistory: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Ownership History' },
            required: { type: Boolean, default: false }
        },
        isOwned: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Owned by Me' },
            required: { type: Boolean, default: false }
        },
        manualBreederName: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breeder Name (Manual)' },
            required: { type: Boolean, default: false }
        },
        currentOwnerDisplay: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Current Owner Display' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 3: PHYSICAL PROFILE =====
        color: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Color' },
            required: { type: Boolean, default: false }
        },
        coat: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Coat Type' },
            required: { type: Boolean, default: false }
        },
        earset: { 
            enabled: { type: Boolean, default: false }, // Specific to rats/mice
            label: { type: String, default: 'Earset' },
            required: { type: Boolean, default: false }
        },
        coatPattern: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Pattern' },
            required: { type: Boolean, default: false }
        },
        eyeColor: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Eye Color' },
            required: { type: Boolean, default: false }
        },
        nailColor: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Nail/Claw Color' },
            required: { type: Boolean, default: false }
        },
        lifeStage: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Life Stage' },
            required: { type: Boolean, default: false }
        },
        heightAtWithers: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats/horses
            label: { type: String, default: 'Height at Withers' },
            required: { type: Boolean, default: false }
        },
        bodyLength: { 
            enabled: { type: Boolean, default: false },
            label: { type: String, default: 'Body Length' },
            required: { type: Boolean, default: false }
        },
        chestGirth: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Chest Girth' },
            required: { type: Boolean, default: false }
        },
        adultWeight: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Adult Weight' },
            required: { type: Boolean, default: false }
        },
        bodyConditionScore: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Body Condition Score' },
            required: { type: Boolean, default: false }
        },
        weight: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Weight' },
            required: { type: Boolean, default: false }
        },
        length: { 
            enabled: { type: Boolean, default: false }, // Reptiles, fish
            label: { type: String, default: 'Length' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 4: IDENTIFICATION =====
        microchipNumber: { 
            enabled: { type: Boolean, default: false }, // Larger mammals
            label: { type: String, default: 'Microchip #' },
            required: { type: Boolean, default: false }
        },
        pedigreeRegistrationId: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Pedigree Registration #' },
            required: { type: Boolean, default: false }
        },
        colonyId: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Colony ID' },
            required: { type: Boolean, default: false }
        },
        breed: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breed' },
            required: { type: Boolean, default: false }
        },
        strain: { 
            enabled: { type: Boolean, default: false }, // Lab animals/rodents
            label: { type: String, default: 'Strain' },
            required: { type: Boolean, default: false }
        },
        licenseNumber: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'License Number' },
            required: { type: Boolean, default: false }
        },
        licenseJurisdiction: { 
            enabled: { type: Boolean, default: false },
            label: { type: String, default: 'License Jurisdiction' },
            required: { type: Boolean, default: false }
        },
        rabiesTagNumber: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Rabies Tag #' },
            required: { type: Boolean, default: false }
        },
        tattooId: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Tattoo ID' },
            required: { type: Boolean, default: false }
        },
        akcRegistrationNumber: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'AKC Registration #' },
            required: { type: Boolean, default: false }
        },
        fciRegistrationNumber: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'FCI Registration #' },
            required: { type: Boolean, default: false }
        },
        cfaRegistrationNumber: { 
            enabled: { type: Boolean, default: false }, // Cats
            label: { type: String, default: 'CFA Registration #' },
            required: { type: Boolean, default: false }
        },
        workingRegistryIds: { 
            enabled: { type: Boolean, default: false }, // Working dogs
            label: { type: String, default: 'Working Registry IDs' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 5: LINEAGE & ORIGIN =====
        origin: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Origin' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 6: REPRODUCTION & BREEDING =====
        isNeutered: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Neutered/Spayed' },
            required: { type: Boolean, default: false }
        },
        spayNeuterDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Spay/Neuter Date' },
            required: { type: Boolean, default: false }
        },
        heatStatus: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Heat Status' },
            required: { type: Boolean, default: false }
        },
        lastHeatDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Last Heat Date' },
            required: { type: Boolean, default: false }
        },
        ovulationDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Ovulation Date' },
            required: { type: Boolean, default: false }
        },
        matingDates: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Mating Dates' },
            required: { type: Boolean, default: false }
        },
        expectedDueDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Expected Due Date' },
            required: { type: Boolean, default: false }
        },
        litterCount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Litter Count' },
            required: { type: Boolean, default: false }
        },
        nursingStartDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Nursing Start Date' },
            required: { type: Boolean, default: false }
        },
        weaningDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Weaning Date' },
            required: { type: Boolean, default: false }
        },
        breedingRole: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Breeding Role' },
            required: { type: Boolean, default: false }
        },
        lastMatingDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Last Mating Date' },
            required: { type: Boolean, default: false }
        },
        successfulMatings: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Successful Matings' },
            required: { type: Boolean, default: false }
        },
        lastPregnancyDate: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Last Pregnancy Date' },
            required: { type: Boolean, default: false }
        },
        offspringCount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Offspring Count' },
            required: { type: Boolean, default: false }
        },
        isStudAnimal: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Stud Animal' },
            required: { type: Boolean, default: false }
        },
        availableForBreeding: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Available for Breeding' },
            required: { type: Boolean, default: false }
        },
        studFeeCurrency: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Stud Fee Currency' },
            required: { type: Boolean, default: false }
        },
        studFeeAmount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Stud Fee Amount' },
            required: { type: Boolean, default: false }
        },
        fertilityStatus: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Fertility Status' },
            required: { type: Boolean, default: false }
        },
        fertilityNotes: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Fertility Notes' },
            required: { type: Boolean, default: false }
        },
        isDamAnimal: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Dam Animal' },
            required: { type: Boolean, default: false }
        },
        damFertilityStatus: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Dam Fertility Status' },
            required: { type: Boolean, default: false }
        },
        damFertilityNotes: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Dam Fertility Notes' },
            required: { type: Boolean, default: false }
        },
        estrusCycleLength: { 
            enabled: { type: Boolean, default: false }, // Mammals
            label: { type: String, default: 'Estrus Cycle Length (days)' },
            required: { type: Boolean, default: false }
        },
        gestationLength: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Gestation Length (days)' },
            required: { type: Boolean, default: false }
        },
        artificialInseminationUsed: { 
            enabled: { type: Boolean, default: false }, // Larger mammals
            label: { type: String, default: 'Artificial Insemination Used' },
            required: { type: Boolean, default: false }
        },
        whelpingDate: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Whelping Date' },
            required: { type: Boolean, default: false }
        },
        queeningDate: { 
            enabled: { type: Boolean, default: false }, // Cats
            label: { type: String, default: 'Queening Date' },
            required: { type: Boolean, default: false }
        },
        deliveryMethod: { 
            enabled: { type: Boolean, default: false }, // Larger mammals
            label: { type: String, default: 'Delivery Method' },
            required: { type: Boolean, default: false }
        },
        reproductiveComplications: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Reproductive Complications' },
            required: { type: Boolean, default: false }
        },
        reproductiveClearances: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Reproductive Clearances' },
            required: { type: Boolean, default: false }
        },
        isForSale: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'For Sale' },
            required: { type: Boolean, default: false }
        },
        salePriceCurrency: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Sale Price Currency' },
            required: { type: Boolean, default: false }
        },
        salePriceAmount: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Sale Price Amount' },
            required: { type: Boolean, default: false }
        },
        isInfertile: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Infertile' },
            required: { type: Boolean, default: false }
        },
        isPregnant: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Pregnant' },
            required: { type: Boolean, default: false }
        },
        isNursing: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Nursing' },
            required: { type: Boolean, default: false }
        },
        isInMating: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'In Mating' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 7: HEALTH & VETERINARY =====
        vaccinations: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Vaccinations' },
            required: { type: Boolean, default: false }
        },
        dewormingRecords: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Deworming Records' },
            required: { type: Boolean, default: false }
        },
        parasiteControl: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Parasite Control' },
            required: { type: Boolean, default: false }
        },
        medicalConditions: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Medical Conditions' },
            required: { type: Boolean, default: false }
        },
        allergies: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Allergies' },
            required: { type: Boolean, default: false }
        },
        medications: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Medications' },
            required: { type: Boolean, default: false }
        },
        medicalProcedures: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Medical Procedures' },
            required: { type: Boolean, default: false }
        },
        labResults: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Lab Results' },
            required: { type: Boolean, default: false }
        },
        vetVisits: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Vet Visits' },
            required: { type: Boolean, default: false }
        },
        primaryVet: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Primary Veterinarian' },
            required: { type: Boolean, default: false }
        },
        parasitePreventionSchedule: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Parasite Prevention Schedule' },
            required: { type: Boolean, default: false }
        },
        heartwormStatus: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Heartworm Status' },
            required: { type: Boolean, default: false }
        },
        hipElbowScores: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Hip/Elbow Scores' },
            required: { type: Boolean, default: false }
        },
        geneticTestResults: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Genetic Test Results' },
            required: { type: Boolean, default: false }
        },
        eyeClearance: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Eye Clearance' },
            required: { type: Boolean, default: false }
        },
        cardiacClearance: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Cardiac Clearance' },
            required: { type: Boolean, default: false }
        },
        dentalRecords: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Dental Records' },
            required: { type: Boolean, default: false }
        },
        chronicConditions: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Chronic Conditions' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 8: NUTRITION & HUSBANDRY =====
        dietType: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Diet Type' },
            required: { type: Boolean, default: false }
        },
        feedingSchedule: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Feeding Schedule' },
            required: { type: Boolean, default: false }
        },
        supplements: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Supplements' },
            required: { type: Boolean, default: false }
        },
        housingType: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Housing Type' },
            required: { type: Boolean, default: false }
        },
        bedding: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Bedding' },
            required: { type: Boolean, default: false }
        },
        temperatureRange: { 
            enabled: { type: Boolean, default: false }, // Reptiles/exotics
            label: { type: String, default: 'Temperature Range' },
            required: { type: Boolean, default: false }
        },
        humidity: { 
            enabled: { type: Boolean, default: false }, // Reptiles/amphibians
            label: { type: String, default: 'Humidity' },
            required: { type: Boolean, default: false }
        },
        lighting: { 
            enabled: { type: Boolean, default: false }, // Reptiles/exotics
            label: { type: String, default: 'Lighting' },
            required: { type: Boolean, default: false }
        },
        noise: { 
            enabled: { type: Boolean, default: false },
            label: { type: String, default: 'Noise Levels' },
            required: { type: Boolean, default: false }
        },
        enrichment: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Enrichment' },
            required: { type: Boolean, default: false }
        },
        exerciseRequirements: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Exercise Requirements' },
            required: { type: Boolean, default: false }
        },
        dailyExerciseMinutes: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Daily Exercise (minutes)' },
            required: { type: Boolean, default: false }
        },
        groomingNeeds: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Grooming Needs' },
            required: { type: Boolean, default: false }
        },
        sheddingLevel: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Shedding Level' },
            required: { type: Boolean, default: false }
        },
        crateTrained: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Crate Trained' },
            required: { type: Boolean, default: false }
        },
        litterTrained: { 
            enabled: { type: Boolean, default: false }, // Cats
            label: { type: String, default: 'Litter Trained' },
            required: { type: Boolean, default: false }
        },
        leashTrained: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Leash Trained' },
            required: { type: Boolean, default: false }
        },
        freeFlightTrained: { 
            enabled: { type: Boolean, default: false }, // Birds
            label: { type: String, default: 'Free Flight Trained' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 9: BEHAVIOR & WELFARE =====
        temperament: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Temperament' },
            required: { type: Boolean, default: false }
        },
        handlingTolerance: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Handling Tolerance' },
            required: { type: Boolean, default: false }
        },
        socialStructure: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Social Structure' },
            required: { type: Boolean, default: false }
        },
        activityCycle: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Activity Cycle' },
            required: { type: Boolean, default: false }
        },
        trainingLevel: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Training Level' },
            required: { type: Boolean, default: false }
        },
        trainingDisciplines: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Training Disciplines' },
            required: { type: Boolean, default: false }
        },
        certifications: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Certifications' },
            required: { type: Boolean, default: false }
        },
        workingRole: { 
            enabled: { type: Boolean, default: false }, // Working dogs
            label: { type: String, default: 'Working Role' },
            required: { type: Boolean, default: false }
        },
        behavioralIssues: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Behavioral Issues' },
            required: { type: Boolean, default: false }
        },
        biteHistory: { 
            enabled: { type: Boolean, default: false }, // Dogs/cats
            label: { type: String, default: 'Bite History' },
            required: { type: Boolean, default: false }
        },
        reactivityNotes: { 
            enabled: { type: Boolean, default: false }, // Dogs
            label: { type: String, default: 'Reactivity Notes' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 10: SHOW =====
        showTitles: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Show Titles' },
            required: { type: Boolean, default: false }
        },
        showRatings: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Show Ratings' },
            required: { type: Boolean, default: false }
        },
        judgeComments: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Judge Comments' },
            required: { type: Boolean, default: false }
        },
        workingTitles: { 
            enabled: { type: Boolean, default: false }, // Working dogs
            label: { type: String, default: 'Working Titles' },
            required: { type: Boolean, default: false }
        },
        performanceScores: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Performance Scores' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 11: END OF LIFE & LEGAL =====
        causeOfDeath: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Cause of Death' },
            required: { type: Boolean, default: false }
        },
        necropsyResults: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Necropsy Results' },
            required: { type: Boolean, default: false }
        },
        insurance: { 
            enabled: { type: Boolean, default: false }, // Larger animals
            label: { type: String, default: 'Insurance' },
            required: { type: Boolean, default: false }
        },
        legalStatus: { 
            enabled: { type: Boolean, default: false }, // Exotic animals
            label: { type: String, default: 'Legal Status' },
            required: { type: Boolean, default: false }
        },
        endOfLifeCareNotes: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'End of Life Care Notes' },
            required: { type: Boolean, default: false }
        },
        coOwnership: { 
            enabled: { type: Boolean, default: false }, // Larger animals
            label: { type: String, default: 'Co-Ownership' },
            required: { type: Boolean, default: false }
        },
        transferHistory: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Transfer History' },
            required: { type: Boolean, default: false }
        },
        breedingRestrictions: { 
            enabled: { type: Boolean, default: false }, // Purebred animals
            label: { type: String, default: 'Breeding Restrictions' },
            required: { type: Boolean, default: false }
        },
        exportRestrictions: { 
            enabled: { type: Boolean, default: false }, // Regulated species
            label: { type: String, default: 'Export Restrictions' },
            required: { type: Boolean, default: false }
        },
        
        // ===== TAB 12: GENETICS & NOTES =====
        geneticCode: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Genetic Code' },
            required: { type: Boolean, default: false }
        },
        phenotype: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Phenotype' },
            required: { type: Boolean, default: false }
        },
        morph: { 
            enabled: { type: Boolean, default: false }, // Reptiles
            label: { type: String, default: 'Morph' },
            required: { type: Boolean, default: false }
        },
        markings: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Markings' },
            required: { type: Boolean, default: false }
        },
        carrierTraits: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Carrier Traits' },
            required: { type: Boolean, default: false }
        },
        remarks: { 
            enabled: { type: Boolean, default: true },
            label: { type: String, default: 'Notes/Remarks' },
            required: { type: Boolean, default: false }
        }
    },
    
    // Metadata
    version: { type: Number, default: 1 }, // For template versioning
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
const FieldTemplate = mongoose.model('FieldTemplate', FieldTemplateSchema);


// --- 15. SPECIES SCHEMA ---
const SpeciesSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true, trim: true },
    latinName: { type: String, default: null, trim: true },
    category: { type: String, required: true, index: true }, // e.g., 'Mammal', 'Reptile', 'Bird', 'Amphibian', 'Fish', 'Invertebrate', 'Other'
    fieldTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldTemplate', default: null, index: true }, // Reference to field template
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
    type: { type: String, enum: ['sale', 'purchase', 'expense', 'income'], required: true, index: true },
    animalId: { type: String, default: null }, // id_public of the animal
    animalName: { type: String, default: null },
    price: { type: Number, required: true, default: 0 },
    date: { type: Date, required: true, index: true },
    buyer: { type: String, default: null },
    seller: { type: String, default: null },
    buyerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    category: { type: String, default: null }, // For expenses/income: food, equipment, other, etc.
    description: { type: String, default: null }, // For expenses/income
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
        symbol: { type: String, required: true }, // e.g., 'A', 'B', 'C' - the locus symbol
        name: { type: String, required: true }, // e.g., 'Agouti', 'Brown', 'Albino' - the locus name
        description: { type: String, default: null },
        order: { type: Number, default: 0 },
        // Individual alleles for this locus
        alleles: [{
            symbol: { type: String, required: true }, // e.g., 'A', 'a', 'at', 'ay'
            name: { type: String, default: null }, // e.g., 'Agouti', 'Non-agouti', 'Tan-belly' (optional)
            phenotype: { type: String, default: null }, // What this allele contributes (optional)
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        // Gene combinations (pairs of alleles)
        combinations: [{
            notation: { type: String, required: true }, // e.g., 'A/A', 'A/a', 'a/a'
            phenotype: { type: String, default: null }, // e.g., 'Agouti', 'Black'
            carrier: { type: String, default: null }, // e.g., 'Black' - what this carries (for heterozygous)
            isLethal: { type: Boolean, default: false }, // e.g., Ay/Ay
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
            symbol: { type: String, required: true },
            name: { type: String, default: null },
            phenotype: { type: String, default: null },
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        combinations: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            carrier: { type: String, default: null },
            isLethal: { type: Boolean, default: false },
            order: { type: Number, default: 0 }
        }]
    }],
    // Coat/Texture genes (separate category)
    coatGenes: [{
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        alleles: [{
            symbol: { type: String, required: true },
            name: { type: String, default: null },
            phenotype: { type: String, default: null },
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        combinations: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            carrier: { type: String, default: null },
            isLethal: { type: Boolean, default: false },
            order: { type: Number, default: 0 }
        }]
    }],
    // Other genes (ear type, tail type, etc.)
    otherGenes: [{
        symbol: { type: String, required: true },
        name: { type: String, required: true },
        alleles: [{
            symbol: { type: String, required: true },
            name: { type: String, default: null },
            phenotype: { type: String, default: null },
            dominance: { type: String, enum: ['dominant', 'recessive', 'codominant'], default: 'recessive' },
            order: { type: Number, default: 0 }
        }],
        combinations: [{
            notation: { type: String, required: true },
            phenotype: { type: String, default: null },
            carrier: { type: String, default: null },
            isLethal: { type: Boolean, default: false },
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

// ── Animal Changelog ────────────────────────────────────────────────────────
const AnimalLogSchema = new mongoose.Schema({
    animalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true, index: true },
    animalId_public: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: ['care', 'field'], required: true },
    changes: [{
        field:    { type: String },
        label:    { type: String },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
    }],
}, { timestamps: true });
AnimalLogSchema.index({ animalId: 1, createdAt: -1 });
const AnimalLog = mongoose.model('AnimalLog', AnimalLogSchema);

// ── Supply Item ──────────────────────────────────────────────────────────────
const SupplyItemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['Food', 'Bedding', 'Medication', 'Other'], default: 'Other' },
    currentStock: { type: Number, default: 0 },
    unit: { type: String, default: '', trim: true },
    reorderThreshold: { type: Number, default: null },
    notes: { type: String, default: '', trim: true },
    // Feeder animal fields (Food category only)
    isFeederAnimal: { type: Boolean, default: false },
    feederType: { type: String, default: '', trim: true },  // e.g. Mice, Rats, Crickets
    feederSize: { type: String, default: '', trim: true },  // e.g. Pinky, Fuzzy, Adult
    costPerUnit: { type: Number, default: null },           // cost per individual unit/animal
    // Schedule-based reorder (for bulk/timed items independent of stock count)
    nextOrderDate: { type: Date, default: null },           // when to place the next order
    orderFrequency: { type: Number, default: null },        // repeat interval number
    orderFrequencyUnit: { type: String, enum: ['days', 'weeks', 'months'], default: 'months' },
}, { timestamps: true });
const SupplyItem = mongoose.model('SupplyItem', SupplyItemSchema);

// ── Enclosure ─────────────────────────────────────────────────────────────────
const EnclosureSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    enclosureType: { type: String, default: '', trim: true }, // e.g. Tank, Cage, Vivarium, Pond
    size: { type: String, default: '', trim: true },           // e.g. 40 gallon, 48x24x24
    notes: { type: String, default: '', maxlength: 500 },
    // Flexible cleaning/maintenance tasks for the enclosure (spot clean, full clean, bulb change, etc.)
    cleaningTasks: [{
        taskName: { type: String, required: true, trim: true },
        lastDoneDate: { type: Date, default: null },
        frequencyDays: { type: Number, default: null },
    }],
}, { timestamps: true });
const Enclosure = mongoose.model('Enclosure', EnclosureSchema);

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
    Feedback,
    Message,
    MessageReport,
    ProfileReport,
    AnimalReport,
    AuditLog,
    UserActivityLog,
    SystemSettings,
    FieldTemplate,
    Species,
    SpeciesConfig,
    GeneticsData,
    Transaction,
    AnimalTransfer,
    ModChat,
    Enclosure,
    SupplyItem,
    AnimalLog,
};