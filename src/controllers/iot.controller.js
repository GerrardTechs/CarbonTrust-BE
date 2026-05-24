const IotHistory = require('../models/IotHistory');
const Parcel = require('../models/Parcel');
const { broadcast } = require('../utils/websocket');

const CO2_THRESHOLD = 1000; // ppm

// GET /api/iot/:parcelId/history?hours=72
const getHistory = async (req, res) => {
  try {
    const { parcelId } = req.params;
    const hours = parseInt(req.query.hours) || 72;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const record = await IotHistory.findOne({ parcelId });
    if (!record) return res.status(404).json({ success: false, message: 'Data IoT tidak ditemukan' });

    const filtered = record.data.filter(d => d.ts >= since);
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/iot/company/:companyId?scope=
const getCompanyIot = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { scope = 'all' } = req.query;

    const parcelFilter = { companyId };
    if (scope === 'office') parcelFilter.locType = 'office';
    else if (scope === 'site') parcelFilter.locType = 'site';

    const parcels = await Parcel.find(parcelFilter);
    const result = { office: [], site: [] };

    for (const parcel of parcels) {
      const iot = await IotHistory.findOne({ parcelId: parcel._id });
      const latest = iot && iot.data.length > 0 ? iot.data[iot.data.length - 1] : null;
      const entry = { parcelId: parcel._id, name: parcel.name, latest };
      if (parcel.locType === 'office') result.office.push(entry);
      else result.site.push(entry);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/iot/:parcelId/push
const pushData = async (req, res) => {
  try {
    const { parcelId } = req.params;
    const { temp, hum, co2, ndvi, ts } = req.body;

    if (temp === undefined || hum === undefined || co2 === undefined || ndvi === undefined) {
      return res.status(400).json({ success: false, message: 'temp, hum, co2, ndvi wajib' });
    }

    const dataPoint = { temp, hum, co2, ndvi, ts: ts ? new Date(ts) : new Date() };

    let record = await IotHistory.findOne({ parcelId });
    if (!record) {
      record = await IotHistory.create({ parcelId, data: [] });
    }
    record.data.push(dataPoint);
    // Keep only last 1000 points
    if (record.data.length > 1000) record.data = record.data.slice(-1000);
    await record.save();

    // Auto-alerts
    const parcel = await Parcel.findById(parcelId);
    if (parcel) {
      let alertGenerated = false;
      if (parcel.type === 'peatland' && hum < 40) {
        parcel.alerts.push({ type: 'humidity_critical', message: `Kelembaban peatland kritis: ${hum}%`, severity: 'critical' });
        alertGenerated = true;
      }
      if (co2 > CO2_THRESHOLD) {
        parcel.alerts.push({ type: 'co2_high', message: `CO2 melebihi ambang batas: ${co2} ppm`, severity: 'warning' });
        alertGenerated = true;
      }
      if (alertGenerated) await parcel.save();
    }

    broadcast('iot_live', { parcelId, data: dataPoint });
    res.json({ success: true, parcelId, data: dataPoint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getHistory, getCompanyIot, pushData };
