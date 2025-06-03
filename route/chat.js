// route/chat.js
const express = require('express');
const router = express.Router();
const chatLogic = require('../logic/chatLogic');
const db = require('../database/database'); // To get user info for blocking/unblocking
const multer = require('multer'); // For handling image/video/voice uploads
const path = require('path');
const fs = require('fs').promises; // For creating directories

// --- Multer Setup for Chat Media ---
const chatMediaUploadDir = path.join(__dirname, '..', 'images', 'chat_media');
// Ensure the directory exists
fs.mkdir(chatMediaUploadDir, { recursive: true }).catch(console.error);

const chatMediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Dynamic subfolder for each chat, e.g., images/chat_media/<chatId>/
        const chatId = req.body.chatId || req.params.chatId; // Get chatId from body or params
        if (!chatId) {
            return cb(new Error('Chat ID is required for media upload.'));
        }
        const chatSpecificDir = path.join(chatMediaUploadDir, chatId);
        fs.mkdir(chatSpecificDir, { recursive: true })
            .then(() => cb(null, chatSpecificDir))
            .catch(err => cb(err));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${req.user._id || req.user.username}-${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const uploadChatMedia = multer({
    storage: chatMediaStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for media
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only common image, video, and audio formats are allowed.'), false);
        }
    }
});


// --- Get Chat List for Current User ---
router.get('/list', async (req, res) => {
    const currentUserId = req.user._id || req.user.username;
    try {
        const chats = await chatLogic.getChatList(currentUserId);
        res.json({ success: true, chats });
    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chat list.' });
    }
});

// --- Get Messages in a Specific Chat (with pagination and timestamp) ---
router.get('/:chatId/messages', async (req, res) => {
    const { chatId } = req.params;
    const currentUserId = req.user._id || req.user.username;
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const lastMessageTimestamp = req.query.timestamp || null; // New: Get timestamp for new messages

    try {
        const chat = await db.getChatById(chatId);
        if (!chat || !chat.participants.some(p => (p._id ? p._id.toString() : p.username) === currentUserId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to chat.' });
        }

        const otherParticipant = chat.participants.find(p => (p._id ? p._id.toString() : p.username) !== currentUserId);
        if (otherParticipant) {
            const otherParticipantId = otherParticipant._id ? otherParticipant._id.toString() : otherParticipant.username;
            const hasBlockedOther = await chatLogic.hasBlocked(currentUserId, otherParticipantId);
            const isBlockedByOther = await chatLogic.isBlockedBy(currentUserId, otherParticipantId);

            if (hasBlockedOther || isBlockedByOther) {
                return res.status(403).json({
                    success: false,
                    message: hasBlockedOther ? 'You have blocked this user.' : 'You are blocked by this user.'
                });
            }
        }

        const messages = await chatLogic.getMessagesInChat(chatId, currentUserId, skip, limit, lastMessageTimestamp); // Pass lastMessageTimestamp
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
    }
});

// --- Create or Get Chat and Send First Message (from profile page) ---
router.post('/start-chat', async (req, res) => {
    const { receiverUsername, content } = req.body;
    const senderId = req.user._id || req.user.username;

    if (!receiverUsername) {
        return res.status(400).json({ success: false, message: 'Receiver username is required.' });
    }

    try {
        const receiverUser = await db.getUser(receiverUsername);
        if (!receiverUser) {
            return res.status(404).json({ success: false, message: 'Receiver user not found.' });
        }
        const receiverId = receiverUser._id || receiverUser.username;

        const hasBlockedReceiver = await chatLogic.hasBlocked(senderId, receiverId);
        const isBlockedByReceiver = await chatLogic.isBlockedBy(senderId, receiverId);

        if (hasBlockedReceiver) {
            return res.status(403).json({ success: false, message: 'You have blocked this user. Unblock to send messages.' });
        }
        if (isBlockedByReceiver) {
            return res.status(403).json({ success: false, message: 'You are blocked by this user and cannot send messages.' });
        }

        const chat = await chatLogic.createOrGetChat(senderId, receiverId);
        const message = await chatLogic.sendMessage(chat._id, senderId, receiverId, content, 'text');

        res.status(201).json({ success: true, message: 'Chat created and message sent!', chat, newMessage: message });
    } catch (error) {
        console.error('Error starting chat:', error);
        res.status(500).json({ success: false, message: 'Failed to start chat.' });
    }
});

// --- Send Message (Text) ---
router.post('/:chatId/send', async (req, res) => {
    const { chatId } = req.params;
    const { content, receiverId } = req.body;
    const senderId = req.user._id || req.user.username;

    if (!content) {
        return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    try {
        const chat = await db.getChatById(chatId);
        if (!chat || !chat.participants.some(p => (p._id ? p._id.toString() : p.username) === senderId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized to send message in this chat.' });
        }

        const actualReceiverId = chat.participants.find(p => (p._id ? p._id.toString() : p.username) !== senderId);
        if (!actualReceiverId) {
            return res.status(400).json({ success: false, message: 'Could not determine receiver for this chat.' });
        }
        const receiverIdToUse = actualReceiverId._id ? actualReceiverId._id.toString() : actualReceiverId.username;

        const hasBlockedReceiver = await chatLogic.hasBlocked(senderId, receiverIdToUse);
        const isBlockedByReceiver = await chatLogic.isBlockedBy(senderId, receiverIdToUse);

        if (hasBlockedReceiver) {
            return res.status(403).json({ success: false, message: 'You have blocked this user. Unblock to send messages.' });
        }
        if (isBlockedByReceiver) {
            return res.status(403).json({ success: false, message: 'You are blocked by this user and cannot send messages.' });
        }

        const message = await chatLogic.sendMessage(chatId, senderId, receiverIdToUse, content, 'text');
        res.status(201).json({ success: true, message: 'Message sent!', newMessage: message });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message.' });
    }
});

// --- Send Message (Media - Image/Video/Voice) ---
router.post('/:chatId/send-media', uploadChatMedia.single('mediaFile'), async (req, res) => {
    const { chatId } = req.params;
    const { receiverId, content } = req.body;
    const senderId = req.user._id || req.user.username;

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No media file uploaded.' });
    }

    try {
        const chat = await db.getChatById(chatId);
        if (!chat || !chat.participants.some(p => (p._id ? p._id.toString() : p.username) === senderId)) {
            await fs.unlink(req.file.path).catch(console.error);
            return res.status(403).json({ success: false, message: 'Unauthorized to send media in this chat.' });
        }

        const actualReceiverId = chat.participants.find(p => (p._id ? p._id.toString() : p.username) !== senderId);
        if (!actualReceiverId) {
            await fs.unlink(req.file.path).catch(console.error);
            return res.status(400).json({ success: false, message: 'Could not determine receiver for this chat.' });
        }
        const receiverIdToUse = actualReceiverId._id ? actualReceiverId._id.toString() : actualReceiverId.username;

        const hasBlockedReceiver = await chatLogic.hasBlocked(senderId, receiverIdToUse);
        const isBlockedByReceiver = await chatLogic.isBlockedBy(senderId, receiverIdToUse);

        if (hasBlockedReceiver || isBlockedByReceiver) {
            await fs.unlink(req.file.path).catch(console.error);
            return res.status(403).json({
                success: false,
                message: hasBlockedReceiver ? 'You have blocked this user.' : 'You are blocked by this user.'
            });
        }

        const mediaType = req.file.mimetype.startsWith('image') ? 'image' :
                          req.file.mimetype.startsWith('video') ? 'video' :
                          req.file.mimetype.startsWith('audio') ? 'voice' : 'file';

        const mediaUrl = `/images/chat_media/${chatId}/${req.file.filename}`;

        const message = await chatLogic.sendMessage(chatId, senderId, receiverIdToUse, content, mediaType, mediaUrl);
        res.status(201).json({ success: true, message: 'Media message sent!', newMessage: message });
    } catch (error) {
        console.error('Error sending media message:', error);
        if (req.file) {
            await fs.unlink(req.file.path).catch(console.error);
        }
        res.status(500).json({ success: false, message: error.message || 'Failed to send media message.' });
    }
});

// --- Toggle Block/Unblock User ---
router.post('/:targetUsername/toggle-block', async (req, res) => {
    const { targetUsername } = req.params;
    const blockerId = req.user._id || req.user.username;

    try {
        const targetUser = await db.getUser(targetUsername);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Target user not found.' });
        }
        const targetId = targetUser._id || targetUser.username;

        if (blockerId === targetId) {
            return res.status(400).json({ success: false, message: 'Cannot block/unblock yourself.' });
        }

        const isCurrentlyBlocked = await chatLogic.hasBlocked(blockerId, targetId);
        await chatLogic.toggleBlock(blockerId, targetId, !isCurrentlyBlocked);

        res.json({
            success: true,
            message: isCurrentlyBlocked ? `Successfully unblocked ${targetUsername}.` : `Successfully blocked ${targetUsername}.`,
            isBlocked: !isCurrentlyBlocked
        });
    } catch (error) {
        console.error('Error toggling block status:', error);
        res.status(500).json({ success: false, message: 'Failed to update block status.' });
    }
});

// New: Set Typing Status
router.post('/:targetUsername/typing', async (req, res) => {
    const { targetUsername } = req.params;
    const { isTyping } = req.body;
    const senderId = req.user._id || req.user.username;

    try {
        const targetUser = await db.getUser(targetUsername);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Target user not found.' });
        }
        const targetId = targetUser._id || targetUser.username;

        // In a real app, you might only allow friends to see typing status
        // For now, allow any authenticated user to update their status towards another
        await db.updateUser(senderId, { isTyping: isTyping }); // Assuming 'isTyping' is a field on User schema

        res.json({ success: true, message: 'Typing status updated.' });
    } catch (error) {
        console.error('Error setting typing status:', error);
        res.status(500).json({ success: false, message: 'Failed to set typing status.' });
    }
});

// New: Get Typing Status
router.get('/:targetUsername/typing-status', async (req, res) => {
    const { targetUsername } = req.params;
    const currentUserId = req.user._id || req.user.username;

    try {
        const targetUser = await db.getUser(targetUsername);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'Target user not found.' });
        }

        // Only return typing status if current user is not blocked by target
        const isBlockedByTarget = await chatLogic.isBlockedBy(currentUserId, targetUser._id || targetUser.username);
        if (isBlockedByTarget) {
            return res.json({ success: true, isTyping: false }); // Don't reveal typing if blocked
        }

        res.json({ success: true, isTyping: targetUser.isTyping || false }); // Return false if not set
    } catch (error) {
        console.error('Error getting typing status:', error);
        res.status(500).json({ success: false, message: 'Failed to get typing status.' });
    }
});


module.exports = router;
