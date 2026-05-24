const router = require('express').Router();
const ctrl = require('../controllers/iot.controller');
const { authenticate } = require('../middleware/auth');
const { iotPushLimiter } = require('../middleware/rateLimit');

router.get('/company/:companyId', authenticate, ctrl.getCompanyIot);
router.get('/:parcelId/history', authenticate, ctrl.getHistory);
router.post('/:parcelId/push', iotPushLimiter, ctrl.pushData); // no auth - IoT devices use device key (future)

module.exports = router;
