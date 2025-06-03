// logic/postLogic.js
const db = require('../database/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Creates a new post.
 * @param {string} userId - The ID of the user creating the post.
 * @param {string} username - The username of the user creating the post.
 * @param {string} content - The text content of the post (caption).
 * @param {string} [imageUrl] - URL of the uploaded image/video.
 * @returns {Promise<Object>} The newly created post object.
 */
const createPost = async (userId, username, content, imageUrl) => {
    if (!content && !imageUrl) {
        throw new Error('Post must have either content or an image/video.');
    }

    const newPost = {
        userId: userId,
        username: username,
        content: content || '',
        imageUrl: imageUrl || null,
        likes: [],
        comments: [],
        createdAt: new Date(),
    };

    const savedPost = await db.savePost(username, newPost);
    return savedPost;
};

/**
 * Fetches posts for the user's home feed.
 * @param {string} currentUserId - The ID of the logged-in user.
 * @param {number} skip - Number of posts to skip for pagination.
 * @param {number} limit - Maximum number of posts to return.
 * @returns {Promise<Array<Object>>} List of feed posts.
 */
const getFeedPosts = async (currentUserId, skip, limit) => {
    return await db.getFeedPosts(currentUserId, skip, limit);
};

/**
 * Toggles the like status for a post.
 * @param {string} postId - The ID of the post.
 * @param {string} userId - The ID of the user liking/unliking.
 * @param {boolean} isLiked - Current like status (true if already liked, false otherwise).
 * @returns {Promise<Object>} The updated post object.
 */
const toggleLike = async (postId, userId, isLiked) => {
    let updatedPost;
    if (isLiked) {
        updatedPost = await db.unlikePost(postId, userId);
    } else {
        updatedPost = await db.likePost(postId, userId);
    }
    return updatedPost;
};

/**
 * Adds a comment to a post.
 * @param {string} postId - The ID of the post.
 * @param {string} userId - The ID of the user commenting.
 * @param {string} username - The username of the user commenting.
 * @param {string} text - The comment text.
 * @returns {Promise<Object>} The updated post object.
 */
const addComment = async (postId, userId, username, text) => {
    const commentData = { userId, username, text };
    return await db.addCommentToPost(postId, commentData);
};

/**
 * Gets all comments for a specific post.
 * @param {string} postId - The ID of the post.
 * @returns {Promise<Array<Object>>} List of comments.
 */
const getComments = async (postId) => {
    return await db.getCommentsForPost(postId);
};

/**
 * Gets a single post by ID.
 * @param {string} postId - The ID of the post.
 * @returns {Promise<Object|null>} The post object or null if not found.
 */
const getSinglePost = async (postId) => {
    return await db.getPost(postId);
};

/**
 * Deletes a post.
 * @param {string} postId - The ID of the post to delete.
 * @param {string} username - The username of the post owner (for local DB file path).
 * @returns {Promise<boolean>} True if deletion was successful.
 */
const deletePost = async (postId, username) => {
    const post = await db.getPost(postId);
    if (!post) {
        throw new Error('Post not found.');
    }

    // Delete associated media file if it exists
    if (post.imageUrl) {
        const mediaFilePath = path.join(__dirname, '..', post.imageUrl);
        await fs.unlink(mediaFilePath).catch(err => console.warn(`Could not delete media file ${mediaFilePath}:`, err.message));
    }

    // Delete the post from the database
    return await db.deletePost(postId, username); // db.deletePost needs to be implemented in db handlers
};


module.exports = {
    createPost,
    getFeedPosts,
    toggleLike,
    addComment,
    getComments,
    getSinglePost,
    deletePost, // Exported
};
