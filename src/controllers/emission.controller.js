const { calculateEmissions } = require('../utils/emissionCalc');
const EmissionRecord = require('../models/EmissionRecord');

// POST /api/emissions/calculate-v2
const calculateV2 = async (req, res) => {
  try {
    const { companyId, method, equityPct, inputs, clientSnapshot } = req.body;

    let result;
    if (clientSnapshot && typeof clientSnapshot === 'object') {
      result = {
        scope1: clientSnapshot.s1 ?? clientSnapshot.scope1 ?? 0,
        scope2: clientSnapshot.s2 ?? clientSnapshot.scope2 ?? 0,
        scope3: clientSnapshot.s3 ?? clientSnapshot.scope3 ?? 0,
        total: clientSnapshot.total ?? 0,
        leakage: clientSnapshot.leakage ?? 0,
        creditsNeeded: clientSnapshot.creditsNeeded ?? Math.ceil((clientSnapshot.total || 0) / 1000),
        breakdown: Array.isArray(clientSnapshot.breakdown) ? clientSnapshot.breakdown : [],
        netEmission: clientSnapshot.netEmission ?? clientSnapshot.total ?? 0,
      };
    } else {
      if (!inputs || typeof inputs !== 'object') {
        return res.status(400).json({ success: false, message: 'inputs wajib diisi' });
      }
      if (method === 'equity' && (equityPct === undefined || equityPct < 0 || equityPct > 100)) {
        return res.status(400).json({ success: false, message: 'equityPct wajib antara 0-100 untuk metode equity' });
      }
      result = calculateEmissions({ method: method || 'operational', equityPct, inputs });
      result.netEmission = result.total;
    }

    if (companyId) {
      await EmissionRecord.create({
        companyId,
        method: method || 'operational',
        equityPct,
        scope1: result.scope1,
        scope2: result.scope2,
        scope3: result.scope3,
        total: result.total,
        leakage: result.leakage,
        creditsNeeded: result.creditsNeeded,
        breakdown: result.breakdown,
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
