const mongoose = require('mongoose');

/**
 * A frozen snapshot of one item as it existed when the order was placed.
 * Nothing here is read live — if an admin later edits the item's quantity or
 * price, past orders (and the stock already deducted against them) must not move.
 */
const orderLineSchema = mongoose.Schema({
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StarterKitItem' },
    itemName: { type: String },
    kitQuantity: { type: Number },   // what stock deducts against
    unitPrice: { type: Number },
    isMandatory: { type: Boolean, default: false }
}, { _id: false });

const kitOrderSchema = mongoose.Schema({
    sewakId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

    orderType: { type: String, enum: ['single', 'combo'], default: 'single' },
    comboId: { type: mongoose.Schema.Types.ObjectId, ref: 'KitCombo', default: null },
    comboName: { type: String, default: '' },   // frozen

    lines: { type: [orderLineSchema], default: [] },
    orderQuantity: { type: Number, default: 1, min: 1 },

    totalAmount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: ['full', 'part'], default: 'full' },
    downPaymentAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['pending', 'confirmed', 'dispatched', 'delivered', 'cancelled'],
        default: 'pending'
    },

    expectedDeliveryDays: { type: Number, default: null },
    expectedDeliveryDate: { type: Date, default: null },

    // Idempotency guard — checked inside the confirm transaction so a double-click
    // or two concurrent admins can't deduct the same stock twice.
    stockDeducted: { type: Boolean, default: false },

    confirmedAt: { type: Date, default: null },
    dispatchedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' }
}, {
    timestamps: true
});

kitOrderSchema.index({ sewakId: 1, status: 1 });
kitOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('KitOrder', kitOrderSchema);
