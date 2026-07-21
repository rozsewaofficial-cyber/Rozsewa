const mongoose = require('mongoose');

const subcategorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    image: {
        type: String,
        default: ''
    },
    icon: {
        type: String,
        default: 'Wrench'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    index: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Subcategory = mongoose.model('Subcategory', subcategorySchema);
module.exports = Subcategory;
