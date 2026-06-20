const jwt = require('jsonwebtoken');
require('dotenv').config({path: 'd:/Rojsewa-main/backend/.env'});

const token = jwt.sign({ _id: 'admin_id_here', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log('Token generated');

const axios = require('axios');
axios.get('http://localhost:5000/api/admin/bookings', {
  headers: { Authorization: `Bearer ${token}` }
}).then(res => {
  const bookings = res.data;
  const target = bookings.find(b => b._id.toString().toLowerCase().endsWith('ab743b'));
  console.log('Target Booking:', target);
}).catch(e => console.log(e.response ? e.response.data : e.message));
