const Case = require('../models/Case');
const Evidence = require('../models/Evidence');
const { randomCode } = require('../utils/codeGenerator');

async function createCase(req, res) {
  const { title, category } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const newCase = await Case.create({
    caseCode: randomCode('CASE'),
    owner: req.user.id,
    title,
    category: category || 'other'
  });

  return res.status(201).json({ case: newCase });
}

async function listCases(req, res) {
  const cases = await Case.find({ owner: req.user.id }).sort({ updatedAt: -1 });
  return res.json({ cases });
}

async function getCase(req, res) {
  const found = await Case.findOne({ _id: req.params.id, owner: req.user.id }).populate('evidenceItems');
  if (!found) return res.status(404).json({ error: 'Case not found' });
  return res.json({ case: found });
}

async function addEvidenceToCase(req, res) {
  const { evidenceId } = req.body;
  const found = await Case.findOne({ _id: req.params.id, owner: req.user.id });
  if (!found) return res.status(404).json({ error: 'Case not found' });

  const evidence = await Evidence.findOne({ _id: evidenceId, owner: req.user.id });
  if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

  if (!found.evidenceItems.includes(evidenceId)) {
    found.evidenceItems.push(evidenceId);
  }
  evidence.caseId = found._id;

  await Promise.all([found.save(), evidence.save()]);
  return res.json({ case: found });
}

async function updateStatus(req, res) {
  const { status } = req.body;
  const allowed = ['draft', 'evidence_collected', 'under_analysis', 'review_recommended', 'report_ready', 'submitted', 'closed'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const found = await Case.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id },
    { status },
    { new: true }
  );
  if (!found) return res.status(404).json({ error: 'Case not found' });
  return res.json({ case: found });
}

async function addNote(req, res) {
  const { text } = req.body;
  const found = await Case.findOne({ _id: req.params.id, owner: req.user.id });
  if (!found) return res.status(404).json({ error: 'Case not found' });

  found.notes.push({ text, addedBy: req.user.id });
  await found.save();
  return res.json({ case: found });
}

module.exports = { createCase, listCases, getCase, addEvidenceToCase, updateStatus, addNote };
