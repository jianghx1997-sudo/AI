const express = require('express');
const bcrypt = require('bcryptjs');

const { dbAsync } = require('../database');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validateCredentials({ username, password }) {
  if (!username || username.length < 3 || username.length > 32) {
    return '用户名长度需要在 3-32 位之间';
  }
  if (!/^[a-zA-Z0-9_@.-]+$/.test(username)) {
    return '用户名只能包含字母、数字、下划线、点、@ 或短横线';
  }
  if (!password || String(password).length < 6) {
    return '密码至少需要 6 位';
  }
  return '';
}

router.post('/auth/register', async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');
    const displayName = String(req.body.display_name || req.body.displayName || username).trim();
    const validationError = validateCredentials({ username, password });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const existing = await dbAsync.getUserByUsername(username);
    if (existing) {
      return res.status(409).json({ success: false, error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await dbAsync.createUser({
      username,
      password_hash: passwordHash,
      display_name: displayName || username
    });
    const token = signToken(user);

    res.json({ success: true, data: { token, user }, message: '注册成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '注册失败' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');
    const validationError = validateCredentials({ username, password });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const userWithPassword = await dbAsync.getUserByUsername(username);
    if (!userWithPassword) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    const ok = await bcrypt.compare(password, userWithPassword.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }

    const user = await dbAsync.getUserById(userWithPassword.id);
    const token = signToken(user);
    res.json({ success: true, data: { token, user }, message: '登录成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '登录失败' });
  }
});

router.get('/auth/me', requireAuth, async (req, res) => {
  res.json({ success: true, data: req.user });
});

router.post('/auth/logout', requireAuth, async (req, res) => {
  res.json({ success: true, message: '已退出登录' });
});

router.put('/users/me', requireAuth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.display_name !== undefined || req.body.displayName !== undefined) {
      updates.display_name = String(req.body.display_name || req.body.displayName || '').trim();
    }
    if (req.body.avatar_url !== undefined || req.body.avatarUrl !== undefined) {
      updates.avatar_url = String(req.body.avatar_url || req.body.avatarUrl || '').trim();
    }

    if (!updates.display_name && updates.avatar_url === undefined) {
      return res.status(400).json({ success: false, error: '没有可更新的资料' });
    }

    await dbAsync.updateUser(req.user.id, updates);
    const user = await dbAsync.getUserById(req.user.id);
    res.json({ success: true, data: user, message: '资料已更新' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || '更新失败' });
  }
});

module.exports = router;
