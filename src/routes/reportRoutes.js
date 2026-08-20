const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

// Auth required — generates/downloads the PDF for evidence you own.
router.get('/evidence/:evidenceId', requireAuth, ctrl.generateEvidenceReport);

// PUBLIC — no auth. Anyone with a report ID can confirm it exists and
// check its hash, without seeing the private evidence itself.
router.get('/:reportId/verify', ctrl.verifyReport);

module.exports = router;
