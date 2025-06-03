// route/post.js
const express = require('express');
const router = express.Router();
const postLogic = require('../logic/postLogic');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../database/database'); // Import the database handler

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
    const username = req.user.username;
    const { content } = req.body;
    let imageUrl = null;

    if (req.file) {
        imageUrl = `/images/posts_media/${req.file.filename}`;
    }

    if (!content && !imageUrl) {
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
        return res.status(400).json({ success: false, message: 'Post must have either text content or an image/video.' });
    }

    try {
        const newPost = await postLogic.createPost(userId, username, content, imageUrl);
        res.status(201).json({ success: true, message: 'Post created successfully!', post: newPost });
    } catch (error) {
        console.error('Error creating post:', error);
        if (req.file) await fs.unlink(req.file.path).catch(console.error);
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

// --- Toggle Like on a Post ---
router.post('/:postId/like', async (req, res) => {
    const { postId } = req.params;
    const userId = req.user._id || req.user.username;

    try {
        const post = await db.getPost(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }
        const isLiked = post.likes && post.likes.includes(userId);
        const updatedPost = await postLogic.toggleLike(postId, userId, isLiked);

        res.json({
            success: true,
            message: isLiked ? 'Post unliked.' : 'Post liked!',
            likesCount: updatedPost.likes ? updatedPost.likes.length : 0,
            isLiked: !isLiked
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to toggle like.' });
    }
});

// --- Add Comment to a Post ---
router.post('/:postId/comment', async (req, res) => {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user._id || req.user.username;
    const username = req.user.username;

    if (!text || text.trim() === '') {
        return res.status(400).json({ success: false, message: 'Comment text cannot be empty.' });
    }

    try {
        const updatedPost = await postLogic.addComment(postId, userId, username, text);
        const newComment = updatedPost.comments && updatedPost.comments.length > 0 ?
                           updatedPost.comments[updatedPost.comments.length - 1] : null;

        res.status(201).json({
            success: true,
            message: 'Comment added!',
            commentsCount: updatedPost.comments ? updatedPost.comments.length : 0,
            newComment: newComment
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to add comment.' });
    }
});

// --- Get Comments for a Post ---
router.get('/:postId/comments', async (req, res) => {
    const { postId } = req.params;

    try {
        const comments = await postLogic.getComments(postId);
        res.json({ success: true, comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comments.' });
    }
});

// --- Get a single post by ID ---
router.get('/:postId', async (req, res) => {
    const { postId } = req.params;
    try {
        const post = await postLogic.getSinglePost(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }
        res.json({ success: true, post });
    } catch (error) {
        console.error(`Error fetching post ${postId}:`, error);
        res.status(500).json({ success: false, message: 'Failed to fetch post.' });
    }
});

// --- Delete a post ---
router.delete('/:postId', async (req, res) => {
    const { postId } = req.params;
    const userId = req.user._id || req.user.username; // Current authenticated user

    try {
        const post = await db.getPost(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post not found.' });
        }
        // Ensure only the owner can delete the post
        const postOwnerId = post.userId._id ? post.userId._id.toString() : post.userId; // For local DB, userId might be username string
        if (postOwnerId !== userId) {
            return res.status(403).json({ success: false, message: 'You are not authorized to delete this post.' });
        }

        await postLogic.deletePost(postId, post.username); // Pass post.username for local DB file path
        res.json({ success: true, message: 'Post deleted successfully.' });
    } catch (error) {
        console.error(`Error deleting post ${postId}:`, error);
        res.status(500).json({ success: false, message: error.message || 'Failed to delete post.' });
    }
});


module.exports = router;
