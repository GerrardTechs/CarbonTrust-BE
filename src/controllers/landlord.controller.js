const Parcel = require('../models/Parcel');

// GET /api/landlord/:id/parcels
const getLandlordParcels = async (req, res) => {
  try {
    const parcels = await Parcel.find({ companyId: req.params.id });
    res.json(parcels.map(p => ({
      id: p._id, name: p.name, type: p.type, area: p.area,
      status: p.status, ndvi: p.ndvi, lat: p.lat, lng: p.lng,
      depth: p.depth, humidity: p.humidity,
      absorptionMonthly: p.absorptionMonthly,
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/landlord/:id/summary
const getLandlordSummary = async (req, res) => {
  try {
    const parcels = await Parcel.find({ companyId: req.params.id });
    const totalParcels = parcels.length;
    const totalArea = parcels.reduce((s, p) => s + (p.area || 0), 0);
    const totalAbsorption = parcels.reduce((s, p) => s + (p.absorptionMonthly || 0), 0);
    const netMonthly = totalAbsorption;
    const netAnnual = netMonthly * 12;
    const netCredits = Math.floor(netAnnual);

    res.json({
      totalParcels,
      totalArea: parseFloat(totalArea.toFixed(2)),
      totalAbsorption: parseFloat(totalAbsorption.toFixed(3)),
      totalEmission: 0,
      netMonthly: parseFloat(netMonthly.toFixed(3)),
      netAnnual: parseFloat(netAnnual.toFixed(3)),
      netCredits,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getLandlordParcels, getLandlordSummary };
