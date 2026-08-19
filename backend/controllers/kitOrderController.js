const mongoose = require('mongoose');
const StarterKitItem = require('../models/StarterKitItem');
const KitCombo = require('../models/KitCombo');
const KitPaymentConfig = require('../models/KitPaymentConfig');
const KitOrder = require('../models/KitOrder');
const KitDue = require('../models/KitDue');
const Provider = require('../models/Provider');
const { applyKitWalletMovement, firstDueDate } = require('../utils/kitWallet');

const DEFAULT_CONFIG = {
    paymentMode: 'full',
    downPaymentType: 'percentage',
    downPaymentValue: 50,
    deductionFrequency: 'weekly',
    instalmentAmount: 0,
    weeklyDeductionDay: 1,
    monthlyDeductionDate: 1,
    blockPayoutOnDues: true,
    isActive: true
};

const notify = async (sewakId, title, message, orderId) => {
    try {
        const { notifyUser } = require('../config/notificationService');
        await notifyUser({
            userId: sewakId,
            userRole: 'provider',
            title,
            message,
            type: 'kit_order',
            // notifyUser dedupes on data.bookingId || data.leadId || data.id — without
            // this, every order's notifications collapse onto one shared key.
            data: { id: orderId ? orderId.toString() : '', orderId: orderId ? orderId.toString() : '' }
        });
    } catch (err) {
        console.error('[KitOrder] notification failed:', err.message);
    }
};

const getConfigFor = async (categoryId) => {
    const cfg = await KitPaymentConfig.findOne({ categoryId, isActive: true }).lean();
    return cfg || { ...DEFAULT_CONFIG, categoryId };
};

/** Down payment for a given total, per the category's rules. */
const computeDownPayment = (cfg, totalAmount) => {
    if (cfg.downPaymentType === 'fixed') {
        return Math.min(Number(cfg.downPaymentValue) || 0, totalAmount);
    }
    const pct = Number(cfg.downPaymentValue) || 0;
    return Math.round((totalAmount * pct) / 100);
};

// ─────────────────────────────────────────────────────────────────────────────
// SEWAK
// ─────────────────────────────────────────────────────────────────────────────

// @desc    Kits + combos available to me
// @route   GET /api/kit-store/catalog
// @access  Private (Sewak)
const getCatalog = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id).lean();
        if (!provider) return res.status(404).json({ message: 'Provider not found' });
        if (!provider.vendorType) return res.json({ items: [], combos: [] });

        const categoryId = provider.vendorType;

        const [items, combos] = await Promise.all([
            StarterKitItem.find({ categoryId, isActive: true }).sort({ isMandatory: -1, name: 1 }).lean(),
            KitCombo.find({ categoryId, isActive: true }).sort({ name: 1 }).lean()
        ]);

        const itemMap = new Map(items.map(i => [String(i._id), i]));

        // Quantities are inherited live from the item definitions (SRS).
        const hydratedCombos = combos.map(c => {
            const lines = (c.items || [])
                .map(({ itemId }) => itemMap.get(String(itemId)))
                .filter(Boolean)
                .map(i => ({
                    itemId: i._id,
                    name: i.name,
                    kitQuantity: i.kitQuantity,
                    image: i.image,
                    isMandatory: i.isMandatory
                }));
            return { ...c, items: lines };
        }).filter(c => c.items.length > 0);

        res.json({
            items: items.map(i => ({
                _id: i._id,
                name: i.name,
                description: i.description,
                image: i.image,
                kitQuantity: i.kitQuantity,
                price: i.price,
                isMandatory: i.isMandatory,
                inStock: i.availableStock > 0
            })),
            combos: hydratedCombos
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    What payment options my category allows
// @route   GET /api/kit-store/payment-config
// @access  Private (Sewak)
const getMyPaymentConfig = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id).lean();
        if (!provider?.vendorType) return res.json(DEFAULT_CONFIG);
        const cfg = await getConfigFor(provider.vendorType);
        res.json({
            paymentMode: cfg.paymentMode,
            downPaymentType: cfg.downPaymentType,
            downPaymentValue: cfg.downPaymentValue,
            deductionFrequency: cfg.deductionFrequency,
            instalmentAmount: cfg.instalmentAmount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Build the frozen order lines + total for a requested purchase.
 * Shared by the quote endpoint and the actual order creation so the number the
 * Sewak sees and the number they're charged can never diverge.
 */
const buildOrderDraft = async ({ provider, orderType, itemId, comboId, orderQuantity }) => {
    const qty = Number(orderQuantity) > 0 ? Number(orderQuantity) : 1;
    const categoryId = provider.vendorType;

    if (orderType === 'combo') {
        const combo = await KitCombo.findOne({ _id: comboId, categoryId, isActive: true }).lean();
        if (!combo) { const e = new Error('Combo pack not found'); e.status = 404; throw e; }

        const items = await StarterKitItem.find({
            _id: { $in: (combo.items || []).map(i => i.itemId) },
            isActive: true
        }).lean();
        if (!items.length) { const e = new Error('This combo has no active items'); e.status = 400; throw e; }

        const lines = items.map(i => ({
            itemId: i._id,
            itemName: i.name,
            kitQuantity: i.kitQuantity,
            unitPrice: i.price,
            isMandatory: i.isMandatory
        }));

        return {
            orderType: 'combo',
            comboId: combo._id,
            comboName: combo.name,
            lines,
            orderQuantity: qty,
            totalAmount: combo.comboPrice * qty,
            categoryId
        };
    }

    const item = await StarterKitItem.findOne({ _id: itemId, categoryId, isActive: true }).lean();
    if (!item) { const e = new Error('Starter kit item not found'); e.status = 404; throw e; }

    return {
        orderType: 'single',
        comboId: null,
        comboName: '',
        lines: [{
            itemId: item._id,
            itemName: item.name,
            kitQuantity: item.kitQuantity,
            unitPrice: item.price,
            isMandatory: item.isMandatory
        }],
        orderQuantity: qty,
        totalAmount: item.price * qty,
        categoryId
    };
};

// @desc    Price a prospective order (no side effects)
// @route   POST /api/kit-store/quote
// @access  Private (Sewak)
const quoteOrder = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id).lean();
        if (!provider?.vendorType) return res.status(400).json({ message: 'No category assigned to your account' });

        const draft = await buildOrderDraft({ provider, ...req.body });
        const cfg = await getConfigFor(provider.vendorType);

        const paymentMode = req.body.paymentMode === 'part' ? 'part' : 'full';
        if (paymentMode === 'part' && cfg.paymentMode === 'full') {
            return res.status(400).json({ message: 'Your category only allows full payment' });
        }
        if (paymentMode === 'full' && cfg.paymentMode === 'part') {
            return res.status(400).json({ message: 'Your category requires part payment' });
        }

        const payNow = paymentMode === 'full' ? draft.totalAmount : computeDownPayment(cfg, draft.totalAmount);
        const remaining = draft.totalAmount - payNow;

        res.json({
            ...draft,
            paymentMode,
            payNow,
            remaining,
            instalmentAmount: cfg.instalmentAmount,
            deductionFrequency: cfg.deductionFrequency
        });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    Place an order (after payment has been verified)
// @route   POST /api/kit-store/order
// @access  Private (Sewak)
const placeOrder = async (req, res) => {
    try {
        const provider = await Provider.findById(req.user._id);
        if (!provider) return res.status(404).json({ message: 'Provider not found' });
        if (!provider.vendorType) return res.status(400).json({ message: 'No category assigned to your account' });

        const draft = await buildOrderDraft({ provider, ...req.body });
        const cfg = await getConfigFor(provider.vendorType);

        const paymentMode = req.body.paymentMode === 'part' ? 'part' : 'full';
        if (paymentMode === 'part' && cfg.paymentMode === 'full') {
            return res.status(400).json({ message: 'Your category only allows full payment' });
        }
        if (paymentMode === 'part' && !(Number(cfg.instalmentAmount) > 0)) {
            return res.status(400).json({ message: 'Part payment is not configured for your category yet. Contact admin.' });
        }

        const downPaymentAmount = paymentMode === 'full'
            ? draft.totalAmount
            : computeDownPayment(cfg, draft.totalAmount);
        const remainingAmount = draft.totalAmount - downPaymentAmount;

        const order = await KitOrder.create({
            sewakId: provider._id,
            categoryId: draft.categoryId,
            orderType: draft.orderType,
            comboId: draft.comboId,
            comboName: draft.comboName,
            lines: draft.lines,
            orderQuantity: draft.orderQuantity,
            totalAmount: draft.totalAmount,
            paymentMode,
            downPaymentAmount,
            remainingAmount,
            status: 'pending',
            razorpayOrderId: req.body.razorpayOrderId || '',
            razorpayPaymentId: req.body.razorpayPaymentId || ''
        });

        // Record the money actually taken up front.
        if (downPaymentAmount > 0) {
            try {
                await applyKitWalletMovement({
                    providerId: provider._id,
                    amount: downPaymentAmount,
                    direction: 'debit',
                    ledgerType: 'KIT_DOWN_PAYMENT',
                    title: paymentMode === 'full' ? 'Starter kit payment' : 'Starter kit down payment',
                    description: `${draft.orderType === 'combo' ? draft.comboName : draft.lines[0]?.itemName} x${draft.orderQuantity}`,
                    metadata: { orderId: order._id.toString(), paymentMode }
                });
            } catch (err) {
                console.error('[KitOrder] ledger write failed:', err.message);
            }
        }

        await notify(
            provider._id,
            'Order Received',
            `Your order for ${draft.orderType === 'combo' ? draft.comboName : draft.lines[0]?.itemName} has been received and is awaiting confirmation.`,
            order._id
        );

        // Tell admins there's something to confirm.
        try {
            const User = require('../models/User');
            const { sendNotificationToUser } = require('../config/notificationService');
            const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
            for (const admin of admins) {
                await sendNotificationToUser(admin._id, 'admin', {
                    title: 'New Starter Kit Order',
                    body: `${provider.ownerName} ordered ${draft.orderType === 'combo' ? draft.comboName : draft.lines[0]?.itemName}.`,
                    data: { type: 'kit_order', id: order._id.toString(), link: '/admin/kit-orders' }
                });
            }
        } catch (err) {
            console.log('[KitOrder] admin notification skipped:', err.message);
        }

        res.status(201).json(order);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    }
};

// @desc    My orders
// @route   GET /api/kit-store/orders
// @access  Private (Sewak)
const getMyOrders = async (req, res) => {
    try {
        const orders = await KitOrder.find({ sewakId: req.user._id })
            .sort({ createdAt: -1 })
            .lean();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    One of my orders
// @route   GET /api/kit-store/orders/:id
// @access  Private (Sewak)
const getMyOrderById = async (req, res) => {
    try {
        const order = await KitOrder.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ message: 'Order not found' });
        if (String(order.sewakId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorised to view this order' });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    My EMI dues + payout lock status
// @route   GET /api/kit-store/dues
// @access  Private (Sewak)
const getMyDues = async (req, res) => {
    try {
        const { Wallet } = require('../models/Wallet');
        const provider = await Provider.findById(req.user._id).lean();

        const [dues, wallet] = await Promise.all([
            KitDue.find({ sewakId: req.user._id }).populate('orderId', 'comboName lines totalAmount').sort({ createdAt: -1 }).lean(),
            Wallet.findOne({ providerId: req.user._id }).lean()
        ]);

        const balance = wallet?.balance ?? 0;
        const activeDues = dues.filter(d => d.status === 'active');
        const cfg = provider?.vendorType ? await getConfigFor(provider.vendorType) : DEFAULT_CONFIG;

        res.json({
            walletBalance: balance,
            totalOutstanding: activeDues.reduce((s, d) => s + d.balance, 0),
            payoutLocked: !!(cfg.blockPayoutOnDues && activeDues.length > 0 && balance < 0),
            payoutLockReason: (cfg.blockPayoutOnDues && activeDues.length > 0 && balance < 0)
                ? 'Your wallet balance is negative because of pending kit instalments. Withdrawals resume once the balance is back above zero.'
                : '',
            dues
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// @desc    List orders with filters
// @route   GET /api/admin/kit-orders
// @access  Private/Admin
const getAdminOrders = async (req, res) => {
    try {
        const { status, categoryId, sewakId, dateFrom, dateTo } = req.query;
        const query = {};
        if (status) query.status = status;
        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) query.categoryId = categoryId;
        if (sewakId && mongoose.Types.ObjectId.isValid(sewakId)) query.sewakId = sewakId;
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); query.createdAt.$lte = d; }
        }

        const orders = await KitOrder.find(query)
            .populate('sewakId', 'ownerName mobile city vendorCode')
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        // Pending first — they're the only rows needing a human.
        const rank = { pending: 0, confirmed: 1, dispatched: 2, delivered: 3, cancelled: 4 };
        orders.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));

        // Surface whether stock would go negative, so the admin sees it before confirming.
        const itemIds = [...new Set(orders.flatMap(o => o.lines.map(l => String(l.itemId))))];
        const items = await StarterKitItem.find({ _id: { $in: itemIds } }).select('availableStock name').lean();
        const stockMap = new Map(items.map(i => [String(i._id), i.availableStock]));

        const withWarnings = orders.map(o => ({
            ...o,
            stockWarnings: o.status === 'pending'
                ? o.lines
                    .map(l => {
                        const need = l.kitQuantity * o.orderQuantity;
                        const have = stockMap.get(String(l.itemId)) ?? 0;
                        return have < need ? { itemName: l.itemName, need, have } : null;
                    })
                    .filter(Boolean)
                : []
        }));

        res.json(withWarnings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Confirm an order — deducts central stock, transactionally
// @route   PUT /api/admin/kit-orders/:id/confirm
// @access  Private/Admin
const confirmOrder = async (req, res) => {
    const expectedDeliveryDays = Number(req.body.expectedDeliveryDays);
    if (!Number.isFinite(expectedDeliveryDays) || expectedDeliveryDays < 0) {
        return res.status(400).json({ message: 'Enter the expected delivery days' });
    }

    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            const order = await KitOrder.findById(req.params.id).session(session);
            if (!order) { const e = new Error('Order not found'); e.status = 404; throw e; }
            if (order.status !== 'pending') {
                const e = new Error(`Only a pending order can be confirmed (this one is ${order.status})`);
                e.status = 400; throw e;
            }
            // Idempotency guard — survives a double-click or two concurrent admins.
            if (order.stockDeducted) {
                const e = new Error('Stock has already been deducted for this order');
                e.status = 400; throw e;
            }

            // $inc is evaluated server-side against the current document, so
            // concurrent confirms serialise correctly instead of overwriting.
            for (const line of order.lines) {
                await StarterKitItem.updateOne(
                    { _id: line.itemId },
                    { $inc: { availableStock: -(line.kitQuantity * order.orderQuantity) } },
                    { session }
                );
            }

            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + expectedDeliveryDays);

            order.status = 'confirmed';
            order.stockDeducted = true;
            order.expectedDeliveryDays = expectedDeliveryDays;
            order.expectedDeliveryDate = deliveryDate;
            order.confirmedAt = new Date();
            order.confirmedBy = req.user._id;
            await order.save({ session });

            // Open the EMI schedule in the same transaction.
            if (order.paymentMode === 'part' && order.remainingAmount > 0) {
                const cfg = await getConfigFor(order.categoryId);
                const instalment = Number(cfg.instalmentAmount) > 0
                    ? Number(cfg.instalmentAmount)
                    : order.remainingAmount;

                await KitDue.create([{
                    sewakId: order.sewakId,
                    orderId: order._id,
                    categoryId: order.categoryId,
                    totalDue: order.remainingAmount,
                    paidSoFar: 0,
                    balance: order.remainingAmount,
                    frequency: cfg.deductionFrequency,
                    instalmentAmount: instalment,
                    nextDeductionDate: firstDueDate(cfg.deductionFrequency, cfg),
                    status: 'active'
                }], { session });
            }

            result = order;
        });

        await notify(
            result.sewakId,
            'Order Confirmed',
            `Your order has been confirmed. Expected delivery in ${expectedDeliveryDays} day(s).`,
            result._id
        );

        const populated = await KitOrder.findById(result._id)
            .populate('sewakId', 'ownerName mobile city vendorCode')
            .lean();
        res.json(populated);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// @desc    Mark dispatched / delivered
// @route   PUT /api/admin/kit-orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['dispatched', 'delivered'].includes(status)) {
            return res.status(400).json({ message: "Status must be 'dispatched' or 'delivered'" });
        }

        const order = await KitOrder.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const allowedFrom = status === 'dispatched' ? ['confirmed'] : ['confirmed', 'dispatched'];
        if (!allowedFrom.includes(order.status)) {
            return res.status(400).json({ message: `Cannot move an order from ${order.status} to ${status}` });
        }

        order.status = status;
        if (status === 'dispatched') order.dispatchedAt = new Date();
        if (status === 'delivered') order.deliveredAt = new Date();
        await order.save();

        await notify(
            order.sewakId,
            status === 'dispatched' ? 'Order Dispatched' : 'Order Delivered',
            status === 'dispatched'
                ? 'Your starter kit order is on its way.'
                : 'Your starter kit order has been delivered.',
            order._id
        );

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Cancel an order — restores stock, cancels dues, refunds down payment
// @route   PUT /api/admin/kit-orders/:id/cancel
// @access  Private/Admin
const cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        let result;
        let refundAmount = 0;

        await session.withTransaction(async () => {
            const order = await KitOrder.findById(req.params.id).session(session);
            if (!order) { const e = new Error('Order not found'); e.status = 404; throw e; }
            if (['delivered', 'cancelled'].includes(order.status)) {
                const e = new Error(`A ${order.status} order cannot be cancelled`);
                e.status = 400; throw e;
            }
            if (order.status === 'dispatched') {
                const e = new Error('This order has already been dispatched. Handle it as a return instead.');
                e.status = 400; throw e;
            }

            // (a) Restore stock, but only if it was actually deducted.
            if (order.stockDeducted) {
                for (const line of order.lines) {
                    await StarterKitItem.updateOne(
                        { _id: line.itemId },
                        { $inc: { availableStock: +(line.kitQuantity * order.orderQuantity) } },
                        { session }
                    );
                }
                order.stockDeducted = false;
            }

            // (b) Cancel any open EMI schedule.
            await KitDue.updateMany(
                { orderId: order._id, status: 'active' },
                { $set: { status: 'cancelled' } },
                { session }
            );

            order.status = 'cancelled';
            order.cancelledAt = new Date();
            order.cancellationReason = req.body.reason || 'Cancelled by admin';
            await order.save({ session });

            refundAmount = order.downPaymentAmount || 0;
            result = order;
        });

        // (c) Refund the down payment back to the wallet (outside the transaction
        // so a ledger hiccup can't roll back the cancellation itself).
        if (refundAmount > 0) {
            try {
                await applyKitWalletMovement({
                    providerId: result.sewakId,
                    amount: refundAmount,
                    direction: 'credit',
                    ledgerType: 'KIT_REFUND',
                    title: 'Starter kit order cancelled — refund',
                    description: `Refund for cancelled order ${result._id}`,
                    metadata: { orderId: result._id.toString() }
                });
            } catch (err) {
                console.error('[KitOrder] refund ledger write failed:', err.message);
            }
        }

        await notify(
            result.sewakId,
            'Order Cancelled',
            refundAmount > 0
                ? `Your order was cancelled. ₹${refundAmount} has been credited back to your wallet.`
                : 'Your order was cancelled.',
            result._id
        );

        res.json(result);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.message });
    } finally {
        session.endSession();
    }
};

// @desc    All EMI schedules
// @route   GET /api/admin/kit-dues
// @access  Private/Admin
const getAdminDues = async (req, res) => {
    try {
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.sewakId && mongoose.Types.ObjectId.isValid(req.query.sewakId)) {
            query.sewakId = req.query.sewakId;
        }

        const dues = await KitDue.find(query)
            .populate('sewakId', 'ownerName mobile vendorCode city')
            .populate('categoryId', 'name')
            .sort({ status: 1, nextDeductionDate: 1 })
            .lean();

        res.json({
            totals: {
                active: dues.filter(d => d.status === 'active').length,
                cleared: dues.filter(d => d.status === 'cleared').length,
                outstanding: dues.filter(d => d.status === 'active').reduce((s, d) => s + d.balance, 0)
            },
            dues
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCatalog,
    getMyPaymentConfig,
    quoteOrder,
    placeOrder,
    getMyOrders,
    getMyOrderById,
    getMyDues,
    getAdminOrders,
    confirmOrder,
    updateOrderStatus,
    cancelOrder,
    getAdminDues,
    getConfigFor,
    computeDownPayment
};
