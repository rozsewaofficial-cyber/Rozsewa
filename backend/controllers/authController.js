const User = require('../models/User');
const Provider = require('../models/Provider');
const { Wallet } = require('../models/Wallet');
const generateToken = require('../utils/generateToken');
const OTP = require('../models/OTP');
const { sendSMSOTP } = require('../utils/smsService');
const { sendEmail } = require('../utils/emailService');
const LoginLog = require('../models/LoginLog');

const STAFF_ROLES = ['admin', 'superadmin', 'supervisor', 'field_staff', 'employee'];

/** Records an admin-panel login. Never lets a logging failure fail the login itself. */
const recordStaffLogin = async (user, req) => {
    if (!STAFF_ROLES.includes(user.role)) return;
    try {
        await LoginLog.create({
            userId: user._id,
            name: user.name,
            role: user.role,
            city: user.city || '',
            ipAddress: req.ip || req.headers['x-forwarded-for'] || ''
        });
    } catch (err) {
        console.error('[LoginLog] failed to record staff login:', err.message);
    }
};

// @desc    Send OTP to mobile
// @route   POST /api/auth/send-otp
// @access  Public
const sendOTP = async (req, res) => {
    const { mobile } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });

    try {
        // Handle test number bypass
        if (mobile === '9999900000' || mobile === '8888888888' || mobile === '9999911111') {
            await OTP.findOneAndUpdate(
                { mobile },
                { otp: '123456', createdAt: new Date() },
                { upsert: true, new: true }
            );
            return res.json({ success: true, message: 'Test OTP generated' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB (upsert)
        await OTP.findOneAndUpdate(
            { mobile },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Send SMS
        const result = await sendSMSOTP(mobile, otp);

        if (result.success) {
            res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send SMS', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
    const { mobile, otp } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile) || !otp) return res.status(400).json({ message: 'Valid 10-digit mobile and OTP required' });

    try {
        const otpDoc = await OTP.findOne({ mobile, otp });

        if (otpDoc) {
            // Delete OTP after verification
            await OTP.deleteOne({ _id: otpDoc._id });
            res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, mobile, password, role, address, city, state } = req.body;
    const email = req.body.email ? req.body.email.trim().toLowerCase() : undefined;

    if (!mobile || !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
    }

    try {
        const existQuery = email ? { $or: [{ email }, { mobile }] } : { mobile };
        const userExists = await User.findOne(existQuery);
        if (userExists) {
            return res.status(400).json({ message: userExists.mobile === mobile ? 'Mobile number is already registered' : 'Email is already registered' });
        }

        const providerExists = await Provider.findOne(existQuery);
        if (providerExists) {
            return res.status(400).json({ message: providerExists.mobile === mobile ? 'Mobile number is already registered as a Provider' : 'Email is already registered as a Provider' });
        }

        const user = await User.create({
            name,
            email,
            mobile,
            password,
            address,
            city,
            state,
            role: role || 'customer',
            location: req.body.location || { type: 'Point', coordinates: [0, 0] }
        });

        if (user) {
            // Create user wallet
            await Wallet.create({
                userId: user._id,
                balance: 0, 
            });

            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                city: user.city,
                address: user.address,
                role: user.role,
                token: generateToken(user._id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Sign up or log in a customer with a Google ID token
// @route   POST /api/auth/google
// @access  Public
/**
 * Signs a customer in (or up) from a Google ID token. Shared by the popup
 * flow (POST /auth/google) and the redirect flow used on iPhone. Returns
 * { status, body } for the caller to send or hand off.
 *
 * `expectNonce`, when given, must match the nonce Google signed into the
 * token — that is what ties a redirect-mode sign-in to the page that began it.
 */
const googleSignIn = async (credential, { expectNonce } = {}) => {
    if (!credential) return { status: 400, body: { message: 'Google credential is required' } };
    if (!process.env.GOOGLE_CLIENT_ID) {
        return { status: 500, body: { message: 'Google Sign-In is not configured on this server' } };
    }

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch (verifyErr) {
        return { status: 401, body: { message: 'Invalid Google credential' } };
    }
    if (expectNonce !== undefined && payload.nonce !== expectNonce) {
        return { status: 401, body: { message: 'This Google sign-in was not started here. Please try again.' } };
    }

    const { sub: googleId, email, name, picture } = payload;
    if (!email) {
        return { status: 400, body: { message: 'This Google account has no email to sign in with' } };
    }
    // Only an address Google has verified may claim an account by email.
    if (payload.email_verified === false) {
        return { status: 400, body: { message: 'Please verify this email with Google first, then sign in again.' } };
    }
    const normalizedEmail = email.trim().toLowerCase();

    // A mobile-registered Provider owning this email is a different account
    // type entirely — Google sign-in on the customer app shouldn't merge into it.
    const providerExists = await Provider.findOne({ email: normalizedEmail });
    if (providerExists) {
        return { status: 400, body: { message: 'This email is already registered as a Provider. Please use the Provider login.' } };
    }

    let user = await User.findOne({ googleId });
    let isNewUser = false;

    if (!user) {
        // Link onto an existing password-based account with the same email.
        user = await User.findOne({ email: normalizedEmail });
        if (user) {
            user.googleId = googleId;
            if (!user.avatar && picture) user.avatar = picture;
            await user.save();
        } else {
            user = await User.create({
                name: name || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                googleId,
                avatar: picture || null,
                role: 'customer',
                location: { type: 'Point', coordinates: [0, 0] },
            });
            await Wallet.create({ userId: user._id, balance: 0 });
            isNewUser = true;
        }
    }

    if (!isNewUser && user.role === 'customer' && user.isActive === false) {
        return { status: 403, body: { message: 'Your account has been blocked. Please contact support.' } };
    }

    const profileComplete = !!(user.mobile && user.city && user.state);

    return {
        status: 200,
        body: {
            success: true,
            message: isNewUser ? 'Account created' : 'Login successful',
            data: {
                token: generateToken(user._id),
                needsProfileCompletion: !profileComplete,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.mobile,
                    mobile: user.mobile,
                    role: user.role,
                    city: user.city || "",
                    state: user.state || "",
                    address: user.address || "",
                    avatar: user.avatar,
                }
            }
        }
    };
};

// @desc    Sign up or log in a customer with a Google ID token (popup flow)
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
    try {
        const { status, body } = await googleSignIn(req.body.credential);
        res.status(status).json(body);
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/*
 * Redirect-mode Google sign-in, for iPhone. A Google popup opened from the app
 * added to the home screen (and often from Safari itself) never hands its
 * result back to the page, so the sign-in silently goes nowhere. In redirect
 * mode the whole page goes to Google, which posts the credential here; the
 * server signs the customer in and sends the browser back to the app with a
 * one-time code.
 */
const crypto = require('crypto');
const AuthHandoff = require('../models/AuthHandoff');
const allowedOrigins = require('../config/allowedOrigins');
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const HANDOFF_MINUTES = 10;

// @desc    Begin a redirect-mode Google sign-in: returns the nonce to sign into the token
// @route   POST /api/auth/google/start
// @access  Public
const googleRedirectStart = async (req, res) => {
    try {
        const returnOrigin = String(req.body.returnOrigin || '');
        if (!allowedOrigins.includes(returnOrigin)) {
            return res.status(400).json({ message: 'Sign-in is not available from this site.' });
        }
        const nonce = crypto.randomBytes(24).toString('base64url');
        await AuthHandoff.create({
            kind: 'google',
            nonce,
            returnOrigin,
            expiresAt: new Date(Date.now() + HANDOFF_MINUTES * 60000)
        });
        res.json({ nonce });
    } catch (error) {
        console.error('Google redirect start error:', error);
        res.status(500).json({ message: 'Could not start Google Sign-In' });
    }
};

// @desc    Google posts the credential here in redirect mode
// @route   POST /api/auth/google/redirect   (form-encoded, from Google)
// @access  Public
const googleRedirectCallback = async (req, res) => {
    const fallbackOrigin = allowedOrigins[0] || '/';
    const back = (origin, params) => res.redirect(303, `${origin}/login?${new URLSearchParams(params).toString()}`);
    try {
        const credential = req.body?.credential;
        // Read the nonce Google signed into the token, to find the hand-off;
        // googleSignIn then verifies the token and that nonce properly.
        let nonce = null;
        try {
            const part = String(credential || '').split('.')[1];
            nonce = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')).nonce || null;
        } catch (_) { /* malformed token: handled below */ }
        const handoff = nonce
            ? await AuthHandoff.findOne({ kind: 'google', nonce, codeHash: null, usedAt: null, expiresAt: { $gt: new Date() } })
            : null;
        if (!handoff) return back(fallbackOrigin, { google_error: 'Your Google sign-in expired. Please try again.' });

        const { status, body } = await googleSignIn(credential, { expectNonce: handoff.nonce });
        if (status !== 200) return back(handoff.returnOrigin, { google_error: body.message || 'Google Sign-In failed' });

        const code = crypto.randomBytes(32).toString('base64url');
        const saved = await AuthHandoff.findOneAndUpdate(
            { _id: handoff._id, codeHash: null },
            { $set: { codeHash: sha256(code), result: body, expiresAt: new Date(Date.now() + 5 * 60000) } },
            { returnDocument: 'after' }
        );
        if (!saved) return back(handoff.returnOrigin, { google_error: 'This Google sign-in was already used. Please try again.' });
        return back(handoff.returnOrigin, { google_code: code });
    } catch (error) {
        console.error('Google redirect callback error:', error);
        return back(fallbackOrigin, { google_error: 'Google Sign-In failed. Please try again.' });
    }
};

// @desc    Swap the one-time code (plus the page's nonce) for the session
// @route   POST /api/auth/google/exchange
// @access  Public
const googleRedirectExchange = async (req, res) => {
    try {
        const { code, nonce } = req.body || {};
        if (!code || !nonce) return res.status(400).json({ message: 'Google sign-in details are missing. Please try again.' });
        const handoff = await AuthHandoff.findOneAndUpdate(
            { kind: 'google', codeHash: sha256(code), nonce: String(nonce), usedAt: null, expiresAt: { $gt: new Date() } },
            { $set: { usedAt: new Date() } },
            { returnDocument: 'after' }
        );
        if (!handoff || !handoff.result) {
            return res.status(400).json({ message: 'This Google sign-in has expired or was already used. Please try again.' });
        }
        res.json(handoff.result);
    } catch (error) {
        console.error('Google exchange error:', error);
        res.status(500).json({ message: 'Google Sign-In failed' });
    }
};

// @desc    Sign up or log in a customer with a Sign in with Apple identity token
// @route   POST /api/auth/apple
// @access  Public
const appleAuth = async (req, res) => {
    const { identityToken, name } = req.body;
    if (!identityToken) {
        return res.status(400).json({ message: 'Apple identity token is required' });
    }
    if (!process.env.APPLE_CLIENT_ID) {
        return res.status(500).json({ message: 'Apple Sign-In is not configured on this server' });
    }

    try {
        const { verifyAppleIdentityToken } = require('../services/appleAuth');
        let identity;
        try {
            identity = await verifyAppleIdentityToken(identityToken, process.env.APPLE_CLIENT_ID);
        } catch (verifyErr) {
            return res.status(401).json({ message: 'Invalid Apple credential' });
        }
        const { appleId, email, emailVerified } = identity;

        let user = await User.findOne({ appleId });
        let isNewUser = false;

        if (!user) {
            // Apple only sends the email on a person's first sign-in. Without one
            // (and with no account already tied to this Apple ID) there is nothing
            // to create or link the account with.
            if (!email) {
                return res.status(400).json({ message: 'Apple did not share an email. In Settings > Apple ID > Sign in with Apple, stop using RozSewa, then try again.' });
            }

            const providerExists = await Provider.findOne({ email });
            if (providerExists) {
                return res.status(400).json({ message: 'This email is already registered as a Provider. Please use the Provider login.' });
            }

            user = await User.findOne({ email });
            if (user) {
                // Only attach an Apple ID to an existing account if Apple vouches for the email.
                if (!emailVerified) {
                    return res.status(400).json({ message: 'This Apple email is not verified, so it cannot be linked to an existing account.' });
                }
                user.appleId = appleId;
                await user.save();
            } else {
                user = await User.create({
                    name: (name && String(name).trim()) || email.split('@')[0],
                    email,
                    appleId,
                    role: 'customer',
                    location: { type: 'Point', coordinates: [0, 0] },
                });
                await Wallet.create({ userId: user._id, balance: 0 });
                isNewUser = true;
            }
        }

        if (!isNewUser && user.role === 'customer' && user.isActive === false) {
            return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
        }

        const profileComplete = !!(user.mobile && user.city && user.state);

        res.json({
            success: true,
            message: isNewUser ? 'Account created' : 'Login successful',
            data: {
                token: generateToken(user._id),
                needsProfileCompletion: !profileComplete,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.mobile,
                    mobile: user.mobile,
                    role: user.role,
                    city: user.city || "",
                    state: user.state || "",
                    address: user.address || "",
                    avatar: user.avatar,
                }
            }
        });
    } catch (error) {
        console.error('Apple Auth Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user with OTP & get token
// @route   POST /api/auth/login-otp
// @access  Public
const loginWithOTP = async (req, res) => {
    const { mobile, otp } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile) || !otp) return res.status(400).json({ message: 'Valid 10-digit mobile and OTP required' });

    try {
        // Handle test number bypass
        if ((mobile === '9999900000' || mobile === '8888888888' || mobile === '9999911111') && otp === '123456') {
            // Allow bypass
        } else {
            const otpDoc = await OTP.findOne({ mobile, otp });
            if (!otpDoc) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            // Delete OTP after successful login
            await OTP.deleteOne({ _id: otpDoc._id });
        }

        let user = null;
        let isProvider = false;

        if (req.body.type === 'provider' || req.body.type === 'sewak') {
            user = await Provider.findOne({ mobile });
            isProvider = !!user;
        } else {
            user = await User.findOne({ mobile });
            isProvider = false;
        }

        if (!user) {
            return res.status(404).json({ message: 'No account found with this mobile number' });
        }

        if (!isProvider && user.role === 'customer' && user.isActive === false) {
            return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
        }

        res.json({
            success: true,
            message: "Login successful",
            data: {
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    name: user.name || user.ownerName,
                    email: user.email,
                    phone: user.mobile,
                    mobile: user.mobile,
                    role: user.role || (isProvider ? 'provider' : 'customer'),
                    city: user.city || "",
                    address: user.address || "",
                    avatar: user.avatar || user.profileImage,
                    providerCategory: isProvider ? (user.providerCategory || "partner") : undefined
                }
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
    const { identifier, password } = req.body;
    console.log(`Login attempt for: ${identifier}`);

    try {
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { mobile: identifier }
            ]
        });

        if (user) {
            console.log(`User found in DB: ${user.email}, ${user.role}`);
            const isMatch = await user.matchPassword(password);
            console.log(`Password match result: ${isMatch}`);

            if (isMatch) {
                // Admin/employee active status is handled elsewhere (HRM); this
                // only stops a blocked customer signing back in. isActive was
                // being flipped by the admin Block button but nothing ever
                // read it at login, so a blocked account could keep using the
                // app exactly as before.
                if (user.role === 'customer' && user.isActive === false) {
                    return res.status(403).json({ message: 'Your account has been blocked. Please contact support.' });
                }

                recordStaffLogin(user, req);

                res.json({
                    success: true,
                    message: "Login successful",
                    data: {
                        token: generateToken(user._id),
                        user: {
                            id: user._id,
                            name: user.name,
                            email: user.email,
                            phone: user.mobile,
                            mobile: user.mobile,
                            role: user.role,
                            city: user.city,
                            address: user.address,
                            avatar: user.avatar
                        }
                    }
                });
            } else if (user.googleId && !user.password) {
                res.status(401).json({ message: 'This account uses Google Sign-In. Please continue with Google.' });
            } else {
                res.status(401).json({ message: 'Invalid email/mobile or password' });
            }
        } else {
            console.log(`User NOT found for identifier: ${identifier}`);
            res.status(401).json({ message: 'Invalid email/mobile or password' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        let user = await User.findById(req.user._id);

        if (!user) {
            user = await Provider.findById(req.user._id);
        }

        if (user) {
            let debtLimitExceeded = false;
            let currentDebt = 0;
            let allowedLimit = 0;
            if (user.ownerName || user.providerCategory) { // it's a provider
                const { Wallet } = require('../models/Wallet');
                const Setting = require('../models/Setting');
                const wallet = await Wallet.findOne({ providerId: user._id });
                if (wallet && wallet.balance < 0) {
                    const configSetting = await Setting.findOne({ key: 'cash_limits_config' });
                    let limit = 1500;
                    if (configSetting && configSetting.value) {
                        const cfg = configSetting.value;
                        limit = Number(cfg.defaultLimit) || 1500;
                        if (user.vendorType) {
                            const catId = user.vendorType.toString();
                            const catLimitObj = cfg.categoryLimits?.find(c => c.categoryId === catId);
                            if (catLimitObj) limit = Number(catLimitObj.limit);
                        }
                    }
                    if (wallet.balance <= -limit) {
                        debtLimitExceeded = true;
                        currentDebt = Math.abs(wallet.balance);
                        allowedLimit = limit;
                    }
                }
            }

            res.json({
                _id: user._id,
                name: user.name || user.ownerName, // Handle both models
                email: user.email,
                mobile: user.mobile,
                role: user.role || (user.ownerName ? 'provider' : 'customer'),
                avatar: user.avatar || user.profileImage,
                addresses: user.addresses || [],
                city: user.city || "",
                address: user.address || "",
                favorites: user.favorites || [],
                vendorCode: user.vendorCode || "",
                commissionFreeBookings: user.commissionFreeBookings || 0,
                permissions: user.permissions || [],
                providerCategory: user.providerCategory || "partner",
                employeeCode: user.role === 'supervisor' || user.role === 'employee' ? (await require('../models/Employee').findOne({ userId: user._id }))?.ownCode : "",
                allowedCreationScope: user.role === 'supervisor' ? (await require('../models/Employee').findOne({ userId: user._id }))?.allowedCreationScope || 'employee_only' : undefined,
                debtLimitExceeded,
                currentDebt,
                allowedLimit
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    const { name, email, mobile, avatar, addresses, favorites, city, state, address } = req.body;

    try {
        let user = await User.findById(req.user._id);
        let isProvider = false;

        if (!user) {
            user = await Provider.findById(req.user._id);
            isProvider = !!user;
        }

        if (user) {
            if (mobile && mobile !== user.mobile) {
                if (!/^\d{10}$/.test(mobile)) {
                    return res.status(400).json({ message: 'Valid 10-digit mobile number is required' });
                }
                const [dupUser, dupProvider] = await Promise.all([
                    User.findOne({ mobile, _id: { $ne: user._id } }),
                    Provider.findOne({ mobile }),
                ]);
                if (dupUser || dupProvider) {
                    return res.status(400).json({ message: 'This mobile number is already registered' });
                }
            }

            if (isProvider) {
                user.ownerName = name || user.ownerName;
                user.profileImage = avatar !== undefined ? avatar : user.profileImage;
            } else {
                user.name = name || user.name;
                user.avatar = avatar !== undefined ? avatar : user.avatar;
            }

            user.email = email || user.email;
            user.mobile = mobile || user.mobile;
            user.addresses = addresses !== undefined ? addresses : user.addresses;
            user.favorites = favorites !== undefined ? favorites : user.favorites;

            if (city !== undefined) {
                user.city = city;
            }
            if (state !== undefined) {
                user.state = state;
            }
            if (address !== undefined) {
                user.address = address;
            }

            if (req.body.location) {
                user.location = req.body.location;
            }

            const updatedUser = await user.save();

            const { notifyUser } = require('../config/notificationService');
            await notifyUser({
                userId: updatedUser._id,
                userRole: isProvider ? 'provider' : 'user',
                title: 'Profile Updated',
                message: 'Your profile information has been successfully updated.',
                type: 'system'
            });

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name || updatedUser.ownerName,
                email: updatedUser.email,
                mobile: updatedUser.mobile,
                role: updatedUser.role || (isProvider ? 'provider' : 'customer'),
                avatar: updatedUser.avatar || updatedUser.profileImage,
                addresses: updatedUser.addresses,
                city: updatedUser.city || "",
                address: updatedUser.address || "",
                favorites: updatedUser.favorites,
                providerCategory: updatedUser.providerCategory || "partner",
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update user password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (user && (await user.matchPassword(currentPassword))) {
            user.password = newPassword;
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete user account
// @route   DELETE /api/auth/profile
// @access  Private
const deleteUserAccount = async (req, res) => {
    try {
        let user = await User.findById(req.user._id);
        let isProvider = false;

        if (!user) {
            user = await Provider.findById(req.user._id);
            isProvider = !!user;
        }

        if (user) {
            // Delete wallet as well
            await Wallet.deleteOne({ userId: user._id });

            if (isProvider) {
                await Provider.deleteOne({ _id: user._id });
            } else {
                await User.deleteOne({ _id: user._id });
            }
            
            res.json({ message: 'Account deleted successfully' });
        } else {
            res.status(404).json({ message: 'User or Provider not found' });
        }
    } catch (error) {
        console.error("Profile Delete Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if user exists
// @route   POST /api/auth/check-existence
// @access  Public
const checkUserExistence = async (req, res) => {
    const { mobile, type } = req.body;
    try {
        if (type === 'provider') {
            const provider = await Provider.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            return res.json({ exists: !!provider });
        } else if (type === 'user') {
            const user = await User.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            return res.json({ exists: !!user });
        } else {
            const user = await User.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            const provider = await Provider.findOne({ $or: [{ phone: mobile }, { mobile: mobile }] });
            return res.json({ exists: !!user || !!provider });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const verifyCredentials = async (req, res) => {
    const { mobile, password, type } = req.body;
    try {
        let user = null;
        let isProvider = false;

        if (type === 'provider') {
            user = await Provider.findOne({ mobile });
            isProvider = !!user;
            if (!user) {
                user = await User.findOne({ mobile });
                isProvider = false;
            }
        } else {
            user = await User.findOne({ mobile });
            if (!user) {
                user = await Provider.findOne({ mobile });
                isProvider = !!user;
            }
        }

        if (user && (await user.matchPassword(password))) {
            res.json({ success: true, isProvider });
        } else {
            res.status(401).json({ success: false, message: 'Invalid mobile or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addAddress = async (req, res) => {
    const { label, address, icon, location } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.addresses.push({ label, address, icon, location });
        await user.save();

        res.status(201).json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
        await user.save();

        res.json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateAddress = async (req, res) => {
    const { label, address, icon, location } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const addr = user.addresses.id(req.params.id);
        if (!addr) return res.status(404).json({ message: 'Address not found' });

        addr.label = label;
        addr.address = address;
        addr.icon = icon;
        if (location) addr.location = location;

        await user.save();
        res.json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addFavorite = async (req, res) => {
    const { providerId } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.favorites.includes(providerId)) {
            user.favorites.push(providerId);
            await user.save();
        }

        res.status(201).json(user.favorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteFavorite = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.favorites = user.favorites.filter(fav => fav.toString() !== req.params.id);
        await user.save();

        res.json(user.favorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getFavorites = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('favorites', 'ownerName shopName mobile profileImage providerCategory');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const mappedFavorites = user.favorites.map(fav => ({
            id: fav._id,
            name: fav.shopName || fav.ownerName,
            category: fav.providerCategory || "Partner",
            image: fav.profileImage || "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
            rating: 4.5, // Dummy for now
            reviews: 100, // Dummy for now
            distance: "2.0 km", // Dummy for now
            price: "199", // Dummy for now
            verified: true
        }));

        res.json(mappedFavorites);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Forgot Password (reset using OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { mobile, otp, newPassword, type } = req.body;
    if (!mobile || !otp || !newPassword) return res.status(400).json({ message: 'Mobile, OTP and new password are required' });

    try {
        // Handle test number bypass
        if ((mobile === '9999900000' || mobile === '8888888888' || mobile === '9999911111') && otp === '123456') {
            // Allow bypass
        } else {
            const otpDoc = await OTP.findOne({ mobile, otp });
            if (!otpDoc) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }
            // Delete OTP after successful verification
            await OTP.deleteOne({ _id: otpDoc._id });
        }

        let user = null;
        if (type === 'provider') {
            user = await Provider.findOne({ mobile });
            if (!user) user = await User.findOne({ mobile });
        } else {
            user = await User.findOne({ mobile });
            if (!user) user = await Provider.findOne({ mobile });
        }

        if (!user) {
            return res.status(404).json({ message: 'No account found with this mobile number' });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify Email OTP
// @route   POST /api/auth/verify-email-otp
// @access  Public
const verifyEmailOtp = async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

    try {
        const otpDoc = await OTP.findOne({ email, otp });

        if (otpDoc) {
            await OTP.deleteOne({ _id: otpDoc._id });
            res.json({ success: true, message: 'Email verified successfully' });
        } else {
            res.status(400).json({ message: 'Invalid or expired OTP' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send OTP to email
// @route   POST /api/auth/send-email-otp
// @access  Public
const sendEmailOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email address is required' });

    try {
        const userExists = await User.findOne({ email });
        const providerExists = await Provider.findOne({ email });
        
        if (userExists || providerExists) {
            return res.status(400).json({ message: 'Email is already registered with another account' });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP to DB (upsert)
        await OTP.findOneAndUpdate(
            { email },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Send Email
        const html = `
            <div style="font-family: sans-serif; padding: 20px;">
                <h2>RozSewa Email Verification</h2>
                <p>Your OTP for email verification is:</p>
                <h1 style="color: #10b981; letter-spacing: 5px;">${otp}</h1>
                <p>This OTP will expire in 5 minutes.</p>
            </div>
        `;
        const result = await sendEmail(email, "Verify Your Email - RozSewa", html);

        if (result.success) {
            res.json({ success: true, message: 'OTP sent to email successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send email OTP', error: result.error });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    googleRedirectStart,
    googleRedirectCallback,
    googleRedirectExchange,
    registerUser,
    googleAuth,
    appleAuth,
    sendEmailOtp,
    verifyEmailOtp,
    authUser,
    getUserProfile,
    updateUserProfile,
    updatePassword,
    deleteUserAccount,
    checkUserExistence,
    sendOTP,
    verifyOTP,
    loginWithOTP,
    verifyCredentials,
    addAddress,
    deleteAddress,
    updateAddress,
    addFavorite,
    deleteFavorite,
    getFavorites,
    forgotPassword
};
