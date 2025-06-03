document.addEventListener('DOMContentLoaded', () => {
    // Main elements
    const homeFeedContainer = document.getElementById('homeFeedContainer');
    const noFeedPostsMessage = document.getElementById('noFeedPosts');
    const feedLoadingIndicator = document.getElementById('feedLoadingIndicator');
    const logoutButtonSidebar = document.getElementById('logout-button-sidebar');

    // Post loading variables
    let postsLoadedCount = 0;
    const POSTS_PER_LOAD = 5;
    let isFetchingPosts = false;
    let currentPostIdForComments = null;
    let currentUserId = null;

    // Helper functions
    const displayTempMessage = (message, type) => {
        const msgBox = document.createElement('div');
        msgBox.textContent = message;
        msgBox.className = `message-box ${type}`;
        document.querySelector('.content').prepend(msgBox);
        setTimeout(() => msgBox.remove(), 5000);
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffSeconds = Math.floor((now - date) / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Render a single post card
    const renderPostCard = (post) => {
        const postCard = document.createElement('div');
        const postId = post._id ? post._id.toString() : post.id;
        postCard.className = 'feed-post-card';
        postCard.dataset.postId = postId;

        const mediaHtml = post.imageUrl ?
            (post.imageUrl.endsWith('.mp4') || post.imageUrl.endsWith('.webm') ?
                `<video src="${post.imageUrl}" controls class="feed-post-media"></video>` :
                `<img src="${post.imageUrl}" alt="Post Media" class="feed-post-media">`) : '';

        const isLikedByCurrentUser = post.likes && post.likes.includes(currentUserId);
        const likeButtonClass = isLikedByCurrentUser ? 'liked' : '';
        const likeButtonIcon = isLikedByCurrentUser ? 'fas fa-heart' : 'far fa-heart';

        const postAuthorDisplayName = post.userId ? (post.userId.displayName || post.userId.username) : 'Unknown User';
        const postAuthorProfilePic = post.userId ? (post.userId.profilePicture || '/images/default_profile.png') : '/images/default_profile.png';

        const postAuthorId = post.userId ? (post.userId._id ? post.userId._id.toString() : post.userId.username) : null;
        const isOwnPost = currentUserId && postAuthorId && (postAuthorId === currentUserId);

        const postOptionsHtml = isOwnPost ? 
            `<div class="post-options-container">
                <button class="post-options-button" data-post-id="${postId}"><i class="fas fa-ellipsis-h"></i></button>
                <div class="post-options-dropdown" id="post-options-dropdown-${postId}">
                    <button class="edit-post-button" data-post-id="${postId}">Edit Post</button>
                    <button class="delete-post-button delete-option" data-post-id="${postId}">Delete Post</button>
                </div>
            </div>` : '';

        postCard.innerHTML = `
            <div class="feed-post-header">
                <img src="${postAuthorProfilePic}" alt="${postAuthorDisplayName}" class="feed-post-avatar">
                <div class="feed-post-author-info">
                    <h4><a href="/@${post.username}">${postAuthorDisplayName}</a></h4>
                    <p>@${post.username} • ${formatTimestamp(post.createdAt)}</p>
                </div>
                ${postOptionsHtml}
            </div>
            <div class="feed-post-content">
                ${post.content ? `<p>${post.content}</p>` : ''}
                ${mediaHtml}
            </div>
            <div class="feed-post-actions">
                <button class="like-button ${likeButtonClass}" data-post-id="${postId}">
                    <i class="${likeButtonIcon}"></i> Like (<span class="like-count">${post.likes ? post.likes.length : 0}</span>)
                </button>
                <button class="comment-button" data-post-id="${postId}">
                    <i class="far fa-comment"></i> Comment (<span class="comment-count">${post.comments ? post.comments.length : 0}</span>)
                </button>
                <button><i class="fas fa-share"></i> Share</button>
            </div>
        `;

        // Add event listeners
        postCard.querySelector('.like-button').addEventListener('click', () => handleLikeToggle(postId));
        postCard.querySelector('.comment-button').addEventListener('click', () => openCommentModal(postId));

        if (isOwnPost) {
            const optionsButton = postCard.querySelector('.post-options-button');
            const optionsDropdown = postCard.querySelector('.post-options-dropdown');

            optionsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.post-options-dropdown').forEach(dropdown => {
                    if (dropdown !== optionsDropdown) dropdown.style.display = 'none';
                });
                optionsDropdown.style.display = optionsDropdown.style.display === 'block' ? 'none' : 'block';
            });

            postCard.querySelector('.edit-post-button').addEventListener('click', (e) => {
                displayTempMessage(`Edit Post (ID: ${e.currentTarget.dataset.postId}) - Feature coming soon!`, 'info');
                optionsDropdown.style.display = 'none';
            });

            postCard.querySelector('.delete-post-button').addEventListener('click', (e) => {
                if (confirm(`Are you sure you want to delete this post?`)) {
                    displayTempMessage(`Delete Post (ID: ${e.currentTarget.dataset.postId}) - Feature coming soon!`, 'info');
                }
                optionsDropdown.style.display = 'none';
            });
        }

        return postCard;
    };

    // Fetch and display posts
    const fetchFeedPosts = async () => {
        if (isFetchingPosts) return;
        isFetchingPosts = true;
        feedLoadingIndicator.style.display = 'block';

        try {
            if (!currentUserId) {
                const userResponse = await fetch('/api/profile/me');
                const userData = await userResponse.json();
                currentUserId = userData.profile._id || userData.profile.username;
            }

            const response = await fetch(`/api/posts/feed?skip=${postsLoadedCount}&limit=${POSTS_PER_LOAD}`);
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            const data = await response.json();
            if (data.success) {
                if (data.posts.length === 0) {
                    if (postsLoadedCount === 0) {
                        noFeedPostsMessage.style.display = 'block';
                    } else {
                        feedLoadingIndicator.textContent = 'No more posts to load.';
                        setTimeout(() => feedLoadingIndicator.style.display = 'none', 2000);
                    }
                } else {
                    noFeedPostsMessage.style.display = 'none';
                    data.posts.forEach(post => {
                        homeFeedContainer.insertBefore(renderPostCard(post), feedLoadingIndicator);
                    });
                    postsLoadedCount += data.posts.length;
                }
            } else {
                displayTempMessage(data.message || 'Failed to load posts.', 'error');
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            displayTempMessage('Failed to load posts. Please try again.', 'error');
        } finally {
            isFetchingPosts = false;
            feedLoadingIndicator.style.display = 'none';
        }
    };

    // Handle post liking
    const handleLikeToggle = async (postId) => {
        try {
            const response = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();

            if (data.success) {
                const postCard = document.querySelector(`.feed-post-card[data-post-id="${postId}"]`);
                if (postCard) {
                    const likeButton = postCard.querySelector('.like-button');
                    const likeCount = postCard.querySelector('.like-count');
                    const likeIcon = postCard.querySelector('.like-button i');

                    likeCount.textContent = data.likesCount;
                    if (data.isLiked) {
                        likeButton.classList.add('liked');
                        likeIcon.classList.replace('far', 'fas');
                    } else {
                        likeButton.classList.remove('liked');
                        likeIcon.classList.replace('fas', 'far');
                    }
                }
            } else {
                displayTempMessage(data.message || 'Failed to like post.', 'error');
            }
        } catch (error) {
            console.error('Error liking post:', error);
            displayTempMessage('Failed to like post. Please try again.', 'error');
        }
    };

    // Comment modal functions
    const openCommentModal = async (postId) => {
        currentPostIdForComments = postId;
        
        const modalOverlay = document.getElementById('commentModalOverlay');
        const commentsList = document.getElementById('commentsList');
        const noCommentsMessage = document.querySelector('.no-comments-message');
        const newCommentInput = document.getElementById('newCommentInput');

        if (!modalOverlay || !commentsList || !noCommentsMessage || !newCommentInput) {
            console.error('Comment modal elements missing');
            return;
        }

        commentsList.innerHTML = '';
        noCommentsMessage.style.display = 'none';
        newCommentInput.value = '';

        try {
            const response = await fetch(`/api/posts/${postId}/comments`);
            const data = await response.json();

            if (data.success) {
                if (data.comments.length === 0) {
                    noCommentsMessage.style.display = 'block';
                } else {
                    data.comments.forEach(comment => {
                        const commentItem = document.createElement('div');
                        commentItem.className = 'comment-item';
                        const authorName = comment.userId ? (comment.userId.displayName || comment.userId.username) : 'Unknown';
                        const authorPic = comment.userId ? (comment.userId.profilePicture || '/images/default_profile.png') : '/images/default_profile.png';

                        commentItem.innerHTML = `
                            <img src="${authorPic}" alt="${authorName}" class="comment-avatar">
                            <div class="comment-info">
                                <h5>${authorName} <span>@${comment.username} • ${formatTimestamp(comment.createdAt)}</span></h5>
                                <p>${comment.text}</p>
                                <div class="comment-actions">
                                    <button class="comment-like-button" data-comment-id="${comment._id}">Like</button>
                                    <button class="comment-reply-button" data-comment-id="${comment._id}" data-author-username="${comment.username}">Reply</button>
                                </div>
                            </div>
                        `;
                        commentsList.appendChild(commentItem);
                    });
                }
                modalOverlay.classList.add('active');
            } else {
                displayTempMessage(data.message || 'Failed to load comments.', 'error');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            displayTempMessage('Failed to load comments. Please try again.', 'error');
        }
    };

    const closeCommentModal = () => {
        const modalOverlay = document.getElementById('commentModalOverlay');
        if (modalOverlay) modalOverlay.classList.remove('active');
        currentPostIdForComments = null;
    };

    const handleAddComment = async () => {
        if (!currentPostIdForComments) return;

        const newCommentInput = document.getElementById('newCommentInput');
        const commentsList = document.getElementById('commentsList');
        const noCommentsMessage = document.querySelector('.no-comments-message');

        const commentText = newCommentInput.value.trim();
        if (!commentText) {
            displayTempMessage('Comment cannot be empty.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/posts/${currentPostIdForComments}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: commentText })
            });
            const data = await response.json();

            if (data.success && data.newComment) {
                // Get current user info if not already available
                if (!data.newComment.userId) {
                    const userResponse = await fetch('/api/profile/me');
                    const userData = await userResponse.json();
                    if (userData.success) {
                        data.newComment.userId = {
                            _id: userData.profile._id,
                            username: userData.profile.username,
                            displayName: userData.profile.displayName,
                            profilePicture: userData.profile.profilePicture
                        };
                    }
                }

                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                const authorName = data.newComment.userId ? (data.newComment.userId.displayName || data.newComment.userId.username) : 'Unknown';
                const authorPic = data.newComment.userId ? (data.newComment.userId.profilePicture || '/images/default_profile.png') : '/images/default_profile.png';

                commentItem.innerHTML = `
                    <img src="${authorPic}" alt="${authorName}" class="comment-avatar">
                    <div class="comment-info">
                        <h5>${authorName} <span>@${data.newComment.username} • ${formatTimestamp(data.newComment.createdAt)}</span></h5>
                        <p>${data.newComment.text}</p>
                        <div class="comment-actions">
                            <button class="comment-like-button" data-comment-id="${data.newComment._id}">Like</button>
                            <button class="comment-reply-button" data-comment-id="${data.newComment._id}" data-author-username="${data.newComment.username}">Reply</button>
                        </div>
                    </div>
                `;
                commentsList.appendChild(commentItem);
                noCommentsMessage.style.display = 'none';
                newCommentInput.value = '';

                // Update comment count on the post card
                const postCard = document.querySelector(`.feed-post-card[data-post-id="${currentPostIdForComments}"]`);
                if (postCard) {
                    const commentCount = postCard.querySelector('.comment-count');
                    if (commentCount) {
                        commentCount.textContent = data.commentsCount;
                    }
                }
            } else {
                displayTempMessage(data.message || 'Failed to add comment.', 'error');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            
        }
    };

    // Event listeners
    document.querySelector('.content').addEventListener('scroll', () => {
        if (document.querySelector('.content').scrollTop + document.querySelector('.content').clientHeight >= 
            document.querySelector('.content').scrollHeight - 100 && !isFetchingPosts) {
            fetchFeedPosts();
        }
    });

    // Comment modal event delegation
    document.addEventListener('click', (e) => {
        if (e.target.id === 'commentModalClose' || e.target.closest('#commentModalClose')) {
            closeCommentModal();
        }
        if (e.target.id === 'commentModalOverlay') {
            closeCommentModal();
        }
        if (e.target.id === 'addCommentButton' || e.target.closest('#addCommentButton')) {
            handleAddComment();
        }
    });

    document.addEventListener('keypress', (e) => {
        if (e.target.id === 'newCommentInput' && e.key === 'Enter') {
            handleAddComment();
        }
    });

    // Logout handler
    if (logoutButtonSidebar) {
        logoutButtonSidebar.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/logout', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/login.html';
                } else {
                    displayTempMessage('Logout failed: ' + data.message, 'error');
                }
            } catch (error) {
                console.error('Logout error:', error);
                displayTempMessage('Failed to logout. Please try again.', 'error');
            }
        });
    }

    // Initial load
    fetchFeedPosts();
});