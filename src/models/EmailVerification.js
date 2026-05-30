const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  token: { type: String, required: true, unique: true },
  role: { type: String, enum: ['company', 'landlord'], required: true },
  payload: { type: Object, required: true },
  verified: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

emailVerificationSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { verified: false } });

module.exports = mongoose.model('EmailVerification', emailVerificationSchema);
