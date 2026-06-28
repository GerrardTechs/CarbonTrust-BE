const Company = require('../models/Company');
const Parcel = require('../models/Parcel');
const EmissionRecord = require('../models/EmissionRecord');
const { generateWalletId } = require('../utils/tokens');
const { extractTextFromPdf } = require('../utils/pdfText');
const { extractEmissionFromText, compareEmissions } = require('../utils/aiEmissionVerify');

// GET /api/company/:id
const getCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id).select('-password');
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });
    res.json({
      id: company._id, name: company.name, email: company.email,
      entity: company.companyType, bizType: company.companyType,
      location: company.location, siteAddress: company.siteAddress,
      walletId: company.walletId,
      walletGenerated: !!(company.walletId && company.walletGenerated !== false),
      esgScore: company.esgScore,
      esgStatus: company.esgStatus, isoCertVerified: company.isoCertVerified,
      stockData: company.stockData, totalTransactions: company.totalTransactions,
      createdAt: company.createdAt,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/company/:id
const updateCompany = async (req, res) => {
  try {
    const { name, entity, bizType, location, siteAddress, emissionObject, stockData } = req.body;

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });

    if (req.userRole !== 'admin' && req.userId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (entity || bizType) updateData.companyType = entity || bizType;
    if (location) updateData.location = location;
    if (siteAddress) updateData.siteAddress = siteAddress;
    if (emissionObject) updateData.emissionObject = emissionObject;
    if (stockData && !company.walletGenerated) updateData.stockData = stockData;

    const updated = await Company.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    res.json({ success: true, ...updated.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/company/:id/stock
const updateStock = async (req, res) => {
  try {
    const { symbol, price, prevPrice } = req.body;
    if (!symbol || price === undefined) {
      return res.status(400).json({ success: false, message: 'symbol dan price wajib diisi' });
    }
    const updated = await Company.findByIdAndUpdate(
      req.params.id,
      { stockData: { symbol, price, prevPrice, updatedAt: new Date() } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });
    res.json({ success: true, ...updated.stockData.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/company/:id/upload-iso
const uploadIso = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File ISO wajib diupload' });

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // Default: belum terverifikasi, menunggu review
    let isoCertVerified = false;
    let aiVerification = null;

    // Hanya jalankan AI extraction kalau filenya PDF
    if (mimeType === 'application/pdf') {
      try {
        const text = await extractTextFromPdf(filePath);
        const aiResult = await extractEmissionFromText(text);

        // Ambil EmissionRecord terbaru milik company ini untuk dibandingkan
        const latestRecord = await EmissionRecord
          .findOne({ companyId: req.params.id })
          .sort({ createdAt: -1 });

        const comparison = compareEmissions(aiResult, latestRecord?.total, 5);

        aiVerification = {
          ai: aiResult,
          comparison,
          checkedAt: new Date(),
        };

        if (comparison.match) {
          isoCertVerified = true;
        }
      } catch (aiErr) {
        console.error('[upload-iso] ⚠️  AI verification gagal, fallback ke manual review:', aiErr.message);
        aiVerification = { error: aiErr.message };
      }
    }

    await Company.findByIdAndUpdate(req.params.id, {
      isoCertPath: filePath,
      isoCertVerified,
      isoCertAiVerification: aiVerification, // field baru, untuk transparansi/audit trail
    });

    res.json({
      success: true,
      filePath,
      isoCertVerified,
      aiVerification,
      message: isoCertVerified
        ? 'Sertifikat terverifikasi otomatis — total emisi pada dokumen cocok dengan data sistem'
        : 'Menunggu verifikasi admin (AI belum dapat memastikan kecocokan data)',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/company/:id/upload-ownership
const uploadOwnership = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'File kepemilikan wajib diupload' });
    const { equityPct, country, docType } = req.body;
    const filePath = req.file.path;
    await Company.findByIdAndUpdate(req.params.id, {
      ownershipCertPath: filePath,
      equityPct: equityPct ? Number(equityPct) : undefined,
    });
    res.json({ success: true, filePath, equityPct: Number(equityPct) || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/company/:id/wallet — generate sekali, tidak bisa diubah
const ensureWallet = async (req, res) => {
  try {
    if (req.userRole !== 'admin' && req.userId !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' });

    if (company.walletId) {
      return res.json({
        success: true,
        walletId: company.walletId,
        walletGenerated: true,
        message: 'Wallet ID sudah ada dan tidak dapat diubah',
      });
    }

    const walletId = generateWalletId();
    company.walletId = walletId;
    company.walletGenerated = true;
    await company.save();

    res.json({ success: true, walletId, walletGenerated: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getCompany, updateCompany, updateStock, uploadIso, uploadOwnership, ensureWallet };