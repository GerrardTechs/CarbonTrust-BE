const mongoose = require('mongoose');

const emissionRecordSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  method: { type: String, enum: ['operational', 'equity'], default: 'operational' },
  equityPct: { type: Number },
  scope1: { type: Number },
  scope2: { type: Number },
  scope3: { type: Number },
  total: { type: Number },
  leakage: { type: Number },
  creditsNeeded: { type: Number },
  breakdown: [
    {
      key: String,
      source: String,
      val: Number,
      unit: String,
      ef: Number,
      emission: Number,
      scope: Number,
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model('EmissionRecord', emissionRecordSchema);
