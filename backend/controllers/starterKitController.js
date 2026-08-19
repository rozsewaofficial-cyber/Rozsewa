const mongoose = require('mongoose');
const StarterKitItem = require('../models/StarterKitItem');
const KitCombo = require('../models/KitCombo');
const KitPaymentConfig = require('../models/KitPaymentConfig');
const KitOrder = require('../models/KitOrder');

// ── Starter Kit Items ────────────────────────────────────────────────────────

// @desc    List starter kit items
// @route   GET /api/admin/starter-kit-items
// @access  Private/Admin
const getStarterKitItems = async (req, res) => {
    try {
        const query = {};
        if (req.query.categoryId && mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
            query.categoryId = req.query.categoryId;
        }
        if (req.query.isActive !== undefined) query.isActive = req.query.isActive === 'true';

        const items = await StarterKitItem.find(query)
            .populate('categoryId', 'name icon')
            .sort({ name: 1 })
            .lean();

        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create starter kit item
// @route   POST /api/admin/starter-kit-items
// @access  Private/Admin
const createStarterKitItem = async (req, res) => {
    try {
        const { name, categoryId, description, image, availableStock, kitQuantity, price, isMandatory, isActive, lowStockThreshold } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ message: 'Item name is required' });
        if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'A category is required' });
        }
        if (price === undefined || Number(price) < 0) {
            return res.status(400).json({ message: 'A valid price is required' });
        }
        if (kitQuantity !== undefined && Number(kitQuantity) < 1) {
            return res.status(400).json({ message: 'Kit quantity must be at least 1' });
        }

        const item = await StarterKitItem.create({
            name: name.trim(),
            categoryId,
            description: description || '',
            image: image || '',
            availableStock: Number(availableStock) || 0,
            kitQuantity: Number(kitQuantity) > 0 ? Number(kitQuantity) : 1,
            price: Number(price),
            isMandatory: !!isMandatory,
            isActive: isActive !== undefined ? isActive : true,
            lowStockThreshold: Number(lowStockThreshold) >= 0 ? Number(lowStockThreshold) : 5
        });

        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update starter kit item
// @route   PUT /api/admin/starter-kit-items/:id
// @access  Private/Admin
const updateStarterKitItem = async (req, res) => {
    try {
        const item = await StarterKitItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const f = req.body;
        if (f.name !== undefined) item.name = f.name.trim();
        if (f.categoryId !== undefined) item.categoryId = f.categoryId;
        if (f.description !== undefined) item.description = f.description;
        if (f.image !== undefined) item.image = f.image;
        if (f.availableStock !== undefined) item.availableStock = Number(f.availableStock);
        if (f.kitQuantity !== undefined && Number(f.kitQuantity) >= 1) item.kitQuantity = Number(f.kitQuantity);
        if (f.price !== undefined && Number(f.price) >= 0) item.price = Number(f.price);
        if (f.isMandatory !== undefined) item.isMandatory = !!f.isMandatory;
        if (f.isActive !== undefined) item.isActive = f.isActive;
        if (f.lowStockThreshold !== undefined) item.lowStockThreshold = Number(f.lowStockThreshold);

        const updated = await item.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Adjust stock manually (restock / correction)
// @route   PATCH /api/admin/starter-kit-items/:id/stock
// @access  Private/Admin
const adjustStock = async (req, res) => {
    try {
        const { delta, absolute, reason } = req.body;
        const item = await StarterKitItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        if (absolute !== undefined) {
            item.availableStock = Number(absolute);
        } else if (delta !== undefined) {
            item.availableStock += Number(delta);
        } else {
            return res.status(400).json({ message: 'Provide either delta or absolute' });
        }

        await item.save();
        console.log(`[KitStock] ${item.name} -> ${item.availableStock} (${reason || 'manual adjustment'})`);
        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete starter kit item
// @route   DELETE /api/admin/starter-kit-items/:id
// @access  Private/Admin
const deleteStarterKitItem = async (req, res) => {
    try {
        const item = await StarterKitItem.findById(req.params.id);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        // Refuse rather than orphan combos or in-flight orders.
        const usedInCombo = await KitCombo.countDocuments({ 'items.itemId': item._id });
        if (usedInCombo > 0) {
            return res.status(400).json({ message: `This item is used in ${usedInCombo} combo pack(s). Remove it from them first, or deactivate the item instead.` });
        }
        const liveOrders = await KitOrder.countDocuments({
            'lines.itemId': item._id,
            status: { $in: ['pending', 'confirmed', 'dispatched'] }
        });
        if (liveOrders > 0) {
            return res.status(400).json({ message: `${liveOrders} in-flight order(s) contain this item. Deactivate it instead.` });
        }

        await item.deleteOne();
        res.json({ message: 'Item removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Combo Packs ──────────────────────────────────────────────────────────────

/** Hydrate a combo's items with their live kitQuantity/price (SRS: inherited). */
const hydrateCombo = async (combo) => {
    const ids = (combo.items || []).map(i => i.itemId);
    const items = await StarterKitItem.find({ _id: { $in: ids } }).lean();
    const map = new Map(items.map(i => [String(i._id), i]));

    const hydrated = (combo.items || []).map(({ itemId }) => {
        const it = map.get(String(itemId));
        return it ? {
            itemId: it._id,
            name: it.name,
            kitQuantity: it.kitQuantity,
            price: it.price,
            image: it.image,
            isMandatory: it.isMandatory,
            availableStock: it.availableStock,
            isActive: it.isActive
        } : { itemId, name: '(deleted item)', kitQuantity: 0, price: 0, missing: true };
    });

    return { ...combo, items: hydrated };
};

// @desc    List combo packs
// @route   GET /api/admin/kit-combos
// @access  Private/Admin
const getKitCombos = async (req, res) => {
    try {
        const query = {};
        if (req.query.categoryId && mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
            query.categoryId = req.query.categoryId;
        }
        const combos = await KitCombo.find(query).populate('categoryId', 'name icon').sort({ name: 1 }).lean();
        const hydrated = await Promise.all(combos.map(hydrateCombo));
        res.json(hydrated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create combo pack
// @route   POST /api/admin/kit-combos
// @access  Private/Admin
const createKitCombo = async (req, res) => {
    try {
        const { name, categoryId, description, image, items, comboPrice, isActive } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ message: 'Combo name is required' });
        if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'A category is required' });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Select at least one starter kit item' });
        }
        if (comboPrice === undefined || Number(comboPrice) < 0) {
            return res.status(400).json({ message: 'A valid combo price is required' });
        }

        const normalized = items.map(i => ({ itemId: i.itemId || i }));

        // Every item must belong to the same category as the combo.
        const found = await StarterKitItem.find({ _id: { $in: normalized.map(i => i.itemId) } }).lean();
        if (found.length !== normalized.length) {
            return res.status(400).json({ message: 'One or more selected items no longer exist' });
        }
        const mismatched = found.filter(i => String(i.categoryId) !== String(categoryId));
        if (mismatched.length) {
            return res.status(400).json({ message: 'All items in a combo must belong to the combo\'s category' });
        }

        const combo = await KitCombo.create({
            name: name.trim(),
            categoryId,
            description: description || '',
            image: image || '',
            items: normalized,
            comboPrice: Number(comboPrice),
            isActive: isActive !== undefined ? isActive : true
        });

        res.status(201).json(combo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update combo pack
// @route   PUT /api/admin/kit-combos/:id
// @access  Private/Admin
const updateKitCombo = async (req, res) => {
    try {
        const combo = await KitCombo.findById(req.params.id);
        if (!combo) return res.status(404).json({ message: 'Combo pack not found' });

        const f = req.body;
        const targetCategory = f.categoryId || combo.categoryId;

        if (f.items !== undefined) {
            if (!Array.isArray(f.items) || f.items.length === 0) {
                return res.status(400).json({ message: 'Select at least one starter kit item' });
            }
            const normalized = f.items.map(i => ({ itemId: i.itemId || i }));
            const found = await StarterKitItem.find({ _id: { $in: normalized.map(i => i.itemId) } }).lean();
            if (found.length !== normalized.length) {
                return res.status(400).json({ message: 'One or more selected items no longer exist' });
            }
            if (found.some(i => String(i.categoryId) !== String(targetCategory))) {
                return res.status(400).json({ message: 'All items in a combo must belong to the combo\'s category' });
            }
            combo.items = normalized;
        }

        if (f.name !== undefined) combo.name = f.name.trim();
        if (f.categoryId !== undefined) combo.categoryId = f.categoryId;
        if (f.description !== undefined) combo.description = f.description;
        if (f.image !== undefined) combo.image = f.image;
        if (f.comboPrice !== undefined && Number(f.comboPrice) >= 0) combo.comboPrice = Number(f.comboPrice);
        if (f.isActive !== undefined) combo.isActive = f.isActive;

        const updated = await combo.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete combo pack
// @route   DELETE /api/admin/kit-combos/:id
// @access  Private/Admin
const deleteKitCombo = async (req, res) => {
    try {
        const combo = await KitCombo.findById(req.params.id);
        if (!combo) return res.status(404).json({ message: 'Combo pack not found' });

        const liveOrders = await KitOrder.countDocuments({
            comboId: combo._id,
            status: { $in: ['pending', 'confirmed', 'dispatched'] }
        });
        if (liveOrders > 0) {
            return res.status(400).json({ message: `${liveOrders} in-flight order(s) reference this combo. Deactivate it instead.` });
        }

        await combo.deleteOne();
        res.json({ message: 'Combo pack removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Payment config ───────────────────────────────────────────────────────────

// @desc    Get payment config for a category (returns defaults if unset)
// @route   GET /api/admin/kit-payment-config/:categoryId
// @access  Private/Admin
const getKitPaymentConfig = async (req, res) => {
    try {
        const { categoryId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid category' });
        }
        const existing = await KitPaymentConfig.findOne({ categoryId }).lean();
        if (existing) return res.json(existing);

        res.json({
            categoryId,
            paymentMode: 'full',
            downPaymentType: 'percentage',
            downPaymentValue: 50,
            deductionFrequency: 'weekly',
            instalmentAmount: 0,
            weeklyDeductionDay: 1,
            monthlyDeductionDate: 1,
            blockPayoutOnDues: true,
            isActive: true,
            _unsaved: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upsert payment config for a category
// @route   PUT /api/admin/kit-payment-config/:categoryId
// @access  Private/Admin
const updateKitPaymentConfig = async (req, res) => {
    try {
        const { categoryId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid category' });
        }

        const f = req.body;
        const allowsPart = f.paymentMode === 'part' || f.paymentMode === 'both';

        if (allowsPart) {
            if (!(Number(f.instalmentAmount) > 0)) {
                return res.status(400).json({ message: 'Set an instalment amount greater than 0 for part payment' });
            }
            if (f.downPaymentType === 'percentage' && (Number(f.downPaymentValue) < 0 || Number(f.downPaymentValue) > 100)) {
                return res.status(400).json({ message: 'Down payment percentage must be between 0 and 100' });
            }
        }

        const update = {
            categoryId,
            paymentMode: f.paymentMode || 'full',
            downPaymentType: f.downPaymentType || 'percentage',
            downPaymentValue: Number(f.downPaymentValue) || 0,
            deductionFrequency: f.deductionFrequency || 'weekly',
            instalmentAmount: Number(f.instalmentAmount) || 0,
            weeklyDeductionDay: Number.isInteger(f.weeklyDeductionDay) ? f.weeklyDeductionDay : 1,
            monthlyDeductionDate: Math.min(Number(f.monthlyDeductionDate) || 1, 28),
            blockPayoutOnDues: f.blockPayoutOnDues !== false,
            isActive: f.isActive !== false
        };

        const saved = await KitPaymentConfig.findOneAndUpdate(
            { categoryId },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.json(saved);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ── Inventory dashboard ──────────────────────────────────────────────────────

// @desc    Real-time stock summary
// @route   GET /api/admin/kit-inventory/summary
// @access  Private/Admin
const getInventorySummary = async (req, res) => {
    try {
        const items = await StarterKitItem.find({})
            .populate('categoryId', 'name')
            .sort({ availableStock: 1 })
            .lean();

        const rows = items.map(i => ({
            _id: i._id,
            name: i.name,
            category: i.categoryId?.name || '—',
            availableStock: i.availableStock,
            kitQuantity: i.kitQuantity,
            price: i.price,
            isActive: i.isActive,
            state: i.availableStock < 0 ? 'backorder'
                : i.availableStock === 0 ? 'out'
                    : i.availableStock <= (i.lowStockThreshold ?? 5) ? 'low'
                        : 'ok'
        }));

        res.json({
            totals: {
                items: rows.length,
                backorder: rows.filter(r => r.state === 'backorder').length,
                out: rows.filter(r => r.state === 'out').length,
                low: rows.filter(r => r.state === 'low').length,
                ok: rows.filter(r => r.state === 'ok').length,
                stockValue: rows.reduce((s, r) => s + Math.max(0, r.availableStock) * r.price, 0)
            },
            rows
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStarterKitItems,
    createStarterKitItem,
    updateStarterKitItem,
    adjustStock,
    deleteStarterKitItem,
    getKitCombos,
    createKitCombo,
    updateKitCombo,
    deleteKitCombo,
    getKitPaymentConfig,
    updateKitPaymentConfig,
    getInventorySummary,
    hydrateCombo
};
