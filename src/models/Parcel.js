const mongoose = require('mongoose');

const parcelSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ['forest', 'peatland', 'mangrove', 'grassland', 'cropland'],
    required: true
  },
  area: { type: Number, required: true }, // hectares
  status: {
    type: String,
    enum: ['healthy', 'flooded', 'degraded', 'burned', 'drying'],
    default: 'healthy'
  },
  ndvi: { type: Number, default: 0.70 },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  depth: { type: Number }, // for peatland (meters)
  humidity: { type: Number, default: 70 }, // %
  locType: { type: String, enum: ['site', 'office'], default: 'site' },
  lastSat: { type: Date, default: Date.now },
  absorptionMonthly: { type: Number, default: 0 }, // tCO2e/month
  alerts: [
    {
      type: String,
      message: String,
      severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
      dismissed: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

// Calculate absorptionMonthly before save
parcelSchema.pre('save', function (next) {
  this.absorptionMonthly = calcAbsorption(this);
  next();
});

function calcAbsorption(parcel) {
  const baseRates = { forest: 0.5, peatland: 0.8, mangrove: 1.2, grassland: 0.3, cropland: 0.2 };
  let rate = baseRates[parcel.type] || 0.3;
  if (parcel.type === 'peatland') {
    const humFactor = Math.min(parcel.humidity / 70, 1);
    rate *= humFactor;
  }
  const ndviFactor = parcel.ndvi / 0.7;
  return parseFloat((parcel.area * rate * ndviFactor).toFixed(3));
}

module.exports = mongoose.model('Parcel', parcelSchema);
module.exports.calcAbsorption = calcAbsorption;
