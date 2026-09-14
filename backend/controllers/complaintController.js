const { pageParams, paginate } = require('../utils/pagination');
const Complaint = require('../models/Complaint');
const Booking = require('../models/Booking');

// @desc    Create a new complaint
// @route   POST /api/complaints
// @access  Private
const createComplaint = async (req, res) => {
    const { bookingId, issueType, description } = req.body;
    try {
        if (!bookingId || !issueType || !description) {
            return res.status(400).json({ message: 'Please fill all fields' });
        }

        // Verify booking exists and belongs to user
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        if (booking.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const complaint = new Complaint({
            userId: req.user._id,
            bookingId,
            issueType,
            description
        });

        await complaint.save();
        res.status(201).json(complaint);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user complaints
// @route   GET /api/complaints
// @access  Private
const getUserComplaints = async (req, res) => {
    try {
        const scope = { userId: req.user._id };
        const complaints = await paginate(
            Complaint.find(scope)
                .populate('bookingId', 'serviceName status')
                .sort({ createdAt: -1 }),
            pageParams(req)
        );
        res.set('X-Total-Count', String(await Complaint.countDocuments(scope)));
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// What an admin screen is asking for when it asks for complaints. Shared
// with the stats below so a tab's count and the rows under it agree.
const adminComplaintScope = (params) => {
    const scope = {};
    if (params.status && params.status !== 'all') scope.status = params.status;

    // Searching in the browser could only ever find what had already been sent,
    // which on a paged list is one page.
    const term = String(params.search || '').trim();
    if (term) {
        const safe = term.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
        scope.$or = [
            { issueType: new RegExp(safe, 'i') },
            // A complaint is referred to by the tail of its id.
            { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: safe, options: 'i' } } }
        ];
    }

    return scope;
};

// @desc    Get all complaints (Admin)
// @route   GET /api/complaints/admin
// @access  Private/Admin
const getAllComplaints = async (req, res) => {
    try {
        // The screens filter by status and search by name or booking, so both
        // happen here — a browser can only filter the page it was sent.
        const scope = adminComplaintScope(req.query);
        const complaints = await paginate(
            Complaint.find(scope)
                .populate('userId', 'name mobile')
                .populate('bookingId', 'serviceName status')
                .sort({ createdAt: -1 }),
            pageParams(req)
        );
        res.set('X-Total-Count', String(await Complaint.countDocuments(scope)));
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update complaint status or notes (Admin)
// @route   PUT /api/complaints/admin/:id
// @access  Private/Admin
const updateComplaintStatus = async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        if (status) complaint.status = status;
        if (adminNotes !== undefined) complaint.adminNotes = adminNotes;

        await complaint.save();
        res.json(complaint);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Counts behind the disputes and reports screens
// @route   GET /api/complaints/admin/stats
// @access  Private/Admin
// The table arrives one page at a time, so its rows cannot say how many
// complaints are open.
const getComplaintStats = async (req, res) => {
    try {
        const rows = await Complaint.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const byStatus = {};
        let total = 0;
        rows.forEach(({ _id, count }) => {
            byStatus[_id || 'unknown'] = count;
            total += count;
        });

        res.json({
            total,
            open: byStatus.open || 0,
            'in-review': byStatus['in-review'] || 0,
            resolved: byStatus.resolved || 0,
            byStatus
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getComplaintStats,
    createComplaint,
    getUserComplaints,
    getAllComplaints,
    updateComplaintStatus
};
