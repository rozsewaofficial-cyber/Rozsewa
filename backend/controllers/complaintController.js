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
        const complaints = await Complaint.find({ userId: req.user._id })
            .populate('bookingId', 'serviceName status')
            .sort({ createdAt: -1 });
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all complaints (Admin)
// @route   GET /api/complaints/admin
// @access  Private/Admin
const getAllComplaints = async (req, res) => {
    try {
        const complaints = await Complaint.find()
            .populate('userId', 'name mobile')
            .populate('bookingId', 'serviceName status')
            .sort({ createdAt: -1 });
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

module.exports = {
    createComplaint,
    getUserComplaints,
    getAllComplaints,
    updateComplaintStatus
};
