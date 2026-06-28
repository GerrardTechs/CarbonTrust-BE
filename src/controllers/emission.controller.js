const { calculateEmissions } = require('../utils/emissionCalc');
const EmissionRecord = require('../models/EmissionRecord');

// POST /api/emissions/calculate-v2
const calculateV2 = async (req, res) => {
  try {
    const { method, equityPct, inputs, clientSnapshot } = req.body;

    // companyId TIDAK lagi dipercaya dari body — selalu pakai identitas dari token login
    const companyId = req.userId;

    let result;
    if (clientSnapshot && typeof clientSnapshot === 'object') {
      // clientSnapshot tetap didukung (tidak dihapus), TAPI hanya dipakai
      // kalau backend juga punya `inputs` untuk verifikasi ulang.
      // Kalau tidak ada inputs untuk verifikasi, snapshot ditolak.
      if (!inputs || typeof inputs !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'clientSnapshot harus disertai inputs mentah untuk verifikasi server',
        });
      }

      const verified = calculateEmissions({ method: method || 'operational', equityPct, inputs });

      result = {
        scope1: verified.scope1,
        scope2: verified.scope2,
        scope3: verified.scope3,
        total: verified.total,
        leakage: verified.leakage,
        creditsNeeded: verified.creditsNeeded,
        breakdown: verified.breakdown,
        netEmission: verified.total,
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
    // IDOR fix: user hanya boleh lihat history miliknya sendiri
    if (req.params.companyId !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan mengakses data company lain' });
    }

    const records = await EmissionRecord.find({ companyId: req.params.companyId }).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { calculateV2, getHistory };