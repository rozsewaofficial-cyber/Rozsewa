const bcrypt = require('bcryptjs');

const test = async () => {
    const password = 'pass-admin123';
    const dbHash = '$2b$10$q820pKKXBVhyEyQ3g3ScWO2l0OJ08PrR3.l66uAwCFVY7C1mCg3hS';
    
    const isMatch = await bcrypt.compare(password, dbHash);
    console.log('Match with DB Hash:', isMatch);
};

test();
