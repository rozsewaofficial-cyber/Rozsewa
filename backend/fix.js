const fs = require('fs');
let content = fs.readFileSync('d:/Rojsewa-main/backend/controllers/bazaarController.js');
let str = content.toString('utf8');
let idx = str.indexOf('\0c\0o\0n\0s\0t'); // UTF-16LE has null bytes
if (idx === -1) {
  idx = str.indexOf(' c o n s t ');
}
if (idx !== -1) {
  str = str.substring(0, idx);
}
str = str.replace(/[\x00]/g, '');

const correctAddition = `
const BazaarChatTemplate = require('../models/BazaarChatTemplate');

// ========================
// CHAT TEMPLATE ACTIONS
// ========================
exports.getChatTemplates = async (req, res) => {
  try {
    const templates = await BazaarChatTemplate.find({ isActive: true }).sort({ order: 1 });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.createChatTemplate = async (req, res) => {
  try {
    const { text, order } = req.body;
    const template = await BazaarChatTemplate.create({ text, order });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.deleteChatTemplate = async (req, res) => {
  try {
    await BazaarChatTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
`;

fs.writeFileSync('d:/Rojsewa-main/backend/controllers/bazaarController.js', str + correctAddition);
console.log('Fixed bazaarController.js encoding issue');
