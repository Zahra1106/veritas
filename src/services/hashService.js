const crypto = require('crypto');

/**
 * Computes a real SHA-256 hash directly from an in-memory buffer.
 * This is used as the evidence fingerprint for chain-of-custody.
 * (No disk read needed — works the same locally and on Vercel.)
 */
function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = { sha256Buffer };