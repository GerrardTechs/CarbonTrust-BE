const router = require('express').Router();
const ctrl = require('../controllers/company.controller');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const upload = require('../middleware/upload');

router.get('/:id', authenticate, ctrl.getCompany);
router.put('/:id', authenticate, ctrl.updateCompany);
router.put('/:id/stock', authenticate, ctrl.updateStock);
router.post('/:id/upload-iso', authenticate, uploadLimiter, upload.single('isoCert'), ctrl.uploadIso);
router.post('/:id/upload-ownership', authenticate, uploadLimiter, upload.single('ownershipDoc'), ctrl.uploadOwnership);

module.exports = router;
