# SeeYou Wardrobe - AI 智能衣橱

## 项目愿景

实现个人衣橱的数字化管理 → 智能搭配推荐 → 数字人试穿与商业化的三阶段演进。

### 阶段1：电子化衣橱（当前）
拍照上传、AI 识别分类、网格化展示、基础筛选。核心目标：让用户「看到自己有什么衣服」。

### 阶段2：智能搭配推荐（下一步）
根据天气、场合、季节推荐穿搭组合。核心目标：解决「今天穿什么」。

### 阶段3：数字人试穿 + 商业化（远期）
生成真实上身效果图；分析衣橱缺口，向用户推荐应购单品。核心目标：从工具转向商业闭环。

---

## 技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue 3 + Vite + Vant 4 | 移动端优先，PWA 可添加到主屏 |
| 后端 | Node.js + Express | 轻量，适配低配服务器 |
| 数据库 | **SQLite** | 零配置，支撑关系查询（搭配表、穿着记录表） |
| AI 识别 | 火山方舟 / 阿里云 / 百度 / Mock | 多源适配，通过 `.env` 切换 |
| 天气数据 | 高德 Web 服务 API | 支持实况天气、IP 定位和经纬度逆地理编码 |

**当前状态**：数据库已使用 SQLite（`backend/data/wardrobe.db`）。`backend/data/clothes.json` 仅作为早期遗留数据源，在空库启动时可迁移一次；后续新数据以 SQLite 为准。

完整顶层规划见 `PROJECT_BLUEPRINT.md`。

---

## 数据模型规划

数据层必须能支撑三个阶段，字段设计宁多勿少，但不要过度抽象。

### `users` 用户表
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
username      TEXT UNIQUE
password_hash TEXT
display_name  TEXT
avatar_url    TEXT
role          TEXT
created_at    TEXT
updated_at    TEXT
```

### `clothes` 衣物表
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT
image_path  TEXT
brand       TEXT          -- 品牌（用于缺口分析和商业推荐）
purchase_date TEXT        -- 购买时间
category    TEXT          -- 上衣 / 裤子 / 裙子 / 外套 / 鞋子 / 配饰
color       TEXT
season      TEXT          -- 春/秋 / 夏季 / 冬季 / 四季
material    TEXT
style       TEXT          -- 休闲 / 商务 / 运动 / 正式 / 街头 / 简约
occasion    TEXT          -- 通勤 / 约会 / 运动 / 休闲 / 正式 / 旅行
fit         TEXT          -- 修身 / 宽松 / 标准
warmth_level REAL        -- 保暖度 1-5，推荐侧优先使用
breathability_level REAL -- 透气度 1-5
formality_level REAL     -- 正式度 1-5
layering_role TEXT       -- top / bottom / outer / shoes / accessory
color_family TEXT        -- neutral / cool / warm / accent / unknown
weather_risk TEXT        -- 雨雪、高温、低温等风险提示
is_favorite INTEGER DEFAULT 0  -- 是否收藏
wear_count  INTEGER DEFAULT 0  -- 穿着次数（阶段2统计用）
last_worn   TEXT          -- 最后一次穿着日期
tags        TEXT          -- 逗号分隔的额外标签
confidence  REAL          -- AI 识别置信度
source      TEXT          -- 识别来源：mock / aliyun / baidu / volcano
created_at  TEXT
updated_at  TEXT
```

### `outfits` 搭配表（阶段2核心）
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
name        TEXT          -- 搭配名称（如"周一通勤"）
description TEXT
occasion    TEXT          -- 适用场合
season      TEXT          -- 适用季节
weather     TEXT          -- 适用天气（如"晴天 15-25°C"）
items       TEXT          -- JSON 数组：[上衣ID, 裤子ID, 鞋子ID...]
is_generated INTEGER DEFAULT 0  -- 是否 AI 生成
wear_count  INTEGER DEFAULT 0
created_at  TEXT
updated_at  TEXT
```

### `wear_logs` 穿着记录表（阶段2统计用）
```sql
id          INTEGER PRIMARY KEY AUTOINCREMENT
date        TEXT
cloth_id    INTEGER
outfit_id   INTEGER
weather     TEXT          -- 当日天气快照
occasion    TEXT
note        TEXT
```

---

## 目录结构

```
vr_seeyou/
├── frontend/                 # PWA 前端
│   ├── src/
│   │   ├── views/            # 页面组件
│   │   ├── components/       # 复用组件（阶段2开始建）
│   │   ├── api/              # API 封装
│   │   ├── utils/            # 工具函数
│   │   ├── stores/           # Pinia 状态管理（阶段2开始建）
│   │   └── assets/           # 静态资源
│   ├── public/               # 构建直出文件
│   └── dist/                 # 构建产物（不提交 git）
├── backend/
│   ├── data/                 # SQLite 数据库 + 旧 JSON（仅作迁移来源）
│   ├── uploads/              # 用户上传图片
│   ├── routes/               # API 路由
│   ├── services/             # 上传、AI、推荐等业务服务
│   ├── server.js             # 应用入口
│   ├── database.js           # 数据库封装（迁移为 SQLite 版）
│   ├── aiService.js          # AI 识别服务
│   ├── outfitService.js      # 搭配推荐逻辑（阶段2新建）
│   ├── weatherService.js     # 天气接入（阶段2新建）
│   └── .env / .env.example   # 环境变量
├── PROJECT_BLUEPRINT.md      # 项目顶层规划
├── deploy.md                 # 部署指南
└── CLAUDE.md                 # 本文件
```

---

## API 规范

- 所有接口以 `/api` 开头
- 响应格式统一：
  ```json
  { "success": true, "data": {}, "message": "" }
  ```
- 错误响应：
  ```json
  { "success": false, "error": "错误描述" }
  ```
- 图片访问通过 `/uploads/`（开发由 Vite proxy 转发，生产由 Nginx 代理）
- 上传限制：单张 10MB，仅接受 jpg / jpeg / png / webp
- 新上传流程：
  - `POST /api/clothes/recognize`：上传图片并识别，图片暂存在 `/uploads/temp/`，不写入数据库
  - `POST /api/clothes`：用户确认后保存衣物，并将临时图片移动为正式图片
  - `POST /api/clothes/:id/reanalyze`：重新分析已有衣物图片，返回待确认 AI 标签
  - `POST /api/clothes/upload`：旧版兼容接口，上传后立即识别并保存
- 衣物列表支持 `search` / `keyword` 参数，用于名称、类别、颜色、季节、材质、风格、场合、品牌和标签搜索
- 衣物图片通过 `GET /api/images/:filename` 鉴权访问；前端不要直接渲染 `/uploads`。

---

## 前端开发规范

- 组件命名：PascalCase（如 `OutfitCard.vue`）
- 视图文件放 `views/`，可复用组件放 `components/`
- API 调用走 `@/api/` 模块，不在视图里直接写 axios
- 图片路径：后端返回相对路径 `/uploads/xxx.jpg`，前端不做硬编码 baseURL
- 移动端优先：所有样式基于 375px 逻辑宽度设计
- Vant 组件手动导入（已在 `main.js` 注册）

---

## 验证命令

修改后必须执行：

```bash
# 后端
node server.js
# 测试：curl http://localhost:3000/api/health

# 前端
cd frontend && npm run build
# 构建必须无报错，产物在 dist/ 目录

# 推荐规则回归
cd backend && npm run test:recommendation

# 后端服务启动后
cd backend && npm run test:api
```

---

## 阶段推进原则

1. **阶段2开始之前，必须补齐搭配与反馈数据结构。** 至少包括 `outfits`、`outfit_items`、`wear_logs`、`recommendation_logs` 的最小可用设计。
2. **阶段3开始之前，必须确认数字人技术路径。** 调研文档需明确走云端 API 还是自建模型，以及隐私、成本和生成质量边界。
3. **每进入下一阶段，先更新 `PROJECT_BLUEPRINT.md` 和本 CLAUDE.md 的数据模型、目录结构，再写代码。**

---

## 项目红线

以下操作必须停下来问我：
- 删除 `backend/uploads/` 或 `backend/data/` 中的已有数据
- 修改 `.env` 中的真实 API Key
- 删除或重命名数据库表 / 字段（涉及已有数据迁移）
- 安装新的全局 npm 包（如 `npm install -g`）
- 前端 `package.json` 或 `vite.config.js` 的大幅变更（如换构建工具）
- 涉及真实用户数据的操作
