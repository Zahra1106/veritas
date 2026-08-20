const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true }, // e.g. RPT-8841
    type: { type: String, enum: ['evidence_analysis', 'chain_of_custody'], required: true },
    evidence: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportHash: { type: String, required: true }, // SHA-256 of the generated PDF bytes
    version: { type: Number, default: 1 },
    generatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
