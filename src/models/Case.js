const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema(
  {
    caseCode: { type: String, required: true, unique: true }, // e.g. CASE-2201
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: [
        'blackmail', 'threat', 'harassment', 'fraud', 'impersonation',
        'fake_content', 'non_consensual_content', 'deepfake_abuse', 'other'
      ],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['draft', 'evidence_collected', 'under_analysis', 'review_recommended', 'report_ready', 'submitted', 'closed'],
      default: 'draft'
    },
    riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    notes: [
      {
        text: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now }
      }
    ],
    evidenceItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
    reportedToAuthority: { type: Boolean, default: false },
    reportedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('Case', caseSchema);
