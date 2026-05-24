const Session = require('../models/Session');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const session = await Session.findOne({ token });
    if (!session) return res.status(401).json({ success: false, message: 'Session tidak valid atau sudah expired' });
    if (session.expiresAt < new Date()) {
      await Session.deleteOne({ token });
      return res.status(401).json({ success: false, message: 'Session expired' });
    }
    req.userId = session.userId;
    req.userRole = session.role;
    req.token = token;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Auth error' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) {
    return res.status(403).json({ success: false, message: `Akses ditolak. Role yang dibutuhkan: ${roles.join(', ')}` });
  }
  next();
};

const requireAdmin = requireRole('admin');
const requireCompany = requireRole('company', 'landlord');

module.exports = { authenticate, requireRole, requireAdmin, requireCompany };
