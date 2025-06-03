// web/create_post.js
document.addEventListener('DOMContentLoaded', () => {
    const createPostForm = document.getElementById('createPostForm');
    const postContentInput = document.getElementById('postContent');
    const postMediaFileInput = document.getElementById('postMediaFile');
    const postMediaPreview = document.getElementById('postMediaPreview');
    const postImagePreview = document.getElementById('postImagePreview');
    const postVideoPreview = document.getElementById('postVideoPreview');
    const removeMediaButton = document.getElementById('removeMediaButton');
    const postMessage = document.getElementById('postMessage');
    const logoutButtonSidebar = document.getElementById('logout-button-sidebar'); // Assuming this ID is consistent

    // --- Helper Functions ---

    const displayMessage = (messageEl, message, type) => {
        messageEl.textContent = message;
        messageEl.className = `message-box ${type}`;
        messageEl.style.display = 'block';
    };

    const clearMessage = (messageEl) => {
        messageEl.textContent = '';
        messageEl.className = 'message-box';
        messageEl.style.display = 'none';
    };

    const showMediaPreview = (file) => {
        postMediaPreview.style.display = 'block';
        if (file.type.startsWith('image/')) {
            postImagePreview.src = URL.createObjectURL(file);
            postImagePreview.style.display = 'block';
            postVideoPreview.style.display = 'none';
        } else if (file.type.startsWith('video/')) {
            postVideoPreview.src = URL.createObjectURL(file);
            postVideoPreview.style.display = 'block';
            postImagePreview.style.display = 'none';
        }
    };

    const hideMediaPreview = () => {
        postMediaPreview.style.display = 'none';
        postImagePreview.src = '';
        postImagePreview.style.display = 'none';
        postVideoPreview.src = '';
        postVideoPreview.style.display = 'none';
        postMediaFileInput.value = ''; // Clear the file input
    };

    // --- Event Listeners ---

    // Media file input change
    postMediaFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            showMediaPreview(file);
        } else {
            hideMediaPreview();
        }
    });

    // Remove media button
    removeMediaButton.addEventListener('click', hideMediaPreview);

    // Create Post Form Submission
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearMessage(postMessage);

        const content = postContentInput.value.trim();
        const mediaFile = postMediaFileInput.files[0];

        if (!content && !mediaFile) {
            displayMessage(postMessage, 'Please enter a caption or upload a photo/video.', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('content', content);
        if (mediaFile) {
            formData.append('mediaFile', mediaFile);
        }

        try {
            const response = await fetch('/api/posts/create', {
                method: 'POST',
                body: formData, // Multer handles multipart/form-data
            });

            const data = await response.json();

            if (data.success) {
                displayMessage(postMessage, data.message, 'success');
                createPostForm.reset(); // Clear form
                hideMediaPreview(); // Clear media preview
                // Optionally redirect to home page after successful post
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            } else {
                displayMessage(postMessage, data.message || 'Failed to create post.', 'error');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            displayMessage(postMessage, 'An unexpected error occurred while creating post.', 'error');
        }
    });

    // Logout button handler (from sidebar)
    if (logoutButtonSidebar) {
        logoutButtonSidebar.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/logout', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/login.html';
                } else {
                    // Use a more robust message display if not on a form
                    alert('Logout failed: ' + data.message);
                }
            } catch (error) {
                console.error('Logout failed:', error);
                alert('An error occurred during logout.');
            }
        });
    }
});
