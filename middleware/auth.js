// middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../database/database'); // Import the database handler

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware to protect routes.
 * Checks for a valid JWT in the cookie.
 * If valid, attaches user data to req.user.
 * If invalid or missing, redirects to the login page.
 */
const authenticateToken = async (req, res, next) => {
    const token = req.cookies.bhabo_token;

    if (!token) {
        console.log('No token found, redirecting to login.');
        return res.redirect('/login.html'); // This line handles the redirection
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);
        // console.log('Token decoded:', decoded);

        // Fetch user from database using the ID from the token
        // This ensures the user still exists and is active
        const user = await db.getUserById(decoded.userId); // Assuming getUserById exists in your db handler
        if (!user) {
            console.log('User not found for token, redirecting to login.');
            return res.redirect('/login.html');
        }

        // Attach user object to the request for subsequent middleware/routes
        req.user = user;
        next(); // Proceed to the next middleware/route handler
    } catch (error) {
        // If token is invalid or expired
        console.error('Token verification failed:', error.message);
        // Clear the invalid cookie and redirect to login
        res.clearCookie('bhabo_token');
        return res.redirect('/login.html');
    }
};

/**
 * Middleware to check if user is already logged in.
 * If logged in, redirects to the home page.
 * Used for login/signup pages to prevent showing them to authenticated users.
 */
const redirectIfLoggedIn = (req, res, next) => {
    const token = req.cookies.bhabo_token;
    if (token) {
        try {
            jwt.verify(token, JWT_SECRET);
            // If token is valid, user is logged in, redirect to home
            return res.redirect('/');
        } catch (error) {
            // If token is invalid, clear it and proceed to login/signup page
            res.clearCookie('bhabo_token');
            next();
        }
    } else {
        next(); // No token, proceed to login/signup page
    }
};

module.exports = {
    authenticateToken,
    redirectIfLoggedIn
};
