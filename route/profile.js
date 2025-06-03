// route/profile.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const profileLogic = require('../logic/profileLogic');
const chatLogic = require('../logic/chatLogic'); // Import chatLogic for block status
const db = require('../database/database');
const multer = require('multer'); // Import multer
const path = require('path');
const fs = require('fs').promises; // For deleting old files

// --- Multer Setup for Profile Pictures ---
const profilePicUploadDir = path.join(__dirname, '..', 'images', 'profile'); // New dedicated folder
// Ensure the directory exists
fs.mkdir(profilePicUploadDir, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profilePicUploadDir);
    },
    filename: (req, file, cb) => {
        // Use userId and timestamp to ensure unique filenames
        const ext = path.extname(file.originalname);
        const filename = `${req.user._id || req.user.username}-${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF are allowed.'), false);
        }
    }
});

// --- GET My Profile ---
router.get('/me', async (req, res) => {
    try {
        const userId = req.user._id || req.user.username;
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const { password, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, ...profileData } = user;
        profileData.followersCount = profileData.followers ? profileData.followers.length : 0;
        profileData.followingCount = profileData.following ? profileData.following.length : 0;

        const userPosts = await db.getAllPostsByUser(userId);
        profileData.postCount = userPosts.length;
        profileData.posts = userPosts; // Include posts directly for own profile

        res.json({ success: true, profile: profileData });
    } catch (error) {
        console.error('Error fetching my profile:', error);
        res.status(500).json({ success: false, message: 'Server error fetching profile.' });
    }
});

// --- UPDATE My Profile ---
// Use `upload.single('profilePicture')` for handling file uploads
router.post(
    '/me',
    upload.single('profilePicture'), // Field name for the file input
    [
        body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty.'),
        body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty.'),
        body('displayName').optional().trim(),
        body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters.'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there are validation errors, and a file was uploaded, delete it
            if (req.file) {
                await fs.unlink(req.file.path).catch(console.error);
            }
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user._id || req.user.username;
        const updates = req.body;

        try {
            // Handle profile picture update if a file was uploaded
            if (req.file) {
                // Get current user data to delete old profile picture
                const currentUser = await db.getUserById(userId);
                if (currentUser && currentUser.profilePicture && currentUser.profilePicture !== '/images/default_profile.png') {
                    // Delete old profile picture file from disk
                    const oldPicPath = path.join(__dirname, '..', currentUser.profilePicture);
                    await fs.unlink(oldPicPath).catch(err => console.warn('Could not delete old profile pic:', err.message));
                }
                updates.profilePicture = `/images/profile/${req.file.filename}`; // Save path to DB
            } else if (updates.removeProfilePicture === 'true') {
                 // Option to remove profile picture and revert to default
                const currentUser = await db.getUserById(userId);
                if (currentUser && currentUser.profilePicture && currentUser.profilePicture !== '/images/default_profile.png') {
                    const oldPicPath = path.join(__dirname, '..', currentUser.profilePicture);
                    await fs.unlink(oldPicPath).catch(err => console.warn('Could not delete old profile pic:', err.message));
                }
                updates.profilePicture = '/images/default_profile.png';
            }


            const updatedProfile = await profileLogic.updateMyProfile(userId, updates);

            if (!updatedProfile) {
                return res.status(404).json({ success: false, message: 'User not found for update.' });
            }

            const { password, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, ...safeProfile } = updatedProfile;
            res.json({ success: true, message: 'Profile updated successfully!', profile: safeProfile });
        } catch (error) {
            console.error('Error updating profile:', error);
            if (req.file) { // If error occurs after file upload, delete the uploaded file
                await fs.unlink(req.file.path).catch(console.error);
            }
            res.status(500).json({ success: false, message: 'Server error updating profile.' });
        }
    }
);

// --- UPDATE My Password ---
router.post(
    '/me/password',
    [
        body('currentPassword').notEmpty().withMessage('Current password is required.'),
        body('newPassword')
            .isLength({ min: 8 })
            .withMessage('New password must be at least 8 characters long.'),
        body('confirmNewPassword').custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('New passwords do not match.');
            }
            return true;
        }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.user._id || req.user.username;
        const { currentPassword, newPassword } = req.body;

        try {
            await profileLogic.updateMyPassword(userId, currentPassword, newPassword);
            res.json({ success: true, message: 'Password updated successfully!' });
        } catch (error) {
            console.error('Error updating password:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }
);

// --- GET Public Profile by Username ---
router.get('/:username', async (req, res) => {
    const { username } = req.params;
    const currentUserId = req.user._id || req.user.username; // Current logged-in user's ID

    try {
        const profileData = await profileLogic.getPublicProfileData(username, currentUserId);
        if (!profileData) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Add a flag to indicate if this is the currently logged-in user's profile
        profileData.isOwnProfile = (profileData.userId === currentUserId);

        // New: Check if the current user has blocked this profile
        profileData.isBlockedByCurrentUser = await chatLogic.hasBlocked(currentUserId, profileData.userId);

        res.json({ success: true, profile: profileData });
    } catch (error) {
        console.error(`Error fetching public profile for ${username}:`, error);
        res.status(500).json({ success: false, message: 'Server error fetching public profile.' });
    }
});

// --- TOGGLE FOLLOW ---
// This single endpoint will handle both follow and unfollow based on current state
router.post('/:username/toggle-follow', async (req, res) => {
    const { username: targetUsername } = req.params;
    const followerUserId = req.user._id || req.user.username;

    try {
        // Fetch public profile data to determine current follow status
        const publicProfile = await profileLogic.getPublicProfileData(targetUsername, followerUserId);
        if (!publicProfile) {
            return res.status(404).json({ success: false, message: 'Target user not found.' });
        }

        if (publicProfile.userId === followerUserId) {
            return res.status(400).json({ success: false, message: 'Cannot follow/unfollow yourself.' });
        }

        const isCurrentlyFollowing = publicProfile.isFollowing;
        const result = await profileLogic.toggleFollow(followerUserId, targetUsername, !isCurrentlyFollowing);

        res.json({
            success: true,
            message: result.status === 'followed' ? `Successfully followed ${targetUsername}.` : `Successfully unfollowed ${targetUsername}.`,
            isFollowing: !isCurrentlyFollowing
        });
    } catch (error) {
        console.error(`Error toggling follow for ${targetUsername}:`, error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = router;
