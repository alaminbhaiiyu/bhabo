// web/./js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    const messageBox = document.getElementById('messageBox');

    // Helper function to display messages
    const displayMessage = (message, type) => {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = 'block';
    };

    // Helper function to clear messages
    const clearMessages = () => {
        messageBox.textContent = '';
        messageBox.className = 'message-box';
        messageBox.style.display = 'none';
    };

    // Helper to display input-specific errors
    const displayInputError = (inputId, message) => {
        const errorSpan = document.getElementById(`${inputId}Error`);
        if (errorSpan) {
            errorSpan.textContent = message;
            errorSpan.style.display = 'block';
        }
    };

    // Helper to clear input-specific errors
    const clearInputError = (inputId) => {
        const errorSpan = document.getElementById(`${inputId}Error`);
        if (errorSpan) {
            errorSpan.textContent = '';
            errorSpan.style.display = 'none';
        }
    };

    // --- Login Form Handling ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessages();

            const identifier = document.getElementById('identifier').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password, rememberMe }),
                });

                const data = await response.json();

                if (data.success) {
                    displayMessage(data.message, 'success');
                    setTimeout(() => {
                        window.location.href = data.redirectTo || '/';
                    }, 1000);
                } else {
                    displayMessage(data.message, 'error');
                    if (data.redirectTo === '/verify.html' && data.userId) {
                        // Store userId in session storage for verification page
                        sessionStorage.setItem('unverifiedUserId', data.userId);
                        setTimeout(() => {
                            window.location.href = data.redirectTo;
                        }, 1000);
                    }
                }
            } catch (error) {
                console.error('Login request failed:', error);
                displayMessage('An unexpected error occurred. Please try again.', 'error');
            }
        });
    }

    // --- Signup Form Handling ---
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        // Real-time validation for username and email (can be expanded)
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const birthdayInput = document.getElementById('birthday');

        const validateUsername = () => {
            const username = usernameInput.value.trim();
            if (username.length < 3) {
                displayInputError('username', 'Username must be at least 3 characters.');
                return false;
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                displayInputError('username', 'Username can only contain letters, numbers, and underscores.');
                return false;
            }
            clearInputError('username');
            return true;
        };

        const validateEmail = () => {
            const email = emailInput.value.trim();
            if (!/\S+@\S+\.\S+/.test(email)) {
                displayInputError('email', 'Please enter a valid email address.');
                return false;
            }
            clearInputError('email');
            return true;
        };

        const validatePassword = () => {
            const password = passwordInput.value;
            if (password.length < 8) {
                displayInputError('password', 'Password must be at least 8 characters long.');
                return false;
            }
            clearInputError('password');
            return true;
        };

        const validateConfirmPassword = () => {
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            if (password !== confirmPassword) {
                displayInputError('confirmPassword', 'Passwords do not match.');
                return false;
            }
            clearInputError('confirmPassword');
            return true;
        };

        const calculateAge = (birthday) => {
            const dob = new Date(birthday);
            const diff_ms = Date.now() - dob.getTime();
            const age_dt = new Date(diff_ms);
            return Math.abs(age_dt.getUTCFullYear() - 1970);
        };

        const validateBirthday = () => {
            const birthday = birthdayInput.value;
            if (!birthday) {
                displayInputError('birthday', 'Birthday is required.');
                return false;
            }
            if (calculateAge(birthday) < 15) {
                displayInputError('birthday', 'You must be at least 15 years old.');
                return false;
            }
            clearInputError('birthday');
            return true;
        };


        usernameInput.addEventListener('input', validateUsername);
        emailInput.addEventListener('input', validateEmail);
        passwordInput.addEventListener('input', validatePassword);
        confirmPasswordInput.addEventListener('input', validateConfirmPassword);
        birthdayInput.addEventListener('change', validateBirthday); // Use change for date input

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessages();

            // Run all validations on submit
            const isUsernameValid = validateUsername();
            const isEmailValid = validateEmail();
            const isPasswordValid = validatePassword();
            const isConfirmPasswordValid = validateConfirmPassword();
            const isBirthdayValid = validateBirthday();
            const isFirstNameValid = document.getElementById('firstName').value.trim() !== '';
            const isLastNameValid = document.getElementById('lastName').value.trim() !== '';
            const isGenderValid = document.getElementById('gender').value.trim() !== '';

            if (!isUsernameValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid ||
                !isBirthdayValid || !isFirstNameValid || !isLastNameValid || !isGenderValid) {
                displayMessage('Please correct the errors in the form.', 'error');
                return;
            }

            const formData = {
                username: usernameInput.value,
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: emailInput.value,
                birthday: birthdayInput.value,
                gender: document.getElementById('gender').value,
                password: passwordInput.value,
                confirmPassword: confirmPasswordInput.value,
            };

            try {
                const response = await fetch('/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });

                const data = await response.json();

                if (data.success) {
                    displayMessage(data.message, 'success');
                    // Store userId for verification page
                    sessionStorage.setItem('unverifiedUserId', data.userId);
                    setTimeout(() => {
                        window.location.href = '/verify.html';
                    }, 2000); // Redirect after a short delay
                } else {
                    if (data.errors) {
                        data.errors.forEach(err => {
                            // Map server-side errors to client-side input fields
                            if (err.path) {
                                displayInputError(err.path, err.msg);
                            } else {
                                displayMessage(err.msg, 'error');
                            }
                        });
                    } else {
                        displayMessage(data.message, 'error');
                    }
                }
            } catch (error) {
                console.error('Signup request failed:', error);
                displayMessage('An unexpected error occurred. Please try again.', 'error');
            }
        });
    }

    // --- Verification Form Handling ---
    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm) {
        // Populate userId from session storage if available (from signup/login redirect)
        const storedUserId = sessionStorage.getItem('unverifiedUserId');
        const userIdInput = document.getElementById('userId');
        if (storedUserId) {
            userIdInput.value = storedUserId;
        } else {
            // If no userId in session, user might have come directly.
            // In a real app, you might want to prompt them to log in first.
            displayMessage('Please log in or sign up to verify your account.', 'error');
            // Optionally redirect to login after a delay
            // setTimeout(() => { window.location.href = '/login.html'; }, 3000);
        }

        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessages();

            const code = document.getElementById('code').value;
            const userId = document.getElementById('userId').value; // Get userId from hidden input

            if (!userId) {
                displayMessage('User ID is missing. Please log in or sign up again.', 'error');
                return;
            }

            try {
                const response = await fetch('/auth/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code }),
                });

                const data = await response.json();

                if (data.success) {
                    displayMessage(data.message, 'success');
                    sessionStorage.removeItem('unverifiedUserId'); // Clear stored ID
                    setTimeout(() => {
                        window.location.href = data.redirectTo || '/';
                    }, 1000);
                } else {
                    displayMessage(data.message, 'error');
                    if (data.redirectTo === '/verify.html' && data.userId) {
                        // If code expired and new one sent, update userId just in case
                        sessionStorage.setItem('unverifiedUserId', data.userId);
                    }
                }
            } catch (error) {
                console.error('Verification request failed:', error);
                displayMessage('An unexpected error occurred. Please try again.', 'error');
            }
        });

        // Resend Code functionality
        const resendCodeLink = document.getElementById('resendCode');
        if (resendCodeLink && storedUserId) {
            resendCodeLink.addEventListener('click', async (e) => {
                e.preventDefault();
                clearMessages();
                const userId = document.getElementById('userId').value;

                if (!userId) {
                    displayMessage('Cannot resend code. User ID is missing.', 'error');
                    return;
                }

                try {
                    // This assumes a 'resend-verification' endpoint or similar,
                    // but for now, we'll just re-trigger the login flow which sends a new code
                    // if the user is unverified. A dedicated resend endpoint would be better.
                    // For simplicity, we'll tell the user to try logging in again.
                    displayMessage('Please try logging in again. A new verification code will be sent if your account is unverified.', 'info');
                    // In a real app, you'd have a dedicated /auth/resend-verification route.
                    // For now, we'll just guide the user.
                    // Example: await fetch('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ userId }) });
                } catch (error) {
                    console.error('Resend code failed:', error);
                    displayMessage('Failed to resend code. Please try again later.', 'error');
                }
            });
        }
    }

    // --- Forgot Password Form Handling ---
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessages();

            const identifier = document.getElementById('identifier').value;

            try {
                const response = await fetch('/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier }),
                });

                const data = await response.json();

                if (data.success) {
                    displayMessage(data.message, 'success');
                    if (data.userId) {
                        sessionStorage.setItem('resetPasswordUserId', data.userId);
                        setTimeout(() => {
                            window.location.href = '/reset-password.html';
                        }, 2000);
                    }
                } else {
                    displayMessage(data.message, 'error');
                }
            } catch (error) {
                console.error('Forgot password request failed:', error);
                displayMessage('An unexpected error occurred. Please try again.', 'error');
            }
        });
    }

    // --- Reset Password Form Handling ---
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        const storedUserId = sessionStorage.getItem('resetPasswordUserId');
        const userIdInput = document.getElementById('userId');
        if (storedUserId) {
            userIdInput.value = storedUserId;
        } else {
            displayMessage('Please request a password reset code first.', 'error');
            // Optionally redirect to forgot password page
            // setTimeout(() => { window.location.href = '/forgot-password.html'; }, 3000);
        }

        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearMessages();

            const userId = document.getElementById('userId').value;
            const code = document.getElementById('code').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmNewPassword = document.getElementById('confirmNewPassword').value;

            if (!userId) {
                displayMessage('User ID is missing. Please request a password reset again.', 'error');
                return;
            }

            if (newPassword !== confirmNewPassword) {
                displayMessage('New passwords do not match.', 'error');
                return;
            }
            if (newPassword.length < 8) {
                displayMessage('New password must be at least 8 characters long.', 'error');
                return;
            }

            try {
                const response = await fetch('/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, code, newPassword, confirmNewPassword }),
                });

                const data = await response.json();

                if (data.success) {
                    displayMessage(data.message, 'success');
                    sessionStorage.removeItem('resetPasswordUserId'); // Clear stored ID
                    setTimeout(() => {
                        window.location.href = '/login.html'; // Redirect to login after successful reset
                    }, 2000);
                } else {
                    displayMessage(data.message, 'error');
                }
            } catch (error) {
                console.error('Reset password request failed:', error);
                displayMessage('An unexpected error occurred. Please try again.', 'error');
            }
        });
    }

    // --- Logout Functionality (add to your main app's script.js or a dedicated logout button) ---
    // Example: If you have a logout button on your main page
    const logoutButton = document.getElementById('logout-button'); // Assuming you add this button in index.html
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/logout', { method: 'POST' });
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/login.html'; // Redirect to login page after logout
                } else {
                    alert('Logout failed: ' + data.message); // Use a custom message box instead of alert in production
                }
            } catch (error) {
                console.error('Logout failed:', error);
                alert('An error occurred during logout.'); // Use a custom message box
            }
        });
    }

    // Initial redirect check for home page
    // This is handled by server.js now, but good to have client-side fallback
    // if (window.location.pathname === '/') {
    //     // If on home page, and no token, redirect to login
    //     // This is now primarily handled by the `authenticateToken` middleware in server.js
    //     // but client-side JS can also react to server redirects.
    // }
});
