#!/usr/bin/env python3
"""
衣柜管理系统 - 主应用入口
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from backend.models import init_db
from backend.api import clothes_router
from backend.config import API_HOST, API_PORT, DEBUG, TRANSPARENT_DIR, IMAGES_DIR

# 前端目录
FRONTEND_DIR = Path(__file__).parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    print("🚀 正在初始化数据库...")
    init_db()
    print("✅ 数据库初始化完成")
    yield
    # 关闭时的清理工作
    print("👋 应用关闭")


# 创建FastAPI应用
app = FastAPI(
    title="智能衣柜管理系统 API",
    description="帮助管理衣服、智能分类、穿搭推荐的API服务",
    version="1.0.0",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册API路由
app.include_router(clothes_router, prefix="/api/v1")


# ==================== 前端静态文件服务 ====================

@app.get("/", tags=["前端页面"])
async def serve_index():
    """返回前端首页"""
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file, media_type="text/html")
    return {"message": "前端页面未找到，请访问 /docs 查看API文档"}


@app.get("/{path:path}", tags=["前端页面"])
async def serve_frontend(path: str):
    """
    服务前端静态文件
    优先级：静态文件 > fallback到index.html(SPA)
    """
    # 忽略API路径
    if path.startswith("api/") or path.startswith("docs") or path.startswith("openapi"):
        return None
    
    # 尝试返回请求的静态文件
    file_path = FRONTEND_DIR / path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    # 对于SPA，所有非静态路径返回index.html
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file, media_type="text/html")
    
    return {"error": "File not found"}


@app.get("/health", tags=["健康检查"])
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    print(f"""
    ╔════════════════════════════════════════════════════╗
    ║        智能衣柜管理系统 API 服务                    ║
    ╠════════════════════════════════════════════════════╣
    ║  API文档: http://{API_HOST}:{API_PORT}/docs              ║
    ║  API地址: http://{API_HOST}:{API_PORT}/api/v1            ║
    ╚════════════════════════════════════════════════════╝
    """)
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=DEBUG
    )
