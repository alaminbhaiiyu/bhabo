// database/database.js
const localDb = require('./localDbHandler');
const mongoDb = require('./mongoDbHandler');

const USED_DB = process.env.USED_DB || 'mongo'; // Set this in your .env file or default to 'local'

let dbHandler;

if (USED_DB === 'mongo') {
    dbHandler = mongoDb;
    console.log('Using MongoDB as the database.');
} else {
    dbHandler = localDb;
    console.log('Using local file system as the database.');
}

module.exports = dbHandler;
