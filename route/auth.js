// route/auth.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const userLogic = require('../logic/userLogic');
const db = require('../database/database'); // Unified database handler

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to calculate age from birthday
const calculateAge = (birthday) => {
    const dob = new Date(birthday);
    const diff_ms = Date.now() - dob.getTime();
    const age_dt = new Date(diff_ms);
    return Math.abs(age_dt.getUTCFullYear() - 1970);
};

// --- Signup Route ---
router.post(
    '/signup',
    [
        body('username')
            .trim()
            .isLength({ min: 3 })
            .withMessage('Username must be at least 3 characters long.')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers, and underscores.'),
        body('firstName').trim().notEmpty().withMessage('First name is required.'),
        body('lastName').trim().notEmpty().withMessage('Last name is required.'),
        body('email').isEmail().withMessage('Please enter a valid email address.').normalizeEmail(),
        body('birthday')
            .isISO8601()
            .toDate()
            .withMessage('Invalid birthday format. Use YYYY-MM-DD.')
            .custom((value) => {
                if (calculateAge(value) < 15) {
                    throw new Error('You must be at least 15 years old to sign up.');
                }
                return true;
            }),
        body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender selected.'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long.'),
        body('confirmPassword').custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match.');
            }
            return true;
        }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { username, firstName, lastName, email, birthday, gender, password } = req.body;

        try {
            // Check if username or email already exists (real-time check)
            const existingUserByUsername = await db.getUser(username);
            if (existingUserByUsername) {
                return res.status(409).json({ success: false, message: 'Username already taken.' });
            }
            const existingUserByEmail = await db.findUserByIdentifier(email);
            if (existingUserByEmail) {
                return res.status(409).json({ success: false, message: 'Email already registered.' });
            }

            const hashedPassword = await userLogic.hashPassword(password);
            const verificationCode = userLogic.generateCode(6);
            const verificationCodeExpires = new Date(Date.now() + 60 * 1000); // 1 minute from now

            const newUser = {
                username,
                firstName,
                lastName,
                email,
                birthday,
                gender,
                password: hashedPassword,
                isVerified: false,
                verificationCode,
                verificationCodeExpires,
                createdAt: new Date(),
            };

            const savedUser = await db.saveUser(newUser); // Save user to DB

            // Send verification email
            await userLogic.sendVerificationEmail(
                email,
                verificationCode,
                'Bhabo Account Verification',
                'Thank you for signing up for Bhabo! Please use the following code to verify your account:'
            );

            res.status(201).json({
                success: true,
                message: 'Signup successful! Please check your email for a verification code.',
                userId: savedUser._id || savedUser.username // Use _id for Mongo, username for local
            });

        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ success: false, message: 'Server error during signup.' });
        }
    }
);

// --- Login Route ---
router.post('/login', async (req, res) => {
    const { identifier, password, rememberMe } = req.body; // identifier can be username or email

    try {
        const user = await userLogic.findUserByIdentifier(identifier);

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await userLogic.comparePassword(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials.' });
        }

        if (!user.isVerified) {
            // If not verified, send a new code and redirect to verification page
            const newVerificationCode = userLogic.generateCode(6);
            const newVerificationCodeExpires = new Date(Date.now() + 60 * 1000); // 1 minute from now

            await db.updateUser(user._id || user.username, { // Use _id for Mongo, username for local
                verificationCode: newVerificationCode,
                verificationCodeExpires: newVerificationCodeExpires,
            });

            await userLogic.sendVerificationEmail(
                user.email,
                newVerificationCode,
                'Bhabo Account Verification',
                'Your account is not verified. Please use the following code to verify your account:'
            );

            return res.status(403).json({
                success: false,
                message: 'Account not verified. A new verification code has been sent to your email.',
                redirectTo: '/verify.html',
                userId: user._id || user.username
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id || user.username, username: user.username }, // Use _id for Mongo, username for local
            JWT_SECRET,
            { expiresIn: rememberMe ? '7d' : '1h' } // 7 days if rememberMe, 1 hour otherwise
        );

        // Set token in a http-only cookie
        res.cookie('bhabo_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
            maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 7 days or 1 hour
            sameSite: 'Lax', // Protects against CSRF
        });

        res.json({ success: true, message: 'Login successful!', redirectTo: '/' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login.' });
    }
});

// --- Verification Route ---
router.post('/verify', async (req, res) => {
    const { userId, code } = req.body; // userId can be actual ID or username from signup response

    try {
        const user = await db.getUserById(userId); // Use getUserById which handles both mongo and local

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'Account already verified.' });
        }

        if (user.verificationCode !== code) {
            return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }

        if (new Date() > new Date(user.verificationCodeExpires)) {
            // Code expired, generate new one and prompt user to retry
            const newVerificationCode = userLogic.generateCode(6);
            const newVerificationCodeExpires = new Date(Date.now() + 60 * 1000); // 1 minute from now

            await db.updateUser(user._id || user.username, { // Use _id for Mongo, username for local
                verificationCode: newVerificationCode,
                verificationCodeExpires: newVerificationCodeExpires,
            });

            await userLogic.sendVerificationEmail(
                user.email,
                newVerificationCode,
                'Bhabo Account Verification - New Code',
                'Your previous verification code has expired. A new code has been sent to your email.'
            );

            return res.status(400).json({
                success: false,
                message: 'Verification code expired. A new code has been sent to your email.',
                redirectTo: '/verify.html', // Keep them on verify page
                userId: user._id || user.username
            });
        }

        // Verification successful
        await db.updateUser(user._id || user.username, { // Use _id for Mongo, username for local
            isVerified: true,
            verificationCode: null,
            verificationCodeExpires: null,
        });

        // Auto-login after successful verification
        const token = jwt.sign(
            { userId: user._id || user.username, username: user.username },
            JWT_SECRET,
            { expiresIn: '7d' } // Auto-login for 7 days
        );

        res.cookie('bhabo_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'Lax',
        });

        res.json({ success: true, message: 'Account verified and logged in!', redirectTo: '/' });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during verification.' });
    }
});

// --- Forgot Password Request Route ---
router.post('/forgot-password', async (req, res) => {
    const { identifier } = req.body; // username or email

    try {
        const user = await userLogic.findUserByIdentifier(identifier);

        if (!user) {
            // For security, don't reveal if user exists or not
            return res.status(200).json({ success: true, message: 'If an account with that identifier exists, a password reset code has been sent.' });
        }

        const resetCode = userLogic.generateCode(8);
        const resetCodeExpires = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

        await db.updateUser(user._id || user.username, { // Use _id for Mongo, username for local
            resetPasswordCode: resetCode,
            resetPasswordCodeExpires: resetCodeExpires,
        });

        await userLogic.sendVerificationEmail(
            user.email,
            resetCode,
            'Bhabo Password Reset',
            'You have requested a password reset. Please use the following code to reset your password:'
        );

        res.json({
            success: true,
            message: 'Password reset code sent to your email.',
            userId: user._id || user.username // Pass userId to the client for the reset page
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset request.' });
    }
});

// --- Reset Password Route ---
router.post('/reset-password', async (req, res) => {
    const { userId, code, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ success: false, message: 'New passwords do not match.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long.' });
    }

    try {
        const user = await db.getUserById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.resetPasswordCode !== code) {
            return res.status(400).json({ success: false, message: 'Invalid reset code.' });
        }

        if (new Date() > new Date(user.resetPasswordCodeExpires)) {
            return res.status(400).json({ success: false, message: 'Reset code expired. Please request a new one.' });
        }

        const hashedPassword = await userLogic.hashPassword(newPassword);

        await db.updateUser(user._id || user.username, { // Use _id for Mongo, username for local
            password: hashedPassword,
            resetPasswordCode: null,
            resetPasswordCodeExpires: null,
        });

        res.json({ success: true, message: 'Password reset successfully! You can now log in.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error during password reset.' });
    }
});

// --- Logout Route ---
router.post('/logout', (req, res) => {
    res.clearCookie('bhabo_token'); // Clear the JWT cookie
    res.json({ success: true, message: 'Logged out successfully!' });
});


module.exports = router;
