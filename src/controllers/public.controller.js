const Project = require('../models/Project');
const Company = require('../models/Company');
const Parcel = require('../models/Parcel');

// GET /api/public/projects
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ status: 'active' });
    const result = await Promise.all(projects.map(async (proj) => {
      const company = await Company.findById(proj.companyId).select('name esgScore isoCertVerified companyType location');
      const parcels = await Parcel.find({ companyId: proj.companyId });
      const totalAbsorption = parcels.reduce((s, p) => s + (p.absorptionMonthly || 0), 0);

      return {
        id: proj._id,
        name: proj.name,
        company: company?.name || 'Unknown',
        country: proj.country,
        flag: proj.flag,
        type: proj.type,
        price: proj.pricePerTon,
        available: proj.availableCredits,
        rating: proj.rating,
        ndvi: proj.ndvi,
        absRate: proj.absRate || parseFloat(totalAbsorption.toFixed(3)),
        verified: company?.isoCertVerified || false,
        companyESG: company?.esgScore || 0,
        isoVerified: company?.isoCertVerified || false,
        totalParcels: parcels.length,
        totalAbsorption: parseFloat(totalAbsorption.toFixed(3)),
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/public/company/:id
const getPublicCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select('name companyType bizType esgScore isoCertVerified createdAt');
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });

    const parcels = await Parcel.find({ companyId: company._id })
      .select('id name type area status ndvi absorptionMonthly');

    const totalAbsorption = parcels.reduce((s, p) => s + (p.absorptionMonthly || 0), 0);
    const netMonthly = totalAbsorption;
    const netAnnual = totalAbsorption * 12;
    const netCredits = Math.floor(netAnnual);

    res.json({
      id: company._id,
      name: company.name,
      entity: company.companyType,
      bizType: company.companyType,
      esgScore: company.esgScore,
      isoCertVerified: company.isoCertVerified,
      totalAbsorption: parseFloat(totalAbsorption.toFixed(3)),
      totalEmission: 0,
      netMonthly: parseFloat(netMonthly.toFixed(3)),
      netAnnual: parseFloat(netAnnual.toFixed(3)),
      netCredits,
      // Parcels without precise coordinates
      parcels: parcels.map(p => ({
        id: p._id, name: p.name, type: p.type,
        area: p.area, status: p.status, ndvi: p.ndvi,
        absorptionMonthly: p.absorptionMonthly,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProjects, getPublicCompany };
