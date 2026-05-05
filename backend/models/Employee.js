const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    employeeId: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
    },
    mobile: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Optional if created without a user account initially
    },
    registrationCommission: {
        type: Number,
        default: 50, // Fixed commission per registration
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    role: {
        type: String,
        enum: ['supervisor', 'field_staff', 'wfh', 'employee'],
        default: 'employee',
    },
    ownCode: {
        type: String,
        unique: true,
    },
    supervisorCode: {
        type: String, // Code of the supervisor for field_staff
    },
    managedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee', // Reference to the supervisor
    },
    totalEarnings: {
        type: Number,
        default: 0,
    },
    referralCount: {
        type: Number,
        default: 0,
    },
    panCard: { type: String, trim: true },
    aadharCard: { type: String, trim: true },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Employee = mongoose.model('Employee', employeeSchema);
module.exports = Employee;
