#!/usr/bin/env python3
"""
衣服管理服务层
"""
import os
import uuid
import shutil
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from backend.models.database import ClothingItem
from backend.config import IMAGES_DIR, PHOTO_DIR, TRANSPARENT_DIR, ALLOWED_EXTENSIONS


class ClothingService:
    """衣服管理服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_all(self, 
                category: Optional[str] = None,
                color: Optional[str] = None,
                style: Optional[str] = None,
                season: Optional[str] = None,
                is_favorite: Optional[bool] = None,
                is_archived: Optional[bool] = None,
                search: Optional[str] = None,
                skip: int = 0,
                limit: int = 50) -> List[ClothingItem]:
        """
        获取衣服列表，支持多条件筛选
        """
        query = self.db.query(ClothingItem)
        
        # 筛选条件
        if category:
            query = query.filter(ClothingItem.category == category)
        if color:
            query = query.filter(ClothingItem.color == color)
        if style:
            query = query.filter(ClothingItem.style.contains(f'"{style}"'))
        if is_favorite is not None:
            query = query.filter(ClothingItem.is_favorite == is_favorite)
        if is_archived is not None:
            query = query.filter(ClothingItem.is_archived == is_archived)
        
        # 季节筛选 (JSON字段模糊匹配)
        if season:
            query = query.filter(ClothingItem.season.contains(f'"{season}"'))
        
        # 搜索 (在类型、描述、品牌中搜索)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    ClothingItem.type.ilike(search_pattern),
                    ClothingItem.description.ilike(search_pattern),
                    ClothingItem.brand.ilike(search_pattern),
                    ClothingItem.user_notes.ilike(search_pattern)
                )
            )
        
        # 默认不显示已归档的
        if is_archived is None:
            query = query.filter(ClothingItem.is_archived == False)
        
        # 排序和分页
        query = query.order_by(ClothingItem.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def get_by_id(self, item_id: int) -> Optional[ClothingItem]:
        """根据ID获取衣服"""
        return self.db.query(ClothingItem).filter(ClothingItem.id == item_id).first()
    
    def create(self, data: Dict[str, Any]) -> ClothingItem:
        """创建新衣服记录"""
        item = ClothingItem(**data)
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def update(self, item_id: int, data: Dict[str, Any]) -> Optional[ClothingItem]:
        """更新衣服信息"""
        item = self.get_by_id(item_id)
        if not item:
            return None
        
        for key, value in data.items():
            if hasattr(item, key) and value is not None:
                setattr(item, key, value)
        
        item.updated_at = datetime.now()
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def delete(self, item_id: int) -> bool:
        """删除衣服记录"""
        item = self.get_by_id(item_id)
        if not item:
            return False
        
        # 删除关联的图片文件
        if item.original_path and os.path.exists(item.original_path):
            os.remove(item.original_path)
        if item.transparent_path and os.path.exists(item.transparent_path):
            os.remove(item.transparent_path)
        
        self.db.delete(item)
        self.db.commit()
        return True
    
    def toggle_favorite(self, item_id: int) -> Optional[ClothingItem]:
        """切换收藏状态"""
        item = self.get_by_id(item_id)
        if not item:
            return None
        
        item.is_favorite = not item.is_favorite
        item.updated_at = datetime.now()
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def toggle_archive(self, item_id: int) -> Optional[ClothingItem]:
        """切换归档状态"""
        item = self.get_by_id(item_id)
        if not item:
            return None
        
        item.is_archived = not item.is_archived
        item.updated_at = datetime.now()
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def record_wear(self, item_id: int) -> Optional[ClothingItem]:
        """记录穿着"""
        item = self.get_by_id(item_id)
        if not item:
            return None
        
        item.wear_count = (item.wear_count or 0) + 1
        item.last_worn_date = datetime.now()
        self.db.commit()
        self.db.refresh(item)
        return item
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取衣柜统计信息"""
        total = self.db.query(ClothingItem).filter(ClothingItem.is_archived == False).count()
        favorites = self.db.query(ClothingItem).filter(
            ClothingItem.is_favorite == True,
            ClothingItem.is_archived == False
        ).count()
        
        # 按类别统计
        from sqlalchemy import func
        category_stats = self.db.query(
            ClothingItem.category,
            func.count(ClothingItem.id)
        ).filter(ClothingItem.is_archived == False).group_by(ClothingItem.category).all()
        
        # 最近穿着
        recently_worn = self.db.query(ClothingItem).filter(
            ClothingItem.last_worn_date != None
        ).order_by(ClothingItem.last_worn_date.desc()).limit(5).all()
        
        # 从未穿过 (超过30天)
        from datetime import timedelta
        thirty_days_ago = datetime.now() - timedelta(days=30)
        never_worn = self.db.query(ClothingItem).filter(
            or_(
                ClothingItem.last_worn_date == None,
                ClothingItem.last_worn_date < thirty_days_ago
            ),
            ClothingItem.is_archived == False
        ).count()
        
        return {
            "total_items": total,
            "favorites": favorites,
            "category_distribution": {cat: count for cat, count in category_stats if cat},
            "recently_worn": [item.to_dict() for item in recently_worn],
            "never_worn_count": never_worn
        }
    
    def get_categories(self) -> List[str]:
        """获取所有服装类别"""
        from sqlalchemy import distinct
        result = self.db.query(distinct(ClothingItem.category)).all()
        return [r[0] for r in result if r[0]]
    
    def get_colors(self) -> List[str]:
        """获取所有颜色"""
        from sqlalchemy import distinct
        result = self.db.query(distinct(ClothingItem.color)).all()
        return [r[0] for r in result if r[0]]
    
    def get_styles(self) -> List[str]:
        """获取所有风格"""
        # style是JSON数组，需要遍历所有记录提取唯一值
        items = self.db.query(ClothingItem.style).all()
        styles = set()
        for item in items:
            if item[0]:
                for style in item[0]:
                    styles.add(style)
        return sorted(list(styles))


def save_uploaded_image(file_content: bytes, original_filename: str) -> str:
    """
    保存上传的图片，返回保存路径
    """
    # 生成唯一文件名
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件格式: {ext}")
    
    unique_filename = f"{uuid.uuid4().hex}{ext}"
    save_path = IMAGES_DIR / unique_filename
    
    with open(save_path, 'wb') as f:
        f.write(file_content)
    
    return str(save_path)