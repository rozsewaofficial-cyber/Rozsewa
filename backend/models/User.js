const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please fill a valid email address'],
    },
    mobile: {
        type: String,
        trim: true,
    },
    address: {
        type: String,
        default: "",
    },
    city: {
        type: String,
    },
    state: {
        type: String,
    },
    password: {
        type: String,
        minlength: [6, 'Password must be at least 6 characters'],
    },
    // Set once by Google Sign-In; accounts created this way have no
    // mobile/city/state/password until the "complete your profile" step.
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    plainPassword: {
        type: String,
        default: "",
    },
    avatar: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ['customer', 'provider', 'admin', 'superadmin', 'supervisor', 'field_staff', 'employee'],
        default: 'customer',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    supervisorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    permissions: {
        type: [String],
        default: [],
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    addresses: [{
        label: { type: String, required: true },
        address: { type: String, required: true },
        icon: { type: String, default: 'home' },
        location: {
            type: { type: String, default: 'Point' },
            coordinates: [Number], // [longitude, latitude]
        }
    }],
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Provider'
    }],
    // ── RozSewa Coins: referral attribution ──────────────────────────────
    // Every customer gets a code lazily on first request (see coinController).
    referralCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        trim: true,
    },
    // The code this customer signed up under. Stored as the code rather than a
    // ref so a referrer's code stays resolvable even if their account changes.
    referredBy: {
        type: String,
        default: null,
        uppercase: true,
        trim: true,
    },
    // Set once the referral has been settled (paid, or permanently blocked by
    // the anti-fraud checks) so the check doesn't re-run on every later order.
    referralRewarded: {
        type: Boolean,
        default: false,
    },
    referralBlockedReason: {
        type: String,
        default: null,
    },
    // Captured at signup purely to power the anti-fraud checks on referral
    // payout — same device / same IP as the referrer means no reward.
    signupIp: {
        type: String,
        default: null,
    },
    signupDeviceId: {
        type: String,
        default: null,
    },
    kycAccess: {
        type: Boolean,
        default: false,
    },
    kycLimit: {
        type: Number,
        default: 0,
    },
    kycBonusPerVerification: {
        type: Number,
        default: 0,
    },
    fcmTokens: [String],
    fcmTokenMobile: [String],
    // Bazaar Seller Profile
    sellerProfile: {
        businessType: {
            type: String,
            enum: ['Individual', 'Business'],
            default: 'Individual'
        },
        isVerifiedSeller: {
            type: Boolean,
            default: false
        },
        kycStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'not_submitted'],
            default: 'not_submitted'
        },
        trustScore: {
            type: Number,
            default: 100 // Out of 100
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Create geospatial index for location
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    
    // If it's already a hash (starts with $2a$ or $2b$), don't hash it again
    if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to match password
userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
