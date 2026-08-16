const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const ctrl = require('../controllers/evidenceController');

router.post('/upload', requireAuth, upload.single('file'), ctrl.uploadEvidence);
router.post('/:id/analyze', requireAuth, ctrl.analyzeEvidence);
router.post('/analyze-text', requireAuth, ctrl.analyzeChatText);
router.get('/', requireAuth, ctrl.listEvidence);
router.get('/:id', requireAuth, ctrl.getEvidence);

module.exports = router;
