// route/search.js
const express = require('express');
const router = express.Router();
const searchLogic = require('../logic/searchLogic');

router.get('/', async (req, res) => {
    const query = req.query.q; // Get search query from URL parameter 'q'

    if (!query) {
        return res.status(400).json({ success: false, message: 'Search query is required.' });
    }

    try {
        const results = await searchLogic.performSearch(query);
        res.json({ success: true, results: results });
    } catch (error) {
        console.error('Error during search:', error);
        res.status(500).json({ success: false, message: 'Server error during search.' });
    }
});

// New: API endpoint for "Find Friends" section
router.get('/find-friends', async (req, res) => {
    const currentUserId = req.user._id || req.user.username; // Get current user's ID from authenticated request

    try {
        const users = await searchLogic.getFindFriendsUsers(currentUserId);
        res.json({ success: true, users: users });
    } catch (error) {
        console.error('Error fetching find friends users:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch find friends users.' });
    }
});

module.exports = router;
