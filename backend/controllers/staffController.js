const Staff = require('../models/Staff');

// @desc    Get all staff for logged in provider
// @route   GET /api/provider/staff
// @access  Private (Provider)
const getStaff = async (req, res) => {
    try {
        const staff = await Staff.find({ providerId: req.user._id }).sort({ createdAt: -1 });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new staff member
// @route   POST /api/provider/staff
// @access  Private (Provider)
const createStaff = async (req, res) => {
    const { name, role } = req.body;

    try {
        const staff = await Staff.create({
            providerId: req.user._id,
            name,
            role,
            status: 'Active'
        });

        res.status(201).json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a staff member
// @route   DELETE /api/provider/staff/:id
// @access  Private (Provider)
const deleteStaff = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);

        if (staff) {
            if (staff.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            await Staff.deleteOne({ _id: req.params.id });
            res.json({ message: 'Staff removed' });
        } else {
            res.status(404).json({ message: 'Staff not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle staff status
// @route   PATCH /api/provider/staff/:id/status
// @access  Private (Provider)
const toggleStaffStatus = async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);

        if (staff) {
            if (staff.providerId.toString() !== req.user._id.toString()) {
                return res.status(401).json({ message: 'Not authorized' });
            }

            staff.status = staff.status === 'Active' ? 'On Leave' : 'Active';
            await staff.save();
            res.json(staff);
        } else {
            res.status(404).json({ message: 'Staff not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStaff,
    createStaff,
    deleteStaff,
    toggleStaffStatus
};
