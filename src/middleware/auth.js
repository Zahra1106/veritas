const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If the token carries a session id, confirm that session hasn't been
    // revoked (e.g. via "Log out of all devices"). This is what makes
    // device/session management actually enforce logout, instead of just
    // being a display list.
    if (decoded.sessionId) {
      const user = await User.findOne(
        { _id: decoded.id, 'sessions._id': decoded.sessionId },
        { 'sessions.$': 1 }
      );
      const session = user?.sessions?.[0];
      if (!session || session.revoked) {
        return res.status(401).json({ error: 'This session has been logged out. Please sign in again.' });
      }
    }

    req.user = decoded; // { id, role, sessionId }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
