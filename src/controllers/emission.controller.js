const { calculateEmissions } = require('../utils/emissionCalc');
const EmissionRecord = require('../models/EmissionRecord');

// POST /api/emissions/calculate-v2
const calculateV2 = async (req, res) => {
  try {
    const { companyId, method, equityPct, inputs } = req.body;

    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ success: false, message: 'inputs wajib diisi' });
    }
    if (method === 'equity' && (equityPct === undefined || equityPct < 0 || equityPct > 100)) {
      return res.status(400).json({ success: false, message: 'equityPct wajib antara 0-100 untuk metode equity' });
    }

    const result = calculateEmissions({ method: method || 'operational', equityPct, inputs });

    // Save to DB if companyId provided
    if (companyId) {
      await EmissionRecord.create({
        companyId, method: method || 'operational', equityPct,
        ...result,
      });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/emissions/history/:companyId
const getHistory = async (req, res) => {
  try {
    const records = await EmissionRecord.find({ companyId: req.params.companyId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { calculateV2, getHistory };
