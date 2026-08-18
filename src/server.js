require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const caseRoutes = require('./routes/caseRoutes');

const app = express();

// Connect to MongoDB. On Vercel this runs once per cold start; the
// connection is cached (see src/config/db.js) so repeated calls are cheap.
// process.exit() is deliberately NOT used here — that's fine for a normal
// long-running server, but on Vercel it kills the serverless function and
// shows a 500 crash page instead of a useful error.
connectDB().catch((err) => {
  console.error('[db] Failed to connect (check MONGO_URI in your environment variables):', err.message);
});

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

// Make sure the DB connection is ready before any /api request is handled.
// Without this, a cold-start request could hit a route before mongoose has
// finished connecting, causing intermittent failures.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable. Check MONGO_URI / network access settings.' });
  }
});

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'veritas-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/cases', caseRoutes);

// Central error handler (e.g. multer file errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Only start a normal listening server when run directly (e.g. `npm run dev`
// locally). On Vercel, this file is imported by api/index.js instead, and
// Vercel's own runtime handles incoming requests without app.listen().
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`[server] Veritas backend running on port ${PORT}`));
}

module.exports = app;