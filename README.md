# CarbonTrust Backend API

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env
cp .env.example .env
# Edit .env sesuai konfigurasi

# 3. Pastikan MongoDB berjalan
# mongod --dbpath /data/db

# 4. Jalankan server
npm start
# atau dev mode
npm run dev
```

## Struktur Project

```
carbontrust/
├── config/
│   └── db.js                  # MongoDB connection
├── src/
│   ├── app.js                 # Entry point
│   ├── controllers/           # Business logic
│   ├── models/                # Mongoose schemas
│   ├── routes/                # Express routers
│   ├── middleware/
│   │   ├── auth.js            # Token auth + role guard
│   │   ├── rateLimit.js       # Rate limiters
│   │   └── upload.js          # Multer file upload
│   └── utils/
│       ├── tokens.js          # Token/ID generators
│       ├── websocket.js       # WS broadcast
│       ├── iotSimulator.js    # IoT data generator
│       └── emissionCalc.js    # Emission factors + calc
├── uploads/                   # Uploaded files
├── .env.example
└── package.json
```

## Roles
- **company** - Perusahaan emitter/seller carbon credits
- **landlord** - Pemilik lahan, kelola parcel
- **admin** - Admin platform (hardcoded credentials)
- **public** - Tanpa auth (marketplace view)

## WebSocket Events
Connect ke `ws://localhost:3000`
- `parcel_updated` - Status parcel berubah
- `new_bid` - Bid baru masuk
- `bid_accepted` - Bid diterima
- `iot_live` - Data IoT realtime dari device

## Rate Limits
| Endpoint | Limit |
|----------|-------|
| Auth endpoints (login, register, dll.) | 20 req / 15 menit |
| Check username | 60 req / menit |
| Upload endpoints | 20 req / jam |
| Emission calc | 30 req / menit |
| IoT push | 60 req / menit |
| General | 100 req / menit |
"# CarbonTrust-BE" 
