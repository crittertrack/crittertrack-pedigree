const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- IMPORTANT FIX: Changed '../models' to './models' since models.js is in the same directory (database) ---
const {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Counter
} = require('./models'); 

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const JWT_LIFETIME = '1d';

/**
 * Utility function to get the next auto-incrementing public ID.
 */
const getNextSequence = async (name) => {
    const ret = await Counter.findByIdAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    // If we inserted (upsert: true), the first ID will be 1001, which is correct (default seq is 1000).
    return ret.seq;
};

// --- DATABASE CONNECTION ---
/**
 * Connects to the MongoDB database using the URI from environment variables.
 */
const connectDB = async () => {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI not found in environment variables. Cannot connect to database.");
    }
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connection successful.');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        throw error;
    }
};


// --- USER REGISTRY FUNCTIONS ---

const registerUser = async (userData) => { 
    const { email, password, personalName, breederName, profileImage, showBreederName } = userData;

    // Get new public ID for the user
    const id_public = await getNextSequence('userId');

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the new user
    const newUser = new User({
        id_public,
        email,
        password: hashedPassword,
        personalName,
        breederName,
        profileImage,
        showBreederName
    });

    const savedUser = await newUser.save();

    // Create public profile immediately
    const publicProfileData = {
        userId_backend: savedUser._id,
        id_public: savedUser.id_public,
        personalName: savedUser.personalName,
        profileImage: savedUser.profileImage,
        breederName: savedUser.breederName,
    };
    await PublicProfile.create(publicProfileData);

    return savedUser;
};

const loginUser = async (email, password) => { 
    // Find user by email, selecting the password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new Error('User not found');
    }

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
        { id: user._id, email: user.email, id_public: user.id_public }, 
        JWT_SECRET, 
        { expiresIn: JWT_LIFETIME }
    );
    
    return token;
};
// const updateProfile = async (userId, updates) => { /* ... */ };
// const searchPublicProfiles = async (query) => { /* ... */ };


// --- ANIMAL REGISTRY FUNCTIONS ---

/**
 * Registers a new animal.
 */
const addAnimal = async (appUserId_backend, animalData) => {
    const fileOwner = await User.findById(appUserId_backend);
    if (!fileOwner) {
        throw new Error("File owner (app user) not found.");
    }

    // 1. Get new public ID for the animal
    const id_public = await getNextSequence('animalId');

    // 2. Set owner display info (Initial owner is the app user)
    const ownerId_public = fileOwner.id_public;
    const ownerPersonalName = fileOwner.personalName;
    const ownerBreederName = fileOwner.showBreederName ? fileOwner.breederName : null;


    const newAnimal = new Animal({
        ...animalData,
        id_public,
        appUserId_backend, 
        ownerId_public, 
        ownerPersonalName,
        ownerBreederName,
        birthDate: new Date(animalData.birthDate), 
    });

    return await newAnimal.save();
};

/**
 * Gets all animals for the logged-in user (local page).
 */
const getUsersAnimals = async (appUserId_backend, filters = {}) => {
    // Queries by the access control ID (appUserId_backend)
    const query = { appUserId_backend };
    if (filters.gender) query.gender = filters.gender;
    if (filters.status) query.status = filters.status;

    return await Animal.find(query).sort({ createdAt: -1 });
};

/**
 * Toggles an animal's visibility on the public profile.
 */
const toggleAnimalPublic = async (appUserId_backend, animalId_backend, toggleData) => {
    const { makePublic, includeRemarks = false, includeGeneticCode = false } = toggleData;

    // 1. Find and update the animal's private record (must check ownership)
    const animal = await Animal.findOne({ _id: animalId_backend, appUserId_backend });
    if (!animal) {
        throw new Error("Animal not found or user does not own this animal.");
    }

    animal.showOnPublicProfile = makePublic;
    await animal.save(); 

    // 2. Sync with PublicAnimal collection
    if (makePublic) {
        // Prepare data for public view, including optional fields based on toggleData
        const publicData = {
            _id: animal._id, // Set the public document's _id to match the private one
            id_public: animal.id_public,
            ownerId_public: animal.ownerId_public,
            prefix: animal.prefix,
            name: animal.name,
            gender: animal.gender,
            birthDate: animal.birthDate,
            color: animal.color,
            coat: animal.coat,
            // Include optional fields only if toggled
            remarks: includeRemarks ? animal.remarks : undefined,
            geneticCode: includeGeneticCode ? animal.geneticCode : undefined,
        };

        // Create or update the public-facing document
        await PublicAnimal.findOneAndUpdate({ _id: animal._id }, publicData, { upsert: true, new: true });
    } else {
        // Remove from public collection
        await PublicAnimal.findByIdAndDelete(animal._id);
    }
    return animal;
};

// --- NEW PUBLIC ACCESS FUNCTIONS ---

/**
 * Fetches a single public profile by its public ID.
 */
const getPublicProfile = async (id_public) => {
    const profile = await PublicProfile.findOne({ id_public });
    if (!profile) {
        throw new Error('Public profile not found.');
    }
    return profile;
};

/**
 * Fetches all public animals belonging to a specific user (ownerId_public).
 */
const getPublicAnimalsByOwner = async (ownerId_public) => {
    const animals = await PublicAnimal.find({ ownerId_public }).sort({ createdAt: -1 });
    return animals;
};


// --- LITTER REGISTRY FUNCTIONS (Placeholder) ---
// ...

module.exports = {
    connectDB,
    registerUser,
    loginUser,
    getNextSequence,
    // Animal functions
    addAnimal,
    getUsersAnimals,
    toggleAnimalPublic,
    // NEW Public functions
    getPublicProfile,
    getPublicAnimalsByOwner,
    // ... Litter functions
};
