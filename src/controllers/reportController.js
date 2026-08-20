const Evidence = require('../models/Evidence');
const Report = require('../models/Report');
const { buildEvidenceReportPdf } = require('../services/pdfService');
const { randomCode } = require('../utils/codeGenerator');

/**
 * Generates (or re-serves) a PDF evidence report for a given evidence item
 * owned by the requesting user. Streams the PDF back directly — nothing is
 * written to disk, since Vercel's filesystem is read-only in production.
 */
async function generateEvidenceReport(req, res) {
  try {
    const evidence = await Evidence.findOne({ _id: req.params.evidenceId, owner: req.user.id });
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

    // Reuse an existing report for this evidence if one was already
    // generated, so the reportId and generatedAt stay stable and the PDF
    // (and its hash) stay reproducible on re-download.
    let report = await Report.findOne({ evidence: evidence._id, type: 'evidence_analysis' });
    const reportId = report ? report.reportId : randomCode('RPT');
    const generatedAt = report ? report.generatedAt : new Date();

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers.host;
    const verifyUrl = `${protocol}://${host}/api/reports/${reportId}/verify`;

    const { buffer, reportHash } = await buildEvidenceReportPdf({
      evidence,
      reportId,
      generatedAt,
      verifyUrl
    });

    if (!report) {
      report = await Report.create({
        reportId,
        type: 'evidence_analysis',
        evidence: evidence._id,
        owner: req.user.id,
        reportHash,
        generatedAt
      });
      evidence.timeline.push({ event: 'report_generated', meta: { reportId } });
      await evidence.save();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${evidence.evidenceCode}-report.pdf"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'Report generation failed', details: err.message });
  }
}

/**
 * PUBLIC endpoint (no auth) — lets anyone with a Report ID confirm a report
 * genuinely exists and hasn't been altered, WITHOUT exposing the private
 * evidence itself. If a `hash` query param is supplied (the hash of a PDF
 * someone is holding), it's compared against the stored report hash.
 */
async function verifyReport(req, res) {
  try {
    const report = await Report.findOne({ reportId: req.params.reportId });
    if (!report) {
      return res.status(404).json({ verified: false, error: 'No report found with this ID.' });
    }

    const suppliedHash = req.query.hash;
    const hashMatches = suppliedHash ? suppliedHash === report.reportHash : null;

    return res.json({
      verified: true,
      reportId: report.reportId,
      type: report.type,
      generatedAt: report.generatedAt,
      version: report.version,
      hashMatches, // null if no hash was supplied to compare
      note: 'This confirms the report exists and its generation timestamp. It does not expose the underlying private evidence.'
    });
  } catch (err) {
    return res.status(500).json({ error: 'Verification failed', details: err.message });
  }
}

module.exports = { generateEvidenceReport, verifyReport };
