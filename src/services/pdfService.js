const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');

const COLORS = {
  heading: '#2c1c2c',
  text: '#332233',
  muted: '#7a6678',
  accent: '#9b5fc0',
  risk: '#c4568e'
};

function verdictLabel(v) {
  switch (v) {
    case 'likely_ai_generated': return 'Likely AI Generated';
    case 'potentially_manipulated': return 'Potentially Manipulated';
    case 'likely_authentic': return 'Likely Authentic';
    default: return 'Inconclusive';
  }
}

/**
 * Builds a professional Evidence Analysis Report PDF as an in-memory buffer
 * (no disk writes — required for Vercel's read-only filesystem). Embeds a
 * QR code that links to a public verification endpoint, and returns both
 * the buffer and its SHA-256 hash so the report itself can later be
 * verified as unmodified.
 */
async function buildEvidenceReportPdf({ evidence, reportId, generatedAt, verifyUrl }) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const reportHash = crypto.createHash('sha256').update(buffer).digest('hex');
        resolve({ buffer, reportHash });
      });
      doc.on('error', reject);

      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');

      // Header
      doc.fillColor(COLORS.heading).fontSize(20).font('Helvetica-Bold').text('Veritas', { continued: true });
      doc.fillColor(COLORS.muted).fontSize(10).font('Helvetica').text('  Digital Evidence Verification Report');
      doc.moveDown(0.3);
      doc.strokeColor('#e0d5de').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Evidence info
      doc.fillColor(COLORS.heading).fontSize(13).font('Helvetica-Bold').text('Evidence Information');
      doc.moveDown(0.4);
      const analysis = evidence.analysis || {};
      const infoRows = [
        ['Evidence ID', evidence.evidenceCode || '-'],
        ['Report ID', reportId],
        ['Original filename', evidence.originalFilename || '-'],
        ['File type', evidence.mimeType || '-'],
        ['File size', `${((evidence.fileSizeBytes || 0) / 1024).toFixed(1)} KB`],
        ['SHA-256 hash', evidence.sha256 || '-'],
        ['Uploaded at', evidence.createdAt ? new Date(evidence.createdAt).toISOString() : '-'],
        ['Report generated at', generatedAt.toISOString()]
      ];
      doc.font('Helvetica').fontSize(10);
      infoRows.forEach(([k, v]) => {
        doc.fillColor(COLORS.muted).text(k, 50, doc.y, { continued: true, width: 160 });
        doc.fillColor(COLORS.text).text('  ' + v);
      });

      doc.moveDown(1);
      doc.fillColor(COLORS.heading).fontSize(13).font('Helvetica-Bold').text('AI Analysis');
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(10);
      const verdict = verdictLabel(analysis.verdict);
      doc.fillColor(COLORS.muted).text('Authenticity assessment', 50, doc.y, { continued: true, width: 160 });
      doc.fillColor(COLORS.risk).font('Helvetica-Bold').text('  ' + verdict);
      doc.font('Helvetica').fillColor(COLORS.muted).text('Confidence', 50, doc.y, { continued: true, width: 160 });
      doc.fillColor(COLORS.text).text('  ' + (analysis.confidencePercent != null ? analysis.confidencePercent + '%' : 'N/A'));
      doc.fillColor(COLORS.muted).text('AI-generation probability', 50, doc.y, { continued: true, width: 160 });
      doc.fillColor(COLORS.text).text('  ' + (analysis.aiGenerationProbability != null ? analysis.aiGenerationProbability + '%' : 'N/A'));
      doc.fillColor(COLORS.muted).text('Digital safety risk score', 50, doc.y, { continued: true, width: 160 });
      doc.fillColor(COLORS.text).text('  ' + (analysis.riskScore != null ? `${analysis.riskScore}/100 (${analysis.riskLevel})` : 'N/A'));
      doc.fillColor(COLORS.muted).text('Model source', 50, doc.y, { continued: true, width: 160 });
      doc.fillColor(COLORS.text).text('  ' + (analysis.modelSource || 'N/A'));

      doc.moveDown(0.8);
      doc.fillColor(COLORS.heading).fontSize(11).font('Helvetica-Bold').text('Detected Signals / Explanation');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text);
      const signals = analysis.signals && analysis.signals.length ? analysis.signals : ['No specific signals were flagged.'];
      signals.forEach((s) => doc.text(`•  ${s}`, { indent: 10 }));

      doc.moveDown(1);
      const boxY = doc.y;
      doc.rect(50, boxY, 495, 60).fillOpacity(0.06).fillAndStroke('#c4568e', '#c4568e');
      doc.fillOpacity(1);
      doc.fillColor(COLORS.risk).fontSize(9).font('Helvetica-Oblique').text(
        'Disclaimer: This is an automated AI assessment, not proof or a legal conclusion. AI analysis can make mistakes and should not be treated as definitive. This report demonstrates that the file has been preserved and tracked consistently, but does not by itself make evidence legally admissible.',
        58, boxY + 6, { width: 480 }
      );
      doc.y = boxY + 70;

      // QR + verification
      const qrY = doc.y;
      doc.image(qrBuffer, 50, qrY, { width: 90 });
      doc.fillColor(COLORS.heading).fontSize(10).font('Helvetica-Bold').text('Verify this report', 155, qrY + 5);
      doc.fillColor(COLORS.muted).fontSize(8.5).font('Helvetica').text(`Report ID: ${reportId}`, 155, qrY + 22, { width: 380 });
      doc.text('Scan the QR code or visit:', 155, qrY + 36, { width: 380 });
      doc.fillColor(COLORS.accent).text(verifyUrl, 155, qrY + 48, { width: 380 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildEvidenceReportPdf };
