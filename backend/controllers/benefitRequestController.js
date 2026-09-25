const { pageParams, paginate } = require('../utils/pagination');
const BenefitRequest = require('../models/BenefitRequest');
const BenefitPolicy = require('../models/BenefitPolicy');

// @desc    Claim a benefit (create a request)
// @route   POST /api/benefit-requests
// @access  Private (customer or provider)
const createBenefitRequest = async (req, res) => {
    const { policyId, note } = req.body;
    try {
        if (!policyId) {
            return res.status(400).json({ message: 'policyId is required' });
        }

        const policy = await BenefitPolicy.findById(policyId);
        if (!policy || !policy.isActive) {
            return res.status(404).json({ message: 'Benefit not found or no longer active' });
        }

        const applicantRole = req.user.role === 'provider' ? 'provider' : 'customer';

        // Benefit Policy is never applicable to Sewak — only Partner-category providers.
        if (applicantRole === 'provider' && req.user.providerCategory === 'sewak') {
            return res.status(403).json({ message: 'This benefit is not applicable to Sewak' });
        }

        if (policy.audience && policy.audience !== (applicantRole === 'provider' ? 'provider' : 'user')) {
            return res.status(400).json({ message: 'This benefit is not available for your account type' });
        }

        const existing = await BenefitRequest.findOne({
            policyId,
            applicantId: req.user._id,
            status: 'pending'
        });
        if (existing) {
            return res.status(400).json({ message: 'You already have a pending request for this benefit' });
        }

        const request = await BenefitRequest.create({
            policyId,
            applicantId: req.user._id,
            applicantModel: applicantRole === 'provider' ? 'Provider' : 'User',
            applicantRole,
            note: note || ''
        });

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get the logged-in user/provider's own benefit requests
// @route   GET /api/benefit-requests
// @access  Private
const getMyBenefitRequests = async (req, res) => {
    try {
        const scope = { applicantId: req.user._id };
        const requests = await paginate(
            BenefitRequest.find(scope).populate('policyId', 'title type icon color bgColor').sort({ createdAt: -1 }),
            pageParams(req)
        );
        res.set('X-Total-Count', String(await BenefitRequest.countDocuments(scope)));
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Shared by the admin list and its stats so a status tab's count and the
// rows under it always describe the same set.
const adminBenefitRequestScope = (params) => {
    const scope = {};
    if (params.status && params.status !== 'all') scope.status = params.status;
    if (params.audience && params.audience !== 'all') scope.applicantRole = params.audience;
    return scope;
};

// @desc    List all benefit requests
// @route   GET /api/admin/benefit-requests
// @access  Private (Admin)
const getBenefitRequests = async (req, res) => {
    try {
        const scope = adminBenefitRequestScope(req.query);
        const requests = await paginate(
            BenefitRequest.find(scope)
                .populate('policyId', 'title type')
                .populate('applicantId', 'name mobile email city shopName ownerName')
                .sort({ createdAt: -1 }),
            pageParams(req)
        );
        res.set('X-Total-Count', String(await BenefitRequest.countDocuments(scope)));
        res.set('X-Pending-Count', String(await BenefitRequest.countDocuments({ status: 'pending' })));
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve or reject a benefit request
// @route   PATCH /api/admin/benefit-requests/:id
// @access  Private (Admin)
const updateBenefitRequestStatus = async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        const request = await BenefitRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Benefit request not found' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Benefit request already processed' });
        }

        request.status = status;
        if (adminNotes !== undefined) request.adminNotes = adminNotes;
        await request.save();

        if (status === 'approved' || status === 'rejected') {
            (async () => {
                try {
                    const { sendNotificationToUser } = require('../config/notificationService');
                    const policy = await BenefitPolicy.findById(request.policyId);
                    const title = policy?.title || 'a benefit';
                    const message = status === 'approved'
                        ? `Your request for "${title}" has been approved.`
                        : `Your request for "${title}" was rejected.${adminNotes ? ` Reason: ${adminNotes}` : ''}`;

                    sendNotificationToUser(request.applicantId, request.applicantRole, {
                        title: `Benefit Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
                        body: message,
                        data: { type: 'benefit', id: request._id.toString() }
                    }).catch(err => console.log('Benefit request push notification failed:', err.message));
                } catch (err) {
                    console.log('Push notification failed (skipping):', err.message);
                }
            })();
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createBenefitRequest,
    getMyBenefitRequests,
    getBenefitRequests,
    updateBenefitRequestStatus
};
