const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
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

    const token = signToken(user);
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

    user.sessions.push({ ip, userAgent, deviceLabel: userAgent.slice(0, 60) });
    await user.save();

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, twoFactorEnabled: user.twoFactorEnabled }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed', details: err.message });
  }
}

async function me(req, res) {
  const user = await User.findById(req.user.id).select('-passwordHash -twoFactorSecret');
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
}

async function sessions(req, res) {
  const user = await User.findById(req.user.id).select('sessions');
  return res.json({ sessions: user.sessions });
}

async function logoutAllDevices(req, res) {
  const user = await User.findById(req.user.id);
  user.sessions.forEach((s) => (s.revoked = true));
  await user.save();
  return res.json({ message: 'Logged out from all devices' });
}

module.exports = { register, login, me, sessions, logoutAllDevices };
