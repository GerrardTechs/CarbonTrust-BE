const crypto = require('crypto');

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail({ to, name, token, role }) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/?verifyToken=${token}&email=${encodeURIComponent(to)}`;
  const subject = 'Verifikasi Email — CarbonTrust';
  const text = [
    `Halo ${name || 'Pengguna'},`,
    '',
    'Terima kasih telah mendaftar di CarbonTrust.',
    `Peran: ${role === 'landlord' ? 'Landlord' : 'Company'}`,
    '',
    'Klik tautan berikut untuk memverifikasi email Anda:',
    verifyUrl,
    '',
    `Atau masukkan kode verifikasi ini di aplikasi: ${token}`,
    '',
    'Tautan berlaku 24 jam.',
    '',
    '— CarbonTrust Platform',
  ].join('\n');

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    // Optional SMTP — install nodemailer jika diperlukan di production
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@carbontrust.app',
        to,
        subject,
        text,
        html: `<p>Halo <strong>${name || 'Pengguna'}</strong>,</p>
          <p>Verifikasi email Anda untuk melanjutkan pendaftaran CarbonTrust:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Kode: <code>${token}</code></p>`,
      });
      return { sent: true, verifyUrl };
    } catch (err) {
      console.warn('[email] SMTP gagal, fallback log:', err.message);
    }
  }

  console.log('\n========== CARBONTRUST EMAIL (dev) ==========');
  console.log(`To: ${to}`);
  console.log(subject);
  console.log(text);
  console.log('=============================================\n');

  return { sent: false, verifyUrl, devMode: true };
}

function getReservedUsernames() {
  const admin = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  return new Set([admin, 'administrator', 'root', 'system', 'superadmin']);
}

function isReservedUsername(username) {
  return getReservedUsernames().has(String(username || '').toLowerCase().trim());
}

module.exports = { generateVerificationToken, sendVerificationEmail, isReservedUsername, getReservedUsernames };