// logic/searchLogic.js
const db = require('../database/database');

const performSearch = async (query) => {
    if (!query || query.trim() === '') {
        return { users: [], posts: [] };
    }

    const users = await db.searchUsers(query);
    const posts = await db.searchPosts(query);

    const imagePosts = posts.filter(post => post.imageUrl && post.imageUrl.length > 0);
    const textPosts = posts.filter(post => !post.imageUrl || post.imageUrl.length === 0);

    return {
        users: users,
        imagePosts: imagePosts,
        textPosts: textPosts
    };
};

// New: Get users for "Find Friends" section
const getFindFriendsUsers = async (currentUserId) => {
    const currentUser = await db.getUserById(currentUserId);
    if (!currentUser) {
        return { onlineUsers: [], offlineUsers: [] };
    }

    const userGender = currentUser.gender; // Current user's gender

    // Determine preferred gender for finding friends (opposite gender)
    let genderPreference = null;
    if (userGender === 'Male') {
        genderPreference = 'Female';
    } else if (userGender === 'Female') {
        genderPreference = 'Male';
    }
    // If 'Other', no specific gender preference for now

    // Fetch online users, prioritizing preferred gender
    const preferredOnlineUsers = await db.getOnlineUsers(currentUserId, genderPreference, 5); // Limit 5 preferred
    const otherOnlineUsers = await db.getOnlineUsers(currentUserId, null, 5); // Get other online users

    // Combine and deduplicate online users
    let onlineUsers = [...preferredOnlineUsers, ...otherOnlineUsers];
    onlineUsers = onlineUsers.filter((user, index, self) =>
        index === self.findIndex((u) => (u._id ? u._id.toString() : u.username) === (user._id ? user._id.toString() : user.username))
    );
    onlineUsers = onlineUsers.slice(0, 10); // Max 10 online users

    // Fetch offline users, prioritizing preferred gender
    const preferredOfflineUsers = await db.getOfflineUsers(currentUserId, genderPreference, 5); // Limit 5 preferred
    const otherOfflineUsers = await db.getOfflineUsers(currentUserId, null, 5); // Get other offline users

    // Combine and deduplicate offline users
    let offlineUsers = [...preferredOfflineUsers, ...otherOfflineUsers];
    offlineUsers = offlineUsers.filter((user, index, self) =>
        index === self.findIndex((u) => (u._id ? u._id.toString() : u.username) === (user._id ? user._id.toString() : user.username))
    );
    offlineUsers = offlineUsers.slice(0, 10); // Max 10 offline users


    return { onlineUsers, offlineUsers };
};


module.exports = {
    performSearch,
    getFindFriendsUsers, // Exported
};
