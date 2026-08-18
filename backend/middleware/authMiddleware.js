const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
            } catch (err) {
                if (err.name === 'TokenExpiredError' && req.originalUrl.includes('/fcm-tokens/remove')) {
                    decoded = jwt.decode(token);
                } else {
                    throw err;
                }
            }

            let principal = await User.findById(decoded.id).select('-password');
            if (!principal) {
                const Provider = require('../models/Provider');
                principal = await Provider.findById(decoded.id).select('-password').populate('vendorType', 'name');
                if (principal) {
                    principal = principal.toObject();
                    principal.role = 'provider'; // Ensure role is injected
                }
            } else {
                principal.role = principal.role || 'customer';
            }

            if (!principal) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            req.user = principal;

            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token failed' });
            }
            // For DB errors (e.g., timeout), return 500 so frontend doesn't log the user out
            res.status(500).json({ message: 'Internal server error during authentication' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

const superadmin = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a super admin' });
    }
};

const wfh = (req, res, next) => {
    if (req.user && (req.user.role === 'wfh' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a WFH staff' });
    }
};

const supervisor = (req, res, next) => {
    if (req.user && (req.user.role === 'supervisor' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a supervisor' });
    }
};

const employee = (req, res, next) => {
    if (req.user && (req.user.role === 'employee' || req.user.role === 'supervisor' || req.user.role === 'admin' || req.user.role === 'superadmin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an employee' });
    }
};

// Dedicated middleware for Trainer-issued tokens — kept separate from `protect`
// (User -> Provider chain) rather than folded in, so a Trainer's access can
// never accidentally widen to admin/provider routes.
const protectTrainer = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            const Trainer = require('../models/Trainer');
            const trainer = await Trainer.findById(decoded.id).select('-password');
            if (!trainer) {
                return res.status(401).json({ message: 'Not authorized, trainer not found' });
            }
            if (!trainer.isActive) {
                return res.status(403).json({ message: 'This trainer account has been deactivated' });
            }

            req.trainer = trainer;
            next();
        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token failed' });
            }
            res.status(500).json({ message: 'Internal server error during authentication' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const supervisorWithAllScope = async (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        return next();
    }
    if (req.user && req.user.role === 'supervisor') {
        const Employee = require('../models/Employee');
        const supervisorEmp = await Employee.findOne({ userId: req.user._id });
        if (supervisorEmp && supervisorEmp.allowedCreationScope === 'all') {
            return next();
        }
    }
    res.status(403).json({ message: 'Access denied: Requires supervisor permissions with "All" scope' });
};

module.exports = { protect, admin, superadmin, wfh, supervisor, employee, supervisorWithAllScope, protectTrainer };
