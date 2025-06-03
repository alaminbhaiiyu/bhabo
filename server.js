// server.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config(); // To load environment variables from .env

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
// Middleware to parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// Use cookie-parser middleware
app.use(cookieParser());

// Import authentication middleware
const { authenticateToken, redirectIfLoggedIn } = require('./middleware/auth');

// Import routes
const authRoutes = require('./route/auth');
const profileRoutes = require('./route/profile');
const searchRoutes = require('./route/search');
const chatRoutes = require('./route/chat');
const postRoutes = require('./route/post'); // Import post routes

const db = require('./database/database'); // Import database handler for online status update

// --- IMPORTANT: ORDER MATTERS HERE ---

// 1. Authentication Routes (no protection needed for these themselves)
app.use('/auth', authRoutes);

// 2. Specific HTML pages that should redirect if logged in (like login/signup)
app.get('/login.html', redirectIfLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
});

app.get('/signup.html', redirectIfLoggedIn, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'signup.html'));
});

// 3. Other specific HTML pages (like verify/forgot/reset that don't need redirectIfLoggedIn)
app.get('/verify.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'verify.html'));
});

app.get('/forgot-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'forgot-password.html'));
});

app.get('/reset-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'reset-password.html'));
});

// My Profile Page Route (Protected)
app.get('/profile', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'profile.html'));
});

// Public Profile Page Route (Protected - so req.user is available to check follow status)
app.get('/@:username', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'public_profile.html'));
});

// Dedicated Search Page Route (Protected)
app.get('/search.html', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'search.html'));
});

// Dedicated Chat Page Route (Protected)
app.get('/chat.html', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'chat.html'));
});

// Dedicated Create Post Page Route (Protected)
app.get('/create_post.html', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'create_post.html'));
});

// New: Dedicated Single Post Detail Page Route (Protected)
app.get('/post/:postId', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'web', 'post_detail.html'));
});


// 4. Protected Home Page Route
// This MUST come BEFORE app.use(express.static)
app.get('/', authenticateToken, (req, res) => {
    console.log(`User ${req.user.username} accessed home page.`);
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// 5. Serve Static Files (general fallback for other static assets)
// This should come AFTER specific routes that might serve files or redirect based on logic.
app.use(express.static(path.join(__dirname, 'web')));
app.use('/images', express.static(path.join(__dirname, 'images'))); // Serve general images folder
app.use('/images/posts_media', express.static(path.join(__dirname, 'images', 'posts_media'))); // Serve posts media


// --- Protected API Routes ---
// Apply authenticateToken middleware to all /api routes
app.use('/api', authenticateToken);

// Mount API routes
app.use('/api/profile', profileRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/posts', postRoutes); // Mount post routes

// API for user online status (can be used by client-side JS)
app.post('/api/user/online', async (req, res) => {
    const userId = req.user._id || req.user.username;
    const { isOnline } = req.body;
    try {
        await db.updateUserOnlineStatus(userId, isOnline);
        res.json({ success: true, message: `User ${userId} status set to ${isOnline}.` });
    } catch (error) {
        console.error('Error updating online status:', error);
        res.status(500).json({ success: false, message: 'Failed to update online status.' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Visit: http://localhost:${PORT}/ to test the redirect or http://localhost:${PORT}/login.html to log in.`);
});
