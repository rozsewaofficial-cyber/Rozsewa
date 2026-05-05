const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
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

module.exports = { protect, admin, superadmin, wfh, supervisor, employee };
