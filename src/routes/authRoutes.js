const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/2fa/login-verify', ctrl.verifyTwoFactorLogin);

router.get('/me', requireAuth, ctrl.me);
router.post('/2fa/setup', requireAuth, ctrl.setupTwoFactor);
router.post('/2fa/confirm', requireAuth, ctrl.confirmTwoFactor);
router.post('/2fa/disable', requireAuth, ctrl.disableTwoFactor);

router.get('/sessions', requireAuth, ctrl.sessions);
router.delete('/sessions/:sessionId', requireAuth, ctrl.revokeSession);
router.post('/logout-all', requireAuth, ctrl.logoutAllDevices);

module.exports = router;
