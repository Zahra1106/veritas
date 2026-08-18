const Evidence = require('../models/Evidence');
const { sha256Buffer } = require('../services/hashService');
const { extractMetadata } = require('../services/metadataService');
const { analyzeImageAI, analyzeTextRisk } = require('../services/aiService');
const { uploadBuffer } = require('../services/cloudinaryService');
const { randomCode } = require('../utils/codeGenerator');

function mapEvidenceType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || mimeType.includes('word')) return 'document';
  return 'document';
}

/**
 * Step 1: Upload evidence -> hash -> extract metadata -> upload original to
 * Cloudinary (permanent storage) -> create Evidence ID.
 * Everything works off the in-memory buffer (multer memoryStorage) since
 * Vercel's filesystem is read-only/ephemeral in production.
 */
async function uploadEvidence(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const buffer = req.file.buffer;
    const sha256 = sha256Buffer(buffer);

    // Deduplication check via hash
    const duplicate = await Evidence.findOne({ sha256, owner: req.user.id });
    if (duplicate) {
      return res.status(200).json({
        message: 'This exact file was already uploaded (matched by hash).',
        evidence: duplicate
      });
    }

    const metadata = await extractMetadata(buffer, req.file.mimetype, req.file.size);

    const cloudinaryResult = await uploadBuffer(buffer, {
      originalFilename: req.file.originalname
    });

    const evidence = await Evidence.create({
      evidenceCode: randomCode('EV'),
      owner: req.user.id,
      originalFilename: req.file.originalname,
      storedUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      sha256,
      evidenceType: mapEvidenceType(req.file.mimetype),
      metadata,
      timeline: [
        { event: 'uploaded' },
        { event: 'hashed', meta: { sha256 } }
      ]
    });

    return res.status(201).json({ evidence });
  } catch (err) {
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
}

/**
 * Step 2: Run AI analysis on a previously uploaded evidence item.
 */
async function analyzeEvidence(req, res) {
  try {
    const evidence = await Evidence.findOne({ _id: req.params.id, owner: req.user.id });
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

    evidence.analysis.status = 'processing';
    evidence.timeline.push({ event: 'analysis_started' });
    await evidence.save();

    let aiGenerationProbability = null;
    let signals = [];
    let modelSource = 'none';

    if (evidence.evidenceType === 'image') {
      const result = await analyzeImageAI(evidence.storedUrl);
      aiGenerationProbability = result.aiGenerationProbability;
      signals = signals.concat(result.signals || []);
      modelSource = 'huggingface:image-ai-detector';
      if (result.status === 'inconclusive') signals.push(result.reason ? `Note: ${result.reason}` : 'Inconclusive');
    }

    if (!evidence.metadata?.exifAvailable && evidence.evidenceType === 'image') {
      signals.push('No EXIF metadata found — common after export via messaging apps, but also seen in edited or generated images.');
    }

    let verdict = 'inconclusive';
    let confidence = null;

    if (aiGenerationProbability !== null) {
      confidence = aiGenerationProbability;
      if (aiGenerationProbability >= 70) verdict = 'likely_ai_generated';
      else if (aiGenerationProbability >= 35) verdict = 'potentially_manipulated';
      else verdict = 'likely_authentic';
    }

    const riskScore = aiGenerationProbability !== null ? Math.round(aiGenerationProbability * 0.7) : 0;
    const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 30 ? 'medium' : 'low';

    evidence.analysis = {
      status: 'completed',
      verdict,
      confidencePercent: confidence,
      aiGenerationProbability,
      manipulationProbability: null,
      signals,
      riskScore,
      riskLevel,
      modelSource,
      analyzedAt: new Date()
    };
    evidence.timeline.push({ event: 'analysis_completed' });
    await evidence.save();

    return res.json({ evidence, disclaimer: 'This is an automated assessment, not proof or a legal conclusion.' });
  } catch (err) {
    return res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
}

/**
 * Text/chat risk analysis — accepts raw pasted text, not a file.
 */
async function analyzeChatText(req, res) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const result = analyzeTextRisk(text);
    return res.json({
      ...result,
      disclaimer: 'These are automated risk indicators, not proof of a crime. If you feel unsafe, consider using the Safety Center.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Text analysis failed', details: err.message });
  }
}

async function listEvidence(req, res) {
  const items = await Evidence.find({ owner: req.user.id }).sort({ createdAt: -1 });
  return res.json({ items });
}

async function getEvidence(req, res) {
  const evidence = await Evidence.findOne({ _id: req.params.id, owner: req.user.id });
  if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

  evidence.accessLog.push({ userId: req.user.id, action: 'view' });
  evidence.timeline.push({ event: 'accessed' });
  await evidence.save();

  return res.json({ evidence });
}

module.exports = { uploadEvidence, analyzeEvidence, analyzeChatText, listEvidence, getEvidence };