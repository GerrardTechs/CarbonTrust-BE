const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  id: String,
  type: String,
  name: String,
  amountTonYr: Number,
  method: String,
  progress: Number,
}, { _id: false });

const carbonCreditSchema = new mongoose.Schema({
  kreditKgYr: Number,
  kreditTonYr: Number,
  absorbKgYr: Number,
  emisiKgYr: Number,
  isPositive: Boolean,
}, { _id: false });

const sequestrationRecordSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  totalAbsorbKg: { type: Number, default: 0 },
  greenAbsorbTonYr: { type: Number, default: 0 },
  greenOffsetKg: { type: Number, default: 0 },
  solarPanels: { type: Number },
  solarWp: { type: Number },
  solarWh: { type: Number },
  solarKwh: { type: Number },
  solarOffsetKg: { type: Number, default: 0 },
  biogasInputs: { type: mongoose.Schema.Types.Mixed, default: {} },
  biogasOffsetKg: { type: Number, default: 0 },
  blueProjectName: { type: String },
  blueSequestrationTonYr: { type: Number, default: 0 },
  blueOffsetKg: { type: Number, default: 0 },
  projects: [projectSchema],
  certificatesUploaded: { type: Boolean, default: false },
  emissionCertName: { type: String },
  sequestrationCertName: { type: String },
  emissionCertPath: { type: String },
  sequestrationCertPath: { type: String },
  carbonCredit: carbonCreditSchema,
}, { timestamps: true });

module.exports = mongoose.model('SequestrationRecord', sequestrationRecordSchema);
