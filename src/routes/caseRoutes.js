const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/caseController');

router.post('/', requireAuth, ctrl.createCase);
router.get('/', requireAuth, ctrl.listCases);
router.get('/:id', requireAuth, ctrl.getCase);
router.post('/:id/evidence', requireAuth, ctrl.addEvidenceToCase);
router.patch('/:id/status', requireAuth, ctrl.updateStatus);
router.post('/:id/notes', requireAuth, ctrl.addNote);

module.exports = router;
