const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'rojsewa/kyc',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'heic'],
    },
});

const upload = multer({ storage: storage });

const uploadVideo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'), false);
        }
    }
});

// Banner videos are capped at 10MB while they are being received, not after
// the whole file has been buffered.
const uploadBannerVideoFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) cb(null, true);
        else cb(new Error('Only video files are allowed!'), false);
    }
});

module.exports = { cloudinary, upload, uploadVideo, uploadBannerVideoFile };
