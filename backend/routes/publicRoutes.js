const express = require('express');
const router = express.Router();
const { getPublicBanners, getPublicCategories, getFeaturedProviders, getPublicProviders, getPublicConfig, getPublicServiceByProvider, getPublicProviderById, getPublicCategoryByName, getPublicCoupons, validateCoupon, verifyReferralCode, getPublicZones } = require('../controllers/homeController');
const { getPublicProviderReviews } = require('../controllers/bookingController');

router.get('/banners', getPublicBanners);
router.get('/categories', getPublicCategories);
router.get('/categories/:name', getPublicCategoryByName);
router.get('/featured-providers', getFeaturedProviders);
router.get('/providers', getPublicProviders);
router.get('/providers/:id', getPublicProviderById);
router.get('/providers/:id/reviews', getPublicProviderReviews);
router.get('/services/:providerId', getPublicServiceByProvider);
router.get('/coupons', getPublicCoupons);
router.post('/coupons/validate', validateCoupon);
router.get('/verify-referral/:code', verifyReferralCode);
router.get('/config', getPublicConfig);
router.get('/zones', getPublicZones);
router.get('/benefit-policies', require('../controllers/benefitPolicyController').getPublicBenefitPolicies);

router.get('/categories/:categoryId/subcategories', require('../controllers/subcategoryController').getPublicSubcategoriesByCategory);
router.get('/subcategories/:subcategoryId/services', require('../controllers/subcategoryController').getPublicServicesBySubcategory);

const providerBannerController = require('../controllers/providerBannerController');
router.get('/provider-banners/active', providerBannerController.getActiveBannersByLocation);
router.post('/provider-banners/:id/click', providerBannerController.trackClick);

module.exports = router;
