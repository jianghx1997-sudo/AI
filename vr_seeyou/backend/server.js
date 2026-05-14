require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const clothesRouter = require('./routes/clothes');
const { UPLOAD_DIR, ensureUploadDirs } = require('./services/uploadService');

const app = express();
const PORT = process.env.PORT || 3000;

ensureUploadDirs();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', authRouter);
app.use('/api', clothesRouter);

app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 智能衣橱后端服务已启动');
  console.log(`📍 监听地址: http://0.0.0.0:${PORT}`);
  console.log(`📁 上传目录: ${UPLOAD_DIR}`);
  console.log(`🤖 AI模式: ${process.env.MOCK_AI === 'true' ? '模拟模式（无需API Key）' : '真实API模式'}`);
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️ JWT_SECRET 未配置，当前使用开发默认值，请勿用于生产环境');
  }
  console.log('\nAPI端点:');
  console.log('  POST /api/auth/register     - 注册用户');
  console.log('  POST /api/auth/login        - 登录用户');
  console.log('  GET  /api/auth/me           - 获取当前用户');
  console.log('  POST /api/clothes/recognize  - 上传并识别衣物（不入库）');
  console.log('  GET  /api/images/:file       - 登录后访问衣物图片');
  console.log('  POST /api/clothes            - 确认保存衣物');
  console.log('  GET  /api/clothes            - 获取所有衣物');
  console.log('  GET  /api/clothes/:id        - 获取单件衣物');
  console.log('  PUT  /api/clothes/:id        - 更新衣物');
  console.log('  DELETE /api/clothes/:id      - 删除衣物');
  console.log('  POST /api/clothes/:id/favorite - 切换收藏');
  console.log('  POST /api/clothes/:id/wear   - 记录穿着');
  console.log('  GET  /api/stats/categories   - 分类统计\n');
});
