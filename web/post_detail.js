// web/post_detail.js
document.addEventListener('DOMContentLoaded', () => {
    const postDetailContainer = document.getElementById('postDetailContainer');
    const postDetailPageTitle = document.getElementById('postDetailPageTitle');
    const logoutButtonSidebar = document.getElementById('logout-button-sidebar');

    // Comment Modal elements (re-declared for this specific page)
    const commentModalOverlay = document.getElementById('commentModalOverlay');
    const commentModalClose = document.getElementById('commentModalClose');
    const commentsList = document.getElementById('commentsList');
    const noCommentsMessage = document.getElementById('noCommentsMessage');
    const newCommentInput = document.getElementById('newCommentInput');
    const addCommentButton = document.getElementById('addCommentButton');

    let currentPostId = null; // The ID of the post currently displayed
    let currentUserId = null; // Current logged-in user's ID

    // --- Helper Functions (reused from script.js) ---

    const displayTempMessage = (message, type) => {
        const msgBox = document.createElement('div');
        msgBox.textContent = message;
        msgBox.className = `message-box ${type}`;
        const mainContent = document.querySelector('.content');
        if (mainContent) {
            mainContent.prepend(msgBox);
            setTimeout(() => msgBox.remove(), 5000);
        }
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

    // --- Render a single post card for the detail page ---
    const renderPostDetail = (post) => {
        const postId = post._id ? post._id.toString() : post.id;
        currentPostId = postId; // Set currentPostId for comments

        const mediaHtml = post.imageUrl ?
            (post.imageUrl.endsWith('.mp4') || post.imageUrl.endsWith('.webm') ?
                `<video src="${post.imageUrl}" controls class="feed-post-media"></video>` :
                `<img src="${post.imageUrl}" alt="Post Media" class="feed-post-media">`) : '';

        const isLikedByCurrentUser = post.likes && post.likes.includes(currentUserId);
        const likeButtonClass = isLikedByCurrentUser ? 'liked' : '';
        const likeButtonIcon = isLikedByCurrentUser ? 'fas fa-heart' : 'far fa-heart';

        const postAuthorDisplayName = post.userId ? (post.userId.displayName || post.userId.username) : 'Unknown User';
        const postAuthorProfilePic = post.userId ? (post.userId.profilePicture || '/images/default_profile.png') : '/images/default_profile.png';

        // Post Options Menu (Three-dot menu) - similar to home feed
        let postAuthorId = null;
        if (post.userId) {
            postAuthorId = post.userId._id ? post.userId._id.toString() : post.userId.username;
        }
        const isOwnPost = currentUserId && postAuthorId && (postAuthorId === currentUserId);

        const postOptionsHtml = isOwnPost ? `
            <div class="post-options-container">
                <button class="post-options-button" data-post-id="${postId}"><i class="fas fa-ellipsis-h"></i></button>
                <div class="post-options-dropdown" id="post-options-dropdown-${postId}">
                    <button class="edit-post-button" data-post-id="${postId}">Edit Post</button>
                    <button class="delete-post-button delete-option" data-post-id="${postId}">Delete Post</button>
                </div>
            </div>
        ` : '';

        postDetailContainer.innerHTML = `
            <div class="feed-post-card post-detail-card" data-post-id="${postId}">
                <div class="feed-post-header">
                    <img src="${postAuthorProfilePic}" alt="${postAuthorDisplayName}" class="feed-post-avatar">
                    <div class="feed-post-author-info">
                        <h4><a href="/@${post.username}">${postAuthorDisplayName}</a></h4>
                        <p>@${post.username} &bull; ${formatTimestamp(post.createdAt)}</p>
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
            </div>
        `;

        // Update page title
        postDetailPageTitle.textContent = `Bhabo - Post by ${postAuthorDisplayName}`;

        // Attach event listeners for like/comment buttons
        postDetailContainer.querySelector('.like-button').addEventListener('click', (e) => handleLikeToggle(e.currentTarget.dataset.postId));
        postDetailContainer.querySelector('.comment-button').addEventListener('click', (e) => openCommentModal(e.currentTarget.dataset.postId));

        // Post options menu listeners
        if (isOwnPost) {
            const optionsButton = postDetailContainer.querySelector('.post-options-button');
            const optionsDropdown = postDetailContainer.querySelector('.post-options-dropdown');

            if (optionsButton && optionsDropdown) {
                optionsButton.addEventListener('click', (event) => {
                    event.stopPropagation();
                    document.querySelectorAll('.post-options-dropdown').forEach(dropdown => {
                        if (dropdown !== optionsDropdown) {
                            dropdown.style.display = 'none';
                        }
                    });
                    optionsDropdown.style.display = optionsDropdown.style.display === 'block' ? 'none' : 'block';
                });

                document.addEventListener('click', (event) => {
                    if (optionsDropdown.style.display === 'block' && !optionsDropdown.contains(event.target) && event.target !== optionsButton) {
                        optionsDropdown.style.display = 'none';
                    }
                });

                postDetailContainer.querySelector('.edit-post-button').addEventListener('click', (e) => {
                    displayTempMessage(`Edit Post (ID: ${e.currentTarget.dataset.postId}) - Feature coming soon!`, 'info');
                    optionsDropdown.style.display = 'none';
                });
                postDetailContainer.querySelector('.delete-post-button').addEventListener('click', (e) => {
                    const confirmDelete = confirm(`Are you sure you want to delete this post (ID: ${e.currentTarget.dataset.postId})?`);
                    if (confirmDelete) {
                        handleDeletePost(e.currentTarget.dataset.postId); // Call delete handler
                    }
                    optionsDropdown.style.display = 'none';
                });
            }
        }
    };

    // --- Like/Unlike Post Handler (reused from script.js) ---
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
                    const likeCountSpan = postCard.querySelector('.like-count');
                    const likeIcon = postCard.querySelector('.like-button i');

                    likeCountSpan.textContent = data.likesCount;
                    if (data.isLiked) {
                        likeButton.classList.add('liked');
                        likeIcon.classList.remove('far');
                        likeIcon.classList.add('fas');
                    } else {
                        likeButton.classList.remove('liked');
                        likeIcon.classList.remove('fas');
                        likeIcon.classList.add('far');
                    }
                }
            } else {
                displayTempMessage(data.message || 'Failed to toggle like.', 'error');
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            displayTempMessage('An unexpected error occurred while toggling like.', 'error');
        }
    };

    // --- Delete Post Handler ---
    const handleDeletePost = async (postId) => {
        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();

            if (data.success) {
                displayTempMessage(data.message, 'success');
                // Redirect to profile page or home feed after deletion
                setTimeout(() => {
                    window.location.href = '/profile'; // Redirect to profile page
                }, 1000);
            } else {
                displayTempMessage(data.message || 'Failed to delete post.', 'error');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            displayTempMessage('An unexpected error occurred while deleting post.', 'error');
        }
    };

    // --- Comment Modal Logic (reused from script.js) ---
    const openCommentModal = async (postId) => {
        if (!commentModalOverlay || !commentsList || !noCommentsMessage || !newCommentInput || !addCommentButton || !commentModalClose) {
            console.error("Comment modal elements not found in DOM. Cannot open modal.");
            displayTempMessage('Comment modal components are missing. Please check HTML.', 'error');
            return;
        }

        currentPostId = postId; // Ensure currentPostId is set for comments
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
                        const commentAuthorDisplayName = comment.userId ? (comment.userId.displayName || comment.userId.username) : 'Unknown User';
                        const commentAuthorProfilePic = comment.userId ? (comment.userId.profilePicture || '/images/default_profile.png') : '/images/default_profile.png';

                        commentItem.innerHTML = `
                            <img src="${commentAuthorProfilePic}" alt="${commentAuthorDisplayName}" class="comment-avatar">
                            <div class="comment-info">
                                <h5>${commentAuthorDisplayName} <span>@${comment.username} &bull; ${formatTimestamp(comment.createdAt)}</span></h5>
                                <p>${comment.text}</p>
                                <div class="comment-actions">
                                    <button class="comment-like-button" data-comment-id="${comment._id || comment.id}">Like</button>
                                    <button class="comment-reply-button" data-comment-id="${comment._id || comment.id}" data-author-username="${comment.username}">Reply</button>
                                </div>
                            </div>
                        `;
                        commentsList.appendChild(commentItem);

                        commentItem.querySelector('.comment-like-button').addEventListener('click', () => {
                            displayTempMessage('Liking comments is a future feature!', 'info');
                        });
                        commentItem.querySelector('.comment-reply-button').addEventListener('click', (e) => {
                            const authorUsername = e.currentTarget.dataset.authorUsername;
                            newCommentInput.value = `@${authorUsername} `;
                            newCommentInput.focus();
                        });
                    });
                }
                commentModalOverlay.classList.add('active');
            } else {
                displayTempMessage(data.message || 'Failed to load comments.', 'error');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            displayTempMessage('An unexpected error occurred while loading comments.', 'error');
        }
    };

    const closeCommentModal = () => {
        if (commentModalOverlay) {
            commentModalOverlay.classList.remove('active');
        }
        currentPostId = null;
    };

    const handleAddComment = async () => {
        if (!currentPostId) return;

        const commentText = newCommentInput.value.trim();
        if (!commentText) {
            displayTempMessage('Comment cannot be empty.', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/posts/${currentPostId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: commentText })
            });
            const data = await response.json();

            if (data.success) {
                if (data.newComment && data.newComment.userId) {
                     const currentUserResponse = await fetch('/api/profile/me');
                     const currentUserData = await currentUserResponse.json();
                     if (currentUserData.success && currentUserData.profile) {
                         data.newComment.userId = {
                             _id: currentUserData.profile._id || currentUserData.profile.username,
                             username: currentUserData.profile.username,
                             displayName: currentUserData.profile.displayName,
                             profilePicture: currentUserData.profile.profilePicture
                         };
                     }
                }
                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                const newCommentAuthorDisplayName = data.newComment.userId ? (data.newComment.userId.displayName || data.newComment.userId.username) : 'Unknown User';
                const newCommentAuthorProfilePic = data.newComment.userId ? (data.newComment.userId.profilePicture || '/images/default_profile.png') : '/images/default_profile.png';

                commentItem.innerHTML = `
                    <img src="${newCommentAuthorProfilePic}" alt="${newCommentAuthorDisplayName}" class="comment-avatar">
                    <div class="comment-info">
                        <h5>${newCommentAuthorDisplayName} <span>@${data.newComment.username} &bull; ${formatTimestamp(data.newComment.createdAt)}</span></h5>
                        <p>${data.newComment.text}</p>
                        <div class="comment-actions">
                            <button class="comment-like-button" data-comment-id="${data.newComment._id || data.newComment.id}">Like</button>
                            <button class="comment-reply-button" data-comment-id="${data.newComment._id || data.newComment.id}" data-author-username="${data.newComment.username}">Reply</button>
                        </div>
                    </div>
                `;
                commentsList.appendChild(commentItem);
                noCommentsMessage.style.display = 'none';
                newCommentInput.value = '';

                commentItem.querySelector('.comment-like-button').addEventListener('click', () => {
                    displayTempMessage('Liking comments is a future feature!', 'info');
                });
                commentItem.querySelector('.comment-reply-button').addEventListener('click', (e) => {
                    const authorUsername = e.currentTarget.dataset.authorUsername;
                    newCommentInput.value = `@${authorUsername} `;
                    newCommentInput.focus();
                });

                // Update comment count on the post card (if on home feed)
                // This part is not strictly necessary for post_detail page, but included for completeness
                const postCard = document.querySelector(`.feed-post-card[data-post-id="${currentPostId}"]`);
                if (postCard) {
                    const commentCountSpan = postCard.querySelector('.comment-count');
                    commentCountSpan.textContent = data.commentsCount;
                }
            } else {
                displayTempMessage(data.message || 'Failed to add comment.', 'error');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            displayTempMessage('An unexpected error occurred while adding comment.', 'error');
        }
    };


    // --- Initial Load Logic ---
    const loadPostDetail = async () => {
        const pathParts = window.location.pathname.split('/');
        const postId = pathParts[pathParts.length - 1]; // Get postId from URL: /post/:postId
        currentPostId = postId; // Set currentPostId for comments

        if (!postId) {
            postDetailContainer.innerHTML = '<p class="loading-message" style="color: red;">Invalid Post ID.</p>';
            return;
        }

        try {
            // Fetch current user ID first
            if (!currentUserId) {
                const userResponse = await fetch('/api/profile/me');
                const userData = await userResponse.json();
                currentUserId = userData.profile._id || userData.profile.username;
            }

            const response = await fetch(`/api/posts/${postId}`);
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const data = await response.json();

            if (data.success && data.post) {
                renderPostDetail(data.post);
            } else {
                postDetailContainer.innerHTML = `<p class="loading-message" style="color: red;">${data.message || 'Post not found.'}</p>`;
            }
        } catch (error) {
            console.error('Error loading post detail:', error);
            postDetailContainer.innerHTML = '<p class="loading-message" style="color: red;">Failed to load post. Please try again later.</p>';
        }
    };

    // --- Event Listeners ---
    // Comment modal listeners (attached directly to elements)
    if (commentModalClose) {
        commentModalClose.addEventListener('click', closeCommentModal);
    }
    if (commentModalOverlay) {
        commentModalOverlay.addEventListener('click', (e) => {
            if (e.target === commentModalOverlay) {
                closeCommentModal();
            }
        });
    }
    if (addCommentButton) {
        addCommentButton.addEventListener('click', handleAddComment);
    }
    if (newCommentInput) {
        newCommentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAddComment();
            }
        });
    }

    // Logout button handler (from sidebar)
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
                console.error('Logout failed:', error);
                displayTempMessage('An error occurred during logout.', 'error');
            }
        });
    }

    // Initial load for the post detail page
    loadPostDetail();
});
