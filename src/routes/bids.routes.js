const router = require('express').Router();
const ctrl = require('../controllers/bids.controller');
const { authenticate } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimit');

router.get('/', authenticate, ctrl.getBids);
router.post('/', authenticate, generalLimiter, ctrl.createBid);
router.patch('/:id/accept', authenticate, ctrl.acceptBid);
router.patch('/:id/reject', authenticate, ctrl.rejectBid);

module.exports = router;
