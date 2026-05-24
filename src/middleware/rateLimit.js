const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi setelah 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { success: false, message: 'Terlalu banyak upload. Coba lagi setelah 1 jam.' },
});

const emissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, message: 'Terlalu banyak kalkulasi. Tunggu sebentar.' },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Rate limit tercapai. Tunggu sebentar.' },
});

const iotPushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // ~1/second for IoT devices
  message: { success: false, message: 'IoT push rate limit. Tunggu sebentar.' },
});

module.exports = { authLimiter, uploadLimiter, emissionLimiter, generalLimiter, iotPushLimiter };
