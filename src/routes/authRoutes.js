const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', requireAuth, ctrl.me);
router.get('/sessions', requireAuth, ctrl.sessions);
router.post('/logout-all', requireAuth, ctrl.logoutAllDevices);

module.exports = router;
