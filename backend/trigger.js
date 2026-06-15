const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });
const Booking = require('./models/Booking');

async function trigger() {
  await mongoose.connect(process.env.MONGODB_URI);
  const booking = await Booking.findById('6a2fc6e4f4d8ba0d934a1041');
  if (!booking) {
    console.log('Booking not found');
    process.exit(1);
  }

  // Generate token for the user
  const token = jwt.sign({ id: booking.userId }, process.env.JWT_SECRET, { expiresIn: '30d' });

  console.log('Sending request to complete booking with OTP:', booking.endOTP);
  
  try {
    const res = await fetch(`http://localhost:5000/api/bookings/${booking._id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ otp: booking.endOTP })
    });
    
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
  process.exit();
}
trigger();
