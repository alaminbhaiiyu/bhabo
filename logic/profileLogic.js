// logic/profileLogic.js
const db = require('../database/database');
const userLogic = require('./userLogic');

const updateMyProfile = async (userId, profileData) => {
    return await db.updateProfileFields(userId, profileData);
};

const updateMyPassword = async (userId, currentPassword, newPassword) => {
    const user = await db.getUserById(userId);
    if (!user) {
        throw new Error('User not found.');
    }

    const isMatch = await userLogic.comparePassword(currentPassword, user.password);
    if (!isMatch) {
        throw new Error('Current password is incorrect.');
    }

    const hashedNewPassword = await userLogic.hashPassword(newPassword);
    await db.updateUser(userId, { password: hashedNewPassword });
    return true;
};

const toggleFollow = async (followerUserId, targetUsername, isFollowing) => {
    const followerUser = await db.getUserById(followerUserId);
    if (!followerUser) {
        throw new Error('Follower user not found.');
    }

    const targetUser = await db.getUser(targetUsername); // Get by username
    if (!targetUser) {
        throw new Error('Target user not found.');
    }

    if (followerUser.username === targetUser.username) {
        throw new Error('Cannot follow/unfollow yourself.');
    }

    const actualTargetUserId = targetUser._id ? targetUser._id.toString() : targetUser.username;
    const actualFollowerUserId = followerUser._id ? followerUser._id.toString() : followerUser.username;


    if (isFollowing) {
        await db.addFollowing(actualFollowerUserId, actualTargetUserId);
        await db.addFollower(actualTargetUserId, actualFollowerUserId);
        return { success: true, status: 'followed' };
    } else {
        await db.removeFollowing(actualFollowerUserId, actualTargetUserId);
        await db.removeFollower(actualTargetUserId, actualFollowerUserId);
        return { success: true, status: 'unfollowed' };
    }
};

const getPublicProfileData = async (username, currentUserId) => {
    const user = await db.getPublicUser(username);
    if (!user) return null;

    // Re-fetch follower/following counts directly from the user object to ensure real-time accuracy
    const latestUser = await db.getUser(username); // Get the full user object again to get latest counts
    const followersCount = latestUser.followers ? latestUser.followers.length : 0;
    const followingCount = latestUser.following ? latestUser.following.length : 0;

    const userPosts = await db.getAllPostsByUser(user._id || user.username);
    const postCount = userPosts.length;

    let isFollowing = false;
    if (currentUserId) {
        const currentUser = await db.getUserById(currentUserId);
        if (currentUser && currentUser.following) {
            // Check if current user's following list contains the target user's ID/username
            const targetId = user._id ? user._id.toString() : user.username;
            isFollowing = currentUser.following.includes(targetId);
        }
    }

    return {
        userId: user._id || user.username, // Include userId for client-side logic
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        followersCount,
        followingCount,
        postCount,
        posts: userPosts.map(post => ({
            id: post._id || post.id,
            content: post.content,
            imageUrl: post.imageUrl,
            likesCount: post.likes ? post.likes.length : 0,
            commentsCount: post.comments ? post.comments.length : 0,
            createdAt: post.createdAt,
        })),
        isVerified: user.isVerified,
        isFollowing: isFollowing // New: Whether the current logged-in user is following this profile
    };
};

module.exports = {
    updateMyProfile,
    updateMyPassword,
    toggleFollow,
    getPublicProfileData,
};
