// web/search.js
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const searchHistorySection = document.getElementById('searchHistorySection');
    const searchHistoryList = document.getElementById('searchHistoryList');
    const noHistoryMessage = document.getElementById('noHistoryMessage');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const accountResultsGrid = document.getElementById('accountResultsGrid');
    const imageResultsGrid = document.getElementById('imageResultsGrid');
    const noAccountResults = document.getElementById('noAccountResults');
    const noImageResults = document.getElementById('noImageResults');
    const searchNavButton = document.getElementById('search-nav-button');

    // New "Find Friends" elements
    const findFriendsSection = document.getElementById('findFriendsSection');
    const findFriendsGrid = document.getElementById('findFriendsGrid');
    const noFindFriendsMessage = document.getElementById('noFindFriendsMessage');

    const MAX_HISTORY_ITEMS = 6;
    const SEARCH_HISTORY_KEY = 'bhabo_search_history';

    // --- Helper Functions ---

    const displayMessage = (message, type) => {
        const msgBox = document.createElement('div');
        msgBox.textContent = message;
        msgBox.className = `message-box ${type}`;
        const mainContent = document.querySelector('.content');
        if (mainContent) {
            mainContent.prepend(msgBox);
            setTimeout(() => msgBox.remove(), 5000);
        }
    };

    const loadSearchHistory = () => {
        const history = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
        renderSearchHistory(history);
        return history;
    };

    const saveSearchQuery = (query) => {
        let history = loadSearchHistory();
        history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
        history.unshift(query);
        history = history.slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
        renderSearchHistory(history);
    };

    const renderSearchHistory = (history) => {
        if (!searchHistoryList || !noHistoryMessage || !searchHistorySection) {
            console.error("Search history elements not found in DOM.");
            return;
        }

        searchHistoryList.innerHTML = '';
        if (history.length === 0) {
            noHistoryMessage.style.display = 'block';
            searchHistorySection.style.display = 'none';
        } else {
            noHistoryMessage.style.display = 'none';
            searchHistorySection.style.display = 'block';
            history.forEach(query => {
                const li = document.createElement('li');
                li.textContent = query;
                li.addEventListener('click', () => {
                    if (searchInput) searchInput.value = query;
                    performSearch(query);
                });
                searchHistoryList.appendChild(li);
            });
        }
    };

    const renderSearchResults = (results) => {
        if (!searchResultsContainer || !accountResultsGrid || !imageResultsGrid || !noAccountResults || !noImageResults ||
            !document.getElementById('accountResultsSection') || !document.getElementById('imageResultsSection')) {
            console.error("Search result display elements not found in DOM.");
            return;
        }

        // Hide "Find Friends" section when search results are displayed
        findFriendsSection.style.display = 'none';
        searchResultsContainer.style.display = 'block';

        // Render Accounts
        accountResultsGrid.innerHTML = '';
        if (results.users && results.users.length > 0) {
            noAccountResults.style.display = 'none';
            results.users.forEach(user => {
                const userCard = document.createElement('a');
                userCard.href = `/@${user.username}`;
                userCard.className = 'search-result-card user-card';
                userCard.innerHTML = `
                    <img src="${user.profilePicture || '/images/default_profile.png'}" alt="${user.displayName || user.username}'s Profile" class="user-avatar">
                    <div class="user-info">
                        <h4>${user.displayName || `${user.firstName} ${user.lastName}`}</h4>
                        <p>@${user.username}</p>
                    </div>
                `;
                accountResultsGrid.appendChild(userCard);
            });
        } else {
            noAccountResults.style.display = 'block';
        }

        // Render Image Posts
        imageResultsGrid.innerHTML = '';
        if (results.imagePosts && results.imagePosts.length > 0) {
            noImageResults.style.display = 'none';
            results.imagePosts.forEach(post => {
                const postCard = document.createElement('div');
                postCard.className = 'search-result-card post-card';
                postCard.innerHTML = `
                    <img src="${post.imageUrl}" alt="Post Image">
                    <div class="post-content">
                        <p>${post.content ? post.content.substring(0, 100) + '...' : ''}</p>
                        <small>by @${post.username}</small>
                    </div>
                `;
                imageResultsGrid.appendChild(postCard);
            });
        } else {
            noImageResults.style.display = 'block';
        }

        document.getElementById('accountResultsSection').style.display = (results.users && results.users.length > 0) ? 'block' : 'none';
        document.getElementById('imageResultsSection').style.display = (results.imagePosts && results.imagePosts.length > 0) ? 'block' : 'none';

        if ((!results.users || results.users.length === 0) && (!results.imagePosts || results.imagePosts.length === 0)) {
            searchResultsContainer.innerHTML = '<p class="no-results-message">No results found for your search.</p>';
        }
    };

    // New: Render Find Friends Users
    const renderFindFriendsUsers = (users) => {
        if (!findFriendsGrid || !noFindFriendsMessage) {
            console.error("Find Friends elements not found in DOM.");
            return;
        }

        findFriendsGrid.innerHTML = '';
        if ((!users.onlineUsers || users.onlineUsers.length === 0) && (!users.offlineUsers || users.offlineUsers.length === 0)) {
            noFindFriendsMessage.style.display = 'block';
            findFriendsSection.style.display = 'none'; // Hide section if no users
            return;
        } else {
            noFindFriendsMessage.style.display = 'none';
            findFriendsSection.style.display = 'block'; // Show section
        }

        // Render Online Users first
        users.onlineUsers.forEach(user => {
            const userCard = document.createElement('a');
            userCard.href = `/@${user.username}`;
            userCard.className = `find-friend-card ${user.isOnline ? '' : 'offline'}`;
            userCard.innerHTML = `
                <div class="find-friend-avatar-wrapper">
                    <img src="${user.profilePicture || '/images/default_profile.png'}" alt="${user.displayName || user.username}" class="find-friend-avatar ${user.isOnline ? '' : 'offline'}">
                    <span class="find-friend-status-indicator" style="background-color: ${user.isOnline ? '#4CAF50' : '#999'};"></span>
                </div>
                <h4>${user.displayName || user.username}</h4>
                <p>@${user.username}</p>
            `;
            findFriendsGrid.appendChild(userCard);
        });

        // Then render Offline Users
        users.offlineUsers.forEach(user => {
            const userCard = document.createElement('a');
            userCard.href = `/@${user.username}`;
            userCard.className = `find-friend-card ${user.isOnline ? '' : 'offline'}`;
            userCard.innerHTML = `
                <div class="find-friend-avatar-wrapper">
                    <img src="${user.profilePicture || '/images/default_profile.png'}" alt="${user.displayName || user.username}" class="find-friend-avatar ${user.isOnline ? '' : 'offline'}">
                    <span class="find-friend-status-indicator" style="background-color: ${user.isOnline ? '#4CAF50' : '#999'};"></span>
                </div>
                <h4>${user.displayName || user.username}</h4>
                <p>@${user.username}</p>
            `;
            findFriendsGrid.appendChild(userCard);
        });
    };


    // --- Main Search Function ---
    const performSearch = async (query) => {
        if (!query || query.trim() === '') {
            displayMessage('Please enter a search query.', 'error');
            return;
        }

        displayMessage('Searching...', 'info');
        saveSearchQuery(query);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const data = await response.json();

            if (data.success) {
                renderSearchResults(data.results);
                displayMessage('Search complete!', 'success');
            } else {
                displayMessage(data.message || 'Search failed.', 'error');
                if (searchResultsContainer) {
                    searchResultsContainer.style.display = 'none';
                }
                findFriendsSection.style.display = 'block'; // Show find friends on search failure
            }
        } catch (error) {
            console.error('Search API call failed:', error);
            displayMessage('An unexpected error occurred during search.', 'error');
            if (searchResultsContainer) {
                searchResultsContainer.style.display = 'none';
            }
            findFriendsSection.style.display = 'block'; // Show find friends on API error
        }
    };

    // New: Fetch and display "Find Friends" users
    const fetchFindFriendsUsers = async () => {
        try {
            const response = await fetch('/api/search/find-friends');
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const data = await response.json();

            if (data.success) {
                renderFindFriendsUsers(data.users);
            } else {
                displayMessage(data.message || 'Failed to load friends suggestions.', 'error');
            }
        } catch (error) {
            console.error('Error fetching find friends users:', error);
            displayMessage('An unexpected error occurred while loading friends suggestions.', 'error');
        }
    };


    // --- Event Listeners ---

    searchButton.addEventListener('click', () => {
        if (searchInput) performSearch(searchInput.value);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value);
        }
    });

    if (searchNavButton) {
        searchNavButton.addEventListener('click', () => {
            if (searchInput) searchInput.focus();
            const contentElement = document.querySelector('.content');
            if (contentElement) {
                contentElement.scrollTo({ top: 0, behavior: 'smooth' });
            }
            // Ensure search results are hidden and find friends is visible when navigating to search page
            if (searchResultsContainer) searchResultsContainer.style.display = 'none';
            if (findFriendsSection) findFriendsSection.style.display = 'block';
            fetchFindFriendsUsers(); // Re-fetch find friends list
        });
    }

    // Initial load: Load search history and find friends users
    loadSearchHistory();
    fetchFindFriendsUsers();
});
