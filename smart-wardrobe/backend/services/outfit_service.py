#!/usr/bin/env python3
"""
智能搭配推荐服务
基于衣服属性和搭配规则推荐服装组合
"""
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from backend.models.database import ClothingItem


class OutfitService:
    """智能搭配推荐服务"""
    
    # 颜色搭配规则
    COLOR_COMPATIBILITY = {
        # 中性色可以搭配任何颜色
        "黑色": ["白色", "灰色", "米色", "蓝色", "红色", "绿色", "黄色", "橙色", "紫色", "粉色", "棕色", "牛仔蓝"],
        "白色": ["黑色", "灰色", "米色", "蓝色", "红色", "绿色", "黄色", "橙色", "紫色", "粉色", "棕色", "牛仔蓝"],
        "灰色": ["黑色", "白色", "米色", "蓝色", "红色", "粉色", "牛仔蓝"],
        "米色": ["黑色", "白色", "灰色", "棕色", "蓝色", "绿色", "牛仔蓝"],
        
        # 彩色搭配规则
        "蓝色": ["黑色", "白色", "灰色", "米色", "牛仔蓝"],
        "红色": ["黑色", "白色", "灰色", "米色"],
        "绿色": ["黑色", "白色", "米色", "棕色"],
        "黄色": ["黑色", "白色", "灰色", "蓝色"],
        "橙色": ["黑色", "白色", "蓝色", "牛仔蓝"],
        "紫色": ["黑色", "白色", "灰色", "米色"],
        "粉色": ["黑色", "白色", "灰色", "米色", "蓝色"],
        "棕色": ["白色", "米色", "蓝色", "绿色", "牛仔蓝"],
        "牛仔蓝": ["黑色", "白色", "灰色", "米色", "红色", "黄色", "橙色", "棕色"],
    }
    
    # 风格搭配规则
    STYLE_COMPATIBILITY = {
        "休闲": ["休闲", "运动", "街头"],
        "正式": ["正式", "优雅", "通勤"],
        "运动": ["运动", "休闲", "街头"],
        "时尚": ["时尚", "街头", "优雅", "复古"],
        "街头": ["街头", "休闲", "时尚", "运动"],
        "复古": ["复古", "时尚", "优雅"],
        "简约": ["简约", "休闲", "通勤", "优雅"],
        "优雅": ["优雅", "正式", "时尚", "简约"],
        "甜美": ["甜美", "优雅", "时尚"],
        "通勤": ["通勤", "正式", "简约", "优雅"],
    }
    
    # 季节搭配规则
    SEASON_RULES = {
        "春": ["春", "秋"],
        "夏": ["夏"],
        "秋": ["秋", "春", "冬"],
        "冬": ["冬", "秋"],
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def recommend_outfit(
        self,
        base_item_id: int,
        occasion: Optional[str] = None,
        season: Optional[str] = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        """
        基于某件衣服推荐完整搭配
        
        Args:
            base_item_id: 基础衣服ID
            occasion: 场合（可选）
            season: 季节（可选）
            limit: 每类推荐数量限制
        
        Returns:
            包含推荐搭配的字典
        """
        # 获取基础衣服
        base_item = self.db.query(ClothingItem).filter(
            ClothingItem.id == base_item_id,
            ClothingItem.is_archived == False
        ).first()
        
        if not base_item:
            return {"success": False, "message": "未找到基础衣服"}
        
        base_category = base_item.category
        base_color = base_item.color
        base_style = base_item.style or []
        base_season = base_item.season or []
        base_type = base_item.type
        
        # 确定需要推荐的类别
        needed_categories = self._get_needed_categories(base_category, base_type)
        
        recommendations = {
            "base_item": base_item.to_dict(),
            "recommendations": {},
            "suggestions": []
        }
        
        # 为每个需要的类别推荐衣服
        for category in needed_categories:
            items = self._recommend_for_category(
                category=category,
                base_color=base_color,
                base_style=base_style,
                base_season=season or (base_season[0] if base_season else None),
                occasion=occasion,
                exclude_ids=[base_item_id],
                limit=limit
            )
            if items:
                recommendations["recommendations"][category] = items
        
        # 生成搭配建议
        recommendations["suggestions"] = self._generate_suggestions(
            base_item, 
            recommendations["recommendations"]
        )
        
        return recommendations
    
    def recommend_for_occasion(
        self,
        occasion: str,
        season: Optional[str] = None,
        style_preference: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        根据场合推荐完整搭配组合
        
        Args:
            occasion: 场合
            season: 季节
            style_preference: 风格偏好
        
        Returns:
            推荐的搭配组合
        """
        # 获取所有未归档的衣服
        query = self.db.query(ClothingItem).filter(
            ClothingItem.is_archived == False
        )
        
        all_items = query.all()
        
        # 在Python中过滤场合和季节（因为SQLite不能直接查询JSON数组）
        items = [item for item in all_items 
                 if item.suitable_occasions and occasion in item.suitable_occasions]
        
        if season:
            items = [item for item in items 
                     if item.season and season in item.season]
        
        if not items:
            return {
                "success": False,
                "message": f"未找到适合{occasion}场合的衣服"
            }
        
        # 按类别分组
        items_by_category = {}
        for item in items:
            cat = item.category
            if cat not in items_by_category:
                items_by_category[cat] = []
            items_by_category[cat].append(item)
        
        # 尝试组合搭配
        outfit_combinations = self._create_outfit_combinations(
            items_by_category,
            style_preference,
            limit=3
        )
        
        return {
            "success": True,
            "occasion": occasion,
            "season": season,
            "outfits": outfit_combinations
        }
    
    def get_color_recommendations(self, color: str) -> List[str]:
        """获取颜色搭配建议"""
        return self.COLOR_COMPATIBILITY.get(color, ["黑色", "白色", "灰色"])
    
    def _get_needed_categories(self, base_category: str, base_type: str = None) -> List[str]:
        """根据基础衣服类别确定需要推荐的其他类别"""
        # 先检查具体类型，处理特殊情况
        if base_type:
            base_type_lower = base_type.lower() if base_type else ""
            # 连衣裙是完整的套装，只需要搭配鞋子和配饰
            if "连衣裙" in base_type or "长裙" in base_type:
                return ["鞋子", "包包", "配饰"]
            # 连体裤也是完整的套装
            if "连体" in base_type or " jumpsuit" in base_type_lower:
                return ["鞋子", "包包", "配饰"]
            # 半身裙需要搭配上衣
            if "裙" in base_type and "连衣" not in base_type:
                return ["上衣", "鞋子"]
        
        # 按类别的一般规则
        category_mapping = {
            "上衣": ["裤子", "裙子", "鞋子"],
            "裤子": ["上衣", "鞋子"],
            "裙子": ["上衣", "鞋子"],  # 半身裙需要搭配上衣
            "外套": ["上衣", "裤子", "裙子", "鞋子"],
            "鞋子": ["上衣", "裤子", "裙子"],
            "帽子": ["上衣", "裤子", "裙子", "鞋子"],
            "包包": ["上衣", "裤子", "裙子", "鞋子"],
            "配饰": ["上衣", "裤子", "裙子", "鞋子"],
        }
        return category_mapping.get(base_category, ["上衣", "裤子", "鞋子"])
    
    def _recommend_for_category(
        self,
        category: str,
        base_color: str,
        base_style: List[str],
        base_season: Optional[str],
        occasion: Optional[str],
        exclude_ids: List[int],
        limit: int
    ) -> List[Dict[str, Any]]:
        """为特定类别推荐衣服"""
        query = self.db.query(ClothingItem).filter(
            ClothingItem.category == category,
            ClothingItem.is_archived == False,
            ClothingItem.id.notin_(exclude_ids)
        )
        
        items = query.all()
        
        # 如果推荐裙子类别，排除连衣裙（连衣裙不需要搭配上衣）
        if category == "裙子":
            items = [item for item in items 
                     if item.type and "连衣裙" not in item.type and "长裙" not in item.type]
        
        # 在Python中过滤季节和场合（因为SQLite不能直接查询JSON数组）
        if base_season:
            items = [item for item in items if item.season and base_season in item.season]
        
        if occasion:
            items = [item for item in items if item.suitable_occasions and occasion in item.suitable_occasions]
        
        # 计算每件衣服的匹配分数
        scored_items = []
        for item in items:
            score = self._calculate_match_score(
                item, base_color, base_style, base_season
            )
            scored_items.append((item, score))
        
        # 按分数排序
        scored_items.sort(key=lambda x: x[1], reverse=True)
        
        return [item.to_dict() for item, score in scored_items[:limit]]
    
    def _calculate_match_score(
        self,
        item: ClothingItem,
        base_color: str,
        base_style: List[str],
        base_season: Optional[str]
    ) -> float:
        """计算匹配分数"""
        score = 0.0
        
        # 颜色匹配 (权重: 40%)
        if base_color and item.color:
            compatible_colors = self.COLOR_COMPATIBILITY.get(base_color, [])
            if item.color in compatible_colors:
                score += 0.4
            elif item.color == base_color:
                score += 0.2  # 同色系
            else:
                score += 0.1  # 其他颜色
        
        # 风格匹配 (权重: 40%)
        if base_style and item.style:
            item_styles = item.style or []
            matching_styles = set(base_style) & set(item_styles)
            if matching_styles:
                score += 0.4 * len(matching_styles) / max(len(base_style), 1)
            else:
                # 检查风格兼容性
                for bs in base_style:
                    compatible = self.STYLE_COMPATIBILITY.get(bs, [])
                    if any(s in compatible for s in item_styles):
                        score += 0.2
                        break
        
        # 季节匹配 (权重: 20%)
        if base_season and item.season:
            if base_season in item.season:
                score += 0.2
            else:
                # 检查季节兼容性
                compatible_seasons = self.SEASON_RULES.get(base_season, [])
                if any(s in compatible_seasons for s in item.season):
                    score += 0.1
        
        return score
    
    def _create_outfit_combinations(
        self,
        items_by_category: Dict[str, List[ClothingItem]],
        style_preference: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """创建搭配组合"""
        outfits = []
        
        # 获取各类别
        tops = items_by_category.get("上衣", [])
        pants = items_by_category.get("裤子", [])
        skirts = items_by_category.get("裙子", [])
        shoes = items_by_category.get("鞋子", [])
        outerwears = items_by_category.get("外套", [])
        bags = items_by_category.get("包包", [])
        accessories = items_by_category.get("配饰", [])
        
        # 区分半身裙和连衣裙
        half_skirts = []  # 半身裙，需要搭配上衣
        dresses = []      # 连衣裙，不需要搭配上衣
        for skirt in skirts:
            skirt_type = skirt.type or ""
            if "连衣裙" in skirt_type or "长裙" in skirt_type:
                dresses.append(skirt)
            else:
                half_skirts.append(skirt)
        
        # 尝试组合：上衣 + 裤子 + 鞋子（如果有鞋子）
        if tops and pants:
            for top in tops[:5]:
                for pant in pants[:3]:
                    if shoes:
                        for shoe in shoes[:3]:
                            score = self._calculate_outfit_score([top, pant, shoe], style_preference)
                            if score >= 0.3:
                                outfits.append({
                                    "items": [top.to_dict(), pant.to_dict(), shoe.to_dict()],
                                    "score": score,
                                    "type": "上衣+裤子+鞋子"
                                })
                    else:
                        # 没有鞋子时，只用上衣+裤子
                        score = self._calculate_outfit_score([top, pant], style_preference)
                        if score >= 0.3:
                            outfits.append({
                                "items": [top.to_dict(), pant.to_dict()],
                                "score": score,
                                "type": "上衣+裤子"
                            })
        
        # 尝试组合：上衣 + 半身裙 + 鞋子（如果有鞋子）
        # 注意：只搭配半身裙，不搭配连衣裙
        if tops and half_skirts:
            for top in tops[:5]:
                for skirt in half_skirts[:3]:
                    if shoes:
                        for shoe in shoes[:3]:
                            score = self._calculate_outfit_score([top, skirt, shoe], style_preference)
                            if score >= 0.3:
                                outfits.append({
                                    "items": [top.to_dict(), skirt.to_dict(), shoe.to_dict()],
                                    "score": score,
                                    "type": "上衣+裙子+鞋子"
                                })
                    else:
                        # 没有鞋子时，只用上衣+裙子
                        score = self._calculate_outfit_score([top, skirt], style_preference)
                        if score >= 0.3:
                            outfits.append({
                                "items": [top.to_dict(), skirt.to_dict()],
                                "score": score,
                                "type": "上衣+裙子"
                            })
        
        # 尝试组合：连衣裙单独作为一套（不需要上衣和裤子）
        if dresses:
            for dress in dresses[:5]:
                # 连衣裙可以单独作为一套
                outfits.append({
                    "items": [dress.to_dict()],
                    "score": 0.5,
                    "type": "连衣裙"
                })
        
        # 按分数排序并返回前N个
        outfits.sort(key=lambda x: x["score"], reverse=True)
        return outfits[:limit]
    
    def _calculate_outfit_score(
        self,
        items: List[ClothingItem],
        style_preference: Optional[List[str]]
    ) -> float:
        """计算整体搭配分数"""
        if len(items) < 2:
            return 0.5  # 单件衣服给一个基础分
        
        score = 0.0
        
        # 检查颜色协调
        colors = [item.color for item in items if item.color]
        if len(colors) >= 2:
            color_score = 0
            for i, c1 in enumerate(colors):
                for c2 in colors[i+1:]:
                    compatible = self.COLOR_COMPATIBILITY.get(c1, [])
                    if c2 in compatible or c1 == c2:
                        color_score += 1
            score += color_score / (len(colors) * (len(colors) - 1) / 2) * 0.4
        
        # 检查风格一致
        all_styles = []
        for item in items:
            all_styles.extend(item.style or [])
        
        if all_styles:
            style_counts = {}
            for s in all_styles:
                style_counts[s] = style_counts.get(s, 0) + 1
            
            # 如果有重复出现的风格，加分
            repeated_styles = sum(1 for c in style_counts.values() if c > 1)
            score += min(repeated_styles * 0.3, 0.4)
            
            # 风格偏好加分
            if style_preference:
                matched = len(set(style_preference) & set(style_counts.keys()))
                score += matched * 0.1
        
        # 检查季节一致
        seasons_list = [item.season for item in items if item.season]
        if seasons_list:
            common_seasons = set(seasons_list[0])
            for s in seasons_list[1:]:
                common_seasons &= set(s)
            if common_seasons:
                score += 0.2
        
        return min(score, 1.0)
    
    def _generate_suggestions(
        self,
        base_item: ClothingItem,
        recommendations: Dict[str, List[Dict]]
    ) -> List[str]:
        """生成搭配建议文案"""
        suggestions = []
        
        base_category = base_item.category
        base_color = base_item.color
        base_style = base_item.style or []
        base_type = base_item.type or ""
        
        # 基于类别的建议
        if base_category == "上衣":
            suggestions.append("这件上衣可以搭配休闲裤或牛仔裤")
        elif base_category == "裤子":
            suggestions.append("这条裤子适合搭配简约风格的上衣")
        elif base_category == "裙子":
            # 区分连衣裙和半身裙
            if "连衣裙" in base_type or "长裙" in base_type:
                suggestions.append("连衣裙单穿就很美，搭配一双好看的鞋子即可")
            else:
                suggestions.append("这条半身裙搭配修身上衣效果更佳")
        
        # 基于颜色的建议
        if base_color:
            compatible = self.COLOR_COMPATIBILITY.get(base_color, [])
            if compatible:
                suggestions.append(f"建议搭配{', '.join(compatible[:3])}色系的单品")
        
        # 基于风格的建议
        if base_style:
            if "正式" in base_style:
                suggestions.append("适合商务会议或正式场合")
            if "休闲" in base_style:
                suggestions.append("日常休闲穿着的绝佳选择")
            if "运动" in base_style:
                suggestions.append("适合运动健身或户外活动")
        
        return suggestions