const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
    User,
    PublicProfile,
    Animal,
    PublicAnimal,
    Litter,
    getNextSequence
} = require('./models');

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const JWT_LIFETIME = '1d';

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

/**
 * Registers a new user and creates their public profile counterpart.
 * NOTE: Transactions removed to support Railway's standalone MongoDB setup.
 * @param {object} userData - { email, password, personalName, profileImage, breederName, showBreederName }
 * @returns {object} The newly created user document.
 */
const registerUser = async (userData) => {
    const { email, password, personalName, profileImage, breederName, showBreederName } = userData;

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error('Email already in use');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // --- NON-TRANSACTIONAL SAVE ---
    // The previous transaction logic is REMOVED. Operations now run sequentially.
    try {
        // 1. Get new public ID
        const id_public = await getNextSequence('userId');

        // 2. Create and Save private User document
        const newUser = new User({
            id_public,
            email,
            password: hashedPassword,
            personalName,
            profileImage,
            breederName,
            showBreederName
        });
        await newUser.save(); // Non-transactional save

        // 3. Create and Save public Profile document
        const newPublicProfile = new PublicProfile({
            userId_backend: newUser._id,
            id_public: newUser.id_public,
            personalName: newUser.personalName,
            profileImage: newUser.profileImage,
            breederName: newUser.showBreederName ? newUser.breederName : null
        });
        await newPublicProfile.save(); // Non-transactional save

        return newUser;

    } catch (error) {
        // Since there are no transactions, no abort is needed.
        // If one save fails, the function will simply throw the error.
        throw error;
    }
};

/**
 * Authenticates a user and generates a JWT token.
 * @returns {string} The generated JWT token.
 */
const loginUser = async (email, password) => {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        throw new Error('User not found');
    }

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

/**
 * Updates a user's profile and syncs changes to the public profile.
 * NOTE: Transactions removed to support Railway's standalone MongoDB setup.
 */
const updateProfile = async (userId, updates) => {
    // If password is being updated, hash it
    if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
    }

    // The previous transaction logic is REMOVED.
    try {
        // 1. Update private User (no session option needed)
        const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
        if (!updatedUser) {
            throw new Error('User not found');
        }

        // 2. Update public Profile
        const publicProfile = await PublicProfile.findOne({ userId_backend: userId });
        if (publicProfile) {
            publicProfile.personalName = updatedUser.personalName;
            publicProfile.profileImage = updatedUser.profileImage;
            publicProfile.breederName = updatedUser.showBreederName ? updatedUser.breederName : null;
            await publicProfile.save(); // Non-transactional save
        }
        // Note: We assume the public profile always exists, as it's created on register.

        return updatedUser;

    } catch (error) {
        // No abort needed.
        throw error;
    }
};

/**
 * Searches public profiles by integer ID or text query.
 */
const searchPublicProfiles = async (query) => {
    const parsedQuery = parseInt(query, 10);
    if (!isNaN(parsedQuery)) {
        // Search by Public ID
        return await PublicProfile.find({ id_public: parsedQuery }).limit(10);
    } else {
        // Search by Name (personal or breeder)
        const regex = new RegExp(query, 'i'); // case-insensitive
        return await PublicProfile.find({ _searchableName: regex }).limit(10);
    }
};


// --- ANIMAL REGISTRY FUNCTIONS ---

/**
 * Adds a new animal to the user's private collection.
 * @param {string} ownerId - The backend ID (_id) of the user.
 * @param {object} animalData - All data for the animal from the request body.
 * @returns {object} The new animal document.
 */
const addAnimal = async (ownerId, animalData) => {
    const owner = await User.findById(ownerId);
    if (!owner) {
        throw new Error("Owner not found for this animal.");
    }

    const id_public = await getNextSequence('animalId');

    const newAnimal = new Animal({
        ...animalData,
        id_public,
        ownerId: owner._id,
        ownerPersonalName: owner.personalName,
        ownerBreederName: owner.showBreederName ? owner.breederName : null,
    });

    return await newAnimal.save();
};

/**
 * Function 1: Gets all animals for the logged-in user (local page).
 * @param {string} ownerId - The backend ID (_id) of the user.
 * @param {object} filters - e.g., { gender: 'male', status: 'Active' }
 * @returns {Array<object>} List of animals.
 */
const getUsersAnimals = async (ownerId, filters = {}) => {
    const query = { ownerId };
    if (filters.gender) query.gender = filters.gender;
    if (filters.status) query.status = filters.status;

    return await Animal.find(query).sort({ createdAt: -1 });
};

/**
 * Function 2: Toggles an animal's visibility on the public profile.
 * This syncs the animal's data to/from the PublicAnimal collection.
 * @param {string} ownerId - The backend ID (_id) of the user.
 * @param {string} animalId - The backend ID (_id) of the animal.
 * @param {boolean} makePublic - True to show, False to hide.
 */
const toggleAnimalPublic = async (ownerId, animalId, makePublic) => {
    const animal = await Animal.findOne({ _id: animalId, ownerId: ownerId });
    if (!animal) {
        throw new Error("Animal not found or user does not own this animal.");
    }

    // 1. Update the animal's private record
    animal.showOnPublicProfile = makePublic;
    await animal.save();

    // 2. Sync with PublicAnimal collection
    if (makePublic) {
        // Create or update the public-facing document
        const publicData = {
            id_public: animal.id_public,
            ownerId: animal.ownerId,
            prefix: animal.prefix,
            name: animal.name,
            gender: animal.gender,
            birthdate: animal.birthdate,
            color: animal.color,
        };
        // Use { _id: animalId } to keep IDs consistent
        await PublicAnimal.findByIdAndUpdate(animalId, publicData, { upsert: true, new: true });
    } else {
        // Remove from public collection
        await PublicAnimal.findByIdAndDelete(animalId);
    }
    return animal;
};

/**
 * Gets all PUBLIC animals for a specific user (visual user profile).
 * @param {number} userPublicId - The public integer ID of the user.
 * @returns {Array<object>} List of public animals.
 */
const getPublicAnimalsByUser = async (userPublicId) => {
    // 1. Find the user's public profile to get their backend ID
    const profile = await PublicProfile.findOne({ id_public: userPublicId });
    if (!profile) {
        throw new Error("User profile not found.");
    }

    // 2. Find all animals in the PublicAnimal collection matching that backend ID
    return await PublicAnimal.find({ ownerId: profile.userId_backend }).sort({ name: 1 });
};


// --- LITTER REGISTRY FUNCTIONS ---

/**
 * Adds a new litter to the user's private collection.
 * @param {string} ownerId - The backend ID (_id) of the user.
 * @param {object} litterData - All data for the litter.
 * @returns {object} The new litter document.
 */
const addLitter = async (ownerId, litterData) => {
    const newLitter = new Litter({
        ...litterData,
        ownerId,
    });
    return await newLitter.save();
};

/**
 * Links a newly registered animal (offspring) to its litter.
 * @param {string} ownerId - The backend ID (_id) of the user.
 * @param {string} litterId - The backend ID (_id) of the litter.
 * @param {number} offspringPublicId - The public integer ID of the animal.
 */
const registerOffspringToLitter = async (ownerId, litterId, offspringPublicId) => {
    const litter = await Litter.findOne({ _id: litterId, ownerId: ownerId });
    if (!litter) {
        throw new Error("Litter not found or user does not own this litter.");
    }

    // Add offspring ID to the array, ensuring no duplicates
    return await Litter.findByIdAndUpdate(
        litterId,
        { $addToSet: { offspringIds_public: offspringPublicId } },
        { new: true }
    );
};


module.exports = {
    connectDB,
    registerUser,
    loginUser,
    updateProfile,
    searchPublicProfiles,
    addAnimal,
    getUsersAnimals,
    toggleAnimalPublic,
    getPublicAnimalsByUser,
    addLitter,
    registerOffspringToLitter
};
