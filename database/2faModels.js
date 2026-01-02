const mongoose = require('mongoose');

// 2FA Code Model for storing temporary verification codes
const TwoFactorCodeSchema = new mongoose.Schema({
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    username: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true 
    },
    code_hash: { 
        type: String, 
        required: true 
    },
    salt: { 
        type: String, 
        required: true 
    },
    created_at: { 
        type: Date, 
        default: Date.now, 
        index: true 
    },
    expires_at: { 
        type: Date, 
        required: true, 
        index: true 
    },
    used: { 
        type: Boolean, 
        default: false, 
        index: true 
    },
    attempts: { 
        type: Number, 
        default: 0 
    },
    blocked: { 
        type: Boolean, 
        default: false 
    },
    last_attempt_at: { 
        type: Date, 
        default: null 
    },
    created_ip: { 
        type: String, 
        default: null 
    }
});

// Auto-delete expired codes after 6 minutes (360 seconds)
TwoFactorCodeSchema.index({ expires_at: 1 }, { expireAfterSeconds: 360 });

const TwoFactorCode = mongoose.model('TwoFactorCode', TwoFactorCodeSchema, 'two_factor_codes');


// Login Audit Log Model for tracking admin/moderator logins
const LoginAuditLogSchema = new mongoose.Schema({
    user_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    username: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true 
    },
    ip_address: { 
        type: String, 
        required: true, 
        index: true 
    },
    location: { 
        type: String, 
        default: null 
    },
    user_agent: { 
        type: String, 
        required: true 
    },
    platform: { 
        type: String, 
        default: null 
    },
    language: { 
        type: String, 
        default: null 
    },
    screen_resolution: { 
        type: String, 
        default: null 
    },
    timezone: { 
        type: String, 
        default: null 
    },
    device_name: { 
        type: String, 
        default: null 
    },
    status: { 
        type: String, 
        enum: ['success', 'failed', 'suspicious'], 
        default: 'success', 
        index: true 
    },
    two_factor_verified: { 
        type: Boolean, 
        default: false 
    },
    failure_reason: { 
        type: String, 
        default: null 
    },
    is_suspicious: { 
        type: Boolean, 
        default: false, 
        index: true 
    },
    suspicious_reason: { 
        type: String, 
        default: null 
    },
    created_at: { 
        type: Date, 
        default: Date.now, 
        index: true 
    },
    action_taken: { 
        type: String, 
        default: null 
    }
});

// Compound indexes for common queries
LoginAuditLogSchema.index({ user_id: 1, created_at: -1 });
LoginAuditLogSchema.index({ is_suspicious: 1, created_at: -1 });
LoginAuditLogSchema.index({ ip_address: 1, created_at: -1 });

const LoginAuditLog = mongoose.model('LoginAuditLog', LoginAuditLogSchema, 'login_audit_logs');


module.exports = {
    TwoFactorCode,
    LoginAuditLog
};
