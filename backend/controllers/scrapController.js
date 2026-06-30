const Scrap = require('../models/Scrap');
const User = require('../models/User');
const Provider = require('../models/Provider');
const Notification = require('../models/Notification');
const { sendNotificationToUser } = require('../config/notificationService');

// Create a new scrap item (User)
exports.createScrap = async (req, res) => {
  try {
    const { title, description, images, address } = req.body;

    if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const scrap = new Scrap({
      userId: req.user._id,
      title,
      description,
      images,
      address
    });

    await scrap.save();

    // Notify User
    const notification = new Notification({
        recipientId: req.user._id,
        recipientModel: 'User',
        title: 'Scrap Listed Successfully',
        message: `Your scrap item "${scrap.title}" has been listed. Providers in your area will be notified.`,
        type: 'scrap',
        scrapId: scrap._id
    });
    await notification.save();
    
    try {
        await sendNotificationToUser(req.user._id, 'user', {
            title: 'Scrap Listed Successfully',
            body: `Your scrap item "${scrap.title}" has been listed. Providers in your area will be notified.`,
            data: { type: 'scrap', id: scrap._id.toString() }
        });
    } catch (err) {
        console.error("Push error", err);
    }

    res.status(201).json({
      success: true,
      data: scrap,
      message: 'Scrap item listed successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get list of scrap items for the logged-in user
exports.getMyScrap = async (req, res) => {
  try {
    const scraps = await Scrap.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: scraps });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get all pending scrap items (Provider view/Admin View)
exports.getAvailableScrap = async (req, res) => {
  try {
    const scraps = await Scrap.find({ status: 'pending' })
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: scraps });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Accept a scrap request
exports.acceptScrap = async (req, res) => {
  try {
    const { id } = req.params;
    const acceptorId = req.user._id;

    const scrap = await Scrap.findById(id);
    if (!scrap) return res.status(404).json({ success: false, message: 'Scrap item not found' });

    if (scrap.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Item already taken or cancelled' });
    }

    scrap.status = 'accepted';
    // If admin accepts it, providerId might remain null or be assigned to an admin reference
    // Usually it's accepted by a Provider. Since Homster had Admin only for now, we leave providerId as the acceptor
    scrap.providerId = acceptorId;
    scrap.pickupDate = new Date();
    await scrap.save();

    // Notify User
    const notification = new Notification({
        recipientId: scrap.userId,
        recipientModel: 'User',
        title: 'Scrap Request Accepted!',
        message: `Your scrap request for "${scrap.title}" has been accepted. They will contact you shortly.`,
        type: 'scrap',
        scrapId: scrap._id
    });
    await notification.save();

    res.json({ success: true, data: scrap, message: 'Request accepted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Mark item as picked up / completed
exports.completeScrap = async (req, res) => {
  try {
    const { id } = req.params;
    const { finalPrice } = req.body;

    const scrap = await Scrap.findById(id);
    if (!scrap) return res.status(404).json({ success: false, message: 'Scrap item not found' });

    scrap.status = 'completed';
    if (finalPrice) scrap.finalPrice = finalPrice;
    await scrap.save();

    // Notify User
    const notification = new Notification({
        recipientId: scrap.userId,
        recipientModel: 'User',
        title: 'Scrap Pickup Completed',
        message: `Your scrap item "${scrap.title}" has been successfully picked up and completed.`,
        type: 'scrap',
        scrapId: scrap._id
    });
    await notification.save();

    res.json({ success: true, data: scrap, message: 'Transactions completed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin: Get all scrap items
exports.getAllScrapAdmin = async (req, res) => {
  try {
    const scraps = await Scrap.find({})
      .populate('userId', 'name email phone')
      .populate('providerId', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: scraps });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get single scrap by ID
exports.getScrapById = async (req, res) => {
  try {
    const scrap = await Scrap.findById(req.params.id)
      .populate('userId', 'name phone email')
      .populate('providerId', 'name phone');

    if (!scrap) {
      return res.status(404).json({ success: false, message: 'Scrap not found' });
    }

    res.json({ success: true, data: scrap });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Delete scrap item
exports.deleteScrap = async (req, res) => {
  try {
    const { id } = req.params;
    
    const scrap = await Scrap.findById(id);
    if (!scrap) return res.status(404).json({ success: false, message: 'Scrap item not found' });

    await Scrap.findByIdAndDelete(id);

    res.json({ success: true, message: 'Scrap item deleted successfully' });
  } catch (error) {
    console.error('Delete scrap error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin: List a scrap item in Rojsewa Bazaar
exports.listInBazaar = async (req, res) => {
  try {
    const { id } = req.params;

    const scrap = await Scrap.findById(id);
    if (!scrap) return res.status(404).json({ success: false, message: 'Scrap item not found' });

    if (scrap.status !== 'accepted') {
      return res.status(400).json({ success: false, message: 'Only accepted items can be listed in Bazaar' });
    }

    // Fetch the owner's phone to use as contact
    const user = await User.findById(scrap.userId).select('phone name');

    scrap.listedInBazaar = true;
    scrap.contactPhone = user?.phone || '';
    await scrap.save();

    // Notify the seller
    try {
      const notification = new Notification({
        recipientId: scrap.userId,
        recipientModel: 'User',
        title: '🎉 Your Item is Now in Rojsewa Bazaar!',
        message: `Your scrap item "${scrap.title}" has been listed in Rojsewa Bazaar. Buyers can now contact you.`,
        type: 'scrap',
        scrapId: scrap._id
      });
      await notification.save();
      await sendNotificationToUser(scrap.userId, 'user', {
        title: '🎉 Listed in Rojsewa Bazaar!',
        body: `Your item "${scrap.title}" is now visible in Rojsewa Bazaar.`,
        data: { type: 'scrap', id: scrap._id.toString() }
      });
    } catch (err) {
      console.error('Notification error:', err);
    }

    res.json({ success: true, data: scrap, message: 'Item listed in Rojsewa Bazaar successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Public/User: Get all bazaar items (admin-approved, listed in bazaar)
exports.getBazaarItems = async (req, res) => {
  try {
    const { search, city } = req.query;

    const query = { listedInBazaar: true, status: 'accepted' };
    if (city) query['address.city'] = { $regex: city, $options: 'i' };

    const scraps = await Scrap.find(query)
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });

    // Filter by search term on title/description
    let results = scraps;
    if (search) {
      const lower = search.toLowerCase();
      results = scraps.filter(s =>
        s.title.toLowerCase().includes(lower) ||
        (s.description && s.description.toLowerCase().includes(lower))
      );
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

