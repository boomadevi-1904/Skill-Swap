const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendOTP, sendResetOTP } = require('../utils/mailer');

const router = express.Router();

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Rate limiting check (1 request per 60 seconds)
const checkOTPRateLimit = (user, type = 'signup') => {
  const otpData = type === 'signup' ? user.otp : user.resetPasswordOtp;
  if (otpData && otpData.lastSent) {
    const diff = Date.now() - new Date(otpData.lastSent).getTime();
    if (diff < 60 * 1000) {
      const remaining = Math.ceil((60 * 1000 - diff) / 1000);
      throw new Error(`Please wait ${remaining} seconds before requesting a new code.`);
    }
  }
};

// Signup - Initiate with OTP
router.post(
  '/signup',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['student', 'admin']).withMessage('Invalid role'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, email, password, role = 'student', contact } = req.body;
      
      let user = await User.findOne({ email });
      if (user) {
        if (user.isVerified) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        checkOTPRateLimit(user, 'signup');
        user.name = name;
        user.password = password;
        user.role = role;
        user.contact = contact;
      } else {
        user = new User({ name, email, password, role, contact, isVerified: false });
      }

      const otpCode = generateOTP();
      await sendOTP(email, otpCode);
      await user.setOTP(otpCode, 'signup');
      await user.save();
      
      res.status(user.isNew ? 201 : 200).json({ message: 'OTP sent to your email' });
    } catch (e) {
      res.status(e.message.includes('wait') ? 429 : 500).json({ error: e.message });
    }
  }
);

// Resend OTP for Signup
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'User is already verified' });

    checkOTPRateLimit(user, 'signup');

    const otpCode = generateOTP();
    await sendOTP(email, otpCode);
    await user.setOTP(otpCode, 'signup');
    await user.save();
    res.json({ message: 'OTP sent to your email' });
  } catch (e) {
    res.status(e.message.includes('wait') ? 429 : 500).json({ error: e.message });
  }
});

// Verify OTP for Signup
router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Invalid OTP format'),
  ],
  async (req, res) => {
    try {
      const { email, otp } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.isVerified) return res.status(400).json({ error: 'User is already verified' });
      
      if (!user.otp || user.otp.expiry < new Date()) {
        return res.status(400).json({ error: 'OTP has expired' });
      }

      const isValid = await user.compareOTP(otp, 'signup');
      if (!isValid) return res.status(400).json({ error: 'Invalid verification code' });

      user.isVerified = true;
      user.otp = undefined;
      await user.save();

      const token = generateToken(user._id);
      res.json({ message: 'Account verified successfully!', user: user.toJSON(), token });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Forgot Password - Initiate
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: 'Email not registered' });

      checkOTPRateLimit(user, 'reset');

      const otpCode = generateOTP();
      await sendResetOTP(email, otpCode);
      await user.setOTP(otpCode, 'reset');
      await user.save();
      res.json({ message: 'OTP sent to your email' });
    } catch (e) {
      res.status(e.message.includes('wait') ? 429 : 500).json({ error: e.message });
    }
  }
);

// Reset Password
router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Invalid OTP'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      if (!user.resetPasswordOtp || user.resetPasswordOtp.expiry < new Date()) {
        return res.status(400).json({ error: 'Reset code has expired' });
      }

      const isValid = await user.compareOTP(otp, 'reset');
      if (!isValid) return res.status(400).json({ error: 'Invalid reset code' });

      user.password = newPassword;
      user.resetPasswordOtp = undefined;
      await user.save();
      res.json({ message: 'Password reset successful!' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!user.isVerified) {
        return res.status(403).json({ error: 'Please verify your email first', email });
      }
      const token = generateToken(user._id);
      res.json({ user: user.toJSON(), token });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// Logout (Since we use Bearer tokens in headers, logout is handled by frontend, but we can provide a dummy endpoint)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
