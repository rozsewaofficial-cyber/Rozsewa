require('dotenv').config();
const { sendEmail } = require('./utils/emailService');

async function run() {
    console.log('Sending test email...');
    console.log('SMTP Config check:', process.env.SMTP_USER, process.env.SMTP_PASS ? 'PASS_SET' : 'NO_PASS');
    const result = await sendEmail('test@example.com', 'Test Email', '<h1>This is a test email</h1>');
    console.log(result);
}

run();
