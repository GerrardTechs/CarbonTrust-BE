const router = require('express').Router();
const ctrl = require('../controllers/parcel.controller');
const { authenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimit');

router.get('/', authenticate, ctrl.getParcels);
router.post('/', authenticate, generalLimiter, ctrl.createParcel);
router.patch('/:id/status', authenticate, ctrl.updateStatus);
router.patch('/:id/humidity', authenticate, ctrl.updateHumidity);

module.exports = router;
