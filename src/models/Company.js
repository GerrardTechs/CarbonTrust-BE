const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  companyId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['company', 'landlord', 'admin'], default: 'company' },
  companyType: { type: String },
  position: { type: String },
  phone: { type: String },
  officeAddress: { type: String },
  siteAddress: { type: String },
  location: { type: String },
  emissionObject: { type: String },
  institutionId: { type: String },
  walletId: { type: String, unique: true },
  walletGenerated: { type: Boolean, default: true },
  esgScore: { type: Number, default: 0 },
  esgStatus: { type: String, default: 'unrated' },
  isoCertVerified: { type: Boolean, default: false },
  isoCertAiVerification: { type: mongoose.Schema.Types.Mixed, default: null },
  isoCertPath: { type: String },
  ownershipCertPath: { type: String },
  equityPct: { type: Number },
  calcMethod: { type: String },
  ghgInventoryPath: { type: String },
  carbonRemovalPath: { type: String },
  contactName: { type: String },
  emailVerified: { type: Boolean, default: false },
  stockData: {
    symbol: String,
    price: Number,
    prevPrice: Number,
    updatedAt: Date
  },
  totalTransactions: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
