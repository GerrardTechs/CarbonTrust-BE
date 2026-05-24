const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  buyerCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  buyerName: { type: String, required: true },
  pricePerTon: { type: Number, required: true },
  volume: { type: Number, default: 1 }, // tons
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  note: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);
