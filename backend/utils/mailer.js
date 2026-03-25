const nodemailer = require('nodemailer');

// Debug logging for environment variables (Safe for production)
if (process.env.NODE_ENV === 'development') {
  console.log('--- Email Configuration Debug ---');
  console.log('EMAIL_USER loaded:', !!process.env.EMAIL_USER);
  console.log('EMAIL_PASS loaded:', !!process.env.EMAIL_PASS);
  if (process.env.EMAIL_USER) {
    console.log('EMAIL_USER value exists (length):', process.env.EMAIL_USER.length);
  }
  console.log('---------------------------------');
}

const getTransporter = () => {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').trim();

  if (!user || !pass || user === 'your-email@gmail.com' || pass === 'your-app-password') {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
  });
};

const sendOTP = async (email, otp) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.error('Email service not configured: EMAIL_USER or EMAIL_PASS missing/invalid in .env');
    throw new Error('Email service not configured. Please contact support or check your environment variables.');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Verification Code',
    text: `Your OTP for email verification is: ${otp}. It is valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4CAF50; text-align: center;">Email Verification</h2>
        <p>Hello,</p>
        <p>Your verification code for <strong>SkillSwap</strong> is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 15px; background-color: #f9f9f9; display: inline-block; border-radius: 8px; border: 1px solid #ddd; color: #333;">
            ${otp}
          </div>
        </div>
        <p>This code is <strong>valid for 10 minutes</strong>. For security, please do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message, please do not reply.</p>
        <p style="font-size: 12px; color: #777; text-align: center;">Best regards,<br>SkillSwap Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV === 'development') {
      console.log('Email sent successfully:', info.messageId);
    }
    return info;
  } catch (error) {
    console.error('Nodemailer Error:', error.message);
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check if your App Password is correct.');
    }
    throw new Error('Failed to send verification email. Email service temporarily unavailable.');
  }
};

const sendResetOTP = async (email, otp) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.error('Email service not configured: EMAIL_USER or EMAIL_PASS missing/invalid in .env');
    throw new Error('Email service not configured. Please contact support or check your environment variables.');
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Verification Code',
    text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4CAF50; text-align: center;">Password Reset</h2>
        <p>Hello,</p>
        <p>Your verification code to reset your password is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 15px; background-color: #f9f9f9; display: inline-block; border-radius: 8px; border: 1px solid #ddd; color: #333;">
            ${otp}
          </div>
        </div>
        <p>This code is <strong>valid for 10 minutes</strong>. For security, please do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #777; text-align: center;">This is an automated message, please do not reply.</p>
        <p style="font-size: 12px; color: #777; text-align: center;">Best regards,<br>SkillSwap Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV === 'development') {
      console.log('Reset email sent successfully:', info.messageId);
    }
    return info;
  } catch (error) {
    console.error('Nodemailer Error:', error.message);
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check if your App Password is correct.');
    }
    throw new Error('Failed to send reset email. Email service temporarily unavailable.');
  }
};

module.exports = { sendOTP, sendResetOTP };
