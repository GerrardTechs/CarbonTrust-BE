const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const Session = require('../models/Session');
const EmailVerification = require('../models/EmailVerification');
const { generateToken, generateCompanyId, generateWalletId } = require('../utils/tokens');
const { generateVerificationToken, sendVerificationEmail, isReservedUsername } = require('../utils/email');

const VERIFICATION_HOURS = 24;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeVerificationInput(rawToken) {
  return String(rawToken || '').trim().toLowerCase();
}

async function findVerificationRecord(rawToken, email) {
  const token = normalizeVerificationInput(rawToken);
  if (!token) return null;

  const baseQuery = { expiresAt: { $gt: new Date() } };
  if (email) baseQuery.email = String(email).toLowerCase().trim();

  if (token.length >= 32) {
    return EmailVerification.findOne({ ...baseQuery, token });
  }

  const candidates = await EmailVerification.find({
    ...baseQuery,
    token: { $regex: new RegExp(`^${escapeRegex(token)}`) },
  });

  if (candidates.length === 1) return candidates[0];
  return null;
}

async function assertRegistrationAvailable({ email, username }) {
  const emailNorm = email.toLowerCase();
  const userNorm  = username.toLowerCase();

  if (isReservedUsername(userNorm)) {
    return { ok: false, status: 400, message: 'Username ini tidak dapat digunakan (nama sistem/admin)' };
  }

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
  const record = await findVerificationRecord(verificationToken, email);
  if (!record || !record.verified) {
    return { ok: false, message: 'Verifikasi email belum selesai atau sudah kedaluwarsa' };
  }

  const snapshot = record.toObject();
  await EmailVerification.deleteOne({ _id: record._id });
  return { ok: true, record: snapshot };
}

function resolvePosition(position, customPosition) {
  if (!position) return customPosition || undefined;
  if (String(position).toLowerCase().includes('other') || position === 'Other (specify)') {
    return customPosition || position;
  }
  return position;
}

function registrationPreviewFromPayload(payload) {
  if (!payload) return null;
  return {
    name: payload.name,
    email: payload.email,
    username: payload.username,
    role: payload.role,
    phone: payload.phone,
    location: payload.location,
    institutionId: payload.institutionId,
    position: payload.position,
    customPosition: payload.customPosition,
  };
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
    const {
      name, email, username, password, role, phone, location,
      institutionId, position, customPosition,
    } = req.body;
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
      payload: {
        name, email, username, password, role, phone, location,
        institutionId, position, customPosition,
      },
      verified: false,
      expiresAt,
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
const verifyEmailLink = async (req, res) => {
  try {
    const { token, email } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!token) {
      return res.redirect(`${frontendUrl}/?verifyStatus=error&reason=missing_token`);
    }

    const record = await findVerificationRecord(token, email);
    if (!record) {
      return res.redirect(`${frontendUrl}/?verifyStatus=error&reason=invalid_or_expired`);
    }

    record.verified = true;
    await record.save();

    // Redirect ke frontend bawa verificationToken + email + role,
    // supaya frontend bisa langsung lanjut ke form registrasi
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('verifyStatus', 'success');
    redirectUrl.searchParams.set('verificationToken', record.token);
    redirectUrl.searchParams.set('email', record.email);
    redirectUrl.searchParams.set('role', record.role);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error(err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/?verifyStatus=error&reason=server_error`);
  }
};

// POST /api/auth/register-company
const registerCompany = async (req, res) => {
  try {
    const {
      name, email, username, password, companyType, position, customPosition,
      officeAddress, siteAddress, emissionObject, institutionId, verificationToken,
      calcMethod, equityPct, ghgInventoryPath, carbonRemovalPath, location,
    } = req.body;

    if (!name || !email || !username || !verificationToken) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, verificationToken' });
    }

    const avail = await assertRegistrationAvailable({ email, username });
    if (!avail.ok) return res.status(avail.status).json({ success: false, message: avail.message });

    const verified = await consumeVerification(verificationToken, email);
    if (!verified.ok) return res.status(400).json({ success: false, message: verified.message });

    const plainPassword = password || verified.record.payload?.password;
    if (!plainPassword) {
      return res.status(400).json({ success: false, message: 'Password wajib diisi' });
    }

    const hashed = await bcrypt.hash(plainPassword, 12);
    const resolvedInstitutionId = institutionId || verified.record.payload?.institutionId;
    const companyId = generateCompanyId(resolvedInstitutionId);
    const walletId = generateWalletId();
    const resolvedPosition = resolvePosition(position || verified.record.payload?.position, customPosition || verified.record.payload?.customPosition);

    const company = await Company.create({
      companyId,
      name,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password: hashed,
      contactName: name,
      companyType,
      position: resolvedPosition,
      officeAddress,
      siteAddress,
      location: location || officeAddress,
      emissionObject,
      institutionId: resolvedInstitutionId,
      walletId,
      walletGenerated: true,
      role: 'company',
      emailVerified: true,
      calcMethod,
      equityPct,
      ghgInventoryPath,
      carbonRemovalPath,
    });

    const sessionToken = generateToken('tok');
    await Session.create({ token: sessionToken, userId: company._id.toString(), role: 'company' });

    res.status(201).json({
      success: true,
      token: sessionToken,
      user: {
        id: company._id,
        name: company.name,
        email: company.email,
        role: company.role,
        walletId: company.walletId,
        companyId: company.companyId,
        walletGenerated: true,
        emailVerified: true,
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

    if (!company.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Email belum diverifikasi. Selesaikan verifikasi email sebelum login.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    if (company.isActive === false) {
      return res.status(403).json({ success: false, message: 'Akun dinonaktifkan. Hubungi administrator.' });
    }

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
      success: true,
      token: sessionToken,
      user: {
        id: company._id,
        name: company.name,
        email: company.email,
        username: company.username,
        role: company.role,
        walletId: company.walletId,
        walletGenerated: !!company.walletId,
        esgScore: company.esgScore,
        companyId: company.companyId,
        emailVerified: company.emailVerified,
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
    if (!name || !email || !username || !verificationToken) {
      return res.status(400).json({ success: false, message: 'Field wajib: name, email, username, verificationToken' });
    }

    const avail = await assertRegistrationAvailable({ email, username });
    if (!avail.ok) return res.status(avail.status).json({ success: false, message: avail.message });

    const verified = await consumeVerification(verificationToken, email);
    if (!verified.ok) return res.status(400).json({ success: false, message: verified.message });

    const plainPassword = password || verified.record.payload?.password;
    if (!plainPassword) {
      return res.status(400).json({ success: false, message: 'Password wajib diisi' });
    }

    const hashed = await bcrypt.hash(plainPassword, 12);
    const walletId = generateWalletId();

    const landlord = await Company.create({
      companyId: generateCompanyId(),
      name,
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      password: hashed,
      contactName: name,
      phone: phone || verified.record.payload?.phone,
      location: location || verified.record.payload?.location,
      walletId,
      walletGenerated: true,
      role: 'landlord',
      emailVerified: true,
    });

    const sessionToken = generateToken('tok');
    await Session.create({ token: sessionToken, userId: landlord._id.toString(), role: 'landlord' });

    res.status(201).json({
      success: true,
      token: sessionToken,
      user: {
        id: landlord._id,
        name: landlord.name,
        email: landlord.email,
        role: 'landlord',
        walletId: landlord.walletId,
        walletGenerated: true,
        emailVerified: true,
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
      success: true,
      token: sessionToken,
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
        id: company._id,
        name: company.name,
        email: company.email,
        username: company.username,
        role: company.role,
        walletId: company.walletId,
        walletGenerated: !!company.walletId,
        esgScore: company.esgScore,
        companyId: company.companyId,
        emailVerified: company.emailVerified,
        companyType: company.companyType,
        position: company.position,
        officeAddress: company.officeAddress,
        siteAddress: company.siteAddress,
        emissionObject: company.emissionObject,
        calcMethod: company.calcMethod,
        equityPct: company.equityPct,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  registerCompany, login, logout, registerLandlord, adminLogin, getMe,
  sendVerification, verifyEmailLink, checkUsername,
};
