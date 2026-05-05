const axios = require('axios');

const simulateLogin = async () => {
    try {
        console.log('Testing login for admin@rozsewa.com...');
        const res = await axios.post('http://localhost:5000/api/auth/login', {
            identifier: 'admin@rozsewa.com',
            password: 'pass-admin123'
        });
        console.log('Login successful:', res.data.email, res.data.role);
    } catch (err) {
        console.error('Login failed:', err.response?.status, err.response?.data?.message || err.message);
    }

    try {
        console.log('Testing login for admin@gmail.com...');
        const res = await axios.post('http://localhost:5000/api/auth/login', {
            identifier: 'admin@gmail.com',
            password: 'pass-admin123'
        });
        console.log('Login successful:', res.data.email, res.data.role);
    } catch (err) {
        console.error('Login failed:', err.response?.status, err.response?.data?.message || err.message);
    }
};

simulateLogin();
