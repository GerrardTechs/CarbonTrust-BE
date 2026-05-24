const Company = require('../models/Company');
const Parcel = require('../models/Parcel');
const Bid = require('../models/Bid');

// GET /api/admin/overview
const getOverview = async (req, res) => {
  try {
    const companies = await Company.find({ role: { $in: ['company', 'landlord'] } }).select('-password');
    const allParcels = await Parcel.find();
    const allBids = await Bid.find();

    let totalAbsorption = 0, totalEmission = 0, totalCredits = 0, verifiedCount = 0;
    const allAlerts = [];

    const companySummaries = await Promise.all(companies.map(async (co) => {
      const parcels = allParcels.filter(p => p.companyId.toString() === co._id.toString());
      const absorption = parcels.reduce((s, p) => s + (p.absorptionMonthly || 0), 0);
      const annualAbsorption = absorption * 12;

      totalAbsorption += absorption;
      if (co.isoCertVerified) verifiedCount++;

      parcels.forEach(p => {
        p.alerts.filter(a => !a.dismissed).forEach(a => {
          allAlerts.push({ ...a.toObject(), parcelId: p._id, parcelName: p.name, companyId: co._id, companyName: co.name });
        });
      });

      return {
        id: co._id, name: co.name, email: co.email,
        esgScore: co.esgScore, isoCertVerified: co.isoCertVerified,
        role: co.role,
        parcelsCount: parcels.length,
        totalArea: parcels.reduce((s, p) => s + (p.area || 0), 0),
        totalAbsorption: parseFloat(absorption.toFixed(3)),
        totalEmission: 0, // would come from EmissionRecord
        netCredits: Math.floor(annualAbsorption),
      };
    }));

    allAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      totalCompanies: companies.length,
      totalParcels: allParcels.length,
      totalBids: allBids.length,
      totalAbsorption: parseFloat(totalAbsorption.toFixed(3)),
      totalEmission,
      totalCredits: Math.floor(totalAbsorption * 12),
      verifiedCount,
      alertsCount: allAlerts.length,
      recentAlerts: allAlerts.slice(0, 10),
      companies: companySummaries,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/company/:id/verify-iso
const verifyIso = async (req, res) => {
  try {
    const { approved, note } = req.body;
    if (approved === undefined) return res.status(400).json({ success: false, message: 'approved (true/false) wajib' });

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isoCertVerified: !!approved },
      { new: true }
    );
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });

    res.json({
      success: true,
      companyId: company._id,
      isoCertVerified: company.isoCertVerified,
      note: note || null,
      updatedAt: new Date(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/companies - list all
const listCompanies = async (req, res) => {
  try {
    const companies = await Company.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, companies });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/company/:id/esg
const updateEsg = async (req, res) => {
  try {
    const { esgScore, esgStatus } = req.body;
    const company = await Company.findByIdAndUpdate(req.params.id, { esgScore, esgStatus }, { new: true }).select('-password');
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });
    res.json({ success: true, companyId: company._id, esgScore: company.esgScore, esgStatus: company.esgStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getOverview, verifyIso, listCompanies, updateEsg };
