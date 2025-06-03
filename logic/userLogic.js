// logic/userLogic.js
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../database/database'); // Unified database handler

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can use other services like 'Outlook', 'SendGrid', etc.
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});

/**
 * Hashes a plain text password.
 * @param {string} password - The plain text password.
 * @returns {Promise<string>} - The hashed password.
 */
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

/**
 * Compares a plain text password with a hashed password.
 * @param {string} plainPassword - The plain text password.
 * @param {string} hashedPassword - The hashed password from the database.
 * @returns {Promise<boolean>} - True if passwords match, false otherwise.
 */
const comparePassword = async (plainPassword, hashedPassword) => {
    return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Generates a random N-digit code.
 * @param {number} length - The length of the code.
 * @returns {string} - The generated code.
 */
const generateCode = (length) => {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += Math.floor(Math.random() * 10);
    }
    return code;
};

/**
 * Sends a verification email to the user.
 * @param {string} email - The recipient's email address.
 * @param {string} code - The verification code.
 * @param {string} subject - The email subject.
 * @param {string} messageBody - The main message body.
 */
const sendVerificationEmail = async (email, code, subject, messageBody) => {
    try {
        await transporter.sendMail({
            from: `"Bhabo App" <${EMAIL_USER}>`, // Sender address
            to: email, // List of receivers
            subject: subject, // Subject line
            html: `<p>${messageBody}</p><p>Your code is: <strong>${code}</strong></p><p>This code is valid for 1 minute.</p>`, // HTML body
        });
        console.log(`Verification email sent to ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
        throw new Error('Failed to send verification email. Please check your email configuration.');
    }
};

/**
 * Finds a user by username or email.
 * @param {string} identifier - Username or email.
 * @returns {Promise<Object|null>} - The user object or null if not found.
 */
const findUserByIdentifier = async (identifier) => {
    // This function will need to be implemented in your dbHandler based on the USED_DB
    // For MongoDB, it would be User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    // For local, you'd iterate through user files or have a lookup.
    // For now, let's assume db.findUserByIdentifier exists.
    return await db.findUserByIdentifier(identifier);
};

module.exports = {
    hashPassword,
    comparePassword,
    generateCode,
    sendVerificationEmail,
    findUserByIdentifier,
};
