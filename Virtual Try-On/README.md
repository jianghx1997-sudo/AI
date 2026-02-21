# 智能衣橱管理系统

一个基于AI的智能衣橱管理与应用推荐系统，帮助用户管理衣物、获取搭配建议。

## 功能特性

### 🗄️ 衣物管理
- 上传衣物图片，自动识别类别、颜色、风格等属性
- 支持透明背景处理
- 衣物信息的增删改查
- 收藏、归档功能

### 👗 智能搭配推荐
- **单品推荐**：选择一件衣服，智能推荐搭配的其他单品
- **场合推荐**：根据场合（日常休闲、约会、上班通勤等）推荐完整搭配方案
- **颜色搭配**：基于色彩理论的搭配建议

### 🤖 AI分类
- 自动识别衣物类别（上衣、裤子、裙子、外套、鞋子等）
- 自动识别颜色
- 自动识别适合的季节和场合

## 技术栈

- **后端**: Python, FastAPI, SQLAlchemy
- **前端**: HTML, CSS, JavaScript (原生)
- **数据库**: SQLite
- **AI**: 自定义分类规则引擎

## 项目结构

```
Virtual Try-On/
├── backend/
│   ├── api/            # API路由
│   │   └── clothes.py  # 衣物相关API
│   ├── models/         # 数据模型
│   │   └── database.py # 数据库模型定义
│   ├── services/       # 业务逻辑
│   │   ├── classifier_service.py  # AI分类服务
│   │   ├── clothing_service.py    # 衣物管理服务
│   │   └── outfit_service.py      # 搭配推荐服务
│   └── config.py       # 配置文件
├── frontend/
│   ├── index.html      # 主页面
│   css/
│   │   └── style.css   # 样式文件
│   └── js/
│       ├── api.js      # API调用封装
│       └── app.js      # 前端应用逻辑
├── data/
│   ├── wardrobe.db     # 数据库文件
│   └── images/         # 衣物图片存储
├── main.py             # 应用入口
├── requirements.txt    # 依赖包
└── README.md           # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问应用

在浏览器中打开 `http://localhost:8000`

## API文档

启动服务后，访问 `http://localhost:8000/docs` 查看完整的API文档

### 主要API端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/clothes/` | 获取衣物列表 |
| POST | `/api/v1/clothes/upload` | 上传衣物图片 |
| GET | `/api/v1/clothes/{id}` | 获取衣物详情 |
| PUT | `/api/v1/clothes/{id}` | 更新衣物信息 |
| DELETE | `/api/v1/clothes/{id}` | 删除衣物 |
| GET | `/api/v1/clothes/{id}/outfit` | 基于单品推荐搭配 |
| GET | `/api/v1/clothes/outfit/occasion` | 基于场合推荐搭配 |

## 搭配规则

### 连衣裙处理
- 连衣裙作为完整单品，不需要搭配上衣和裤子
- 上衣推荐时自动排除连衣裙，只推荐半身裙

### 颜色搭配
基于色彩理论的搭配规则：
- 中性色（黑、白、灰、米色）可搭配任何颜色
- 互补色搭配
- 同色系搭配

### 场合分类
支持的场合类型：
- 日常休闲
- 约会
- 聚会
- 上班通勤
- 正式场合
- 户外运动
- 旅行

## 开发说明

### 数据库模型

```python
class ClothingItem:
    id: int              # 主键
    type: str            # 衣物类型（T恤、连衣裙等）
    category: str        # 类别（上衣、裤子等）
    color: str           # 颜色
    style: List[str]     # 风格标签
    season: List[str]    # 适合季节
    suitable_occasions: List[str]  # 适合场合
    image_path: str      # 图片路径
    is_archived: bool    # 是否归档
    is_favorite: bool    # 是否收藏
```

### 扩展搭配规则

在 `backend/services/outfit_service.py` 中可以自定义：
- `COLOR_COMPATIBILITY`: 颜色搭配规则
- `STYLE_COMPATIBILITY`: 风格搭配规则
- `SEASON_RULES`: 季节搭配规则

## 许可证

MIT License

## 作者

jianghx1997