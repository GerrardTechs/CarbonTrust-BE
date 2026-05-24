const router = require('express').Router();
const ctrl = require('../controllers/public.controller');
const { generalLimiter } = require('../middleware/rateLimit');

router.get('/projects', generalLimiter, ctrl.getProjects);
router.get('/company/:id', generalLimiter, ctrl.getPublicCompany);

module.exports = router;
