const mongoose = require('mongoose');

const iotDataPointSchema = new mongoose.Schema({
  ts: { type: Date, default: Date.now },
  temp: { type: Number }, // Celsius
  hum: { type: Number },  // %
  co2: { type: Number },  // ppm
  ndvi: { type: Number },
});

const iotHistorySchema = new mongoose.Schema({
  parcelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parcel', required: true, unique: true },
  data: [iotDataPointSchema],
}, { timestamps: true });

module.exports = mongoose.model('IotHistory', iotHistorySchema);
