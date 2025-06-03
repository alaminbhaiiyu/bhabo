// web/profile.js
document.addEventListener('DOMContentLoaded', () => {
    // Determine if it's the own profile page or another user's
    const isOwnProfilePage = window.location.pathname === '/profile';
    const usernameFromUrl = isOwnProfilePage ? null : window.location.pathname.substring(2); // Gets username from /@username

    // Helper function to display temporary messages (like success/error banners)
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

    // Helper function to display messages specific to profile/password forms
    const displayFormMessage = (messageEl, message, type) => {
        messageEl.textContent = message;
        messageEl.className = `message-box ${type}`;
        messageEl.style.display = 'block';
    };

    const clearFormMessage = (messageEl) => {
        messageEl.textContent = '';
        messageEl.className = 'message-box';
        messageEl.style.display = 'none';
    };

    // Helper to render posts
    const renderPosts = (posts, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // Clear previous posts
        let noPostsMessage = container.querySelector('.no-posts');

        if (!noPostsMessage) {
            noPostsMessage = document.createElement('p');
            noPostsMessage.className = 'no-posts';
            container.appendChild(noPostsMessage);
        }

        if (!posts || posts.length === 0) {
            noPostsMessage.textContent = 'No posts yet.';
            noPostsMessage.style.display = 'block';
            return;
        } else {
            noPostsMessage.style.display = 'none';
        }

        posts.forEach(post => {
            const postId = post._id ? post._id.toString() : post.id;
            const postLink = document.createElement('a'); // Create an anchor tag
            postLink.href = `/post/${postId}`; // Link to the single post page
            postLink.className = 'post-card-link'; // Add a class for styling if needed

            const postCard = document.createElement('div');
            postCard.className = 'post-card';
            postCard.innerHTML = `
                ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Post Image">` : ''}
                <div class="post-content-area">
                    <p>${post.content}</p>
                    <div class="post-meta">
                        <span>Likes: ${post.likes ? post.likes.length : 0}</span>
                        <span>Comments: ${post.comments ? post.comments.length : 0}</span>
                    </div>
                </div>
            `;
            postLink.appendChild(postCard); // Append the post card inside the link
            container.appendChild(postLink); // Append the link to the container
        });
    };


    // --- Common Profile Data Fetching Logic ---
    const fetchProfileData = async () => {
        try {
            const endpoint = isOwnProfilePage ? '/api/profile/me' : `/api/profile/${usernameFromUrl}`;
            const response = await fetch(endpoint);
            if (response.status === 401) { // Redirect if not authenticated
                window.location.href = '/login.html';
                return;
            }
            const data = await response.json();

            if (data.success) {
                const profile = data.profile;
                const profilePicElement = isOwnProfilePage ? document.getElementById('myProfilePic') : document.getElementById('publicProfilePic');
                const displayNameElement = isOwnProfilePage ? document.getElementById('myDisplayName') : document.getElementById('publicDisplayName');
                const usernameElement = isOwnProfilePage ? document.getElementById('myUsername') : document.getElementById('publicUsername');
                const postCountElement = isOwnProfilePage ? document.getElementById('myPostCount') : document.getElementById('publicPostCount');
                const followersCountElement = isOwnProfilePage ? document.getElementById('myFollowersCount') : document.getElementById('publicFollowersCount');
                const followingCountElement = isOwnProfilePage ? document.getElementById('myFollowingCount') : document.getElementById('publicFollowingCount');
                const bioElement = isOwnProfilePage ? document.getElementById('myBio') : document.getElementById('publicBio');
                const postsContainerElement = isOwnProfilePage ? document.getElementById('myPostsContainer') : document.getElementById('publicPostsContainer');

                // Update common elements
                profilePicElement.src = profile.profilePicture || '/images/default_profile.png';
                displayNameElement.textContent = profile.displayName || `${profile.firstName} ${profile.lastName}`;
                usernameElement.textContent = profile.username;
                bioElement.textContent = profile.bio || 'No bio yet.'; // Update bio
                postCountElement.textContent = profile.postCount;
                followersCountElement.textContent = profile.followersCount;
                followingCountElement.textContent = profile.followingCount;


                // Render posts for the user
                renderPosts(profile.posts, postsContainerElement.id);


                // --- Own Profile Page Specific UI ---
                if (isOwnProfilePage) {
                    const firstNameInput = document.getElementById('firstName');
                    const lastNameInput = document.getElementById('lastName');
                    const displayNameInput = document.getElementById('displayName');
                    const bioInput = document.getElementById('bio');

                    firstNameInput.value = profile.firstName || '';
                    lastNameInput.value = profile.lastName || '';
                    displayNameInput.value = profile.displayName || '';
                    bioInput.value = profile.bio || '';
                }
                // --- Public Profile Page Specific UI ---
                else {
                    const pageTitle = document.getElementById('pageTitle');
                    pageTitle.textContent = `${profile.displayName || profile.username}'s Profile - Bhabo`;

                    const followToggleButton = document.getElementById('followToggleButton');
                    const messageButton = document.getElementById('messageButton');
                    const goToMyProfileButton = document.getElementById('goToMyProfileButton');


                    if (profile.isOwnProfile) { // If it's your own profile viewed via /@username
                        followToggleButton.style.display = 'none';
                        messageButton.style.display = 'none';
                        goToMyProfileButton.style.display = 'inline-block';
                        goToMyProfileButton.onclick = () => window.location.href = '/profile';
                    } else { // It's another user's profile
                        followToggleButton.style.display = 'inline-block';
                        messageButton.style.display = 'inline-block';
                        goToMyProfileButton.style.display = 'none';

                        if (profile.isFollowing) {
                            followToggleButton.textContent = 'Unfollow';
                            followToggleButton.className = 'action-button unfollow-button';
                        } else {
                            followToggleButton.textContent = 'Follow';
                            followToggleButton.className = 'action-button follow-button';
                        }
                        followToggleButton.onclick = () => handleFollowToggle(profile.username);
                        // --- Message Button Click Handler ---
                        messageButton.onclick = async () => {
                            try {
                                const response = await fetch('/api/chat/start-chat', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ receiverUsername: profile.username, content: "Hi!" }) // Send an initial message
                                });
                                const chatData = await response.json();

                                if (chatData.success && chatData.chat) {
                                    displayTempMessage(`Chat started with ${profile.username}!`, 'success');
                                    // Redirect to chat page with chat ID
                                    window.location.href = `/chat.html?chatId=${chatData.chat._id}`;
                                } else {
                                    displayTempMessage(chatData.message || 'Failed to start chat.', 'error');
                                }
                            } catch (error) {
                                console.error('Error starting chat from profile:', error);
                                displayTempMessage('An unexpected error occurred while starting chat.', 'error');
                            }
                        };
                    }
                }

            } else {
                // Handle error for public profile not found
                if (!isOwnProfilePage) {
                    const publicDisplayName = document.getElementById('publicDisplayName');
                    const publicUsername = document.getElementById('publicUsername');
                    const publicBio = document.getElementById('publicBio');
                    const publicPostsContainer = document.getElementById('publicPostsContainer');

                    publicDisplayName.textContent = 'User Not Found';
                    publicUsername.textContent = `@${usernameFromUrl}`;
                    publicBio.textContent = data.message || 'The user you are looking for does not exist.';
                    document.getElementById('publicPostCount').textContent = '0';
                    document.getElementById('publicFollowersCount').textContent = '0';
                    document.getElementById('publicFollowingCount').textContent = '0';
                    publicPostsContainer.innerHTML = '<p class="no-posts">No posts found for this user.</p>';

                    // Hide action buttons if user not found
                    if (!isOwnProfilePage) {
                        document.getElementById('followToggleButton').style.display = 'none';
                        document.getElementById('messageButton').style.display = 'none';
                        document.getElementById('goToMyProfileButton').style.display = 'none';
                    }
                } else {
                    // For own profile page errors
                    displayFormMessage(document.getElementById('profileMessage'), data.message, 'error');
                }
            }
        } catch (error) {
            console.error('Error fetching profile data:', error);
            if (!isOwnProfilePage) {
                document.getElementById('publicDisplayName').textContent = 'Error';
                document.getElementById('publicUsername').textContent = `@${usernameFromUrl}`;
                document.getElementById('publicBio').textContent = 'Could not load profile data.';
            } else {
                 displayFormMessage(document.getElementById('profileMessage'), 'Failed to load profile data.', 'error');
            }
        }
    };


    // --- My Profile Page Specific Logic ---
    if (isOwnProfilePage) {
        const editProfileButton = document.getElementById('editProfileButton');
        const profileSettingsPanel = document.getElementById('profileSettingsPanel');
        const editProfileForm = document.getElementById('editProfileForm');
        const profileMessage = document.getElementById('profileMessage');
        const changePasswordForm = document.getElementById('changePasswordForm');
        const passwordMessage = document.getElementById('passwordMessage');
        const removeProfilePictureCheckbox = document.getElementById('removeProfilePicture');
        const logoutButtonSidebar = document.getElementById('logout-button-sidebar');
        const logoutButtonPanel = document.getElementById('logoutButtonPanel'); // Corrected ID
        const deleteAccountButton = document.getElementById('deleteAccountButton');


        // Toggle visibility of the settings panel (Edit Profile & Change Password sections)
        editProfileButton.addEventListener('click', () => {
            if (profileSettingsPanel.style.display === 'none' || profileSettingsPanel.style.display === '') {
                profileSettingsPanel.style.display = 'flex'; // Use flex for column layout
                editProfileButton.textContent = 'Hide Settings';
                editProfileButton.style.backgroundColor = '#ffc107'; // Yellow for hide
                editProfileButton.style.color = '#333';
            } else {
                profileSettingsPanel.style.display = 'none';
                editProfileButton.textContent = 'Edit Profile';
                editProfileButton.style.backgroundColor = '#607D8B'; // Grey-blue for edit
                editProfileButton.style.color = 'white';
            }
        });

        // Handle profile update form submission
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormMessage(profileMessage);

            const formData = new FormData(editProfileForm); // Use FormData for file upload

            // If removeProfilePicture is checked, send this flag
            if (!removeProfilePictureCheckbox.checked) {
                // If the user didn't select a new file and didn't check 'remove',
                // we should remove the 'profilePicture' field from formData
                // so that it doesn't send an empty file or overwrite with empty string
                if (formData.get('profilePicture') && formData.get('profilePicture').size === 0) {
                    formData.delete('profilePicture');
                }
            } else {
                formData.set('removeProfilePicture', 'true');
                formData.delete('profilePicture'); // Ensure no file is sent with remove request
            }

            try {
                const response = await fetch('/api/profile/me', {
                    method: 'POST',
                    body: formData, // Multer handles multipart/form-data
                });

                const data = await response.json();

                if (data.success) {
                    displayFormMessage(profileMessage, data.message, 'success');
                    fetchProfileData(); // Reload profile data to reflect changes
                    // Reset file input and checkbox
                    document.getElementById('profilePictureFile').value = ''; // Clear file input
                    removeProfilePictureCheckbox.checked = false;
                } else {
                    displayFormMessage(profileMessage, data.message || 'Failed to update profile.', 'error');
                    if (data.errors) {
                         // Display validation errors below fields
                        data.errors.forEach(err => {
                            // Find the correct input element
                            const inputEl = document.getElementById(err.path === 'profilePicture' ? 'profilePictureFile' : err.path);
                            if (inputEl) {
                                let errorSpan = inputEl.nextElementSibling;
                                if (!errorSpan || !errorSpan.classList.contains('error-message')) {
                                    errorSpan = document.createElement('span');
                                    errorSpan.className = 'error-message';
                                    inputEl.parentNode.appendChild(errorSpan);
                                }
                                errorSpan.textContent = err.msg;
                                errorSpan.style.display = 'block';
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                displayFormMessage(profileMessage, 'An unexpected error occurred during profile update.', 'error');
            }
        });

        // Clear errors on input change for dynamic validation
        editProfileForm.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', () => {
                const errorSpan = input.nextElementSibling;
                if (errorSpan && errorSpan.classList.contains('error-message')) {
                    errorSpan.textContent = '';
                    errorSpan.style.display = 'none';
                }
            });
        });

        // Handle password change form submission
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormMessage(passwordMessage);

            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (newPassword !== confirmNewPassword) {
                displayFormMessage(passwordMessage, 'New passwords do not match.', 'error');
                return;
            }

            try {
                const response = await fetch('/api/profile/me/password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
                });
                const data = await response.json();

                if (data.success) {
                    displayFormMessage(passwordMessage, data.message, 'success');
                    changePasswordForm.reset(); // Clear form fields
                } else {
                    displayFormMessage(passwordMessage, data.message || 'Failed to change password.', 'error');
                }
            } catch (error) {
                console.error('Error changing password:', error);
                displayFormMessage(passwordMessage, 'An unexpected error occurred during password change.', 'error');
            }
        });

        // Handle delete account button
        deleteAccountButton.addEventListener('click', () => {
            // In a real application, you would show a confirmation modal here
            const confirmDelete = confirm("Are you sure you want to delete your account? This action cannot be undone.");
            if (confirmDelete) {
                alert("Account deletion functionality is not yet implemented.");
                // Here you would make an API call to delete the account
                // e.g., fetch('/api/profile/me', { method: 'DELETE' });
            }
        });


        // Handle logout buttons
        const handleLogout = async () => {
            try {
                const response = await fetch('/auth/logout', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/login.html'; // Redirect to login page after logout
                } else {
                    displayFormMessage(profileMessage, 'Logout failed: ' + data.message, 'error');
                }
            } catch (error) {
                console.error('Logout failed:', error);
                displayFormMessage(profileMessage, 'An error occurred during logout.', 'error');
            }
        };

        if (logoutButtonSidebar) {
            logoutButtonSidebar.addEventListener('click', handleLogout);
        }
        if (logoutButtonPanel) {
            logoutButtonPanel.addEventListener('click', handleLogout);
        }

    }


    // --- Public Profile Page Specific Logic ---
    const handleFollowToggle = async (targetUsername) => {
        try {
            const response = await fetch(`/api/profile/${targetUsername}/toggle-follow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json();

            if (data.success) {
                // Re-fetch profile data to update follow button and counts dynamically
                fetchProfileData();
            } else {
                // Use a proper notification system here instead of alert
                alert(data.message);
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            // Use a proper notification system here instead of alert
            alert('An unexpected error occurred. Failed to update follow status.');
        }
    };


    // Initial data fetch call for both profile types
    fetchProfileData();
});
