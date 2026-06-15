const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Booking = require('./models/Booking');
const Provider = require('./models/Provider');
const { Wallet, Transaction } = require('./models/Wallet');
const Setting = require('./models/Setting');
const SewakIncentiveLog = require('./models/SewakIncentiveLog');
const Category = require('./models/Category');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const booking = await Booking.findById('6a2fc6e4f4d8ba0d934a1041');
  console.log('Booking found:', booking ? 'Yes' : 'No');
  
  if (booking) {
      const provider = await Provider.findById(booking.providerId).populate('vendorType');
      console.log('Provider found:', provider ? 'Yes' : 'No');
    
      try {
         await booking.save();
         console.log('booking save ok');
         await provider.save();
         console.log('provider save ok');
         let wallet = await Wallet.findOne({ providerId: provider._id });
         if (!wallet) wallet = await Wallet.create({ providerId: provider._id, balance: 0 });
         await wallet.save();
         console.log('wallet save ok');
         
         await Transaction.create({
             providerId: provider._id,
             title: `Service Earnings: ${booking.serviceName}`,
             amount: 100,
             type: 'credit',
             status: 'completed',
             bookingId: booking._id,
             description: `Booking ID #${booking._id.toString().slice(-6)}`
         });
         console.log('Transaction create ok');
      } catch (e) {
         console.error('ERROR:', e.message);
      }
  }
  process.exit();
}
test();
