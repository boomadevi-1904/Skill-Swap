const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  points: { type: Number, default: 0 },
  contact: { type: String, trim: true },
  isVerified: { type: Boolean, default: false },
  otp: {
    code: String, // Will store hashed OTP
    expiry: Date,
    lastSent: Date
  },
  resetPasswordOtp: {
    code: String, // Will store hashed OTP
    expiry: Date,
    lastSent: Date
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.compareOTP = function (candidate, type = 'signup') {
  const otpData = type === 'signup' ? this.otp : this.resetPasswordOtp;
  if (!otpData || !otpData.code) return false;
  return bcrypt.compare(candidate, otpData.code);
};

userSchema.methods.setOTP = async function (code, type = 'signup') {
  const hashedCode = await bcrypt.hash(code, 10);
  const data = {
    code: hashedCode,
    expiry: new Date(Date.now() + 10 * 60 * 1000), // 10 mins
    lastSent: new Date()
  };
  if (type === 'signup') {
    this.otp = data;
  } else {
    this.resetPasswordOtp = data;
  }
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
