const jwt = require('jsonwebtoken');
const { dbAsync } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-change-me-seeyou';

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ success: false, error: '请先登录' });
    }

    const payload = jwt.verify(match[1], JWT_SECRET);
    const user = await dbAsync.getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: '登录状态已失效' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: '登录状态已失效' });
  }
}

module.exports = {
  requireAuth,
  signToken
};
