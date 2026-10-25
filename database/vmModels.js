const mongoose = require('mongoose');

const VmUserSetupSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    logoIndex: {
        type: Number,
        min: 1,
        max: 9,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-update updatedAt on save
VmUserSetupSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

VmUserSetupSchema.index({ userId: 1 });

const VmUserSetup = mongoose.model('VmUserSetup', VmUserSetupSchema, 'vm_user_setups');

module.exports = VmUserSetup;
