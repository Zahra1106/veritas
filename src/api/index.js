// Vercel serverless entry point. Vercel looks for a default-exported
// request handler in files under /api. We reuse the same Express app
// defined in src/server.js instead of duplicating route setup.
const app = require('../src/server');

module.exports = app;