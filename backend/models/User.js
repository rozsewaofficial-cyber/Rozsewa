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
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please fill a valid email address'],
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        trim: true,
    },
    address: {
        type: String,
        default: "",
    },
    city: {
        type: String,
        required: [true, 'City is required'],
    },
    state: {
        type: String,
        required: [true, 'State is required'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
    },
    avatar: {
        type: String,
        default: null,
    },
    role: {
        type: String,
        enum: ['customer', 'provider', 'admin', 'superadmin'],
        default: 'customer',
    },
    permissions: {
        type: [String],
        default: [],
    },
    isVerified: {
        type: Boolean,
        default: false,
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
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to match password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
