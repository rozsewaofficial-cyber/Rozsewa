// The web app origins this API serves: used for CORS, and as the only places
// a redirect-mode sign-in may send the browser back to.
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:8080',
    'http://localhost:5173',
    'https://rozsewa.in',
    'https://www.rozsewa.in',
    'https://rozsewa.vercel.app'
].filter(Boolean);

module.exports = allowedOrigins;
