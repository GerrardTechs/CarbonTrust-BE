const Bid = require('../models/Bid');
const Project = require('../models/Project');
const { broadcast } = require('../utils/websocket');

// GET /api/bids?projectId=&companyId=
const getBids = async (req, res) => {
  try {
    const { projectId, companyId } = req.query;
    const filter = {};
    if (projectId) filter.projectId = projectId;
    if (companyId) filter.buyerCompanyId = companyId;

    const bids = await Bid.find(filter).sort({ pricePerTon: -1 });
    res.json(bids);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bids
const createBid = async (req, res) => {
  try {
    const { projectId, buyerCompanyId, buyerName, pricePerTon, volume } = req.body;
    if (!projectId || !buyerCompanyId || !buyerName || pricePerTon === undefined) {
      return res.status(400).json({ success: false, message: 'projectId, buyerCompanyId, buyerName, pricePerTon wajib' });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project tidak ditemukan' });
    if (project.status !== 'active') return res.status(400).json({ success: false, message: 'Project tidak aktif' });

    // Prevent seller from bidding their own project
    if (project.companyId.toString() === buyerCompanyId) {
      return res.status(400).json({ success: false, message: 'Tidak bisa bid project sendiri' });
    }

    const bid = await Bid.create({ projectId, buyerCompanyId, buyerName, pricePerTon, volume: volume || 1 });

    broadcast('new_bid', {
      bidId: bid._id,
      projectId,
      buyerName,
      pricePerTon,
      sellerId: project.companyId,
    });

    res.status(201).json({ success: true, ...bid.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/bids/:id/accept
const acceptBid = async (req, res) => {
  try {
    const bid = await Bid.findById(req.params.id);
    if (!bid) return res.status(404).json({ success: false, message: 'Bid tidak ditemukan' });
    if (bid.status !== 'pending') return res.status(400).json({ success: false, message: 'Bid sudah diproses' });

    bid.status = 'accepted';
    await bid.save();

    // Optionally reject other bids for same project
    await Bid.updateMany(
      { projectId: bid.projectId, _id: { $ne: bid._id }, status: 'pending' },
      { status: 'rejected' }
    );

    broadcast('bid_accepted', { bidId: bid._id, projectId: bid.projectId, buyerCompanyId: bid.buyerCompanyId });

    res.json({ success: true, ...bid.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/bids/:id/reject
const rejectBid = async (req, res) => {
  try {
    const bid = await Bid.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    if (!bid) return res.status(404).json({ success: false, message: 'Bid tidak ditemukan' });
    res.json({ success: true, ...bid.toObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getBids, createBid, acceptBid, rejectBid };
