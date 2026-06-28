const crypto = require('crypto');
const { Resend } = require('resend');

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Resend] ⚠️  RESEND_API_KEY not set in .env');
    return null;
  }
  console.log('[Resend] 🔌 Connecting to Resend API...');
  return new Resend(process.env.RESEND_API_KEY);
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail({ to, name, token, role }) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const verifyUrl = `${backendUrl}/api/auth/verify-email-link?token=${token}&email=${encodeURIComponent(to)}`;
  const roleLabel = role === 'landlord' ? 'Landlord' : 'Company';
  const shortCode = token.slice(0, 8).toUpperCase();

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="background:linear-gradient(135deg,#14532d,#0f766e);border-radius:16px;padding:32px 24px;text-align:center;margin-bottom:24px;">
        <h1 style="color:#fff;font-size:22px;font-weight:900;margin:0 0 6px;">CarbonTrust</h1>
        <p style="color:rgba(255,255,255,.75);font-size:13px;margin:0;">Carbon Credit Management Platform</p>
      </div>
      <h2 style="font-size:18px;font-weight:800;color:#1e293b;margin:0 0 8px;">Verify Your Email</h2>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Hello <strong>${name || 'User'}</strong>, thank you for registering as a <strong>${roleLabel}</strong> on CarbonTrust.
        Click the button below to verify your email address.
      </p>
      <a href="${verifyUrl}" style="display:block;background:linear-gradient(135deg,#166534,#0f766e);color:#fff;text-align:center;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:20px;">
        ✅ Verify My Email →
      </a>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;margin-bottom:20px;">
        <p style="font-size:12px;color:#166534;margin:0 0 4px;font-weight:700;">Or enter this code in the app:</p>
        <p style="font-family:monospace;font-size:16px;font-weight:900;color:#14532d;margin:0;letter-spacing:.1em;">${shortCode}</p>
      </div>
      <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0;">
        This link & code are valid for 24 hours. Ignore this email if you did not sign up.
      </p>
    </div>
  `;

  const text = [
    `Hello ${name || 'User'},`,
    '',
    `Thank you for registering on CarbonTrust as a ${roleLabel}.`,
    '',
    'Click the link below to verify your email address:',
    verifyUrl,
    '',
    `Or enter this verification code in the app: ${shortCode}`,
    '',
    'This link is valid for 24 hours.',
    '',
    '— CarbonTrust Platform',
  ].join('\n');

  const resend = getResendClient();
  const fromName  = process.env.EMAIL_FROM_NAME || 'CarbonTrust';
  const fromEmail = process.env.EMAIL_FROM;

  if (resend && fromEmail) {
    console.log(`[Resend] 📤 Sending verification email to ${to} from "${fromName} <${fromEmail}>"...`);

    try {
      const { data, error } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: 'Verify Your Email — CarbonTrust',
        html,
        text,
      });

      if (error) {
        console.error('[Resend] ❌ Failed to send email:', error);
      } else {
        console.log(`[Resend] ✅ Email sent successfully to ${to} (id: ${data?.id})`);
        return { sent: true, verifyUrl };
      }
    } catch (err) {
      console.error('[Resend] ❌ Exception while sending email:', err.message);
      // fallback to dev log below
    }
  } else {
    console.warn('[Resend] ⚠️  Resend not configured — set RESEND_API_KEY & EMAIL_FROM in .env');
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