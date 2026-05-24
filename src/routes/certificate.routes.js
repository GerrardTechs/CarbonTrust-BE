const router = require('express').Router();
const ctrl = require('../controllers/certificate.controller');
const { authenticate } = require('../middleware/auth');

router.get('/:companyId', authenticate, ctrl.getCertificate);

module.exports = router;
