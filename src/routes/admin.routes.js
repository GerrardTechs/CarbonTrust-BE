const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/overview', ctrl.getOverview);
router.get('/companies', ctrl.listCompanies);
router.patch('/company/:id/verify-iso', ctrl.verifyIso);
router.patch('/company/:id/esg', ctrl.updateEsg);

module.exports = router;
