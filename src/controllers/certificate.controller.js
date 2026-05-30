const Company = require('../models/Company');
const Parcel = require('../models/Parcel');

// GET /api/certificate/:companyId
const getCertificate = async (req, res) => {
  try {
    const company = await Company.findById(req.params.companyId).select('-password');
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });

    const parcels = await Parcel.find({ companyId: company._id });
    const totalAbsorption = parcels.reduce((s, p) => s + (p.absorptionMonthly || 0), 0);
    const totalEmission = 0; // could pull from latest EmissionRecord
    const netMonthly = totalAbsorption - totalEmission;
    const netAnnual = netMonthly * 12;
    const netCredits = Math.floor(netAnnual);

    const year = new Date().getFullYear();
    const certNumber = `CT-CERT-${company.companyId || company._id}-${year}`;
    const issuedAt = new Date();
    const validUntil = new Date(new Date().setFullYear(year + 1));

    res.json({
      success: true,
      certNumber,
      companyId: company._id,
      companyName: company.name,
      issuedAt,
      validUntil,
      totalAbsorption: parseFloat(totalAbsorption.toFixed(3)),
      totalEmission,
      netMonthly: parseFloat(netMonthly.toFixed(3)),
      netAnnual: parseFloat(netAnnual.toFixed(3)),
      netCredits,
      standard: 'ISO 14064:2018',
      verified: !!company.isoCertVerified,
      preview: !company.isoCertVerified,
      isoPendingMessage: company.isoCertVerified
        ? null
        : 'Pratinjau — sertifikat resmi setelah admin memverifikasi ISO 14064',
      parcels: parcels.map(p => ({
        id: p._id, name: p.name, type: p.type,
        area: p.area, absorption: p.absorptionMonthly,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getCertificate };
