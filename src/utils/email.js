const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // ← tambah di paling atas file

const crypto     = require('crypto');
const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  
  const port = Number(process.env.SMTP_PORT || 587);
  const isSecure = process.env.SMTP_SECURE === 'true';

  console.log(`[SMTP Debug] Attempting connection to ${process.env.SMTP_HOST}:${port} (Secure: ${isSecure})`);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: isSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000, 
    socketTimeout:     10000,
    greetingTimeout:   10000,
    // logger: true, // Hapus komentar ini sementara untuk melihat log komunikasi Nodemailer
    // debug: true,  // Hapus komentar ini sementara untuk melihat traffic secara detail
  });
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail({ to, name, token, role }) {
  const baseUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/?verifyToken=${token}&email=${encodeURIComponent(to)}`;
  const roleLabel = role === 'landlord' ? 'Landlord' : 'Company';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="background:linear-gradient(135deg,#14532d,#0f766e);border-radius:16px;padding:32px 24px;text-align:center;margin-bottom:24px;">
        <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 6px;">CarbonTrust</h1>
        <p style="color:rgba(255,255,255,.75);font-size:13px;margin:0;">Platform Manajemen Kredit Karbon</p>
      </div>
      <h2 style="font-size:18px;font-weight:800;color:#1e293b;margin:0 0 8px;">Verifikasi Email Anda</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Halo <strong>${name || 'Pengguna'}</strong>, terima kasih telah mendaftar sebagai <strong>${roleLabel}</strong> di CarbonTrust.
        Klik tombol di bawah untuk memverifikasi email Anda.
      </p>
      <a href="${verifyUrl}" style="display:block;background:linear-gradient(135deg,#166534,#0f766e);color:#fff;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:20px;">
        ✅ Verifikasi Email Saya →
      </a>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
        <p style="font-size:12px;color:#166534;margin:0 0 4px;font-weight:700;">Atau masukkan kode ini di aplikasi:</p>
        <p style="font-family:monospace;font-size:16px;font-weight:900;color:#14532d;margin:0;letter-spacing:.1em;">${token.slice(0,8).toUpperCase()}</p>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
        Tautan & kode berlaku 24 jam. Abaikan email ini jika Anda tidak mendaftar.
      </p>
    </div>
  `;

  const text = [
    `Halo ${name || 'Pengguna'},`,
    '',
    `Terima kasih telah mendaftar di CarbonTrust sebagai ${roleLabel}.`,
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

  const transporter = getTransporter();

  if (transporter) {
    try {
      await transporter.sendMail({
        from:    `"CarbonTrust" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: 'Verifikasi Email — CarbonTrust',
        text,
        html,
      });
      console.log(`[email] ✅ Verification email sent to ${to}`);
      return { sent: true, verifyUrl };
    } catch (err) {
      console.error('[email] ❌ SMTP error:', err.message);
      // Tetap fallback ke log agar token bisa dipakai dev
    }
  } else {
    console.warn('[email] ⚠️  SMTP not configured — set SMTP_HOST & SMTP_USER in env');
  }

  // Dev fallback
  console.log('\n========== CARBONTRUST EMAIL (dev fallback) ==========');
  console.log(`To:    ${to}`);
  console.log(`Token: ${token}`);
  console.log(`URL:   ${verifyUrl}`);
  console.log('======================================================\n');

  return { sent: false, verifyUrl, devMode: true };
}

function getReservedUsernames() {
  const admin = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  return new Set([admin, 'administrator', 'root', 'system', 'superadmin']);
}

function isReservedUsername(username) {
  return getReservedUsernames().has(String(username || '').toLowerCase().trim());
}

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  isReservedUsername,
  getReservedUsernames,
};