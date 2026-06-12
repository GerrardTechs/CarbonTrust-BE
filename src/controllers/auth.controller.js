const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const Session = require('../models/Session');
const EmailVerification = require('../models/EmailVerification');
const { generateToken, generateCompanyId, generateWalletId } = require('../utils/tokens');
const { generateVerificationToken, sendVerificationEmail, isReservedUsername } = require('../utils/email');

const VERIFICATION_HOURS = 24;

async function assertRegistrationAvailable({ email, username }) {
  const emailNorm = email.toLowerCase();
  const userNorm  = username.toLowerCase();

  if (isReservedUsername(userNorm)) {
    return { ok: false, status: 400, message: 'Username ini tidak dapat digunakan (nama sistem/admin)' };
  }

  // Cek hanya di Company (akun final), BUKAN di EmailVerification
  const existing = await Company.findOne({ $or: [{ email: emailNorm }, { username: userNorm }] });
  if (existing) {
    const message = existing.email === emailNorm
      ? 'Email sudah digunakan'
      : 'Username sudah digunakan';
    return { ok: false, status: 409, message };
  }
  return { ok: true };
}

async function consumeVerification(verificationToken, email) {
  const record = await EmailVerification.findOne({
    token: verificationToken,
    email: email.toLowerCase(),
    verified: true,
    expiresAt: { $gt: new Date() },
  });
  if (!record) {
    return { ok: false, message: 'Verifikasi email belum selesai atau sudah kedaluwarsa' };
  }
  await EmailVerification.deleteOne({ _id: record._id });
  return { ok: true, record };
}

// GET /api/auth/check-username?username=
const checkUsername = async (req, res) => {
  try {
    const username = String(req.query.username || '').toLowerCase().trim();
    if (!username) return res.status(400).json({ success: false, message: 'username wajib' });
    if (isReservedUsername(username)) {
      return res.json({ success: true, available: false, reason: 'reserved' });
    }
    const taken = await Company.findOne({ username });
    res.json({ success: true, available: !taken, reason: taken ? 'taken' : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/send-verification
const sendVerification = async (req, res) => {
  try {
    const { name, email, username, password, role, phone, location } = req.body;
    if (!name || !email || !username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, password, role' });
    }
    if (!['company', 'landlord'].includes(role)) {
      return res.status(400).json({ success: false, message: 'role harus company atau landlord' });
    }

    const avail = await assertRegistrationAvailable({ email, username });
    if (!avail.ok) return res.status(avail.status).json({ success: false, message: avail.message });

    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_HOURS * 60 * 60 * 1000);

    await EmailVerification.deleteMany({ email: email.toLowerCase() });

    await EmailVerification.create({
      email: email.toLowerCase(),
      token,
      role,
      payload: { name, email, username, password, role, phone, location },
      verified: false,
      expiresAt: new Date(Date.now() + VERIFICATION_HOURS * 60 * 60 * 1000),
    });

    const mail = await sendVerificationEmail({ to: email, name, token, role });

    res.json({
      success: true,
      message: 'Email verifikasi telah dikirim. Periksa inbox atau folder spam.',
      email: email.toLowerCase(),
      ...(mail.devMode ? { devHint: 'Mode dev: lihat token di log server backend' } : {}),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/verify-email
const verifyEmail = async (req, res) => {
  try {
    const { token, email } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token wajib' });

    const query = { token, expiresAt: { $gt: new Date() } };
    if (email) query.email = email.toLowerCase();

    const record = await EmailVerification.findOne(query);
    if (!record) {
      return res.status(400).json({ success: false, message: 'Token tidak valid atau kedaluwarsa' });
    }

    record.verified = true;
    await record.save();

    res.json({
      success: true,
      message: 'Email berhasil diverifikasi',
      verificationToken: record.token,
      email: record.email,
      role: record.role,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/register-company
const registerCompany = async (req, res) => {
  try {
    const {
      name, email, username, password, companyType, position, officeAddress, siteAddress,
      emissionObject, institutionId, verificationToken,
      calcMethod, equityPct, ghgInventoryPath, carbonRemovalPath,
    } = req.body;

    if (!name || !email || !username || !password || !verificationToken) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, password, verificationToken' });
    }

    const avail = await assertRegistrationAvailable({ email, username });
    if (!avail.ok) return res.status(avail.status).json({ success: false, message: avail.message });

    const verified = await consumeVerification(verificationToken, email);
    if (!verified.ok) return res.status(400).json({ success: false, message: verified.message });

    const hashed = await bcrypt.hash(password, 12);
    const companyId = generateCompanyId(institutionId);
    const walletId = generateWalletId();

    const company = await Company.create({
      companyId, name, email, username, password: hashed,
      companyType, position, officeAddress, siteAddress,
      emissionObject, institutionId, walletId, walletGenerated: true,
      role: 'company', calcMethod, equityPct,
      ghgInventoryPath, carbonRemovalPath,
    });

    const sessionToken = generateToken('tok');
    await Session.create({ token: sessionToken, userId: company._id.toString(), role: 'company' });

    res.status(201).json({
      success: true, token: sessionToken,
      user: {
        id: company._id, name: company.name, email: company.email,
        role: company.role, walletId: company.walletId, companyId: company.companyId,
        walletGenerated: true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, username, password, role } = req.body;
    if (!password || (!email && !username)) {
      return res.status(400).json({ success: false, message: 'Email/username dan password wajib diisi' });
    }

    const query = email ? { email: email.toLowerCase() } : { username: username.toLowerCase() };
    const company = await Company.findOne(query);
    if (!company) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan' });

    if (role && company.role !== role) {
      return res.status(403).json({
        success: false,
        message: role === 'company'
          ? 'Akun ini bukan akun perusahaan'
          : 'Akun ini bukan akun pemilik lahan',
      });
    }

    const valid = await bcrypt.compare(password, company.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Password salah' });

    const sessionToken = generateToken('tok');
    await Session.create({ token: sessionToken, userId: company._id.toString(), role: company.role });

    res.json({
      success: true, token: sessionToken,
      user: {
        id: company._id, name: company.name, email: company.email,
        username: company.username,
        role: company.role, walletId: company.walletId,
        walletGenerated: !!company.walletId, esgScore: company.esgScore,
        companyId: company.companyId,
      },
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
    const { name, email, username, password, phone, location, verificationToken } = req.body;
    if (!name || !email || !username || !password || !verificationToken) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, password, verificationToken' });
    }

    const avail = await assertRegistrationAvailable({ email, username });
    if (!avail.ok) return res.status(avail.status).json({ success: false, message: avail.message });

    const verified = await consumeVerification(verificationToken, email);
    if (!verified.ok) return res.status(400).json({ success: false, message: verified.message });

    const hashed = await bcrypt.hash(password, 12);
    const walletId = generateWalletId();

    const landlord = await Company.create({
      companyId: generateCompanyId(), name, email, username,
      password: hashed, phone, location, walletId, walletGenerated: true, role: 'landlord',
    });

    const sessionToken = generateToken('tok');
    await Session.create({ token: sessionToken, userId: landlord._id.toString(), role: 'landlord' });

    res.status(201).json({
      success: true, token: sessionToken,
      user: {
        id: landlord._id, name: landlord.name, email: landlord.email,
        role: 'landlord', walletId: landlord.walletId, walletGenerated: true,
      },
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

    const sessionToken = generateToken('admin_tok');
    await Session.create({ token: sessionToken, userId: 'admin', role: 'admin' });

    res.json({
      success: true, token: sessionToken,
      user: { id: 'admin', name: 'Administrator', role: 'admin', username: adminUser },
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
    res.json({
      success: true,
      user: {
        id: company._id, name: company.name, email: company.email, role: company.role,
        walletId: company.walletId, walletGenerated: !!company.walletId,
        esgScore: company.esgScore, companyId: company.companyId,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  registerCompany, login, logout, registerLandlord, adminLogin, getMe,
  sendVerification, verifyEmail, checkUsername,
};
