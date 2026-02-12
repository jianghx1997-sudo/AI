# 👔 衣服照片智能处理系统

基于 AI 的衣服照片背景透明化处理和智能分类系统。

## ✨ 功能特性

- 🤖 **AI 背景透明化** - 使用 U²-Net 深度学习模型自动去除衣服背景
- 🧠 **智能分类** - 使用阿里云通义千问(qwen-vl)进行图像识别和分类
- 🌐 **Web 界面** - 基于 Streamlit 的交互式网页应用
- 📂 **目录导航** - 按类别（外套、裤子、上衣等）分类展示
- 📊 **详细信息** - 显示类型、颜色、风格、材质、置信度、描述、特征等
- 💾 **数据导出** - 支持导出 JSON 格式的分类结果

## 🚀 快速开始

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装依赖

```bash
pip install rembg pillow requests streamlit
```

### 配置 API Key

在 `app.py` 中配置你的阿里云通义千问 API Key：

```python
DASHSCOPE_API_KEY = "your-api-key-here"
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
```

> 获取 API Key：[阿里云 DashScope](https://dashscope.console.aliyun.com/)

### 运行应用

#### 方式一：Web 界面（推荐）

```bash
streamlit run app.py
```

然后访问 http://localhost:8501

#### 方式二：命令行

```bash
python process_clothes.py
```

## 📖 使用指南

### Web 界面使用流程

1. **上传照片**
   - 在左侧边栏点击 "Browse files"
   - 选择衣服照片（支持 JPG, PNG, WEBP, BMP 格式，可多选）

2. **开始处理**
   - 点击 "🚀 开始处理" 按钮
   - 等待处理完成（每张照片约需 10-20 秒）

3. **查看结果**
   - 在类别目录中选择类别查看详情
   - 或点击左侧快捷导航快速跳转

4. **查看详情**
   - 原图和透明背景图并排显示
   - 查看类型、颜色、风格、材质等信息
   - 阅读 AI 生成的详细描述和特征

5. **导出数据**
   - 点击 "📥 导出 JSON" 下载分类结果

### 命令行使用流程

1. 将衣服照片放入 `photo/` 文件夹
2. 运行 `python process_clothes.py`
3. 查看 `output/` 文件夹中的结果：
   - `output/transparent/` - 透明背景图片
   - `output/classification_results.json` - 分类结果

## 📁 项目结构

```
.
├── app.py                    # Streamlit Web 应用
├── process_clothes.py        # 命令行版本
├── README.md                 # 项目说明文档
├── 代码详解.md                # 代码详细解释
├── photo/                    # 输入图片文件夹
├── uploads/                  # Web 上传临时文件夹
└── output/                   # 输出文件夹
    ├── transparent/          # 透明背景图片
    └── classification_results.json  # 分类结果
```

## 🔧 技术架构

### 背景透明化
- **模型**: U²-Net (U-square-Net)
- **库**: rembg
- **原理**: 深度学习显著性检测，自动分离前景和背景

### 智能分类
- **模型**: 通义千问 qwen-vl-max
- **服务**: 阿里云 DashScope
- **能力**: 视觉理解、图像分类、自然语言描述

### Web 框架
- **框架**: Streamlit
- **特点**: 纯 Python、快速开发、交互式界面

## 📝 API 响应格式

```json
{
  "category": "裤子",
  "type": "长裤",
  "color": "卡其色",
  "style": "休闲",
  "material": "棉",
  "features": ["腰部有纽扣", "两侧有斜插口袋"],
  "description": "这是一条卡其色的儿童长裤...",
  "confidence": "high"
}
```

## 🎨 界面预览

### 类别目录页
- 以卡片网格形式展示所有类别
- 显示类别名称和衣物数量
- 点击"查看详情"进入类别

### 类别详情页
- 显示该类别下的所有衣物
- 每件衣物包含：
  - 📷 原图
  - ✂️ 透明背景图
  - 📋 基本信息（文件名、类型、颜色、风格、材质、置信度）
  - 📝 详细描述
  - ✨ 特征列表

## ⚙️ 配置说明

### 支持的图片格式
- JPG / JPEG
- PNG
- WEBP
- BMP

### 单文件大小限制
- Web 界面: 200MB
- 命令行: 无限制

## 🐛 常见问题

### Q: 如何处理大量图片？
A: 建议使用命令行版本 `process_clothes.py`，可以批量处理整个文件夹。

### Q: API 调用失败怎么办？
A: 
1. 检查 API Key 是否正确
2. 检查网络连接
3. 查看阿里云 DashScope 控制台是否有额度

### Q: 背景透明化效果不理想？
A: 
1. 确保衣服与背景有明显对比
2. 使用光线充足的照片
3. 避免背景过于复杂

### Q: 分类结果不准确？
A: 
1. 确保照片清晰
2. 衣服占图片主要部分
3. 置信度低时可以手动检查

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题，请通过 GitHub Issue 联系。

---

Made with ❤️ using Python, Streamlit & 通义千问
