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

function getRequestToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return match[1];

  return '';
}

function createAuthMiddleware() {
  return async function authMiddleware(req, res, next) {
    try {
      const token = getRequestToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: '请先登录' });
      }

      const payload = jwt.verify(token, JWT_SECRET);
      const user = await dbAsync.getUserById(payload.sub);
      if (!user) {
        return res.status(401).json({ success: false, error: '登录状态已失效' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, error: '登录状态已失效' });
    }
  };
}

const requireAuth = createAuthMiddleware();
const requireImageAuth = createAuthMiddleware();

module.exports = {
  requireAuth,
  requireImageAuth,
  signToken
};
