const router = require('express').Router();
const ctrl = require('../controllers/emission.controller');
const { authenticate } = require('../middleware/auth');
const { emissionLimiter } = require('../middleware/rateLimit');

router.post('/calculate-v2', authenticate, emissionLimiter, ctrl.calculateV2);
router.get('/history/:companyId', authenticate, ctrl.getHistory);

module.exports = router;
