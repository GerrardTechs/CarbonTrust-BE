const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  parcelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parcel' },
  name: { type: String, required: true },
  type: { type: String },
  country: { type: String, default: 'Indonesia' },
  flag: { type: String, default: '🇮🇩' },
  pricePerTon: { type: Number, required: true },
  availableCredits: { type: Number, required: true },
  rating: { type: Number, default: 4.0 },
  ndvi: { type: Number, default: 0.70 },
  absRate: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'closed', 'draft'], default: 'active' },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
