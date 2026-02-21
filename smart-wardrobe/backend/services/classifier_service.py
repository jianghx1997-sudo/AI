#!/usr/bin/env python3
"""
AI分类服务
使用阿里云通义千问进行图像识别
"""
import base64
import json
import requests
from typing import Dict, Any, Optional
from pathlib import Path

from backend.config import DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL


class ClassifierService:
    """AI分类服务"""
    
    def __init__(self):
        self.api_key = DASHSCOPE_API_KEY
        self.base_url = DASHSCOPE_BASE_URL
    
    def encode_image_to_base64(self, image_path: str) -> str:
        """将图片转换为base64编码"""
        with open(image_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    
    def classify_image(self, image_path: str) -> Dict[str, Any]:
        """
        使用通义千问进行图像分类
        """
        # 将图片转换为base64
        base64_image = self.encode_image_to_base64(image_path)
        
        # 构建API请求
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "qwen-vl-max",
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个专业的服装识别与穿搭顾问专家。请分析图片中的服装，提供详细的分类信息以及穿搭搭配建议。"
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        },
                        {
                            "type": "text",
                            "text": """请详细分析这张服装图片，并按以下JSON格式返回结果：
{
    "category": "服装类别（如：上衣、裤子、裙子、外套、鞋子、帽子、包包、配饰等）",
    "type": "具体类型（如：T恤、牛仔裤、连衣裙、运动鞋等）",
    "color": "主要颜色",
    "color_tone": "色调类型（暖色调/冷色调/中性色/多色）",
    "style": "风格（如：休闲、正式、运动、通勤、时尚、街头、复古等）",
    "material": "材质（如棉、牛仔、皮革、羊毛等，如看不清可写未知）",
    "thickness": "厚薄程度（薄款/中等/厚款）",
    "features": ["显著特征1", "显著特征2"],
    "season": ["适合季节，可多选：春、夏、秋、冬"],
    "suitable_weather": ["适合天气，可多选：晴天、阴天、小雨、冷天、热天、大风等"],
    "suitable_occasions": ["适合场合，可多选：日常休闲、上班通勤、户外运动、正式场合、约会、聚会、旅行等"],
    "suitable_age_group": "适合年龄段",
    "body_type_tips": "适合的身材类型建议",
    "matching_tops": ["推荐搭配的上衣类型"],
    "matching_bottoms": ["推荐搭配的下装类型"],
    "matching_shoes": ["推荐搭配的鞋子类型"],
    "matching_accessories": ["推荐搭配的配饰"],
    "matching_colors": ["推荐的搭配颜色"],
    "outfit_tags": ["穿搭标签"],
    "description": "详细描述",
    "confidence": "识别置信度（high/medium/low）"
}
请只返回JSON格式的结果，不要有其他文字说明。"""
                        }
                    ]
                }
            ]
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            )
            response.raise_for_status()
            
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            
            # 尝试解析JSON响应
            try:
                # 清理可能的markdown代码块标记
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                
                classification = json.loads(content)
                return classification
                
            except json.JSONDecodeError:
                # 如果无法解析JSON，返回原始文本
                return {
                    "category": "unknown",
                    "type": "clothing",
                    "description": content,
                    "confidence": "low"
                }
                
        except Exception as e:
            print(f"API调用失败: {e}")
            return self.classify_by_filename(Path(image_path))
    
    def classify_by_filename(self, image_path: Path) -> Dict[str, Any]:
        """基于文件名的启发式分类（备用方案）"""
        filename = image_path.stem.lower()
        
        categories = {
            "裤子": ["pants", "trousers", "jeans", "shorts", "leggings", "slacks"],
            "上衣": ["shirt", "t-shirt", "tshirt", "blouse", "top", "tee"],
            "裙子": ["dress", "gown", "skirt"],
            "外套": ["jacket", "coat", "blazer", "sweater", "hoodie", "cardigan"],
            "鞋子": ["shoes", "sneakers", "boots", "sandals", "heels"],
            "帽子": ["hat", "cap", "beanie"],
            "包包": ["bag", "handbag", "backpack", "purse", "tote", "clutch"],
            "配饰": ["scarf", "belt", "gloves", "sunglasses", "watch", "jewelry"]
        }
        
        detected_category = "unknown"
        detected_type = "clothing"
        
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in filename:
                    detected_category = category
                    detected_type = keyword
                    break
            if detected_category != "unknown":
                break
        
        return {
            "category": detected_category,
            "type": detected_type,
            "color": "unknown",
            "style": "unknown",
            "material": "unknown",
            "features": [],
            "description": f"Based on filename, this appears to be {detected_type}.",
            "confidence": "low",
            "note": "Fallback classification (API failed)"
        }


# 单例实例
classifier_service = ClassifierService()