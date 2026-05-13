# 🧥 AI智能衣橱 - SeeYou Wardrobe

一个基于 PWA 技术的智能衣橱应用，支持手机拍照上传、AI 自动识别分类、确认保存、搜索筛选和衣橱管理。

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

## 📝 配置AI API

1. 复制后端配置文件模板：`backend/.env.example` → `backend/.env`
2. 本地体验建议先保持 `MOCK_AI=true`
3. 如需真实识别，填入火山方舟、阿里云或百度 AI 的 API Key
3. 重启后端服务

详见 `backend/.env.example`

## 🔌 核心 API

- `POST /api/clothes/recognize`：上传图片并进行 AI 识别，不保存入库
- `POST /api/clothes`：确认保存识别结果
- `GET /api/clothes?search=关键词`：搜索/筛选衣物
- `POST /api/clothes/upload`：旧版兼容接口，上传后立即保存
- `GET /api/weather/current?city=110101`：查询高德实况天气
- `GET /api/recommendations/outfits`：根据天气、场景和衣橱生成穿搭推荐

## 📱 使用方式

1. 手机浏览器访问您的域名
2. 点击"添加到主屏幕"
3. 即可像App一样使用

## 🌟 功能特性

- [x] 手机拍照/相册上传
- [x] AI自动识别衣物类型、颜色、季节
- [x] 识别预览后确认保存
- [x] 网格化衣橱展示
- [x] 分类筛选与搜索
- [x] PWA离线缓存
- [x] 天气集成与规则穿搭推荐（Phase 2 原型）
- [ ] 数字人试穿（Phase 3）

## 📄 License

MIT
