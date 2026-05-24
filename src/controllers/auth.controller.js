const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const Session = require('../models/Session');
const { generateToken, generateCompanyId, generateWalletId } = require('../utils/tokens');

// POST /api/auth/register-company
const registerCompany = async (req, res) => {
  try {
    const { name, email, username, password, companyType, position, officeAddress, siteAddress, emissionObject, institutionId } = req.body;

    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, password' });
    }

    const existing = await Company.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (existing) {
      return res.status(409).json({ success: false, message: existing.email === email.toLowerCase() ? 'Email sudah digunakan' : 'Username sudah digunakan' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const companyId = generateCompanyId(institutionId);
    const walletId = generateWalletId();

    const company = await Company.create({
      companyId, name, email, username, password: hashed,
      companyType, position, officeAddress, siteAddress,
      emissionObject, institutionId, walletId, role: 'company',
    });

    const token = generateToken('tok');
    await Session.create({ token, userId: company._id.toString(), role: 'company' });

    res.status(201).json({
      success: true, token,
      user: { id: company._id, name: company.name, email: company.email, role: company.role, walletId: company.walletId, companyId: company.companyId }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!password || (!email && !username)) {
      return res.status(400).json({ success: false, message: 'Email/username dan password wajib diisi' });
    }

    const query = email ? { email: email.toLowerCase() } : { username: username.toLowerCase() };
    const company = await Company.findOne(query);
    if (!company) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });

    const valid = await bcrypt.compare(password, company.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Password salah' });

    const token = generateToken('tok');
    await Session.create({ token, userId: company._id.toString(), role: company.role });

    res.json({
      success: true, token,
      user: { id: company._id, name: company.name, email: company.email, role: company.role, walletId: company.walletId, esgScore: company.esgScore }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    await Session.deleteOne({ token: req.token });
    res.json({ success: true, message: 'Berhasil logout' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/register-landlord
const registerLandlord = async (req, res) => {
  try {
    const { name, email, username, password, phone, location } = req.body;
    if (!name || !email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, password' });
    }

    const existing = await Company.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (existing) return res.status(409).json({ success: false, message: 'Email atau username sudah digunakan' });

    const hashed = await bcrypt.hash(password, 12);
    const walletId = generateWalletId();

    const landlord = await Company.create({
      companyId: generateCompanyId(), name, email, username,
      password: hashed, phone, location, walletId, role: 'landlord',
    });

    const token = generateToken('tok');
    await Session.create({ token, userId: landlord._id.toString(), role: 'landlord' });

    res.status(201).json({
      success: true, token,
      user: { id: landlord._id, name: landlord.name, email: landlord.email, role: 'landlord', walletId: landlord.walletId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/admin-login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    if (username !== adminUser || password !== adminPass) {
      return res.status(401).json({ success: false, message: 'Kredensial admin salah' });
    }

    const token = generateToken('admin_tok');
    await Session.create({ token, userId: 'admin', role: 'admin' });

    res.json({
      success: true, token,
      user: { id: 'admin', name: 'Administrator', role: 'admin' }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    if (req.userRole === 'admin') {
      return res.json({ success: true, user: { id: 'admin', name: 'Administrator', role: 'admin' } });
    }
    const company = await Company.findById(req.userId).select('-password');
    if (!company) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, user: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { registerCompany, login, logout, registerLandlord, adminLogin, getMe };
