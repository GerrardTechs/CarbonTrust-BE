const SequestrationRecord = require('../models/SequestrationRecord');
const Company = require('../models/Company');

function assertCompanyAccess(req, companyId) {
  if (req.userRole === 'admin') return true;
  return req.userId === companyId;
}

function parseMaybeJson(val) {
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return val; }
}

function normalizeBody(body) {
  const data = { ...body };
  ['biogasInputs', 'projects', 'carbonCredit'].forEach((field) => {
    if (data[field] != null) data[field] = parseMaybeJson(data[field]);
  });
  const numericFields = [
    'totalAbsorbKg', 'greenAbsorbTonYr', 'greenOffsetKg', 'solarPanels', 'solarWp',
    'solarWh', 'solarKwh', 'solarOffsetKg', 'biogasOffsetKg', 'blueSequestrationTonYr',
    'blueOffsetKg',
  ];
  numericFields.forEach((field) => {
    if (data[field] !== undefined && data[field] !== '') {
      data[field] = Number(data[field]);
    }
  });
  if (data.certificatesUploaded != null) {
    data.certificatesUploaded = data.certificatesUploaded === true || data.certificatesUploaded === 'true';
  }
  delete data.companyId;
  return data;
}

// POST /api/sequestration/:companyId
const saveSequestration = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!assertCompanyAccess(req, companyId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });

    const data = normalizeBody(req.body);
    if (req.files?.emissionCert?.[0]) data.emissionCertPath = req.files.emissionCert[0].path;
    if (req.files?.sequestrationCert?.[0]) data.sequestrationCertPath = req.files.sequestrationCert[0].path;

    const record = await SequestrationRecord.findOneAndUpdate(
      { companyId },
      { $set: { ...data, companyId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sequestration/:companyId
const getSequestration = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!assertCompanyAccess(req, companyId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const record = await SequestrationRecord.findOne({ companyId }).sort({ updatedAt: -1 });
    res.json({ success: true, record: record || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { saveSequestration, getSequestration };
