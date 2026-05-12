const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');

// @desc    Upload image to Cloudinary
// @route   POST /api/upload
// @access  Public (for KYC during registration)
router.post('/', (req, res, next) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({ message: 'Cloudinary credentials are not configured on the server.' });
    }
    next();
}, (req, res, next) => {
    upload.single('image')(req, res, function (err) {
        if (err) {
            console.error('Multer/Cloudinary Error:', err);
            return res.status(500).json({ message: err.message || 'Upload failed' });
        }
        next();
    });
}, (req, res) => {
    if (req.file && req.file.path) {
        res.json({
            url: req.file.path,
            public_id: req.file.filename
        });
    } else {
        res.status(400).json({ message: 'Image upload failed' });
    }
});

module.exports = router;
