const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    deviceLabel: String,
    ip: String,
    userAgent: String,
    loginAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: null },
    phoneVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    role: {
      type: String,
      enum: ['user', 'support_agent', 'evidence_reviewer', 'security_reviewer', 'super_admin'],
      default: 'user'
    },
    isAnonymous: { type: Boolean, default: false },
    sessions: [sessionSchema],
    loginHistory: [
      {
        ip: String,
        userAgent: String,
        at: { type: Date, default: Date.now },
        success: Boolean
      }
    ],
    consent: {
      privacyPolicyAcceptedAt: Date,
      aiTrainingOptIn: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
