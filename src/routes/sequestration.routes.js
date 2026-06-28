const router = require('express').Router();
const ctrl = require('../controllers/sequestration.controller');
const { authenticate } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const upload = require('../middleware/upload');

const certFields = upload.fields([
  { name: 'emissionCert', maxCount: 1 },
  { name: 'sequestrationCert', maxCount: 1 },
]);

router.use(authenticate);

router.get('/:companyId', ctrl.getSequestration);
router.post('/:companyId', uploadLimiter, certFields, ctrl.saveSequestration);

module.exports = router;
