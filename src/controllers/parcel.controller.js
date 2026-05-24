const Parcel = require('../models/Parcel');
const IotHistory = require('../models/IotHistory');
const { generateIotHistory } = require('../utils/iotSimulator');
const { broadcast } = require('../utils/websocket');

const NDVI_MAP = {
  healthy: 0.75, flooded: 0.40, degraded: 0.35, burned: 0.15, drying: 0.45
};

// GET /api/parcels?companyId=
const getParcels = async (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ success: false, message: 'companyId wajib' });
    const parcels = await Parcel.find({ companyId });
    res.json(parcels);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/parcels
const createParcel = async (req, res) => {
  try {
    const { companyId, name, type, area, lat, lng, depth, humidity, locType } = req.body;
    if (!companyId || !name || !type || !area || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Field wajib: companyId, name, type, area, lat, lng' });
    }
    if (type === 'peatland' && !depth) {
      return res.status(400).json({ success: false, message: 'depth wajib untuk lahan peatland' });
    }

    const parcel = await Parcel.create({
      companyId, name, type, area, lat, lng,
      depth: depth || null,
      humidity: humidity || 70,
      locType: locType || 'site',
      status: 'healthy',
      ndvi: 0.70,
    });

    // Init IoT history with simulated data
    const simulatedData = generateIotHistory(parcel);
    await IotHistory.create({ parcelId: parcel._id, data: simulatedData });

    res.status(201).json(parcel);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/parcels/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['healthy', 'flooded', 'degraded', 'burned', 'drying'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status tidak valid. Pilih: ${validStatuses.join(', ')}` });
    }

    const ndvi = NDVI_MAP[status];
    const updateData = { status, ndvi };

    let alertMsg = null;
    if (status !== 'healthy') {
      const alertMap = {
        flooded: { message: 'Lahan terdeteksi banjir', severity: 'critical' },
        degraded: { message: 'Lahan mengalami degradasi', severity: 'warning' },
        burned: { message: 'Lahan terbakar - perlu penanganan segera!', severity: 'critical' },
        drying: { message: 'Lahan mengering - kelembaban rendah', severity: 'warning' },
      };
      alertMsg = alertMap[status];
    }

    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) return res.status(404).json({ success: false, message: 'Parcel tidak ditemukan' });

    parcel.status = status;
    parcel.ndvi = ndvi;
    if (alertMsg) parcel.alerts.push(alertMsg);
    await parcel.save();

    broadcast('parcel_updated', { parcelId: parcel._id, status, ndvi });

    res.json(parcel);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/parcels/:id/humidity
const updateHumidity = async (req, res) => {
  try {
    const { humidity } = req.body;
    if (humidity === undefined || humidity < 0 || humidity > 100) {
      return res.status(400).json({ success: false, message: 'humidity harus antara 0-100' });
    }

    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) return res.status(404).json({ success: false, message: 'Parcel tidak ditemukan' });

    parcel.humidity = humidity;

    if (parcel.type === 'peatland' && humidity < 40) {
      parcel.alerts.push({
        type: 'humidity_warning',
        message: `Kelembaban kritis: ${humidity}%. Peatland butuh minimal 40%.`,
        severity: 'critical',
      });
    }

    await parcel.save();
    res.json({ success: true, ...parcel.toObject(), absorptionMonthly: parcel.absorptionMonthly });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getParcels, createParcel, updateStatus, updateHumidity };
