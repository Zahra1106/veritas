const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/User');

function signToken(user, sessionId) {
  return jwt.sign({ id: user._id, role: user.role, sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

function signTempTwoFactorToken(userId) {
  // Short-lived, single-purpose token: only valid for completing 2FA login,
  // not for accessing any other route (no sessionId, and routes check
  // decoded.type separately from requireAuth's normal usage).
  return jwt.sign({ id: userId, type: '2fa_pending' }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    const userAgent = req.headers['user-agent'] || '';
    user.sessions.push({ ip: req.ip, userAgent, deviceLabel: userAgent.slice(0, 60) });
    await user.save();
    const session = user.sessions[user.sessions.length - 1];

    const token = signToken(user, session._id);
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed', details: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });

    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || '';

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password || '', user.passwordHash);

    user.loginHistory.push({ ip, userAgent, success: valid });
    if (!valid) {
      await user.save();
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // If 2FA is enabled, don't issue a full session token yet — require a
    // second step with a TOTP code first.
    if (user.twoFactorEnabled) {
      await user.save();
      return res.json({
        requiresTwoFactor: true,
        tempToken: signTempTwoFactorToken(user._id)
      });
    }

    user.sessions.push({ ip, userAgent, deviceLabel: userAgent.slice(0, 60) });
    await user.save();
    const session = user.sessions[user.sessions.length - 1];

    const token = signToken(user, session._id);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, twoFactorEnabled: user.twoFactorEnabled }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed', details: err.message });
  }
}

/**
 * Step 2 of login when 2FA is enabled: verify the 6-digit TOTP code against
 * the tempToken issued by /login, then issue a full session token.
 */
async function verifyTwoFactorLogin(req, res) {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code are required' });

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'This login attempt expired. Please sign in again.' });
    }
    if (decoded.type !== '2fa_pending') return res.status(401).json({ error: 'Invalid token for this step' });

    const user = await User.findById(decoded.id);
    if (!user || !user.twoFactorEnabled) return res.status(400).json({ error: '2FA is not enabled for this account' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1
    });
    if (!verified) return res.status(401).json({ error: 'Incorrect or expired code' });

    const userAgent = req.headers['user-agent'] || '';
    user.sessions.push({ ip: req.ip, userAgent, deviceLabel: userAgent.slice(0, 60) });
    await user.save();
    const session = user.sessions[user.sessions.length - 1];

    const token = signToken(user, session._id);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, twoFactorEnabled: true }
    });
  } catch (err) {
    return res.status(500).json({ error: '2FA verification failed', details: err.message });
  }
}

/** Step 1 of enabling 2FA: generate a secret + QR code (not yet active). */
async function setupTwoFactor(req, res) {
  try {
    const user = await User.findById(req.user.id);
    const secret = speakeasy.generateSecret({ name: `Veritas (${user.email})` });

    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = false; // not active until verified
    await user.save();

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    return res.json({ qrCode: qrDataUrl, manualEntryKey: secret.base32 });
  } catch (err) {
    return res.status(500).json({ error: '2FA setup failed', details: err.message });
  }
}

/** Step 2 of enabling 2FA: confirm the user's authenticator app is synced. */
async function confirmTwoFactor(req, res) {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user.id);
    if (!user.twoFactorSecret) return res.status(400).json({ error: 'Run 2FA setup first' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1
    });
    if (!verified) return res.status(401).json({ error: 'Incorrect code. Check your authenticator app and try again.' });

    user.twoFactorEnabled = true;
    await user.save();
    return res.json({ message: 'Two-factor authentication enabled', twoFactorEnabled: true });
  } catch (err) {
    return res.status(500).json({ error: 'Could not confirm 2FA', details: err.message });
  }
}

async function disableTwoFactor(req, res) {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user.id);
    const valid = await bcrypt.compare(password || '', user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();
    return res.json({ message: 'Two-factor authentication disabled', twoFactorEnabled: false });
  } catch (err) {
    return res.status(500).json({ error: 'Could not disable 2FA', details: err.message });
  }
}

async function me(req, res) {
  const user = await User.findById(req.user.id).select('-passwordHash -twoFactorSecret');
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
}

async function sessions(req, res) {
  const user = await User.findById(req.user.id).select('sessions');
  const currentSessionId = req.user.sessionId;
  const list = user.sessions
    .filter((s) => !s.revoked)
    .map((s) => ({
      id: s._id,
      deviceLabel: s.deviceLabel,
      ip: s.ip,
      loginAt: s.loginAt,
      lastSeenAt: s.lastSeenAt,
      isCurrent: String(s._id) === String(currentSessionId)
    }));
  return res.json({ sessions: list });
}

async function revokeSession(req, res) {
  const user = await User.findById(req.user.id);
  const session = user.sessions.id(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.revoked = true;
  await user.save();
  return res.json({ message: 'Session revoked' });
}

async function logoutAllDevices(req, res) {
  const user = await User.findById(req.user.id);
  user.sessions.forEach((s) => (s.revoked = true));
  await user.save();
  return res.json({ message: 'Logged out from all devices' });
}

module.exports = {
  register,
  login,
  verifyTwoFactorLogin,
  setupTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  me,
  sessions,
  revokeSession,
  logoutAllDevices
};
