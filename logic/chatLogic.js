// logic/chatLogic.js
const db = require('../database/database');

/**
 * Creates a new chat or retrieves an existing one between two users.
 * @param {string} senderId - ID of the sender.
 * @param {string} receiverId - ID of the receiver.
 * @returns {Promise<Object>} The chat object.
 */
const createOrGetChat = async (senderId, receiverId) => {
    // For MongoDB, participant IDs are Mongoose ObjectIds. For local, they are usernames.
    // Ensure consistent ID type is passed to db.createChat
    const participantIds = [senderId, receiverId];
    return await db.createChat(participantIds);
};

/**
 * Sends a message within a chat.
 * @param {string} chatId - ID of the chat.
 * @param {string} senderId - ID of the sender.
 * @param {string} receiverId - ID of the receiver.
 * @param {string} content - Message text content.
 * @param {string} type - Type of message (text, image, video, voice).
 * @param {string} [mediaUrl] - URL of the media file if type is not 'text'.
 * @returns {Promise<Object>} The new message object.
 */
const sendMessage = async (chatId, senderId, receiverId, content, type = 'text', mediaUrl = null) => {
    return await db.addMessageToChat(chatId, senderId, receiverId, content, type, mediaUrl);
};

/**
 * Gets the list of chats for a given user.
 * @param {string} userId - ID of the user.
 * @returns {Promise<Array<Object>>} List of chat objects.
 */
const getChatList = async (userId) => {
    const chats = await db.getChatsForUser(userId);
    // For local DB, participants are usernames, need to fetch full user objects
    // MongoDB's populate handles this automatically.
    return chats;
};

/**
 * Gets messages within a specific chat.
 * @param {string} chatId - ID of the chat.
 * @param {string} currentUserId - ID of the currently logged-in user (to mark messages as read).
 * @param {number} skip - Number of messages to skip (for pagination).
 * @param {number} limit - Maximum number of messages to return (for pagination).
 * @returns {Promise<Array<Object>>} List of message objects.
 */
const getMessagesInChat = async (chatId, currentUserId, skip, limit) => {
    const messages = await db.getMessagesInChat(chatId, skip, limit);
    // Only mark as read if fetching the latest messages (or if specifically told to)
    // For pagination, we might not want to mark all older messages as read just by scrolling
    // For simplicity here, we'll mark the last batch as read.
    await db.markMessagesAsRead(chatId, currentUserId);
    return messages;
};

/**
 * Toggles block status for a user.
 * @param {string} blockerId - ID of the user performing the block/unblock.
 * @param {string} targetId - ID of the user to be blocked/unblocked.
 * @param {boolean} block - True to block, false to unblock.
 * @returns {Promise<boolean>} True if successful.
 */
const toggleBlock = async (blockerId, targetId, block) => {
    if (block) {
        await db.blockUser(blockerId, targetId);
    } else {
        await db.unblockUser(blockerId, targetId);
    }
    return true;
};

/**
 * Checks if a user has blocked another user.
 * @param {string} userId - The user checking.
 * @param {string} targetId - The user being checked against.
 * @returns {Promise<boolean>} True if userId has blocked targetId.
 */
const hasBlocked = async (userId, targetId) => {
    return await db.isUserBlocked(userId, targetId);
};

/**
 * Checks if a user is blocked by another user.
 * @param {string} userId - The user being checked.
 * @param {string} blockerId - The user who might have blocked userId.
 * @returns {Promise<boolean>} True if userId is blocked by blockerId.
 */
const isBlockedBy = async (userId, blockerId) => {
    return await db.isUserBlocked(blockerId, userId);
};

module.exports = {
    createOrGetChat,
    sendMessage,
    getChatList,
    getMessagesInChat,
    toggleBlock,
    hasBlocked,
    isBlockedBy,
};
