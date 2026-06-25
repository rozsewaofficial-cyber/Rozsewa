const Message = require('../models/Message');
const Booking = require('../models/Booking');
const { getIO } = require('../config/socket');

// @desc    Get messages for a booking
// @route   GET /api/chat/:bookingId
// @access  Private (User/Provider)
const getMessages = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const messages = await Message.find({ bookingId }).sort({ createdAt: 1 }).populate('senderId', 'name shopName ownerName profileImage avatar');
        
        // Enhance messages with a generic "senderName" property
        const enhancedMessages = messages.map(msg => {
            let senderName = "Unknown";
            if (msg.senderId) {
                if (msg.senderModel === 'Provider') {
                    senderName = msg.senderId.shopName || msg.senderId.ownerName || msg.senderId.name;
                } else {
                    senderName = msg.senderId.name;
                }
            }
            return {
                ...msg.toObject(),
                senderName
            };
        });

        res.status(200).json(enhancedMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
};

// @desc    Send a message
// @route   POST /api/chat/:bookingId
// @access  Private (User/Provider)
const sendMessage = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { text, type, offerAmount } = req.body;
        
        // Determine sender from req.user or req.provider
        let senderId, senderModel, senderName;
        if (req.provider) {
            senderId = req.provider._id;
            senderModel = 'Provider';
            senderName = req.provider.shopName || req.provider.ownerName || req.provider.name;
        } else if (req.user) {
            senderId = req.user._id;
            senderModel = 'User';
            senderName = req.user.name;
        } else {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const message = new Message({
            bookingId,
            senderId,
            senderModel,
            text,
            type: type || 'text',
            offerAmount: type === 'offer' ? offerAmount : undefined
        });

        await message.save();

        const savedMessage = await Message.findById(message._id).populate('senderId', 'name shopName ownerName profileImage avatar');
        
        const enhancedMessage = {
            ...savedMessage.toObject(),
            senderName
        };

        // Broadcast to socket room
        const io = getIO();
        io.to(`booking_${bookingId}`).emit('receive_message', enhancedMessage);

        res.status(201).json(enhancedMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

module.exports = {
    getMessages,
    sendMessage
};
