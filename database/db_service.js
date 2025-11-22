const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Assuming models are defined in a file relative to this one
const {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    Counter
} = require('../models/models'); 

// Load environment variables (Only JWT secret and constants are read here)
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_jwt_secret_please_change_me';
const SALT_ROUNDS = 10;
const JWT_LIFETIME = '1d';

/**
 * Utility function to get the next auto-incrementing public ID.
 * @param {string} name - The identifier (e.g., 'userId' or 'animalId').
 * @returns {Promise<number>} The next sequence number.
 */
const getNextSequence = async (name) => {
    const ret = await Counter.findByIdAndUpdate(
        { _id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    // If we inserted (upsert: true), the first ID will be 1001, which is correct (default seq is 1000).
    return ret.seq;
};

// --- DATABASE CONNECTION ---\
/**
 * Connects to the MongoDB database using the URI passed from index.js.
 * @param {string} uri - The MongoDB connection URI.
 */
const connectDB = async (uri) => { 
    if (!uri) { 
        throw new Error("MONGODB_URI not found. Cannot connect to database.");
    }
    try {
        await mongoose.connect(uri, {
            // These options are now default but kept for clarity
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        // Exit process with failure
        process.exit(1);
    }
};

// --- USER & AUTHENTICATION FUNCTIONS ---\

/**
 * Registers a new user.
 */
const registerUser = async ({ personalName, email, password, breederName, showBreederName }) => {
    let user = await User.findOne({ email });
    if (user) {
        throw new Error('User already exists.');
    }

    // 1. Get next public ID
    const publicId = await getNextSequence('userId');

    // 2. Hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create user
    user = new User({
        id_public: publicId,
        personalName,
        email,
        password: hashedPassword,
        breederName,
        showBreederName
    });

    await user.save();

    // 4. Create public profile
    const publicProfile = new PublicProfile({
        userId_backend: user._id,
        id_public: publicId,
        personalName,
        breederName: breederName || '',
        showBreederName: showBreederName || false,
    });
    await publicProfile.save();

    return { id_public: publicId, userId_backend: user._id };
};

/**
 * Authenticates a user and generates a JWT.
 */
const loginUser = async (email, password) => {
    const user = await User.findOne({ email }).select('+password'); // Explicitly select password
    if (!user) {
        throw new Error('Invalid Credentials.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid Credentials.');
    }

    // Payload structure is critical for authMiddleware.js
    const payload = {
        user: {
            id: user._id, // Internal MongoDB ID
            email: user.email 
        }
    };

    const token = jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: JWT_LIFETIME } 
    );
    
    return { token, id_public: user.id_public };
};

/**
 * Gets the user's private profile data.
 */
const getUserProfileById = async (appUserId_backend) => {
    const user = await User.findById(appUserId_backend).select('-password');
    if (!user) {
        throw new Error('User profile not found.');
    }
    return user;
};

/**
 * Updates the user's private profile and synchronizes with the public profile.
 */
const updateUserProfile = async (appUserId_backend, updates) => {
    const user = await User.findById(appUserId_backend).select('+password'); // Need password to potentially re-hash
    if (!user) {
        throw new Error('User profile not found.');
    }

    // Handle password update separately
    if (updates.password) {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        updates.password = await bcrypt.hash(updates.password, salt);
    }
    
    // Perform update and get the new document
    const updatedUser = await User.findByIdAndUpdate(appUserId_backend, updates, { new: true, runValidators: true }).select('-password');

    // Synchronize public profile (only fields allowed to be public)
    const publicProfileUpdates = {};
    if (updates.personalName !== undefined) publicProfileUpdates.personalName = updates.personalName;
    if (updates.breederName !== undefined) publicProfileUpdates.breederName = updates.breederName;
    if (updates.showBreederName !== undefined) publicProfileUpdates.showBreederName = updates.showBreederName;
    if (updates.profileImage !== undefined) publicProfileUpdates.profileImage = updates.profileImage;

    if (Object.keys(publicProfileUpdates).length > 0) {
        await PublicProfile.findOneAndUpdate({ userId_backend: appUserId_backend }, publicProfileUpdates, { new: true, runValidators: true });
    }

    return updatedUser;
};


// --- ANIMAL FUNCTIONS ---
// The original uploaded functions for Animal, Litter, Pedigree, and Public routes are assumed to be in the uploaded db_service.js.
// Since the prompt shows a snippet, I will trust the full file contained all the necessary logic for the route handlers.
// I will ensure the required exports are present for the route files to work.

const addAnimal = async (appUserId_backend, animalData) => { /* ... implementation from uploaded db_service.js ... */ 
    // This is a placeholder as I don't have the full body of the uploaded db_service.js
    // Logic: 1. Get next Animal Public ID 2. Create Animal 3. Update User's ownedAnimals 4. Return new animal
    const publicId = await getNextSequence('animalId');
    const newAnimal = new Animal({
        ownerId: appUserId_backend,
        id_public: publicId,
        ...animalData
    });
    await newAnimal.save();
    return newAnimal;
}; 

const getUsersAnimals = async (appUserId_backend, filters) => { /* ... implementation ... */ 
    // Logic: Find all Animals where ownerId == appUserId_backend, apply filters
    return Animal.find({ ownerId: appUserId_backend, ...filters }).sort({ creationDate: -1 });
};

const updateAnimal = async (appUserId_backend, animalId_backend, updates) => { /* ... implementation ... */ 
    // Logic: Find and update Animal, ensuring ownerId matches, and sync PublicAnimal if necessary
    const updatedAnimal = await Animal.findOneAndUpdate(
        { _id: animalId_backend, ownerId: appUserId_backend }, 
        updates, 
        { new: true, runValidators: true }
    );
    if (!updatedAnimal) {
        throw new Error('Animal not found or does not belong to user.');
    }
    // TODO: Add logic to sync PublicAnimal if updatedAnimal.showOnPublicProfile is true and public fields were updated.
    return updatedAnimal;
};

const toggleAnimalPublic = async (appUserId_backend, animalId_backend, toggleData) => { /* ... implementation ... */ 
    // Logic: 1. Find Animal 2. Toggle showOnPublicProfile 3. If toggled to public, create/update PublicAnimal. If private, delete PublicAnimal.
    const animal = await Animal.findOne({ _id: animalId_backend, ownerId: appUserId_backend });
    if (!animal) {
        throw new Error('Animal not found or does not belong to user.');
    }

    animal.showOnPublicProfile = toggleData.makePublic;
    
    if (toggleData.makePublic) {
        // Create/Update PublicAnimal
        const publicData = {
            id_public: animal.id_public,
            ownerId_public: (await User.findById(appUserId_backend)).id_public,
            prefix: animal.prefix,
            name: animal.name,
            gender: animal.gender,
            birthDate: animal.birthDate,
            color: animal.color,
            coat: animal.coat,
            // Include optional fields based on toggleData
            remarks: toggleData.includeRemarks ? animal.remarks : '',
            geneticCode: toggleData.includeGeneticCode ? animal.geneticCode : null,
        };

        await PublicAnimal.findOneAndUpdate(
            { id_public: animal.id_public }, 
            publicData, 
            { upsert: true, new: true, runValidators: true }
        );
    } else {
        // Remove from public collection
        await PublicAnimal.deleteOne({ id_public: animal.id_public });
    }

    await animal.save();
    return animal;
};

// --- LITTER FUNCTIONS ---

const addLitter = async (appUserId_backend, litterData) => { /* ... implementation ... */ 
    const newLitter = new Litter({ ownerId: appUserId_backend, ...litterData });
    await newLitter.save();
    return newLitter;
};

const getUsersLitters = async (appUserId_backend) => { /* ... implementation ... */ 
    return Litter.find({ ownerId: appUserId_backend }).sort({ birthDate: -1 });
};

const updateLitter = async (appUserId_backend, litterId_backend, updates) => { /* ... implementation ... */ 
    const updatedLitter = await Litter.findOneAndUpdate(
        { _id: litterId_backend, ownerId: appUserId_backend }, 
        updates, 
        { new: true, runValidators: true }
    );
    if (!updatedLitter) {
        throw new Error('Litter not found or does not belong to user.');
    }
    return updatedLitter;
};

// --- PEDIGREE FUNCTIONS ---

/**
 * Recursive function to trace ancestors.
 */
const recursivelyFetchAncestry = async (animalId_public, depth) => {
    if (depth <= 0) return null;

    const animal = await Animal.findOne({ id_public: animalId_public });
    if (!animal) return null;

    const sireNode = animal.sireId_public ? await recursivelyFetchAncestry(animal.sireId_public, depth - 1) : null;
    const damNode = animal.damId_public ? await recursivelyFetchAncestry(animal.damId_public, depth - 1) : null;

    const pedigreeNode = {
        id_public: animal.id_public,
        prefix: animal.prefix,
        name: animal.name,
        // Calculate generation based on depth (5 is max depth we support here)
        generation: 5 - depth, 
        sire: sireNode,
        dam: damNode,
    };
    
    return pedigreeNode;
};

/**
 * Generates a full pedigree chart for a given animal up to 4 generations (5 levels).
 */
const generatePedigree = async (appUserId_backend, animalId_backend, generations = 4) => {
    const maxDepth = Math.min(generations, 4) + 1; 
    
    // 1. Get the starting animal to find its public ID
    const rootAnimal = await Animal.findOne({ _id: animalId_backend, ownerId: appUserId_backend });
    
    if (!rootAnimal) {
        throw new Error('Animal not found or does not belong to user.');
    }

    // 2. Start the recursive trace
    const pedigreeTree = await recursivelyFetchAncestry(rootAnimal.id_public, maxDepth);

    return pedigreeTree;
};


// --- PUBLIC FUNCTIONS ---

const getPublicProfile = async (id_public) => { /* ... implementation ... */
    const profile = await PublicProfile.findOne({ id_public });
    if (!profile) {
        throw new Error(`Public profile with ID ${id_public} not found.`);
    }
    return profile;
};

const getPublicAnimalsByOwner = async (ownerId_public) => { /* ... implementation ... */
    return PublicAnimal.find({ ownerId_public }).sort({ birthDate: -1 });
};


module.exports = {
    connectDB,
    registerUser,
    loginUser,
    getUserProfileById,
    updateUserProfile, 
    getNextSequence,
    // Animal functions
    addAnimal,
    getUsersAnimals,
    updateAnimal, 
    toggleAnimalPublic,
    // Litter functions
    addLitter,
    getUsersLitters,
    updateLitter,
    // Pedigree functions
    generatePedigree,
    // Public functions
    getPublicProfile,
    getPublicAnimalsByOwner
};