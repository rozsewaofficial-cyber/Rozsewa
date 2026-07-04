const mongoose = require('mongoose');
const Booking = require('./models/Booking');

mongoose.connect('mongodb://localhost:27017/rojsewa').then(async () => {
  const bookings = await Booking.find({});
  let count = 0;
  for (const b of bookings) {
    if (b._id.toString().toUpperCase().endsWith('ADCF41')) {
      b.paymentMode = 'after';
      await b.save();
      console.log('Fixed booking:', b._id);
      count++;
    }
  }
  console.log('Fixed total:', count);
  process.exit(0);
});
