/**
 * Boots the API against a LOCAL scratch MongoDB instead of whatever
 * MONGODB_URI points at in .env.
 *
 * Setting the variable before index.js runs is what makes this work — dotenv
 * never overwrites a value already present in process.env. Intended for local
 * end-to-end testing so that exercising the app can't write to the real
 * database.
 *
 *   node scripts/devLocalDb.js
 */
const path = require('path');

// index.js calls dotenv.config() with no path, which resolves against the
// process CWD. This script may be launched from the repo root, so load
// backend/.env explicitly first — dotenv won't re-read it later.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.MONGODB_URI =
    process.env.LOCAL_DB_URI || 'mongodb://127.0.0.1:27018/rozsewa_demo';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`[devLocalDb] Using database: ${process.env.MONGODB_URI}`);

require('../index.js');
