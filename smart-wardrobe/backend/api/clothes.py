#!/usr/bin/env python3
"""
衣服管理API路由
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.models import get_db, ClothingItem
from backend.services import ClothingService, save_uploaded_image, classifier_service, OutfitService
from backend.config import TRANSPARENT_DIR, IMAGES_DIR

router = APIRouter(prefix="/clothes", tags=["衣服管理"])


# ==================== Pydantic模型 ====================

class ClothingCreate(BaseModel):
    """创建衣服请求"""
    filename: str
    original_path: Optional[str] = None
    transparent_path: Optional[str] = None
    category: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    color_tone: Optional[str] = None
    style: Optional[List[str]] = None
    material: Optional[str] = None
    thickness: Optional[str] = None
    features: Optional[List[str]] = None
    season: Optional[List[str]] = None
    suitable_weather: Optional[List[str]] = None
    suitable_occasions: Optional[List[str]] = None
    matching_tops: Optional[List[str]] = None
    matching_bottoms: Optional[List[str]] = None
    matching_shoes: Optional[List[str]] = None
    matching_accessories: Optional[List[str]] = None
    matching_colors: Optional[List[str]] = None
    outfit_tags: Optional[List[str]] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    user_notes: Optional[str] = None


class ClothingUpdate(BaseModel):
    """更新衣服请求"""
    category: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    color_tone: Optional[str] = None
    style: Optional[List[str]] = None
    material: Optional[str] = None
    thickness: Optional[str] = None
    features: Optional[List[str]] = None
    season: Optional[List[str]] = None
    suitable_weather: Optional[List[str]] = None
    suitable_occasions: Optional[List[str]] = None
    matching_tops: Optional[List[str]] = None
    matching_bottoms: Optional[List[str]] = None
    matching_shoes: Optional[List[str]] = None
    matching_accessories: Optional[List[str]] = None
    matching_colors: Optional[List[str]] = None
    outfit_tags: Optional[List[str]] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    user_notes: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None


# ==================== API端点 ====================

@router.get("/", summary="获取衣服列表")
async def get_clothes(
    category: Optional[str] = Query(None, description="服装类别"),
    color: Optional[str] = Query(None, description="颜色"),
    style: Optional[str] = Query(None, description="风格"),
    season: Optional[str] = Query(None, description="季节"),
    is_favorite: Optional[bool] = Query(None, description="是否收藏"),
    is_archived: Optional[bool] = Query(None, description="是否归档"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(50, ge=1, le=100, description="返回数量"),
    db: Session = Depends(get_db)
):
    """获取衣服列表，支持多条件筛选"""
    service = ClothingService(db)
    items = service.get_all(
        category=category,
        color=color,
        style=style,
        season=season,
        is_favorite=is_favorite,
        is_archived=is_archived,
        search=search,
        skip=skip,
        limit=limit
    )
    return {
        "success": True,
        "data": [item.to_dict() for item in items],
        "count": len(items)
    }


@router.get("/statistics", summary="获取衣柜统计")
async def get_statistics(db: Session = Depends(get_db)):
    """获取衣柜统计信息"""
    service = ClothingService(db)
    stats = service.get_statistics()
    return {
        "success": True,
        "data": stats
    }


@router.get("/filters", summary="获取筛选选项")
async def get_filter_options(db: Session = Depends(get_db)):
    """获取所有可用的筛选选项（类别、颜色、风格）"""
    service = ClothingService(db)
    return {
        "success": True,
        "data": {
            "categories": service.get_categories(),
            "colors": service.get_colors(),
            "styles": service.get_styles()
        }
    }


@router.post("/confirm", summary="确认并保存衣服信息")
async def confirm_clothing(data: ClothingCreate, db: Session = Depends(get_db)):
    """
    用户确认后保存衣服记录
    """
    service = ClothingService(db)
    item = service.create(data.dict(exclude_unset=True))
    return {
        "success": True,
        "data": item.to_dict(),
        "message": "保存成功"
    }


@router.get("/outfit/occasion", summary="根据场合推荐搭配")
async def get_outfit_by_occasion(
    occasion: str = Query(..., description="场合"),
    season: Optional[str] = Query(None, description="季节"),
    style: Optional[str] = Query(None, description="风格偏好"),
    db: Session = Depends(get_db)
):
    """
    根据场合推荐完整搭配组合
    
    - 自动组合上衣+下装+鞋子
    - 考虑颜色协调和风格一致
    - 返回多个搭配方案供选择
    """
    outfit_service = OutfitService(db)
    style_list = [style] if style else None
    result = outfit_service.recommend_for_occasion(
        occasion=occasion,
        season=season,
        style_preference=style_list
    )
    
    return {
        "success": result.get("success", True),
        "data": result
    }


@router.get("/colors/{color}/matching", summary="获取颜色搭配建议")
async def get_color_matching(color: str):
    """
    获取某个颜色的推荐搭配颜色
    
    - 基于色彩理论推荐协调的颜色组合
    - 返回可搭配的颜色列表
    """
    outfit_service = OutfitService(None)
    matching_colors = outfit_service.get_color_recommendations(color)
    
    return {
        "success": True,
        "data": {
            "base_color": color,
            "matching_colors": matching_colors
        }
    }


@router.get("/{item_id}/outfit", summary="获取搭配推荐")
async def get_outfit_recommendation(
    item_id: int,
    occasion: Optional[str] = Query(None, description="场合"),
    season: Optional[str] = Query(None, description="季节"),
    limit: int = Query(5, ge=1, le=10, description="每类推荐数量"),
    db: Session = Depends(get_db)
):
    """
    基于某件衣服推荐完整搭配组合
    """
    outfit_service = OutfitService(db)
    result = outfit_service.recommend_outfit(
        base_item_id=item_id,
        occasion=occasion,
        season=season,
        limit=limit
    )
    
    return {
        "success": True,
        "data": result
    }


@router.get("/{item_id}", summary="获取单件衣服详情")
async def get_clothing_item(item_id: int, db: Session = Depends(get_db)):
    """根据ID获取衣服详情"""
    service = ClothingService(db)
    item = service.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    return {
        "success": True,
        "data": item.to_dict()
    }


@router.post("/", summary="创建衣服记录")
async def create_clothing(data: ClothingCreate, db: Session = Depends(get_db)):
    """创建新的衣服记录"""
    service = ClothingService(db)
    item = service.create(data.dict(exclude_unset=True))
    return {
        "success": True,
        "data": item.to_dict(),
        "message": "创建成功"
    }


@router.post("/upload", summary="上传并分类衣服图片")
async def upload_clothing(
    file: UploadFile = File(..., description="衣服图片"),
    auto_classify: bool = Form(True, description="是否自动AI分类"),
    db: Session = Depends(get_db)
):
    """
    上传衣服图片并自动分类
    - 图片会被保存到data/images目录
    - 如果auto_classify为True，会调用AI进行自动分类
    - 返回临时ID和分类结果，等待用户确认
    """
    # 检查文件类型
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    # 读取文件内容
    content = await file.read()
    
    # 保存原始图片
    try:
        original_path = save_uploaded_image(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 准备数据
    data = {
        "filename": file.filename,
        "original_path": original_path,
        "temp_id": original_path  # 用图片路径作为临时ID
    }
    
    # AI自动分类
    if auto_classify:
        classification = classifier_service.classify_image(original_path)
        # 映射分类结果到数据字段
        for key in ["category", "type", "color", "color_tone", "style", "material", 
                    "thickness", "features", "season", "suitable_weather", 
                    "suitable_occasions", "suitable_age_group", "body_type_tips",
                    "matching_tops", "matching_bottoms", "matching_shoes",
                    "matching_accessories", "matching_colors", "outfit_tags",
                    "description", "confidence"]:
            if key in classification:
                data[key] = classification[key]
    
    return {
        "success": True,
        "data": data,
        "message": "上传成功，请确认信息"
    }


@router.post("/preview-classify", summary="预览AI分类结果")
async def preview_classify(
    file: UploadFile = File(..., description="衣服图片")
):
    """
    只进行AI分类预览，不保存到数据库
    返回分类结果供用户确认
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    # 读取文件内容
    content = await file.read()
    
    # 保存原始图片（临时）
    try:
        original_path = save_uploaded_image(content, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # AI分类
    classification = classifier_service.classify_image(original_path)
    
    # 合并结果
    result = {
        "filename": file.filename,
        "original_path": original_path,
        "temp_id": original_path
    }
    
    for key in ["category", "type", "color", "color_tone", "style", "material", 
                "thickness", "features", "season", "suitable_weather", 
                "suitable_occasions", "suitable_age_group", "body_type_tips",
                "matching_tops", "matching_bottoms", "matching_shoes",
                "matching_accessories", "matching_colors", "outfit_tags",
                "description", "confidence"]:
        if key in classification:
            result[key] = classification[key]
    
    return {
        "success": True,
        "data": result,
        "message": "分类完成"
    }


@router.put("/{item_id}", summary="更新衣服信息")
async def update_clothing(item_id: int, data: ClothingUpdate, db: Session = Depends(get_db)):
    """更新衣服信息"""
    service = ClothingService(db)
    item = service.update(item_id, data.dict(exclude_unset=True))
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    return {
        "success": True,
        "data": item.to_dict(),
        "message": "更新成功"
    }


@router.delete("/{item_id}", summary="删除衣服")
async def delete_clothing(item_id: int, db: Session = Depends(get_db)):
    """删除衣服记录及关联图片"""
    service = ClothingService(db)
    success = service.delete(item_id)
    if not success:
        raise HTTPException(status_code=404, detail="衣服不存在")
    return {
        "success": True,
        "message": "删除成功"
    }


@router.post("/{item_id}/favorite", summary="切换收藏状态")
async def toggle_favorite(item_id: int, db: Session = Depends(get_db)):
    """切换衣服的收藏状态"""
    service = ClothingService(db)
    item = service.toggle_favorite(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    return {
        "success": True,
        "data": {"is_favorite": item.is_favorite},
        "message": "已收藏" if item.is_favorite else "已取消收藏"
    }


@router.post("/{item_id}/archive", summary="切换归档状态")
async def toggle_archive(item_id: int, db: Session = Depends(get_db)):
    """切换衣服的归档状态"""
    service = ClothingService(db)
    item = service.toggle_archive(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    return {
        "success": True,
        "data": {"is_archived": item.is_archived},
        "message": "已归档" if item.is_archived else "已取消归档"
    }


@router.post("/{item_id}/wear", summary="记录穿着")
async def record_wear(item_id: int, db: Session = Depends(get_db)):
    """记录一次穿着"""
    service = ClothingService(db)
    item = service.record_wear(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    return {
        "success": True,
        "data": {"wear_count": item.wear_count, "last_worn_date": item.last_worn_date.isoformat() if item.last_worn_date else None},
        "message": "记录成功"
    }


@router.post("/{item_id}/reclassify", summary="重新AI分类")
async def reclassify_clothing(item_id: int, db: Session = Depends(get_db)):
    """重新使用AI对衣服进行分类"""
    service = ClothingService(db)
    item = service.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    
    if not item.original_path:
        raise HTTPException(status_code=400, detail="该衣服没有原始图片")
    
    # 重新分类
    classification = classifier_service.classify_image(item.original_path)
    
    # 更新数据
    update_data = {}
    for key in ["category", "type", "color", "color_tone", "style", "material", 
                "thickness", "features", "season", "suitable_weather", 
                "suitable_occasions", "suitable_age_group", "body_type_tips",
                "matching_tops", "matching_bottoms", "matching_shoes",
                "matching_accessories", "matching_colors", "outfit_tags",
                "description", "confidence"]:
        if key in classification:
            update_data[key] = classification[key]
    
    item = service.update(item_id, update_data)
    
    return {
        "success": True,
        "data": item.to_dict(),
        "message": "重新分类成功"
    }


@router.get("/{item_id}/image", summary="获取衣服图片")
async def get_clothing_image(
    item_id: int, 
    transparent: bool = Query(False, description="是否获取透明背景图片"),
    db: Session = Depends(get_db)
):
    """获取衣服图片"""
    service = ClothingService(db)
    item = service.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="衣服不存在")
    
    image_path = item.transparent_path if transparent else item.original_path
    if not image_path:
        raise HTTPException(status_code=404, detail="图片不存在")
    
    return FileResponse(
        image_path,
        media_type="image/png" if transparent else "image/jpeg",
        filename=item.filename
    )


