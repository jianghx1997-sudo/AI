# 🧥 AI智能衣橱 - SeeYou Wardrobe

一个基于 PWA 技术的智能衣橱应用，支持账号登录、手机拍照上传、AI 自动识别与标签补全、确认保存、搜索筛选、天气穿搭推荐、推荐反馈和衣橱管理。

## 🚀 快速开始

### 1. 启动后端服务
```bash
cd backend
npm install
copy .env.example .env  # Windows PowerShell 可使用 Copy-Item .env.example .env
npm start
```

### 2. 启动前端开发服务器
```bash
cd frontend
npm install
npm run dev
```

### 3. 构建生产版本
```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist/` 目录，将其部署到您的服务器即可。

## 📁 项目结构

```
vr_seeyou/
├── frontend/          # PWA前端 (Vue 3 + Vite + Vant)
├── backend/           # Node.js后端 (Express + SQLite)
├── PROJECT_BLUEPRINT.md # 项目顶层规划
├── deploy.md          # 部署指南
└── README.md
```

## 🛠 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue 3 + Vite + Vant 4 | 移动端UI框架，体验接近原生App |
| 后端 | Node.js + Express | 轻量高效，适配2核2G服务器 |
| 数据库 | SQLite | 零配置，单文件存储 |
| AI识别 | Mock / 火山方舟 / 阿里云视觉智能 / 百度AI | 通过 `.env` 切换，Mock 可直接体验 |

## 📝 本地账号

首次启动后端会自动创建默认演示账号：

- 用户名：`demo`
- 密码：读取 `backend/.env` 的 `DEMO_USER_PASSWORD`，默认开发值为 `demo123456`

业务接口均需要登录。衣物、穿着记录、推荐反馈按用户隔离；衣物图片通过 `/api/images/...` + `Authorization` 头鉴权访问，不再直接公开 `/uploads` 目录，也不要把 token 放进图片 URL。

## 📝 配置AI API

1. 复制后端配置文件模板：`backend/.env.example` → `backend/.env`
2. 本地体验建议先保持 `MOCK_AI=true`
3. 如需真实识别，填入火山方舟、阿里云或百度 AI 的 API Key
3. 重启后端服务

详见 `backend/.env.example`

## 🔌 核心 API

- `POST /api/auth/login`：账号密码登录
- `GET /api/auth/me`：获取当前用户
- `POST /api/clothes/recognize`：上传图片并进行 AI 识别，不保存入库
- `POST /api/clothes`：确认保存识别结果
- `GET /api/clothes?search=关键词`：搜索/筛选衣物
- `POST /api/clothes/:id/reanalyze`：对已有衣物重新 AI 分析，返回待确认标签
- `GET /api/images/:filename`：登录后访问衣物图片
- `GET /api/weather/current?city=110101`：查询高德实况天气
- `GET /api/recommendations/outfits?aiReview=true`：根据天气、场景和衣橱生成穿搭推荐，并可启用 AI 评审
- `POST /api/recommendations/feedback`：记录喜欢、已穿、不适合及原因

## ✅ 验证命令

```bash
cd backend
npm run check
# 包含基础 smoke 和 20 个固定衣橱/天气/场景 fixture 回归
npm run test:recommendation

# 默认会自动启动临时后端，使用临时 SQLite 和上传目录，不污染开发数据
npm run test:api

cd ../frontend
npm run build
```

## 📱 使用方式

1. 手机浏览器访问您的域名
2. 点击"添加到主屏幕"
3. 即可像App一样使用

## 🌟 功能特性

- [x] 手机拍照/相册上传
- [x] 账号密码登录与用户数据隔离
- [x] AI自动识别衣物类型、颜色、季节、材质、风格和推荐增强标签
- [x] 识别预览后确认保存
- [x] 网格化衣橱展示
- [x] 分类筛选与搜索
- [x] PWA离线缓存
- [x] 天气集成、规则穿搭推荐、缺口建议与 AI 顾问评审
- [ ] 数字人试穿（Phase 3）

## 📄 License

MIT
