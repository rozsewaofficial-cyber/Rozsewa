const { pageParams, paginate } = require('../utils/pagination');
const BazaarAd = require('../models/BazaarAd');
const BazaarCategory = require('../models/BazaarCategory');
const BazaarOffer = require('../models/BazaarOffer');
const BazaarChatTemplate = require('../models/BazaarChatTemplate');
const BazaarUnlockTransaction = require('../models/BazaarUnlockTransaction');
const BazaarPIIViolation = require('../models/BazaarPIIViolation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { Wallet, Transaction } = require('../models/Wallet');
const { sendNotificationToUser } = require('../config/notificationService');
const { validationResult } = require('express-validator');
const { getIO } = require('../config/socket');
const { detectPII } = require('../utils/piiFilter');

// ========================
// SHARED RULES
// ========================

/**
 * What this ad costs a buyer to unlock, most specific answer first.
 *
 *   the ad's own override  ->  its subcategory's fee  ->  the global fee  ->  20
 *
 * This lived inline in every place that needed it, which is how the answers
 * drifted apart; there is one of it now so a new rule lands everywhere at once.
 */
const resolveUnlockFee = async (ad) => {
    if (ad.unlockFee !== null && ad.unlockFee !== undefined) return ad.unlockFee;

    if (ad.category && ad.subCategory) {
        const category = await BazaarCategory.findOne({ name: ad.category })
            .select('subCategoryUnlockFees')
            .lean();
        const match = (category?.subCategoryUnlockFees || []).find(
            (f) => String(f.subCategory).trim().toLowerCase() === String(ad.subCategory).trim().toLowerCase()
        );
        if (match && match.unlockFee !== null && match.unlockFee !== undefined) return match.unlockFee;
    }

    const setting = await Setting.findOne({ key: 'bazaar_rules' }).lean();
    return setting?.value?.bazaarCommissionFee ?? 20;
};

/**
 * Records that a buyer has paid to see a seller's contact.
 *
 * The unlock is what `BazaarUnlockTransaction` says it is — that row is what
 * `getUnlockedContactDetails` looks for before it hands over a phone number.
 * The wallet path wrote one and the gateway path did not, so a buyer who paid
 * by card was charged and still shown "Contact details locked". Both paths call
 * this now, and there is only one definition of what unlocking means.
 *
 * Safe to call twice: a second call on an already-unlocked ad returns the
 * existing record rather than charging the buyer a second entry.
 */
const finaliseUnlock = async ({ buyerId, ad, offerId = null, amount, paymentMode }) => {
    const existing = await BazaarUnlockTransaction.findOne({
        buyerId, adId: ad._id, status: 'success'
    });
    if (existing) return { record: existing, alreadyUnlocked: true };

    const record = await BazaarUnlockTransaction.create({
        buyerId,
        adId: ad._id,
        offerId: offerId || null,
        amount,
        paymentMode,
        status: 'success'
    });

    // The older flag, still read when a buyer's offer thread is served.
    await BazaarOffer.findOneAndUpdate(
        { adId: ad._id, buyerId },
        { isLeadUnlockedByBuyer: true }
    );

    try {
        await new Notification({
            recipientId: ad.sellerId,
            recipientModel: 'User',
            title: 'Contact Unlocked 🔓',
            message: `A buyer has paid ₹${amount} to view your contact for "${ad.title}". They may reach out soon!`,
            type: 'bazaar'
        }).save();
    } catch (err) {
        console.error('Bazaar unlock notify failed:', err.message);
    }

    try {
        const io = getIO();
        io.to(`user_${buyerId}`).emit('BAZAAR_UNLOCK_SUCCESS', { adId: ad._id });
        io.to(`user_${ad.sellerId}`).emit('BAZAAR_CONTACT_VIEWED', { adId: ad._id, buyerId });
    } catch (socketErr) {
        console.error('Bazaar socket emit error (finaliseUnlock):', socketErr.message);
    }

    return { record, alreadyUnlocked: false };
};

/**
 * Which templates apply to a given ad: the ones written for everything, plus
 * the ones written for its category, plus the ones for its exact subcategory.
 */
const templateScopeFor = (ad) => {
    const scopes = [{ category: { $in: ['', null] } }];
    if (ad?.category) {
        scopes.push({ category: ad.category, subCategory: { $in: ['', null] } });
        if (ad.subCategory) scopes.push({ category: ad.category, subCategory: ad.subCategory });
    }
    return { $or: scopes };
};

exports.resolveUnlockFee = resolveUnlockFee;
exports.finaliseUnlock = finaliseUnlock;
exports.templateScopeFor = templateScopeFor;

// ========================
// USER ACTIONS
// ========================

// Post a new Bazaar Ad
exports.postAd = async (req, res) => {
  try {
    const { 
      title, description, category, subCategory, brand, condition, 
      price, isNegotiable, images, location 
    } = req.body;
    
    const userId = req.user._id;

    if (!images || images.length < 2 || images.length > 10) {
      return res.status(400).json({ success: false, message: 'Please upload between 2 to 10 images.' });
    }

    // Fetch user for contact info (User or Provider)
    const user = req.user;
    // AI Check Simulation (In real world, call an API like Google Cloud Vision here)
    // For now, assume it's safe. It goes to 'pending_review' anyway as per Blueprint Phase 2 Step 7.
    let status = 'pending_review';

    const newAd = new BazaarAd({
      sellerId: userId,
      title,
      description,
      category,
      subCategory,
      brand,
      condition,
      price,
      isNegotiable,
      images,
      dynamicFields: req.body.dynamicFields || {},
      location: {
        type: 'Point',
        coordinates: location.coordinates, // [lng, lat]
        areaName: location.areaName,
        city: location.city,
        state: location.state,
        exactAddress: location.exactAddress, // Hidden
        houseNumber: location.houseNumber    // Hidden
      },
      status: status,
      contactDetails: {
        phone: user.mobile, // From user model
        isVerified: user.isVerified
      }
    });

    await newAd.save();

    res.status(201).json({
      success: true,
      message: 'Ad posted successfully and is under review.',
      data: newAd
    });
  } catch (error) {
    console.error('Post Ad Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server Error', error: error });
  }
};

// Get Live Ads (For Buyers - Includes Distance Sorting if lat/lng provided)
exports.getLiveAds = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, condition, lat, lng, radiusKm = 10, search } = req.query;

    const query = { status: 'live' };

    if (category) query.category = category;
    if (condition) query.condition = condition;
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Escaped: what a shopper typed is text to look for, not a pattern to run.
    const escape = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);

    if (search) {
      const safe = escape(search);
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } }
      ];
    }

    // The browse screen filters by town, which it cannot do over one page.
    if (req.query.city) {
      query['location.city'] = { $regex: escape(req.query.city), $options: 'i' };
    }

    // GeoSpatial Search if lat/lng provided
    if (lat && lng) {
      query.location = {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(radiusKm) * 1000 // Convert km to meters
        }
      };
    }

    // A marketplace listing page is browsed, not exhausted: one page at a
    // time, with the count so the browser knows there is more.
    const adParams = pageParams(req);
    const [adTotal, ads] = await Promise.all([
      BazaarAd.countDocuments(query),
      paginate(
        BazaarAd.find(query)
          .select('-contactDetails -location.exactAddress -location.houseNumber') // STRICTLY HIDE SENSITIVE INFO
          .sort(lat && lng ? {} : { createdAt: -1 })
          .lean(),
        adParams
      )
    ]);

    const User = require('../models/User');
    const Provider = require('../models/Provider');

    // Two queries for the whole page, rather than two per ad on it. This used
    // to run a findById per listing, so a page of thirty cost sixty round trips.
    const sellerIds = [...new Set(ads.map(a => a.sellerId).filter(Boolean).map(String))];
    const [sellerUsers, sellerProviders] = await Promise.all([
      User.find({ _id: { $in: sellerIds } }).select('name sellerProfile.isVerifiedSeller sellerProfile.trustScore').lean(),
      Provider.find({ _id: { $in: sellerIds } }).select('ownerName name isVerified').lean()
    ]);

    const sellerById = new Map();
    sellerUsers.forEach(u => sellerById.set(String(u._id), u));
    // A provider selling something is shown the same way a user is, so their
    // fields are normalised here rather than at every point of use.
    sellerProviders.forEach(p => {
      if (sellerById.has(String(p._id))) return;
      sellerById.set(String(p._id), {
        ...p,
        name: p.ownerName || p.name,
        sellerProfile: { isVerifiedSeller: p.isVerified, trustScore: 100 }
      });
    });

    for (let ad of ads) {
      if (ad.sellerId) {
        ad.sellerId = sellerById.get(String(ad.sellerId)) || { _id: ad.sellerId }; // Fallback
      }
    }

    // How many listings match, so the browser knows there are more pages.
    res.json({ success: true, count: adTotal, pageCount: ads.length, data: ads });
  } catch (error) {
    console.error('Get Live Ads Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get User's Own Ads
exports.getUserAds = async (req, res) => {
  try {
    const userId = req.user._id;
    // A seller's own listings grow without limit, so they arrive a page at a
    // time and the count describes all of them rather than the page.
    const [count, ads] = await Promise.all([
      BazaarAd.countDocuments({ sellerId: userId }),
      paginate(BazaarAd.find({ sellerId: userId }).sort({ createdAt: -1 }), pageParams(req))
    ]);
    res.json({ success: true, count, data: ads });
  } catch (error) {
    console.error('Get User Ads Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Seller marks their own ad as sold — RozSewa has no visibility into the
// actual off-app transaction (that happens after contact unlock), so this
// is a deliberate seller action, never automatic. Once sold, the ad drops
// out of getLiveAds (status filter already excludes non-'live' ads) and
// makeOffer already rejects new offers on a non-'live' ad — no other
// listing-query changes are needed for it to disappear from browsing.
exports.markAdSold = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user._id;

    const ad = await BazaarAd.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    if (ad.sellerId.toString() !== sellerId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only mark your own ads as sold' });
    }

    if (!['live', 'deal_locked'].includes(ad.status)) {
      return res.status(400).json({ success: false, message: `Cannot mark an ad as sold from its current status (${ad.status})` });
    }

    ad.status = 'sold';
    await ad.save();

    // Notify buyers with an still-open (non-rejected) negotiation thread so
    // they aren't left waiting on a deal that can no longer close.
    try {
      // Everyone still negotiating on this one ad. Only the buyer is read off
      // each, and a ceiling keeps a notification fan-out bounded.
      const openOffers = await BazaarOffer.find({
        adId: id,
        status: { $in: ['pending', 'countered', 'deal_locked'] }
      })
        .select('buyerId')
        .limit(500)
        .lean();
      for (const offer of openOffers) {
        await new Notification({
          recipientId: offer.buyerId,
          recipientModel: 'User',
          title: 'Item No Longer Available',
          message: `"${ad.title}" was marked as sold by the seller.`,
          type: 'bazaar'
        }).save();
      }
    } catch (notifyErr) {
      console.error('Mark Sold — buyer notification error:', notifyErr.message);
    }

    res.json({ success: true, message: 'Ad marked as sold', data: ad });
  } catch (error) {
    console.error('Mark Ad Sold Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get Single Ad Details (Public)
exports.getSingleAd = async (req, res) => {
  try {
    const { id } = req.params;
    let ad = await BazaarAd.findById(id)
      .select('-contactDetails -location.exactAddress -location.houseNumber') // STRICTLY HIDE SENSITIVE INFO
      .lean();

    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    
    // Manually populate sellerId
    const User = require('../models/User');
    const Provider = require('../models/Provider');
    if (ad.sellerId) {
      let seller = await User.findById(ad.sellerId).select('name sellerProfile.isVerifiedSeller sellerProfile.trustScore').lean();
      if (!seller) {
        seller = await Provider.findById(ad.sellerId).select('ownerName name isVerified').lean();
        if (seller) {
          seller.name = seller.ownerName || seller.name;
          seller.sellerProfile = { isVerifiedSeller: seller.isVerified, trustScore: 100 };
        }
      }
      ad.sellerId = seller || { _id: ad.sellerId };
    }

    // Increment views
    await BazaarAd.findByIdAndUpdate(id, { $inc: { 'metrics.views': 1 } });

    res.json({ success: true, data: ad });
  } catch (error) {
    console.error('Get Single Ad Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// ADMIN ACTIONS
// ========================

// Get Pending Ads for Manual Review
exports.getPendingAds = async (req, res) => {
  try {
    // A moderation queue is worked through, not read in one go.
    const scope = { status: 'pending_review' };
    const [total, ads] = await Promise.all([
      BazaarAd.countDocuments(scope),
      paginate(
        BazaarAd.find(scope).populate('sellerId', 'name mobile').sort({ createdAt: 1 }),
        pageParams(req)
      )
    ]);

    res.json({ success: true, total, data: ads });
  } catch (error) {
    console.error('Get Pending Ads Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get All Ads for Admin Management (Live, Rejected, Sold, etc.)
exports.getAllAdminAds = async (req, res) => {
  try {
    const { status, search, category, subCategory } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    } else {
      query.status = { $ne: 'pending_review' };
    }
    if (category) query.category = category;
    // Only meaningful alongside a category — a subcategory name is not
    // unique across categories, so filtering by it alone could mix ads
    // from an unrelated category that happens to reuse the same tag.
    if (subCategory && category) query.subCategory = subCategory;
    if (search) {
      // Escaped: what was typed is a title to look for, not a pattern to run.
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
      query.$or = [
        { title: { $regex: safe, $options: 'i' } }
      ];
    }

    const [total, ads] = await Promise.all([
      BazaarAd.countDocuments(query),
      paginate(
        BazaarAd.find(query).populate('sellerId', 'name mobile').sort({ createdAt: -1 }),
        pageParams(req)
      )
    ]);

    res.json({ success: true, total, data: ads });
  } catch (error) {
    console.error('Get All Admin Ads Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Delete any ad (Admin only)
exports.deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await BazaarAd.findByIdAndDelete(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    
    res.json({ success: true, message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Delete Ad Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin Approve or Reject Ad
// Now also accepts: unlockFee (optional per-product override), adminNote (internal note)
exports.reviewAd = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason, unlockFee, adminNote } = req.body;

    const ad = await BazaarAd.findById(id);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    if (action === 'approve') {
      ad.status = 'live';
      // Set expiry to 30 days from now
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      ad.expiresAt = expiry;

      // Per-product unlock fee override (null = use global default from Settings)
      if (unlockFee !== undefined && unlockFee !== null && unlockFee !== '') {
        const parsed = parseFloat(unlockFee);
        ad.unlockFee = isNaN(parsed) ? null : parsed;
      } else {
        ad.unlockFee = null; // Null = fall back to global Setting
      }

      // Internal admin note
      if (adminNote) ad.adminNote = adminNote;
      
      await ad.save();

      // Notify User
      await new Notification({
        recipientId: ad.sellerId,
        recipientModel: 'User',
        title: 'Ad Approved! 🎉',
        message: `Your ad "${ad.title}" is now live on RozSewa Bazaar.`,
        type: 'bazaar'
      }).save();

      res.json({ success: true, message: 'Ad approved and is now live.' });
    } else if (action === 'reject') {
      ad.status = 'rejected';
      ad.rejectionReason = rejectionReason || 'Violated community guidelines';
      if (adminNote) ad.adminNote = adminNote;
      await ad.save();

      // Notify User
      await new Notification({
        recipientId: ad.sellerId,
        recipientModel: 'User',
        title: 'Ad Rejected ❌',
        message: `Your ad "${ad.title}" was rejected. Reason: ${ad.rejectionReason}`,
        type: 'bazaar'
      }).save();

      res.json({ success: true, message: 'Ad rejected.' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Review Ad Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// CATEGORY MANAGEMENT
// ========================

// Get all active categories (Public)
// The towns and categories that actually have something for sale right now.
// The browse screen used to derive these from the listings it had been sent,
// which now means the page it is looking at.
exports.getLiveFacets = async (req, res) => {
  try {
    const [cities, categories] = await Promise.all([
      BazaarAd.distinct('location.city', { status: 'live' }),
      BazaarAd.distinct('category', { status: 'live' })
    ]);

    res.json({
      success: true,
      data: {
        cities: cities.filter(Boolean).sort(),
        categories: categories.filter(Boolean).sort()
      }
    });
  } catch (error) {
    console.error('Get Live Facets Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await BazaarCategory.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Create a new category (Admin)
exports.createCategory = async (req, res) => {
  try {
    const { name, icon, order, description, subCategories, fields } = req.body;
    
    // Check if exists
    const existing = await BazaarCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
       return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = new BazaarCategory({ name, icon, order, description, subCategories, fields });
    await category.save();
    
    res.status(201).json({ success: true, data: category, message: 'Category added successfully' });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Update a category (Admin)
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, order, description, subCategories, fields, isActive, subCategoryUnlockFees } = req.body;
    
    const category = await BazaarCategory.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (order !== undefined) category.order = order;
    if (description !== undefined) category.description = description;
    if (subCategories) category.subCategories = subCategories;
    if (fields) category.fields = fields;
    if (isActive !== undefined) category.isActive = isActive;

    // Per-subcategory unlock fees. Only entries naming a real subcategory of
    // this category are kept, and a blank fee means "no override" rather than
    // "free", so clearing the box falls back to the global fee instead of
    // quietly making contacts cost nothing.
    if (subCategoryUnlockFees !== undefined) {
      const known = (category.subCategories || []).map(sc => String(sc).trim().toLowerCase());
      category.subCategoryUnlockFees = (Array.isArray(subCategoryUnlockFees) ? subCategoryUnlockFees : [])
        .filter(f => f && f.subCategory && known.includes(String(f.subCategory).trim().toLowerCase()))
        .filter(f => f.unlockFee !== null && f.unlockFee !== undefined && f.unlockFee !== '')
        .map(f => ({ subCategory: String(f.subCategory).trim(), unlockFee: Math.max(0, Number(f.unlockFee) || 0) }));
    }

    await category.save();
    
    res.json({ success: true, data: category, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Delete a category (Admin)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Optional: Check if ads exist for this category before deleting
    await BazaarCategory.findByIdAndDelete(id);
    
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// BIDDING & NEGOTIATION
// ========================

exports.makeOffer = async (req, res) => {
  try {
    const { adId, actionType, numericAmount, predefinedMessage } = req.body;
    const buyerId = req.user._id;

    // Validate Input
    if (!['numeric_offer', 'predefined_query'].includes(actionType)) {
      return res.status(400).json({ success: false, message: 'Invalid action type' });
    }

    if (actionType === 'numeric_offer' && (!numericAmount || isNaN(numericAmount) || numericAmount <= 0)) {
       return res.status(400).json({ success: false, message: 'Invalid numeric offer' });
    }

    const ad = await BazaarAd.findById(adId);
    if (!ad || ad.status !== 'live') return res.status(400).json({ success: false, message: 'Ad is not available for offers' });

    if (ad.sellerId.toString() === buyerId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot make an offer on your own ad' });
    }

    // ── RULE 1: Chat messages can only be sent AFTER a numeric offer thread exists + Max Limit check
    if (actionType === 'predefined_query') {
      const existingThread = await BazaarOffer.findOne({ adId, buyerId });
      if (!existingThread) {
        return res.status(400).json({
          success: false,
          message: 'Please make a price offer first before sending messages.'
        });
      }

      let settings = await Setting.findOne({ key: 'bazaar_rules' });
      const maxChatMsgs = settings?.value?.maxChatMessages ?? 10;
      
      const totalChatMsgs = existingThread.offerHistory.filter(m => m.actionType === 'predefined_query').length;
      if (totalChatMsgs >= maxChatMsgs) {
        return res.status(400).json({
          success: false,
          message: `Maximum chat message limit (${maxChatMsgs}) reached for this negotiation.`
        });
      }

      // Block messages once the deal is locked or rejected — no more chatter needed
      if (existingThread.status === 'deal_locked') {
        return res.status(400).json({
          success: false,
          message: 'Deal is already locked. Use the contact details to communicate directly.'
        });
      }

      // ── RULE 2: Template allowlist validation + PII check
      // A. Text must strictly match an active admin chat template for 'buyer' or 'both'
      // Scoped the same way the picker is, or a buyer could be offered a
      // subcategory template and then refused for sending it.
      const matchedTemplate = await BazaarChatTemplate.findOne({
        text: predefinedMessage,
        forRole: { $in: ['buyer', 'both'] },
        isActive: true,
        ...templateScopeFor(ad)
      });

      if (!matchedTemplate) {
        // Log violation if custom text containing PII was injected via direct API call
        const piiResult = detectPII(predefinedMessage);
        if (piiResult.containsPII) {
          await BazaarPIIViolation.create({
            userId: buyerId,
            adId,
            offerId: existingThread._id,
            attemptedText: predefinedMessage,
            detectedType: piiResult.type || 'template_bypass',
            reason: piiResult.reason || 'Custom message injected bypassing chat templates'
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Custom chat messages are not allowed. Please select from quick-reply options.'
        });
      }

      // B. Secondary PII check on the template text (just in case an admin template itself contains contact info)
      const piiCheck = detectPII(predefinedMessage);
      if (piiCheck.containsPII) {
        await BazaarPIIViolation.create({
          userId: buyerId,
          adId,
          offerId: existingThread._id,
          attemptedText: predefinedMessage,
          detectedType: piiCheck.type,
          reason: piiCheck.reason
        });
        return res.status(400).json({
          success: false,
          message: 'Message blocked due to security policies (contact sharing not allowed).'
        });
      }
    }

    // Fetch Admin Settings for Bargaining Rules
    let settings = await Setting.findOne({ key: 'bazaar_rules' });
    const rules = settings ? settings.value : { minOfferPercentage: 50, maxCounterAttempts: 3 };

    if (actionType === 'numeric_offer') {
      const minAllowed = (rules.minOfferPercentage / 100) * ad.price;
      if (numericAmount < minAllowed) {
         return res.status(400).json({ success: false, message: `Offer must be at least ${rules.minOfferPercentage}% of the asking price (₹${minAllowed})` });
      }
      if (numericAmount > ad.price) {
         return res.status(400).json({ success: false, message: `Offer price cannot exceed the asking price (₹${ad.price.toLocaleString('en-IN')})` });
      }
    }

    let offer = await BazaarOffer.findOne({ adId, buyerId });

    if (!offer) {
      offer = new BazaarOffer({
        adId,
        buyerId,
        sellerId: ad.sellerId,
        currentOfferAmount: actionType === 'numeric_offer' ? numericAmount : ad.price,
        offerHistory: []
      });
    } else {
      if (offer.status === 'deal_locked' || offer.status === 'completed') {
        return res.status(400).json({ success: false, message: `Offer is already ${offer.status}` });
      }
      if (actionType === 'numeric_offer' && offer.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Your previous offer is waiting for the seller to respond. Please wait for the seller to accept, reject, or counter.'
        });
      }
      if (offer.status === 'rejected') {
        // Reset counter attempts and re-open the negotiation
        offer.counterAttempts = 0;
        offer.status = 'pending';
      }
    }

    // Add to history
    offer.offerHistory.push({
      actionType,
      senderId: buyerId,
      numericAmount,
      predefinedMessage
    });

    if (actionType === 'numeric_offer') {
      offer.currentOfferAmount = numericAmount;
      offer.status = 'pending'; // Buyer just proposed a new amount
    }

    await offer.save();

    // Increment metrics
    if (offer.offerHistory.length === 1) {
      await BazaarAd.findByIdAndUpdate(adId, { $inc: { 'metrics.offersCount': 1 } });
    }

    // Notify Seller
    await new Notification({
      recipientId: ad.sellerId,
      recipientModel: 'User',
      title: actionType === 'numeric_offer' ? 'New Offer Received 💰' : 'New Query on Bazaar Ad',
      message: actionType === 'numeric_offer' ? `Someone offered ₹${numericAmount} on "${ad.title}"` : `A buyer asked: "${predefinedMessage}" on "${ad.title}"`,
      type: 'bazaar'
    }).save();

    // Real-time: notify both buyer and seller immediately
    try {
      const io = getIO();
      const payload = { adId: adId.toString(), offerId: offer._id.toString() };
      io.to(`user_${buyerId}`).emit('BAZAAR_OFFER_UPDATED', payload);
      io.to(`user_${ad.sellerId}`).emit('BAZAAR_OFFER_UPDATED', payload);
    } catch (socketErr) {
      console.error('Bazaar socket emit error (makeOffer):', socketErr.message);
    }

    res.json({ success: true, message: 'Offer sent successfully', data: offer });
  } catch (error) {
    console.error('Make Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get User Offers (where user is buyer or seller)
exports.getUserOffers = async (req, res) => {
  try {
    const userId = req.user._id;
    const offerScope = {
      $or: [
        { sellerId: userId },
        { buyerId: userId }
      ]
    };
    // Negotiations accumulate for as long as someone uses the marketplace.
    const offers = await paginate(
      BazaarOffer.find(offerScope)
        .populate('adId', 'title price images')
        .populate('buyerId', 'name')
        .populate('sellerId', 'name')
        .sort({ updatedAt: -1 }),
      pageParams(req)
    );

    res.json({ success: true, data: offers });
  } catch (error) {
    console.error('Get User Offers Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.respondToOffer = async (req, res) => {
  try {
    const { offerId, action, numericAmount } = req.body; // action: 'accept', 'reject', 'counter'
    const sellerId = req.user._id;

    const offer = await BazaarOffer.findById(offerId).populate('adId');
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });

    const isSeller = offer.sellerId.toString() === sellerId.toString();
    const isBuyer = offer.buyerId.toString() === sellerId.toString();

    if (!isSeller && !isBuyer) {
       return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (offer.status === 'deal_locked' || offer.status === 'rejected') {
      return res.status(400).json({ success: false, message: 'Offer is already finalized' });
    }

    if (action === 'accept') {
      if (isBuyer && offer.status !== 'countered') {
        return res.status(400).json({ success: false, message: 'You can only accept a countered offer' });
      }
      if (isSeller && offer.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'You can only accept an active pending offer' });
      }

      offer.status = 'deal_locked';
      offer.offerHistory.push({
        actionType: 'system_message',
        senderId: sellerId,
        predefinedMessage: 'Deal Locked! Both parties must pay the lead fee to view contacts.'
      });
    } else if (action === 'reject') {
      if (isBuyer) return res.status(403).json({ success: false, message: 'Only seller can explicitly reject' });
      offer.status = 'rejected';
      offer.offerHistory.push({
        actionType: 'system_message',
        senderId: sellerId,
        predefinedMessage: 'Offer Rejected by Seller.'
      });
    } else if (action === 'counter') {
       if (isBuyer) return res.status(403).json({ success: false, message: 'Buyers cannot counter directly, make a new offer' });
       if (offer.status === 'countered') {
         return res.status(400).json({
           success: false,
           message: 'You have already sent a counter offer. Please wait for the buyer to accept or make a new offer.'
         });
       }
       if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
         return res.status(400).json({ success: false, message: 'Invalid counter amount' });
       }
       if (numericAmount > offer.adId.price) {
         return res.status(400).json({ success: false, message: `Counter price cannot exceed the asking price (₹${offer.adId.price.toLocaleString('en-IN')})` });
       }
       
       let settings = await Setting.findOne({ key: 'bazaar_rules' });
       const rules = settings ? settings.value : { minOfferPercentage: 50, maxCounterAttempts: 3 };

       if (offer.counterAttempts >= rules.maxCounterAttempts) {
         return res.status(400).json({ success: false, message: `Maximum counter attempts (${rules.maxCounterAttempts}) reached.` });
       }
       
       offer.status = 'countered';
       offer.currentOfferAmount = numericAmount;
       offer.counterAttempts += 1;
       
       offer.offerHistory.push({
         actionType: 'numeric_offer',
         senderId: sellerId,
         numericAmount
       });
    } else {
       return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    await offer.save();

    // Notify Buyer
    const recipientId = isSeller ? offer.buyerId : offer.sellerId;
    await new Notification({
      recipientId,
      recipientModel: 'User',
      title: action === 'accept' ? 'Deal Locked! 🤝' : (action === 'reject' ? 'Offer Rejected' : 'Counter Offer Received'),
      message: action === 'accept' ? `${isSeller ? 'Seller' : 'Buyer'} accepted the offer on "${offer.adId?.title}". Unlock contact now.` : `Seller responded to your offer on "${offer.adId?.title}"`,
      type: 'bazaar'
    }).save();

    // Real-time: notify both buyer and seller immediately
    try {
      const io = getIO();
      const payload = { adId: offer.adId?._id?.toString() || offer.adId?.toString(), offerId: offer._id.toString() };
      io.to(`user_${offer.buyerId}`).emit('BAZAAR_OFFER_UPDATED', payload);
      io.to(`user_${offer.sellerId}`).emit('BAZAAR_OFFER_UPDATED', payload);
    } catch (socketErr) {
      console.error('Bazaar socket emit error (respondToOffer):', socketErr.message);
    }

    res.json({ success: true, message: `Offer ${action}ed successfully`, data: offer });

  } catch (error) {
    console.error('Respond Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getOfferHistory = async (req, res) => {
  try {
    const { adId } = req.params;
    const { offerId } = req.query;
    const userId = req.user._id;

    const ad = await BazaarAd.findById(adId);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    let offer;
    if (ad.sellerId.toString() === userId.toString()) {
       if (offerId) {
         const specificOffer = await BazaarOffer.findById(offerId).populate('buyerId', 'name avatar').lean();
         return res.json({ success: true, data: specificOffer ? [specificOffer] : [] });
       }
       // Every negotiation on one listing — few in practice, capped all the same.
    const offers = await BazaarOffer.find({ adId })
      .populate('buyerId', 'name avatar')
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();
       return res.json({ success: true, data: offers });
    } else {
       offer = await BazaarOffer.findOne({ adId, buyerId: userId }).lean();
       if (offer && offer.isLeadUnlockedByBuyer) {
         offer.sellerContactDetails = ad.contactDetails;
         offer.sellerLocation = ad.location;
       }
       return res.json({ success: true, data: offer ? [offer] : [] });
    }
  } catch (error) {
    console.error('Get Offer History Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// UNLOCK CONTACT (PAID)
// ========================

/**
 * Check if the current buyer has already unlocked this ad's contact,
 * and return the applicable unlock fee + deal lock state.
 * The UI uses this to show the correct CTA:
 *   - No offer yet      → "Make an offer to start"
 *   - Offer pending     → "Waiting for seller to accept"
 *   - deal_locked       → "Pay to unlock contact"
 *   - Already paid      → Show contact details
 */
exports.checkUnlockStatus = async (req, res) => {
  try {
    const { adId } = req.params;
    const buyerId = req.user._id;

    // category and subCategory are needed to price the unlock; leaving them out
    // of the projection silently charged every subcategory the global fee.
    const ad = await BazaarAd.findById(adId).select('unlockFee status sellerId category subCategory');
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    const isSeller = ad.sellerId.toString() === buyerId.toString();

    const fee = await resolveUnlockFee(ad);

    // Check if already paid-unlock exists
    const existingUnlock = await BazaarUnlockTransaction.findOne({
      buyerId,
      adId,
      status: 'success'
    });

    // Check offer state so UI can guide buyer correctly
    let dealState = 'no_offer'; // no_offer | offer_pending | countered | deal_locked
    if (!isSeller) {
      const offer = await BazaarOffer.findOne({ adId, buyerId }).select('status');
      if (offer) {
        dealState = offer.status; // 'pending' | 'countered' | 'deal_locked' | 'rejected'
      }
    }

    res.json({
      success: true,
      data: {
        isUnlocked: !!existingUnlock,
        fee,
        adStatus: ad.status,
        isSeller,
        dealState // frontend uses this to show the right CTA
      }
    });
  } catch (error) {
    console.error('Check Unlock Status Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


/**
 * GET /bazaar/unlock/contact/:adId
 * Returns full contact details if buyer has a verified unlock transaction.
 * This is the secure server-side gate — never trust client-side flags.
 */
exports.getUnlockedContactDetails = async (req, res) => {
  try {
    const { adId } = req.params;
    const buyerId = req.user._id;

    const ad = await BazaarAd.findById(adId);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    // Sellers can always see their own ad contact (it's theirs)
    if (ad.sellerId.toString() === buyerId.toString()) {
      return res.json({
        success: true,
        data: {
          phone: ad.contactDetails?.phone,
          exactAddress: ad.location?.exactAddress,
          houseNumber: ad.location?.houseNumber,
          areaName: ad.location?.areaName,
          city: ad.location?.city
        }
      });
    }

    // For buyers: verify they have a successful unlock transaction
    const unlock = await BazaarUnlockTransaction.findOne({
      buyerId,
      adId,
      status: 'success'
    });

    if (!unlock) {
      return res.status(403).json({
        success: false,
        message: 'Contact details locked. Please pay the unlock fee first.'
      });
    }

    res.json({
      success: true,
      data: {
        phone: ad.contactDetails?.phone,
        exactAddress: ad.location?.exactAddress,
        houseNumber: ad.location?.houseNumber,
        areaName: ad.location?.areaName,
        city: ad.location?.city
      }
    });
  } catch (error) {
    console.error('Get Unlocked Contact Details Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * POST /bazaar/unlock
 * Buyer pays the unlock fee (wallet deduction) to reveal seller's contact.
 *
 * BUSINESS RULES (enforced server-side, never trust client):
 * 1. A BazaarOffer with status 'deal_locked' MUST exist for (buyerId, adId).
 *    Both parties must have agreed on a price before contact is revealed.
 * 2. Predefined chat messages ("Hi", "Is it available?") do NOT satisfy this —
 *    only a numeric offer that was accepted by the seller creates deal_locked.
 * 3. Atomic wallet deduction with $gte guard prevents overdraft race conditions.
 * 4. Unique index on (buyerId, adId) prevents double-charge.
 */
exports.unlockLead = async (req, res) => {
  try {
    const { adId, offerId } = req.body;
    const buyerId = req.user._id;

    if (!adId) {
      return res.status(400).json({ success: false, message: 'adId is required' });
    }

    const ad = await BazaarAd.findById(adId);
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });

    if (ad.status !== 'live') {
      return res.status(400).json({ success: false, message: 'This ad is not currently available' });
    }

    // Prevent seller from unlocking their own ad
    if (ad.sellerId.toString() === buyerId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot unlock your own ad' });
    }

    // ── GATE: Both parties must have agreed on a deal (deal_locked) first.
    // Chat messages, queries, or browsing do NOT qualify.
    // Only a numeric offer accepted by the seller transitions status → 'deal_locked'.
    const lockedOffer = await BazaarOffer.findOne({
      adId,
      buyerId,
      status: 'deal_locked'
    });
    if (!lockedOffer) {
      return res.status(403).json({
        success: false,
        code: 'DEAL_NOT_LOCKED',
        message: 'You can only unlock contact after both parties agree on a price. Make an offer and wait for the seller to accept it first.'
      });
    }

    // Check for existing successful unlock — prevents double-payment
    const existingUnlock = await BazaarUnlockTransaction.findOne({
      buyerId,
      adId,
      status: 'success'
    });
    if (existingUnlock) {
      return res.status(400).json({ success: false, message: 'You have already unlocked this ad' });
    }

    const fee = await resolveUnlockFee(ad);

    // Fetch buyer's wallet
    const buyerWallet = await Wallet.findOne({ userId: buyerId });
    if (!buyerWallet) {
      return res.status(402).json({
        success: false,
        message: 'Wallet not found. Please set up your wallet first.',
        feeRequired: fee,
        currentBalance: 0
      });
    }

    if (buyerWallet.balance < fee) {
      return res.status(402).json({
        success: false,
        message: `Insufficient wallet balance. You need ₹${fee} to unlock this contact.`,
        feeRequired: fee,
        currentBalance: buyerWallet.balance
      });
    }

    // ATOMIC wallet deduction — use $gte guard to prevent race conditions
    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId: buyerId, balance: { $gte: fee } },
      {
        $inc: { balance: -fee, availableBalance: -fee },
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedWallet) {
      return res.status(402).json({
        success: false,
        message: 'Insufficient balance. Please add funds and try again.',
        feeRequired: fee,
        currentBalance: buyerWallet.balance
      });
    }

    // Record Transaction (debit buyer)
    await Transaction.create({
      userId: buyerId,
      title: 'Bazaar Contact Unlock',
      amount: fee,
      type: 'debit',
      status: 'completed',
      description: `Unlocked contact for Bazaar ad: "${ad.title}"`
    });

    // Recording the unlock, notifying the seller and the live update all happen
    // in one place, shared with the gateway path.
    const { record: unlockRecord } = await finaliseUnlock({
      buyerId, ad, offerId, amount: fee, paymentMode: 'wallet'
    });

    // Return contact details immediately after successful payment
    res.json({
      success: true,
      message: '🎉 Contact unlocked successfully!',
      data: {
        phone: ad.contactDetails?.phone,
        exactAddress: ad.location?.exactAddress,
        houseNumber: ad.location?.houseNumber,
        areaName: ad.location?.areaName,
        city: ad.location?.city,
        newWalletBalance: updatedWallet.balance
      }
    });
  } catch (error) {
    // Handle duplicate key error (race condition double-unlock attempt)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already unlocked this ad' });
    }
    console.error('Unlock Lead Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// CHAT TEMPLATE ACTIONS
// ========================

/**
 * GET /bazaar/chat-templates?role=buyer|seller
 * role param filters templates by forRole field.
 * 'both' templates are always included regardless of role filter.
 */
exports.getChatTemplates = async (req, res) => {
  try {
    const { role, adId } = req.query; // 'buyer' or 'seller'
    let query = { isActive: true };

    if (role === 'buyer') {
      query.forRole = { $in: ['buyer', 'both'] };
    } else if (role === 'seller') {
      query.forRole = { $in: ['seller', 'both'] };
    }
    // No role filter = return all active templates (admin view)

    // Asked for a particular ad, only the templates that suit it come back:
    // the general ones, plus its category's, plus its subcategory's. Without an
    // ad this is the admin list, which shows everything.
    if (adId) {
      const ad = await BazaarAd.findById(adId).select('category subCategory').lean();
      if (ad) Object.assign(query, templateScopeFor(ad));
    }

    const templates = await BazaarChatTemplate.find(query).sort({ order: 1 });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.createChatTemplate = async (req, res) => {
  try {
    const { text, order, forRole, category, subCategory } = req.body;
    const template = await BazaarChatTemplate.create({
      text,
      order,
      forRole: forRole || 'buyer',
      // Blank means it applies everywhere. A subcategory without a category
      // would match nothing, so it is only kept alongside one.
      category: (category || '').trim(),
      subCategory: category ? (subCategory || '').trim() : ''
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateChatTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, order, forRole, isActive, category, subCategory } = req.body;
    const template = await BazaarChatTemplate.findById(id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    if (text !== undefined) template.text = text;
    if (order !== undefined) template.order = order;
    if (forRole !== undefined) template.forRole = forRole;
    if (isActive !== undefined) template.isActive = isActive;
    if (category !== undefined) {
      template.category = (category || '').trim();
      // A subcategory only means something inside a category; clearing the
      // category has to clear it too, or the template would match nothing.
      if (!template.category) template.subCategory = '';
    }
    if (subCategory !== undefined && template.category) {
      template.subCategory = (subCategory || '').trim();
    }

    await template.save();
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.deleteChatTemplate = async (req, res) => {
  try {
    await BazaarChatTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


// ========================
// BAZAAR RULES / SETTINGS
// ========================
exports.getBazaarSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'bazaar_rules' });
    if (!setting) {
      setting = await new Setting({
        key: 'bazaar_rules',
        value: { minOfferPercentage: 50, maxCounterAttempts: 3, bazaarCommissionFee: 20, maxChatMessages: 10 }
      }).save();
    }
    // Ensure fallback if key exists but maxChatMessages is undefined
    if (setting.value.maxChatMessages === undefined) {
      setting.value.maxChatMessages = 10;
    }
    res.json({ success: true, data: setting.value });
  } catch (error) {
    console.error('Get Bazaar Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.updateBazaarSettings = async (req, res) => {
  try {
    const { minOfferPercentage, maxCounterAttempts, bazaarCommissionFee, maxChatMessages } = req.body;
    let setting = await Setting.findOne({ key: 'bazaar_rules' });
    
    const newValue = {
      minOfferPercentage: minOfferPercentage !== undefined ? minOfferPercentage : 50,
      maxCounterAttempts: maxCounterAttempts !== undefined ? maxCounterAttempts : 3,
      bazaarCommissionFee: bazaarCommissionFee !== undefined ? bazaarCommissionFee : 20,
      maxChatMessages: maxChatMessages !== undefined ? maxChatMessages : 10
    };

    if (!setting) {
      setting = new Setting({ key: 'bazaar_rules', value: newValue });
    } else {
      setting.value = newValue;
    }
    await setting.save();
    
    res.json({ success: true, message: 'Bazaar rules updated successfully', data: setting.value });
  } catch (error) {
    console.error('Update Bazaar Settings Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// GET ALL TRANSACTIONS (ADMIN)
// ========================

exports.getBazaarTransactions = async (req, res) => {
  try {
    // Every successful unlock, with buyer and ad attached to each.
    const transactions = await paginate(
      BazaarUnlockTransaction.find({ status: 'success' })
        .populate('buyerId', 'name mobile')
        .populate('adId', 'title price category')
        .sort({ createdAt: -1 }),
      pageParams(req)
    );

    const setting = await Setting.findOne({ key: 'bazaar_rules' });
    const globalFee = setting?.value?.bazaarCommissionFee || 20;

    // Both cards above this table describe every unlock ever made, so neither
    // is measured off the page of them returned here.
    const [totals] = await BazaarUnlockTransaction.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);

    res.json({
      success: true,
      data: transactions,
      globalFee,
      totalUnlocks: totals?.count || 0,
      totalRevenue: Math.round((totals?.revenue || 0) * 100) / 100
    });
  } catch (error) {
    console.error('Get Bazaar Transactions Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


exports.editAdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category, condition, dynamicFields } = req.body;
    const ad = await BazaarAd.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    ad.title = title || ad.title;
    ad.description = description || ad.description;
    ad.price = price || ad.price;
    ad.category = category || ad.category;
    ad.condition = condition || ad.condition;
    if (dynamicFields) ad.dynamicFields = dynamicFields;
    await ad.save();
    res.json({ success: true, message: 'Ad updated successfully', data: ad });
  } catch (error) {
    console.error('Edit Ad Admin Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};



// Get all offer requests received on seller's ads
exports.getSellerOfferRequests = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all ads belonging to this user
    // The offers carry the ad they are on, so the seller's listings are only
    // needed as ids.
    const myAds = await BazaarAd.find({ sellerId: userId }).select('_id').lean();
    const adIds = myAds.map(a => a._id);

    const offers = await paginate(
      BazaarOffer.find({ adId: { $in: adIds } })
        .populate('adId', 'title images price')
        .populate('buyerId', 'name avatar')
        .sort({ updatedAt: -1 }),
      pageParams(req)
    );

    res.json({ success: true, data: offers });
  } catch (error) {
    console.error('Get Seller Offer Requests Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get all Bazaar offer chats for Admin Inspection
exports.getAllBazaarOffersAdmin = async (req, res) => {
  try {
    // Every negotiation ever held on the platform, so: a page of them.
    const [total, offers] = await Promise.all([
      BazaarOffer.countDocuments(),
      paginate(
        BazaarOffer.find()
          .populate('adId', 'title category price images')
          .populate('buyerId', 'name mobile email')
          .populate('sellerId', 'name mobile email')
          .sort({ updatedAt: -1 }),
        pageParams(req)
      )
    ]);

    res.json({ success: true, total, data: offers });
  } catch (error) {
    console.error('Get All Bazaar Offers Admin Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ========================
// PII VIOLATION LOGS (ADMIN)
// ========================

exports.getPIIViolations = async (req, res) => {
  try {
    // A log only grows.
    const [total, violations] = await Promise.all([
      BazaarPIIViolation.countDocuments(),
      paginate(
        BazaarPIIViolation.find()
          .populate('userId', 'name mobile email')
          .populate('adId', 'title category price')
          .sort({ createdAt: -1 }),
        pageParams(req)
      )
    ]);

    res.json({ success: true, total, data: violations });
  } catch (error) {
    console.error('Get PII Violations Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};



