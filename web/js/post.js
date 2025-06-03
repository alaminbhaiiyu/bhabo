// route/post.js
const express = require('express');
const router = express.Router();
const postLogic = require('../logic/postLogic');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// --- Multer Setup for Post Media ---
const postsMediaUploadDir = path.join(__dirname, '..', 'images', 'posts_media');
// Ensure the directory exists
fs.mkdir(postsMediaUploadDir, { recursive: true }).catch(console.error);

const postsMediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, postsMediaUploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${req.user._id || req.user.username}-${Date.now()}${ext}`; // Use user ID and timestamp
        cb(null, filename);
    }
});

const uploadPostMedia = multer({
    storage: postsMediaStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for posts
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, MP4, WebM are allowed.'), false);
        }
    }
});

// --- Create New Post ---
router.post('/create', uploadPostMedia.single('mediaFile'), async (req, res) => {
    const userId = req.user._id || req.user.username;
    const username = req.user.username; // Get username from authenticated user
    const { content } = req.body;
    let imageUrl = null;

    if (req.file) {
        imageUrl = `/images/posts_media/${req.file.filename}`;
    }

    if (!content && !imageUrl) {
        // If no content and no image, delete uploaded file if any
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ success: false, message: 'Post must have either text content or an image/video.' });
    }

    try {
        const newPost = await postLogic.createPost(userId, username, content, imageUrl);
        res.status(201).json({ success: true, message: 'Post created successfully!', post: newPost });
    } catch (error) {
        console.error('Error creating post:', error);
        if (req.file) await fs.unlink(req.file.path).catch(console.error); // Delete file on error
        res.status(500).json({ success: false, message: error.message || 'Failed to create post.' });
    }
});

// --- Get Home Feed Posts ---
router.get('/feed', async (req, res) => {
    const currentUserId = req.user._id || req.user.username;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const posts = await postLogic.getFeedPosts(currentUserId, skip, limit);
        res.json({ success: true, posts });
    } catch (error) {
        console.error('Error fetching feed posts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch feed posts.' });
    }
});

module.exports = router;
