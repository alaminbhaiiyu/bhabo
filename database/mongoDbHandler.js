// database/mongoDbHandler.js
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bhabo_db';

mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- User Schema ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    displayName: { type: String },
    email: { type: String, required: true, unique: true },
    birthday: { type: Date, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '/images/default_profile.png' },
    bio: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String },
    verificationCodeExpires: { type: Date },
    resetPasswordCode: { type: String },
    resetPasswordCodeExpires: { type: Date },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isOnline: { type: Boolean, default: false }, // New: Online status
    isTyping: { type: Boolean, default: false }, // New: Typing status
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', function(next) {
    if (!this.displayName || this.displayName.trim() === '') {
        this.displayName = `${this.firstName} ${this.lastName}`;
    }
    next();
});

const User = mongoose.model('User', userSchema);

// --- Post Schema ---
const postSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    content: { type: String },
    imageUrl: { type: String },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    }],
    createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model('Post', postSchema);

// --- Chat Schema ---
const chatSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        type: { type: String, enum: ['text', 'image', 'video', 'voice'], default: 'text' },
        timestamp: { type: Date, default: Date.now },
        read: { type: Boolean, default: false }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

chatSchema.index({ participants: 1 }, { unique: true });

const Chat = mongoose.model('Chat', chatSchema);

// --- Message Schema ---
const messageSchema = new mongoose.Schema({
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String },
    type: { type: String, enum: ['text', 'image', 'video', 'voice'], default: 'text' },
    mediaUrl: { type: String },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
});

const Message = mongoose.model('Message', messageSchema);


// --- Database operations for MongoDB ---

const getUser = async (username) => {
    return await User.findOne({ username });
};

const getUserById = async (userId) => {
    return await User.findById(userId);
};

const findUserByIdentifier = async (identifier) => {
    return await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
};

const saveUser = async (userData) => {
    const newUser = new User(userData);
    return await newUser.save();
};

const updateUser = async (userId, updateData) => {
    return await User.findByIdAndUpdate(userId, updateData, { new: true });
};

const updateProfileFields = async (userId, updateData) => {
    const { firstName, lastName, displayName, bio, profilePicture } = updateData;
    return await User.findByIdAndUpdate(userId,
        { firstName, lastName, displayName, bio, profilePicture },
        { new: true, runValidators: true }
    );
};

const addFollower = async (targetUserId, followerId) => {
    await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: followerId } });
};

const removeFollower = async (targetUserId, followerId) => {
    await User.findByIdAndUpdate(targetUserId, { $pull: { followers: followerId } });
};

const addFollowing = async (followerId, targetUserId) => {
    await User.findByIdAndUpdate(followerId, { $addToSet: { following: targetUserId } });
};

const removeFollowing = async (followerId, targetUserId) => {
    await User.findByIdAndUpdate(followerId, { $pull: { following: targetUserId } });
};

const getPost = async (postId) => {
    return await Post.findById(postId).populate('userId', 'username displayName profilePicture');
};

const savePost = async (postData) => {
    const newPost = new Post(postData);
    return await newPost.save();
};

const getAllPostsByUser = async (userId) => {
    return await Post.find({ userId }).sort({ createdAt: -1 });
};

const getPublicUser = async (username) => {
    return await User.findOne({ username }).select('-password -email -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordCodeExpires');
};

const searchUsers = async (query) => {
    const fuzzyRegex = new RegExp(query.split('').join('.*'), 'i');
    return await User.find({
        $or: [
            { username: fuzzyRegex },
            { displayName: fuzzyRegex }
        ]
    }).select('-password -email -verificationCode -verificationCodeExpires -resetPasswordCode -resetPasswordCodeExpires');
};

const searchPosts = async (query) => {
    const fuzzyRegex = new RegExp(query.split('').join('.*'), 'i');
    return await Post.find({
        $or: [
            { content: fuzzyRegex },
            { imageUrl: { $exists: true, $ne: null } }
        ]
    }).sort({ createdAt: -1 });
};

const createChat = async (participantIds) => {
    const sortedParticipants = [...participantIds].sort();
    let chat = await Chat.findOne({ participants: { $all: sortedParticipants, $size: sortedParticipants.length } });

    if (!chat) {
        chat = new Chat({ participants: sortedParticipants });
        await chat.save();
    }
    return chat;
};

const getChatById = async (chatId) => {
    return await Chat.findById(chatId).populate('participants', 'username displayName profilePicture isOnline');
};

const getChatsForUser = async (userId) => {
    return await Chat.find({ participants: userId })
                     .populate('participants', 'username displayName profilePicture isOnline')
                     .sort({ 'lastMessage.timestamp': -1 });
};

const addMessageToChat = async (chatId, senderId, receiverId, content, type, mediaUrl) => {
    const newMessage = new Message({
        chatId,
        senderId,
        receiverId,
        content,
        type,
        mediaUrl,
        read: false
    });
    await newMessage.save();

    await Chat.findByIdAndUpdate(chatId, {
        lastMessage: {
            sender: senderId,
            content: content || (type === 'image' ? 'Image' : type === 'video' ? 'Video' : type === 'voice' ? 'Voice Message' : 'Media'),
            type: type,
            timestamp: newMessage.timestamp,
            read: false
        },
        updatedAt: newMessage.timestamp
    });
    return newMessage;
};

// Updated: getMessagesInChat to support skip, limit, and lastMessageTimestamp
const getMessagesInChat = async (chatId, skip = 0, limit = 50, lastMessageTimestamp = null) => {
    let query = { chatId: chatId };
    if (lastMessageTimestamp) {
        query.timestamp = { $gt: new Date(lastMessageTimestamp) }; // Only messages newer than this timestamp
    }
    return await Message.find(query)
                        .sort({ timestamp: 1 }) // Always sort by oldest first for display
                        .skip(skip)
                        .limit(limit);
};

const markMessagesAsRead = async (chatId, userId) => {
    await Message.updateMany(
        { chatId: chatId, receiverId: userId, read: false },
        { $set: { read: true } }
    );
    const chat = await Chat.findById(chatId);
    if (chat && chat.lastMessage && chat.lastMessage.sender.toString() !== userId.toString() && chat.lastMessage.read === false) {
         await Chat.findByIdAndUpdate(chatId, { 'lastMessage.read': true });
    }
};

const updateUserOnlineStatus = async (userId, isOnline) => {
    await User.findByIdAndUpdate(userId, { isOnline: isOnline });
};

const blockUser = async (blockerId, targetId) => {
    await User.findByIdAndUpdate(blockerId, { $addToSet: { blockedUsers: targetId } });
};

const unblockUser = async (blockerId, targetId) => {
    await User.findByIdAndUpdate(blockerId, { $pull: { blockedUsers: targetId } });
};

const isUserBlocked = async (userId, targetId) => {
    const user = await User.findById(userId);
    return user && user.blockedUsers.includes(targetId);
};

const getFeedPosts = async (currentUserId, skip = 0, limit = 10) => {
    const currentUser = await User.findById(currentUserId);
    let query = {};

    if (currentUser && currentUser.following && currentUser.following.length > 0) {
        query = { userId: { $in: currentUser.following } };
    } else {
        const blockedUsers = currentUser ? currentUser.blockedUsers : [];
        if (blockedUsers.length > 0) {
            query.userId = { $nin: blockedUsers };
        }
    }

    return await Post.find(query)
                     .populate('userId', 'username displayName profilePicture')
                     .sort({ createdAt: -1 })
                     .skip(skip)
                     .limit(limit);
};

const likePost = async (postId, userId) => {
    return await Post.findByIdAndUpdate(postId, { $addToSet: { likes: userId } }, { new: true });
};

const unlikePost = async (postId, userId) => {
    return await Post.findByIdAndUpdate(postId, { $pull: { likes: userId } }, { new: true });
};

const addCommentToPost = async (postId, commentData) => {
    return await Post.findByIdAndUpdate(postId, { $push: { comments: commentData } }, { new: true });
};

const getCommentsForPost = async (postId) => {
    const post = await Post.findById(postId).select('comments').populate('comments.userId', 'username displayName profilePicture');
    return post ? post.comments : [];
};

const getOnlineUsers = async (currentUserId, genderPreference = null, limit = 10) => {
    let query = { _id: { $ne: currentUserId }, isOnline: true };
    if (genderPreference) {
        query.gender = genderPreference === 'Male' ? 'Female' : 'Male';
    }
    return await User.find(query)
                     .select('username displayName profilePicture isOnline gender')
                     .limit(limit);
};

const getOfflineUsers = async (currentUserId, genderPreference = null, limit = 10) => {
    let query = { _id: { $ne: currentUserId }, isOnline: false };
    if (genderPreference) {
        query.gender = genderPreference === 'Male' ? 'Female' : 'Male';
    }
    return await User.find(query)
                     .select('username displayName profilePicture isOnline gender')
                     .limit(limit);
};

const deletePost = async (postId) => {
    return await Post.findByIdAndDelete(postId);
};


module.exports = {
    getUser,
    getUserById,
    findUserByIdentifier,
    saveUser,
    updateUser,
    updateProfileFields,
    addFollower,
    removeFollower,
    addFollowing,
    removeFollowing,
    getPost,
    savePost,
    getAllPostsByUser,
    getPublicUser,
    searchUsers,
    searchPosts,
    createChat,
    getChatById,
    getChatsForUser,
    addMessageToChat,
    getMessagesInChat, // Updated
    markMessagesAsRead,
    updateUserOnlineStatus,
    blockUser,
    unblockUser,
    isUserBlocked,
    getFeedPosts,
    likePost,
    unlikePost,
    addCommentToPost,
    getCommentsForPost,
    getOnlineUsers,
    getOfflineUsers,
    deletePost,
    User,
    Post,
    Chat,
    Message,
};
