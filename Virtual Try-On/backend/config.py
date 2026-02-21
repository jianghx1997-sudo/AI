#!/usr/bin/env python3
"""
后端配置文件
"""
import os
from pathlib import Path

# 基础路径
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
PHOTO_DIR = BASE_DIR / "photo"
OUTPUT_DIR = BASE_DIR / "output"
TRANSPARENT_DIR = OUTPUT_DIR / "transparent"

# 确保目录存在
DATA_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
TRANSPARENT_DIR.mkdir(exist_ok=True)

# 数据库配置
DATABASE_URL = f"sqlite:///{DATA_DIR / 'wardrobe.db'}"

# 阿里云通义千问API配置
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "sk-475537d9b1634c5487b87e81b9d44230")
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# 服务配置
API_HOST = "0.0.0.0"
API_PORT = 8000
DEBUG = True

# 图片配置
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB