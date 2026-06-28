require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { setupWebSocket } = require('./utils/websocket');
const connectDB = require('../config/db');

// Routes
const authRoutes = require('./routes/auth.routes');
const companyRoutes = require('./routes/company.routes');
const parcelRoutes = require('./routes/parcel.routes');
const emissionRoutes = require('./routes/emission.routes');
const bidsRoutes = require('./routes/bids.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');
const certificateRoutes = require('./routes/certificate.routes');
const landlordRoutes = require('./routes/landlord.routes');
const sequestrationRoutes = require('./routes/sequestration.routes');

const app = express();
const server = http.createServer(app);

// Required on Render/reverse proxies so rate limits use the real client IP
app.set('trust proxy', 1);

// WebSocket setup
setupWebSocket(server);

// Connect DB
connectDB();

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/parcels', parcelRoutes);
app.use('/api/emissions', emissionRoutes);
app.use('/api/bids', bidsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/certificate', certificateRoutes);
app.use('/api/landlord', landlordRoutes);
app.use('/api/sequestration', sequestrationRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan' }));

// Tambahkan route ini agar saat URL utama dibuka, ia merespons dengan benar
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to CarbonTrust Backend API is running smoothly!"
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`CarbonTrust API running on port ${PORT}`));

module.exports = app;
