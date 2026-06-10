const SewakEnquiry = require('../models/SewakEnquiry');

// @desc    Create a new Sewak Enquiry (Public)
// @route   POST /api/v1/sewak-enquiry
// @access  Public
const createEnquiry = async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({ message: 'Please provide all required fields (name, phone, email)' });
        }

        const enquiry = await SewakEnquiry.create({
            name,
            phone,
            email
        });

        res.status(201).json({
            success: true,
            message: 'Enquiry submitted successfully. Our team will contact you soon.',
            data: enquiry
        });
    } catch (error) {
        console.error('Sewak Enquiry Creation Error:', error);
        res.status(500).json({ message: 'Server error while submitting enquiry' });
    }
};

// @desc    Get all Sewak Enquiries (Admin)
// @route   GET /api/v1/admin/sewak-enquiries
// @access  Private/Admin
const getEnquiries = async (req, res) => {
    try {
        const enquiries = await SewakEnquiry.find().sort({ createdAt: -1 });
        res.json(enquiries);
    } catch (error) {
        console.error('Get Sewak Enquiries Error:', error);
        res.status(500).json({ message: 'Server error while fetching enquiries' });
    }
};

// @desc    Update Sewak Enquiry Status (Admin)
// @route   PUT /api/v1/admin/sewak-enquiries/:id
// @access  Private/Admin
const updateEnquiryStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'contacted', 'resolved'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const enquiry = await SewakEnquiry.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!enquiry) {
            return res.status(404).json({ message: 'Enquiry not found' });
        }

        res.json({
            success: true,
            message: 'Status updated successfully',
            data: enquiry
        });
    } catch (error) {
        console.error('Update Enquiry Status Error:', error);
        res.status(500).json({ message: 'Server error while updating enquiry' });
    }
};

module.exports = {
    createEnquiry,
    getEnquiries,
    updateEnquiryStatus
};
