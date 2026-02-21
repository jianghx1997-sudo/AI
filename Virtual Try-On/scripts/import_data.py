#!/usr/bin/env python3
"""
数据导入脚本
将已有的分类结果JSON导入到数据库
"""
import json
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
from backend.models import init_db, SessionLocal, ClothingItem
from backend.config import PHOTO_DIR, TRANSPARENT_DIR


def import_classification_results(json_path: str = "output/classification_results.json"):
    """导入分类结果到数据库"""
    
    # 初始化数据库
    print("初始化数据库...")
    init_db()
    
    # 读取JSON文件
    json_file = Path(__file__).parent.parent / json_path
    if not json_file.exists():
        print(f"❌ 文件不存在: {json_file}")
        return
    
    with open(json_file, 'r', encoding='utf-8') as f:
        results = json.load(f)
    
    print(f"读取到 {len(results)} 条记录")
    
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        imported_count = 0
        for item_data in results:
            # 检查是否已存在
            existing = db.query(ClothingItem).filter(
                ClothingItem.filename == item_data.get("filename")
            ).first()
            
            if existing:
                print(f"  ⏭ 跳过已存在: {item_data.get('filename')}")
                continue
            
            # 构建图片路径
            filename = item_data.get("filename", "")
            original_path = str(PHOTO_DIR / filename) if filename else None
            
            transparent_filename = filename.rsplit('.', 1)[0] + "_transparent.png" if filename else None
            transparent_path = str(TRANSPARENT_DIR / transparent_filename) if transparent_filename else None
            
            # 检查文件是否存在
            if original_path and not Path(original_path).exists():
                original_path = None
            if transparent_path and not Path(transparent_path).exists():
                transparent_path = None
            
            # 创建数据库记录
            item = ClothingItem(
                filename=filename,
                original_path=original_path,
                transparent_path=transparent_path,
                category=item_data.get("category"),
                type=item_data.get("type"),
                color=item_data.get("color"),
                color_tone=item_data.get("color_tone"),
                style=item_data.get("style"),
                material=item_data.get("material"),
                thickness=item_data.get("thickness"),
                features=item_data.get("features"),
                season=item_data.get("season"),
                suitable_weather=item_data.get("suitable_weather"),
                suitable_occasions=item_data.get("suitable_occasions"),
                suitable_age_group=item_data.get("suitable_age_group"),
                body_type_tips=item_data.get("body_type_tips"),
                matching_tops=item_data.get("matching_tops"),
                matching_bottoms=item_data.get("matching_bottoms"),
                matching_shoes=item_data.get("matching_shoes"),
                matching_accessories=item_data.get("matching_accessories"),
                matching_colors=item_data.get("matching_colors"),
                outfit_tags=item_data.get("outfit_tags"),
                description=item_data.get("description"),
                confidence=item_data.get("confidence"),
            )
            
            db.add(item)
            imported_count += 1
            print(f"  ✓ 导入: {filename}")
        
        # 提交事务
        db.commit()
        print(f"\n✅ 成功导入 {imported_count} 条记录")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 导入失败: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    import_classification_results()