const router = require('express').Router();
const ctrl = require('../controllers/landlord.controller');
const { authenticate } = require('../middleware/auth');

router.get('/:id/parcels', authenticate, ctrl.getLandlordParcels);
router.get('/:id/summary', authenticate, ctrl.getLandlordSummary);

module.exports = router;
