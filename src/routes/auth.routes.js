const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register-company', authLimiter, ctrl.registerCompany);
router.post('/login', authLimiter, ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.post('/register-landlord', authLimiter, ctrl.registerLandlord);
router.post('/admin-login', authLimiter, ctrl.adminLogin);
router.get('/me', authenticate, ctrl.getMe);

module.exports = router;
