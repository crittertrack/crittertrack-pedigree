const mongoose = require('mongoose');

// Contact Schema - for tracking keepers and breeders
const ContactSchema = new mongoose.Schema({
    // Owner of this contact record
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true 
    },
    
    // Contact identification
    linkedCTUID: { 
        type: String, 
        default: null,
        index: true,
        sparse: true // Allow multiple null values
    },
    
    // Names
    personalName: { 
        type: String, 
        default: null,
        trim: true 
    },
    breederName: { 
        type: String, 
        default: null,
        trim: true 
    },
    prefix: { 
        type: String, 
        default: null,
        trim: true 
    },
    suffix: { 
        type: String, 
        default: null,
        trim: true 
    },
    
    // Address
    address: {
        street: { type: String, default: null, trim: true },
        city: { type: String, default: null, trim: true },
        state: { type: String, default: null, trim: true },
        postalCode: { type: String, default: null, trim: true },
        country: { type: String, default: null, trim: true }
    },
    
    // Contact type - can be both keeper and breeder
    isKeeper: { type: Boolean, default: false },
    isBreeder: { type: Boolean, default: false },
    
    // Animals assigned to this contact
    // Each entry contains the animal ID and the role (keeper/breeder)
    assignedAnimals: [{
        animalId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Animal',
            required: true 
        },
        animalId_public: { 
            type: String, 
            required: true 
        },
        role: { 
            type: String, 
            enum: ['keeper', 'breeder', 'both'],
            required: true 
        },
        assignedDate: { 
            type: Date, 
            default: Date.now 
        }
    }],
    
    // Additional notes
    notes: { 
        type: String, 
        default: null,
        trim: true 
    },
    
    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp on save
ContactSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for efficient queries
ContactSchema.index({ userId: 1, isKeeper: 1 });
ContactSchema.index({ userId: 1, isBreeder: 1 });
ContactSchema.index({ userId: 1, linkedCTUID: 1 });

const Contact = mongoose.model('Contact', ContactSchema);

module.exports = Contact;
