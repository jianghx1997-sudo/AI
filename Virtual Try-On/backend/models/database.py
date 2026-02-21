#!/usr/bin/env python3
"""
数据库模型定义
使用SQLAlchemy ORM
"""
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from backend.config import DATABASE_URL

# 创建数据库引擎
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

# 创建基类
Base = declarative_base()

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class ClothingItem(Base):
    """服装物品模型"""
    __tablename__ = "clothing_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 基本信息
    filename = Column(String(255), nullable=False, comment="原始文件名")
    original_path = Column(String(500), comment="原始图片路径")
    transparent_path = Column(String(500), comment="透明背景图片路径")
    
    # 分类信息
    category = Column(String(50), comment="服装类别(上衣/裤子/裙子/外套/鞋子/帽子/包包/配饰)")
    type = Column(String(100), comment="具体类型(T恤/牛仔裤/连衣裙等)")
    color = Column(String(50), comment="主要颜色")
    color_tone = Column(String(30), comment="色调类型(暖色调/冷色调/中性色/多色)")
    style = Column(JSON, comment="风格列表(休闲/正式/运动/通勤等)")
    material = Column(String(50), comment="材质")
    thickness = Column(String(20), comment="厚薄程度(薄款/中等/厚款)")
    
    # 特征和适用场景 (JSON格式存储列表)
    features = Column(JSON, comment="显著特征列表")
    season = Column(JSON, comment="适合季节列表")
    suitable_weather = Column(JSON, comment="适合天气列表")
    suitable_occasions = Column(JSON, comment="适合场合列表")
    suitable_age_group = Column(String(50), comment="适合年龄段")
    
    # 穿搭建议
    body_type_tips = Column(String(255), comment="身材类型建议")
    matching_tops = Column(JSON, comment="推荐搭配上衣")
    matching_bottoms = Column(JSON, comment="推荐搭配下装")
    matching_shoes = Column(JSON, comment="推荐搭配鞋子")
    matching_accessories = Column(JSON, comment="推荐搭配配饰")
    matching_colors = Column(JSON, comment="推荐搭配颜色")
    outfit_tags = Column(JSON, comment="穿搭标签")
    
    # 描述和置信度
    description = Column(Text, comment="详细描述")
    confidence = Column(String(20), comment="识别置信度(high/medium/low)")
    
    # 用户自定义字段
    is_favorite = Column(Boolean, default=False, comment="是否收藏")
    is_archived = Column(Boolean, default=False, comment="是否归档(不常穿)")
    purchase_date = Column(DateTime, comment="购买日期")
    price = Column(Float, comment="价格")
    brand = Column(String(100), comment="品牌")
    user_notes = Column(Text, comment="用户备注")
    
    # 状态和统计
    wear_count = Column(Integer, default=0, comment="穿着次数")
    last_worn_date = Column(DateTime, comment="最后穿着日期")
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "filename": self.filename,
            "original_path": self.original_path,
            "transparent_path": self.transparent_path,
            "category": self.category,
            "type": self.type,
            "color": self.color,
            "color_tone": self.color_tone,
            "style": self.style or [],
            "material": self.material,
            "thickness": self.thickness,
            "features": self.features or [],
            "season": self.season or [],
            "suitable_weather": self.suitable_weather or [],
            "suitable_occasions": self.suitable_occasions or [],
            "suitable_age_group": self.suitable_age_group,
            "body_type_tips": self.body_type_tips,
            "matching_tops": self.matching_tops or [],
            "matching_bottoms": self.matching_bottoms or [],
            "matching_shoes": self.matching_shoes or [],
            "matching_accessories": self.matching_accessories or [],
            "matching_colors": self.matching_colors or [],
            "outfit_tags": self.outfit_tags or [],
            "description": self.description,
            "confidence": self.confidence,
            "is_favorite": self.is_favorite,
            "is_archived": self.is_archived,
            "purchase_date": self.purchase_date.isoformat() if self.purchase_date else None,
            "price": self.price,
            "brand": self.brand,
            "user_notes": self.user_notes,
            "wear_count": self.wear_count,
            "last_worn_date": self.last_worn_date.isoformat() if self.last_worn_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OutfitRecord(Base):
    """穿搭记录模型"""
    __tablename__ = "outfit_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, default=datetime.now, comment="穿搭日期")
    outfit_name = Column(String(100), comment="穿搭名称")
    clothing_ids = Column(JSON, comment="服装ID列表")
    weather = Column(String(50), comment="当天天气")
    temperature = Column(Float, comment="温度")
    occasion = Column(String(50), comment="场合")
    mood = Column(String(50), comment="心情")
    rating = Column(Integer, comment="评分(1-5)")
    notes = Column(Text, comment="备注")
    photo_path = Column(String(500), comment="穿搭照片路径")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    
    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "outfit_name": self.outfit_name,
            "clothing_ids": self.clothing_ids or [],
            "weather": self.weather,
            "temperature": self.temperature,
            "occasion": self.occasion,
            "mood": self.mood,
            "rating": self.rating,
            "notes": self.notes,
            "photo_path": self.photo_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserPreference(Base):
    """用户偏好设置模型"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    preference_key = Column(String(100), unique=True, nullable=False, comment="偏好键")
    preference_value = Column(JSON, comment="偏好值")
    description = Column(String(255), comment="描述")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")


def init_db():
    """初始化数据库"""
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成！")


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()