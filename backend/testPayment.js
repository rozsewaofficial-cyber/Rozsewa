const axios = require('axios');
axios.post('http://localhost:5000/api/payment/order', { amount: 67.6, currency: 'INR' })
  .then(res => console.log(res.data))
  .catch(err => console.log(err.response ? err.response.data : err.message));
