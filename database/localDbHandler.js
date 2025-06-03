// database/localDbHandler.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // For generating unique chat IDs

const BASE_DIR = path.join(__dirname, '..', 'database');

const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            console.error(`Error creating directory ${dirPath}:`, error);
            throw error;
        }
    }
};

const getUser = async (username) => {
    const filePath = path.join(BASE_DIR, 'users', `${username}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        let user;
        try {
            user = JSON.parse(data); // Attempt to parse JSON
        } catch (jsonError) {
            console.error(`Error parsing JSON for user ${username} at ${filePath}:`, jsonError);
            // If JSON is corrupted, attempt to recover by returning a default user structure
            // This prevents crashes but might lead to data loss for that specific user.
            // A better long-term solution would involve data migration or backup.
            user = {
                username: username,
                firstName: '',
                lastName: '',
                displayName: '',
                email: '',
                birthday: new Date().toISOString(),
                gender: 'Other',
                password: '', // This will need to be handled carefully in auth logic
                profilePicture: '/images/default_profile.png',
                bio: '',
                isVerified: false,
                verificationCode: null,
                verificationCodeExpires: null,
                resetPasswordCode: null,
                resetPasswordCodeExpires: null,
                followers: [],
                following: [],
                isOnline: false,
                isTyping: false,
                blockedUsers: [],
                createdAt: new Date().toISOString(),
            };
            await fs.writeFile(filePath, JSON.stringify(user, null, 2), 'utf8').catch(err => console.error(`Failed to recover/overwrite corrupted user file ${filePath}:`, err));
            return user;
        }

        if (!user.blockedUsers) {
            user.blockedUsers = [];
        }
        if (user.isOnline === undefined) {
            user.isOnline = false;
        }
        if (user.isTyping === undefined) {
            user.isTyping = false;
        }
        if (!user.followers) user.followers = [];
        if (!user.following) user.following = [];
        return user;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        console.error(`Error reading user ${username}:`, error);
        throw error;
    }
};

const getUserById = async (userId) => {
    return await getUser(userId);
};

const findUserByIdentifier = async (identifier) => {
    const usersDirPath = path.join(BASE_DIR, 'users');
    try {
        await ensureDirectoryExists(usersDirPath);
        const files = await fs.readdir(usersDirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(usersDirPath, file);
                const data = await fs.readFile(filePath, 'utf8');
                let user;
                try {
                    user = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for user ${file} in findUserByIdentifier:`, jsonError);
                    continue;
                }
                if (user.username === identifier || user.email === identifier) {
                    return user;
                }
            }
        }
        return null;
    } catch (error) {
        console.error(`Error finding user by identifier ${identifier}:`, error);
        throw error;
    }
};

const saveUser = async (user) => {
    const dirPath = path.join(BASE_DIR, 'users');
    await ensureDirectoryExists(dirPath);
    const filePath = path.join(dirPath, `${user.username}.json`);
    try {
        if (!user.displayName || user.displayName.trim() === '') {
            user.displayName = `${user.firstName} ${user.lastName}`;
        }
        if (!user.profilePicture) {
            user.profilePicture = '/images/default_profile.png';
        }
        if (user.isOnline === undefined) {
            user.isOnline = false;
        }
        if (user.isTyping === undefined) {
            user.isTyping = false;
        }
        if (!user.blockedUsers) {
            user.blockedUsers = [];
        }
        if (!user.followers) user.followers = [];
        if (!user.following) user.following = [];

        await fs.writeFile(filePath, JSON.stringify(user, null, 2), 'utf8');
        return user;
    } catch (error) {
        console.error(`Error saving user ${user.username}:`, error);
        throw error;
    }
};

const updateUser = async (username, updateData) => {
    const existingUser = await getUser(username);
    if (!existingUser) {
        return null;
    }
    const updatedUser = { ...existingUser, ...updateData };
    if (!updatedUser.displayName || updatedUser.displayName.trim() === '') {
        updatedUser.displayName = `${updatedUser.firstName} ${updatedUser.lastName}`;
    }
    await saveUser(updatedUser);
    return updatedUser;
};

const updateProfileFields = async (username, updateData) => {
    const existingUser = await getUser(username);
    if (!existingUser) {
        return null;
    }
    const { firstName, lastName, displayName, bio, profilePicture } = updateData;
    const updatedUser = {
        ...existingUser,
        firstName: firstName !== undefined ? firstName : existingUser.firstName,
        lastName: lastName !== undefined ? lastName : existingUser.lastName,
        displayName: displayName !== undefined ? displayName : existingUser.displayName,
        bio: bio !== undefined ? bio : existingUser.bio,
        profilePicture: profilePicture !== undefined ? profilePicture : existingUser.profilePicture,
    };
    if (!updatedUser.displayName || updatedUser.displayName.trim() === '') {
        updatedUser.displayName = `${updatedUser.firstName} ${updatedUser.lastName}`;
    }
    await saveUser(updatedUser);
    return updatedUser;
};

const addFollower = async (targetUsername, followerUsername) => {
    const targetUser = await getUser(targetUsername);
    if (!targetUser) return;
    if (!targetUser.followers) targetUser.followers = [];
    if (!targetUser.followers.includes(followerUsername)) {
        targetUser.followers.push(followerUsername);
        await saveUser(targetUser);
    }
};

const removeFollower = async (targetUsername, followerUsername) => {
    const targetUser = await getUser(targetUsername);
    if (!targetUser || !targetUser.followers) return;
    targetUser.followers = targetUser.followers.filter(f => f !== followerUsername);
    await saveUser(targetUser);
};

const addFollowing = async (followerUsername, targetUsername) => {
    const followerUser = await getUser(followerUsername);
    if (!followerUser) return;
    if (!followerUser.following) followerUser.following = [];
    if (!followerUser.following.includes(targetUsername)) {
        followerUser.following.push(targetUsername);
        await saveUser(followerUser);
    }
};

const removeFollowing = async (followerUsername, targetUsername) => {
    const followerUser = await getUser(followerUsername);
    if (!followerUser || !followerUser.following) return;
    followerUser.following = followerUser.following.filter(f => f !== targetUsername);
    await saveUser(followerUser);
};

const getPost = async (postId) => {
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');
    try {
        await ensureDirectoryExists(postsBaseDirPath);
        const userFolders = await fs.readdir(postsBaseDirPath);
        for (const userFolder of userFolders) {
            const postFilePath = path.join(postsBaseDirPath, userFolder, `${postId}.json`);
            try {
                const data = await fs.readFile(postFilePath, 'utf8');
                let post;
                try {
                    post = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for post ${postFilePath} in getPost:`, jsonError);
                    continue;
                }
                if (!post.id) post.id = post._id;
                if (!post._id) post._id = post.id;
                if (post.id === postId || post._id === postId) {
                    const user = await getUser(post.userId);
                    if (user) {
                        post.userId = {
                            _id: user.username,
                            username: user.username,
                            displayName: user.displayName,
                            profilePicture: user.profilePicture,
                            gender: user.gender
                        };
                    }
                    return post;
                }
            } catch (error) {
                if (error.code === 'ENOENT') continue;
                throw error;
            }
        }
        return null;
    } catch (error) {
        console.error(`Error getting post by ID ${postId}:`, error);
        throw error;
    }
};


const savePost = async (username, post) => {
    const dirPath = path.join(BASE_DIR, 'posts', username);
    await ensureDirectoryExists(dirPath);
    if (!post.id) {
        post.id = uuidv4();
    }
    post._id = post.id;

    const filePath = path.join(dirPath, `${post.id}.json`);
    try {
        await fs.writeFile(filePath, JSON.stringify(post, null, 2), 'utf8');
        return post;
    } catch (error) {
        console.error(`Error saving post ${post.id} for user ${username}:`, error);
        throw error;
    }
};

const getAllPostsByUser = async (username) => {
    const dirPath = path.join(BASE_DIR, 'posts', username);
    try {
        await ensureDirectoryExists(dirPath);
        const files = await fs.readdir(dirPath);
        const posts = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(dirPath, file);
                const data = await fs.readFile(filePath, 'utf8');
                let post;
                try {
                    post = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for post ${file} in getAllPostsByUser:`, jsonError);
                    continue;
                }
                if (!post.id) post.id = post._id;
                if (!post._id) post._id = post.id;
                posts.push(post);
            }
        }
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return posts;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        console.error(`Error reading all posts for user ${username}:`, error);
        throw error;
    }
};

const getPublicUser = async (username) => {
    const user = await getUser(username);
    if (!user) return null;
    const { password, email, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, ...publicUser } = user;
    return publicUser;
};

const searchUsers = async (query) => {
    const usersDirPath = path.join(BASE_DIR, 'users');
    const results = [];
    try {
        await ensureDirectoryExists(usersDirPath);
        const files = await fs.readdir(usersDirPath);
        const lowerCaseQuery = query.toLowerCase();
        const fuzzyRegex = new RegExp(lowerCaseQuery.split('').join('.*'), 'i');

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(usersDirPath, file);
                const data = await fs.readFile(filePath, 'utf8');
                let user;
                try {
                    user = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for user ${file} in searchUsers:`, jsonError);
                    continue;
                }
                if (fuzzyRegex.test(user.username.toLowerCase()) ||
                    (user.displayName && fuzzyRegex.test(user.displayName.toLowerCase()))) {
                    const { password, email, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, ...publicUser } = user;
                    results.push(publicUser);
                }
            }
        }
    } catch (error) {
        console.error('Error searching users in local DB:', error);
    }
    return results;
};

const searchPosts = async (query) => {
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');
    const results = [];
    try {
        await ensureDirectoryExists(postsBaseDirPath);
        const userFolders = await fs.readdir(postsBaseDirPath);
        const lowerCaseQuery = query.toLowerCase();
        const fuzzyRegex = new RegExp(lowerCaseQuery.split('').join('.*'), 'i');

        for (const userFolder of userFolders) {
            const userPostsDirPath = path.join(postsBaseDirPath, userFolder);
            const postFiles = await fs.readdir(userPostsDirPath);

            for (const file of postFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(userPostsDirPath, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    let post;
                    try {
                        post = JSON.parse(data);
                    } catch (jsonError) {
                        console.error(`Error parsing JSON for post ${file} in searchPosts:`, jsonError);
                        continue;
                    }
                    if (fuzzyRegex.test(post.content.toLowerCase()) || (post.imageUrl && post.imageUrl.length > 0)) {
                        results.push(post);
                    }
                }
            }
        }
        results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        console.error('Error searching posts in local DB:', error);
    }
    return results;
};

const CHATS_DIR = path.join(BASE_DIR, 'chats');
const MESSAGES_DIR = path.join(BASE_DIR, 'messages');

const getAllChatFiles = async () => {
    await ensureDirectoryExists(CHATS_DIR);
    const chatFiles = await fs.readdir(CHATS_DIR);
    const chats = [];
    for (const file of chatFiles) {
        if (file.endsWith('.json')) {
            const filePath = path.join(CHATS_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            let chat;
            try {
                chat = JSON.parse(data);
            } catch (jsonError) {
                console.error(`Error parsing JSON for chat ${file} in getAllChatFiles:`, jsonError);
                continue;
            }
            chats.push(chat);
        }
    }
    return chats;
};

const createChat = async (participantUsernames) => {
    const sortedParticipants = [...participantUsernames].sort();
    const chats = await getAllChatFiles();

    let existingChat = chats.find(chat => {
        const chatParticipantsSorted = [...chat.participants].sort();
        return chatParticipantsSorted.length === sortedParticipants.length &&
               chatParticipantsSorted.every((p, i) => p === sortedParticipants[i]);
    });

    if (existingChat) {
        return existingChat;
    }

    const newChatId = uuidv4();
    const newChat = {
        _id: newChatId,
        participants: sortedParticipants,
        lastMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const filePath = path.join(CHATS_DIR, `${newChatId}.json`);
    await fs.writeFile(filePath, JSON.stringify(newChat, null, 2), 'utf8');
    return newChat;
};

const getChatById = async (chatId) => {
    const filePath = path.join(CHATS_DIR, `${chatId}.json`);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        let chat;
        try {
            chat = JSON.parse(data);
        } catch (jsonError) {
            console.error(`Error parsing JSON for chat ${chatId} in getChatById:`, jsonError);
            return null;
        }
        chat.participants = await Promise.all(chat.participants.map(async username => {
            const user = await getUser(username);
            if (user) {
                const { password, email, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, blockedUsers, ...publicUser } = user;
                return publicUser;
            }
            return null;
        }));
        return chat;
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        console.error(`Error getting chat by ID ${chatId}:`, error);
        throw error;
    }
};

const getChatsForUser = async (userId) => {
    const chats = await getAllChatFiles();
    const userChats = chats.filter(chat => chat.participants.includes(userId));

    const populatedChats = await Promise.all(userChats.map(async chat => {
        chat.participants = await Promise.all(chat.participants.map(async username => {
            const user = await getUser(username);
            if (user) {
                const { password, email, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, blockedUsers, ...publicUser } = user;
                return publicUser;
            }
            return null;
        }));
        return chat;
    }));

    populatedChats.sort((a, b) => {
        const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp) : new Date(a.createdAt);
        const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp) : new Date(b.createdAt);
        return timeB - timeA;
    });

    return populatedChats;
};

const addMessageToChat = async (chatId, senderId, receiverId, content, type, mediaUrl) => {
    const messagesDirPath = path.join(MESSAGES_DIR, chatId);
    await ensureDirectoryExists(messagesDirPath);

    const newMessageId = uuidv4();
    const newMessage = {
        _id: newMessageId,
        chatId: chatId,
        senderId: senderId,
        receiverId: receiverId,
        content: content,
        type: type,
        mediaUrl: mediaUrl,
        timestamp: new Date().toISOString(),
        read: false
    };

    const messageFilePath = path.join(messagesDirPath, `${newMessageId}.json`);
    await fs.writeFile(messageFilePath, JSON.stringify(newMessage, null, 2), 'utf8');

    const chatFilePath = path.join(CHATS_DIR, `${chatId}.json`);
    const chatData = await fs.readFile(chatFilePath, 'utf8');
    let chat;
    try {
        chat = JSON.parse(chatData);
    } catch (jsonError) {
        console.error(`Error parsing JSON for chat ${chatId} in addMessageToChat:`, jsonError);
        // Handle corrupted chat file by not updating lastMessage or re-initializing it
        chat = { _id: chatId, participants: [], lastMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }


    chat.lastMessage = {
        sender: senderId,
        content: content || (type === 'image' ? 'Image' : type === 'video' ? 'Video' : type === 'voice' ? 'Voice Message' : 'Media'),
        type: type,
        timestamp: newMessage.timestamp,
        read: false
    };
    chat.updatedAt = newMessage.timestamp;
    await fs.writeFile(chatFilePath, JSON.stringify(chat, null, 2), 'utf8');

    return newMessage;
};

// Updated: getMessagesInChat to support skip, limit, and lastMessageTimestamp
const getMessagesInChat = async (chatId, skip = 0, limit = 20, lastMessageTimestamp = null) => {
    const messagesDirPath = path.join(MESSAGES_DIR, chatId);
    try {
        await ensureDirectoryExists(messagesDirPath);
        const messageFiles = await fs.readdir(messagesDirPath);
        let messages = [];
        for (const file of messageFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(messagesDirPath, file);
                const data = await fs.readFile(filePath, 'utf8');
                let message;
                try {
                    message = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for message ${file} in getMessagesInChat:`, jsonError);
                    continue;
                }
                if (!message.type) message.type = 'text';
                if (!message.mediaUrl) message.mediaUrl = null;
                messages.push(message);
            }
        }
        // Filter by timestamp if provided
        if (lastMessageTimestamp) {
            messages = messages.filter(msg => new Date(msg.timestamp) > new Date(lastMessageTimestamp));
        }

        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Always sort by oldest first for display

        // If a timestamp is provided, we're only looking for NEW messages, so skip/limit might not apply the same way
        // For simplicity, if timestamp is provided, we return all new messages.
        if (lastMessageTimestamp) {
            return messages;
        } else {
            // For initial load or older messages, apply skip and limit
            const paginatedMessages = messages.slice(messages.length - (skip + limit), messages.length - skip);
            return paginatedMessages;
        }

    } catch (error) {
        if (error.code === 'ENOENT') return [];
        console.error(`Error getting messages for chat ${chatId}:`, error);
        throw error;
    }
};

const markMessagesAsRead = async (chatId, userId) => {
    const messagesDirPath = path.join(MESSAGES_DIR, chatId);
    try {
        await ensureDirectoryExists(messagesDirPath);
        const messageFiles = await fs.readdir(messagesDirPath);
        for (const file of messageFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(messagesDirPath, file);
                const data = await fs.readFile(filePath, 'utf8');
                let message;
                try {
                    message = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for message ${file} in markMessagesAsRead:`, jsonError);
                    continue;
                }
                if (message.receiverId === userId && message.read === false) {
                    message.read = true;
                    await fs.writeFile(filePath, JSON.stringify(message, null, 2), 'utf8');
                }
            }
        }

        const chatFilePath = path.join(CHATS_DIR, `${chatId}.json`);
        const chatData = await fs.readFile(chatFilePath, 'utf8');
        let chat;
        try {
            chat = JSON.parse(chatData);
        } catch (jsonError) {
            console.error(`Error parsing JSON for chat ${chatId} in markMessagesAsRead:`, jsonError);
            // If corrupted, don't update lastMessage read status
            return;
        }
        if (chat && chat.lastMessage && chat.lastMessage.sender !== userId && chat.lastMessage.read === false) {
            chat.lastMessage.read = true;
            await fs.writeFile(chatFilePath, JSON.stringify(chat, null, 2), 'utf8');
        }

    } catch (error) {
        console.error(`Error marking messages as read for chat ${chatId}:`, error);
        throw error;
    }
};

const updateUserOnlineStatus = async (userId, isOnline) => {
    const user = await getUser(userId);
    if (user) {
        user.isOnline = isOnline;
        await saveUser(user);
    }
};

const blockUser = async (blockerId, targetId) => {
    const blockerUser = await getUser(blockerId);
    if (blockerUser) {
        if (!blockerUser.blockedUsers.includes(targetId)) {
            blockerUser.blockedUsers.push(targetId);
            await saveUser(blockerUser);
        }
    }
};

const unblockUser = async (blockerId, targetId) => {
    const blockerUser = await getUser(blockerId);
    if (blockerUser) {
        blockerUser.blockedUsers = blockerUser.blockedUsers.filter(id => id !== targetId);
        await saveUser(blockerUser);
    }
};

const isUserBlocked = async (userId, targetId) => {
    const user = await getUser(userId);
    return user && Array.isArray(user.blockedUsers) && user.blockedUsers.includes(targetId);
};

const getFeedPosts = async (currentUserId, skip = 0, limit = 10) => {
    const currentUser = await getUser(currentUserId);
    const allPosts = [];
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');

    try {
        await ensureDirectoryExists(postsBaseDirPath);
        const userFolders = await fs.readdir(postsBaseDirPath);

        for (const userFolder of userFolders) {
            const userPostsDirPath = path.join(postsBaseDirPath, userFolder);
            const postFiles = await fs.readdir(userPostsDirPath);

            for (const file of postFiles) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(userPostsDirPath, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    let post;
                    try {
                        post = JSON.parse(data);
                    } catch (jsonError) {
                        console.error(`Error parsing JSON for post ${file} in getFeedPosts:`, jsonError);
                        continue;
                    }
                    allPosts.push(post);
                }
            }
        }

        let filteredPosts = [];
        if (currentUser && currentUser.following && currentUser.following.length > 0) {
            filteredPosts = allPosts.filter(post => currentUser.following.includes(post.userId));
        } else {
            const blockedUsers = currentUser ? currentUser.blockedUsers : [];
            filteredPosts = allPosts.filter(post => !blockedUsers.includes(post.userId));
        }

        const populatedPosts = await Promise.all(filteredPosts.map(async (post) => {
            const user = await getUser(post.userId);
            if (user) {
                post.userId = {
                    _id: user.username,
                    username: user.username,
                    displayName: user.displayName,
                    profilePicture: user.profilePicture
                };
            }
            return post;
        }));


        populatedPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return populatedPosts.slice(skip, skip + limit);

    } catch (error) {
        console.error('Error getting feed posts in local DB:', error);
        return [];
    }
};

const likePost = async (postId, userId) => {
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');
    const userFolders = await fs.readdir(postsBaseDirPath);

    for (const userFolder of userFolders) {
        const postFilePath = path.join(postsBaseDirPath, userFolder, `${postId}.json`);
        try {
            const data = await fs.readFile(postFilePath, 'utf8');
            let post;
            try {
                post = JSON.parse(data);
            } catch (jsonError) {
                console.error(`Error parsing JSON for post ${postId} in likePost:`, jsonError);
                return null;
            }
            if (!post.likes) post.likes = [];
            if (!post.likes.includes(userId)) {
                post.likes.push(userId);
                await fs.writeFile(postFilePath, JSON.stringify(post, null, 2), 'utf8');
                return post;
            }
            return post;
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
    }
    return null;
};

const unlikePost = async (postId, userId) => {
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');
    const userFolders = await fs.readdir(postsBaseDirPath);

    for (const userFolder of userFolders) {
        const postFilePath = path.join(postsBaseDirPath, userFolder, `${postId}.json`);
        try {
            const data = await fs.readFile(postFilePath, 'utf8');
            let post;
            try {
                post = JSON.parse(data);
            } catch (jsonError) {
                console.error(`Error parsing JSON for post ${postId} in unlikePost:`, jsonError);
                return null;
            }
            if (post.likes) {
                const initialLength = post.likes.length;
                post.likes = post.likes.filter(id => id !== userId);
                if (post.likes.length < initialLength) {
                    await fs.writeFile(postFilePath, JSON.stringify(post, null, 2), 'utf8');
                    return post;
                }
            }
            return post;
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
    }
    return null;
};

const addCommentToPost = async (postId, commentData) => {
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');
    const userFolders = await fs.readdir(postsBaseDirPath);

    for (const userFolder of userFolders) {
        const postFilePath = path.join(postsBaseDirPath, userFolder, `${postId}.json`);
        try {
            const data = await fs.readFile(postFilePath, 'utf8');
            let post;
            try {
                post = JSON.parse(data);
            } catch (jsonError) {
                console.error(`Error parsing JSON for post ${postId} in addCommentToPost:`, jsonError);
                return null;
            }
            if (!post.comments) post.comments = [];
            post.comments.push({ id: uuidv4(), ...commentData, createdAt: new Date().toISOString() });
            await fs.writeFile(postFilePath, JSON.stringify(post, null, 2), 'utf8');
            return post;
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
    }
    return null;
};

const getCommentsForPost = async (postId) => {
    const postsBaseDirPath = path.join(BASE_DIR, 'posts');
    const userFolders = await fs.readdir(postsBaseDirPath);

    for (const userFolder of userFolders) {
        const postFilePath = path.join(postsBaseDirPath, userFolder, `${postId}.json`);
        try {
            const data = await fs.readFile(postFilePath, 'utf8');
            let post;
            try {
                post = JSON.parse(data);
            } catch (jsonError) {
                console.error(`Error parsing JSON for post ${postId} in getCommentsForPost:`, jsonError);
                return [];
            }
            if (post && post.comments) {
                const populatedComments = await Promise.all(post.comments.map(async (comment) => {
                    const user = await getUser(comment.userId);
                    if (user) {
                        comment.userId = {
                            _id: user.username,
                            username: user.username,
                            displayName: user.displayName,
                            profilePicture: user.profilePicture
                        };
                    }
                    return comment;
                }));
                return populatedComments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            }
            return [];
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
    }
    return [];
};

// New: Get all users (excluding current user)
const getAllUsers = async () => {
    const usersDirPath = path.join(BASE_DIR, 'users');
    const allUsers = [];
    try {
        await ensureDirectoryExists(usersDirPath);
        const files = await fs.readdir(usersDirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(usersDirPath, file);
                const data = await fs.readFile(filePath, 'utf8');
                let user;
                try {
                    user = JSON.parse(data);
                } catch (jsonError) {
                    console.error(`Error parsing JSON for user ${file} in getAllUsers:`, jsonError);
                    continue;
                }
                const { password, email, verificationCode, verificationCodeExpires, resetPasswordCode, resetPasswordCodeExpires, blockedUsers, ...publicUser } = user;
                allUsers.push(publicUser);
            }
        }
    } catch (error) {
        console.error('Error getting all users in local DB:', error);
    }
    return allUsers;
};


// New: Get online users (for Find Friends)
const getOnlineUsers = async (currentUserId, genderPreference = null, limit = 10) => {
    const allUsers = await getAllUsers();
    let onlineUsers = allUsers.filter(user => user.isOnline && user.username !== currentUserId);

    if (genderPreference) {
        onlineUsers = onlineUsers.filter(user => user.gender === (genderPreference === 'Male' ? 'Female' : 'Male'));
    }

    return onlineUsers.slice(0, limit);
};

// New: Get offline users (for Find Friends)
const getOfflineUsers = async (currentUserId, genderPreference = null, limit = 10) => {
    const allUsers = await getAllUsers();
    let offlineUsers = allUsers.filter(user => !user.isOnline && user.username !== currentUserId);

    if (genderPreference) {
        offlineUsers = offlineUsers.filter(user => user.gender === (genderPreference === 'Male' ? 'Female' : 'Male'));
    }

    return offlineUsers.slice(0, limit);
};

// New: Delete a post
const deletePost = async (postId, username) => {
    const postFilePath = path.join(BASE_DIR, 'posts', username, `${postId}.json`);
    try {
        await fs.unlink(postFilePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('Post file not found.');
        }
        console.error(`Error deleting post file ${postFilePath}:`, error);
        throw error;
    }
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
    getMessagesInChat,
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
};
