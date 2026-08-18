const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true }, // uploaded, hashed, analysis_started, analysis_completed, report_generated, accessed, exported
    at: { type: Date, default: Date.now },
    meta: mongoose.Schema.Types.Mixed
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    evidenceCode: { type: String, required: true, unique: true }, // e.g. EV-4471
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', default: null },

    originalFilename: String,
    storedUrl: String, // permanent Cloudinary URL — the "original" file, never modified
    cloudinaryPublicId: String,
    mimeType: String,
    fileSizeBytes: Number,
    sha256: { type: String, required: true, index: true },

    evidenceType: {
      type: String,
      enum: ['image', 'video', 'audio', 'screenshot', 'document', 'chat_export'],
      required: true
    },

    metadata: mongoose.Schema.Types.Mixed, // raw EXIF / file metadata, never mutates original

    analysis: {
      status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
      verdict: {
        type: String,
        enum: ['likely_authentic', 'likely_ai_generated', 'potentially_manipulated', 'inconclusive'],
        default: null
      },
      confidencePercent: { type: Number, default: null },
      aiGenerationProbability: { type: Number, default: null },
      manipulationProbability: { type: Number, default: null },
      signals: [String], // human-readable explanation bullet points
      riskScore: { type: Number, default: null }, // 0-100
      riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: null },
      modelSource: String, // which detector/model produced this
      rawModelOutput: mongoose.Schema.Types.Mixed,
      analyzedAt: Date
    },

    timeline: [timelineEventSchema],
    accessLog: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: String, // view, download, export
        at: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Evidence', evidenceSchema);