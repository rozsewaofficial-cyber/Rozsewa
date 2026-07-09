const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Booking = require('./models/Booking');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rojsewa', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
    const queue = await Booking.find({ status: 'completed' })
        .populate('providerId', 'shopName ownerName bankDetails planType providerCategory')
        .sort({ createdAt: -1 })
        .limit(20);

    let sumJobV = 0;
    let sumPay = 0;
    let sumCom = 0;
    queue.forEach(b => {
        const commission = b.adminCommission || 0;
        const payout = b.providerPayout != null ? b.providerPayout : (b.totalAmount - commission);
        sumJobV += (b.totalAmount || 0);
        sumCom += commission;
        sumPay += payout;
        console.log(`Booking ${b._id}: JobV=${b.totalAmount}, Com=${commission}, Pay=${payout}`);
    });
    console.log(`Total JobV: ${sumJobV}`);
    console.log(`Total Com: ${sumCom}`);
    console.log(`Total Pay: ${sumPay}`);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
