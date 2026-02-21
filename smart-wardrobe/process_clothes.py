#!/usr/bin/env python3
"""
衣服图片背景透明化处理和AI分类脚本
使用阿里云通义千问(qwen-vl)进行图像识别
"""

import os
import base64
import json
from pathlib import Path
from PIL import Image
from rembg import remove
import requests

# 配置
PHOTO_DIR = Path("photo")
OUTPUT_DIR = Path("output")
TRANSPARENT_DIR = OUTPUT_DIR / "transparent"

# 阿里云通义千问API配置
DASHSCOPE_API_KEY = "sk-475537d9b1634c5487b87e81b9d44230"
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# 确保输出目录存在
OUTPUT_DIR.mkdir(exist_ok=True)
TRANSPARENT_DIR.mkdir(exist_ok=True)

def remove_background(input_path, output_path):
    """使用rembg去除图片背景 (U²-Net模型)"""
    print(f"  正在处理: {input_path.name}")
    
    # 打开图片
    with open(input_path, 'rb') as f:
        input_image = f.read()
    
    # 去除背景
    output_image = remove(input_image)
    
    # 保存结果
    with open(output_path, 'wb') as f:
        f.write(output_image)
    
    print(f"  ✓ 已保存透明背景图片: {output_path}")
    return output_path

def encode_image_to_base64(image_path):
    """将图片转换为base64编码"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def classify_with_qwen(image_path):
    """
    使用阿里云通义千问(qwen-vl)进行图像识别和分类
    """
    print(f"  正在调用通义千问API进行AI分类...")
    
    # 将图片转换为base64
    base64_image = encode_image_to_base64(image_path)
    
    # 构建API请求
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "qwen-vl-max",
        "messages": [
            {
                "role": "system",
                "content": "你是一个专业的服装识别与穿搭顾问专家。请分析图片中的服装，提供详细的分类信息以及穿搭搭配建议，以便后续根据场景、天气、风格等为用户推荐每日搭配方案。"
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
                        "text": """请详细分析这张服装图片，并按以下JSON格式返回结果（用于智能穿搭推荐系统）：
{
    "category": "服装类别（如：上衣、裤子、裙子、外套、鞋子、配饰等）",
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
    "suitable_age_group": "适合年龄段（如：青少年、青年、中年、全年龄等）",
    "body_type_tips": "适合的身材类型建议（如：适合高挑身材、显瘦、显高等）",
    "matching_tops": ["推荐搭配的上衣类型，如：白色T恤、衬衫等"],
    "matching_bottoms": ["推荐搭配的下装类型，如：黑色紧身裤、牛仔裤等"],
    "matching_shoes": ["推荐搭配的鞋子类型，如：小白鞋、高跟鞋等"],
    "matching_accessories": ["推荐搭配的配饰，如：帆布包、棒球帽等"],
    "matching_colors": ["推荐的搭配颜色，如：白色、米色、黑色等"],
    "outfit_tags": ["穿搭标签，可多选：ins风、极简风、法式浪漫、韩系、日系、北欧风、复古等"],
    "description": "详细描述（包括穿搭建议）",
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
            f"{DASHSCOPE_BASE_URL}/chat/completions",
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
            print(f"  ✓ AI分类成功")
            return classification
            
        except json.JSONDecodeError:
            # 如果无法解析JSON，返回原始文本
            print(f"  ⚠ 无法解析JSON，返回原始结果")
            return {
                "category": "unknown",
                "type": "clothing",
                "description": content,
                "confidence": "low"
            }
            
    except Exception as e:
        print(f"  ✗ API调用失败: {e}")
        # 失败时回退到基于文件名的分类
        return classify_by_filename(image_path)

def classify_by_filename(image_path):
    """
    基于文件名的启发式分类（备用方案）
    """
    filename = image_path.stem.lower()
    
    categories = {
        "pants": ["pants", "trousers", "jeans", "shorts", "leggings", "slacks"],
        "shirt": ["shirt", "t-shirt", "tshirt", "blouse", "top", "tee"],
        "dress": ["dress", "gown", "skirt"],
        "jacket": ["jacket", "coat", "blazer", "sweater", "hoodie", "cardigan"],
        "shoes": ["shoes", "sneakers", "boots", "sandals", "heels"],
        "accessories": ["bag", "hat", "scarf", "belt", "gloves", "sunglasses"]
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

def process_all_images():
    """处理所有图片"""
    # 获取所有图片文件
    image_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}
    image_files = [f for f in PHOTO_DIR.iterdir() 
                   if f.is_file() and f.suffix.lower() in image_extensions]
    
    if not image_files:
        print("没有找到图片文件！")
        return
    
    print(f"找到 {len(image_files)} 张图片")
    print(f"使用模型: 通义千问 (qwen-vl-max)")
    print("=" * 60)
    
    results = []
    
    for image_file in image_files:
        print(f"\n处理图片: {image_file.name}")
        print("-" * 60)
        
        # 1. 背景透明化 (U²-Net模型)
        transparent_path = TRANSPARENT_DIR / f"{image_file.stem}_transparent.png"
        remove_background(image_file, transparent_path)
        
        # 2. AI分类 (通义千问)
        classification = classify_with_qwen(image_file)
        classification["filename"] = image_file.name
        classification["transparent_path"] = str(transparent_path)
        results.append(classification)
        
        # 显示分类结果
        print(f"\n  ✓ 分类结果:")
        print(f"    📁 类别: {classification.get('category', 'N/A')}")
        print(f"    👔 类型: {classification.get('type', 'N/A')}")
        print(f"    🎨 颜色: {classification.get('color', 'N/A')} ({classification.get('color_tone', 'N/A')})")
        print(f"    ✨ 风格: {classification.get('style', 'N/A')}")
        print(f"    🧵 材质: {classification.get('material', 'N/A')} / {classification.get('thickness', 'N/A')}")
        if classification.get('features'):
            print(f"    📝 特征: {', '.join(classification['features'])}")
        if classification.get('season'):
            print(f"    🌸 适合季节: {', '.join(classification['season'])}")
        if classification.get('suitable_weather'):
            print(f"    🌤 适合天气: {', '.join(classification['suitable_weather'])}")
        if classification.get('suitable_occasions'):
            print(f"    🏷 适合场合: {', '.join(classification['suitable_occasions'])}")
        if classification.get('outfit_tags'):
            print(f"    🔖 穿搭标签: {', '.join(classification['outfit_tags'])}")
        if classification.get('matching_tops'):
            print(f"    👕 搭配上衣: {', '.join(classification['matching_tops'])}")
        if classification.get('matching_bottoms'):
            print(f"    👖 搭配下装: {', '.join(classification['matching_bottoms'])}")
        if classification.get('matching_shoes'):
            print(f"    👟 搭配鞋子: {', '.join(classification['matching_shoes'])}")
        if classification.get('matching_accessories'):
            print(f"    👜 搭配配饰: {', '.join(classification['matching_accessories'])}")
        if classification.get('matching_colors'):
            print(f"    🎨 推荐配色: {', '.join(classification['matching_colors'])}")
        if classification.get('body_type_tips'):
            print(f"    💃 身材建议: {classification['body_type_tips']}")
        print(f"    📊 置信度: {classification.get('confidence', 'N/A')}")
        if classification.get('description'):
            print(f"    💬 描述: {classification['description']}")
    
    # 保存分类结果到JSON文件
    results_path = OUTPUT_DIR / "classification_results.json"
    with open(results_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"✅ 处理完成！")
    print(f"   透明背景图片: {TRANSPARENT_DIR}")
    print(f"   分类结果: {results_path}")
    print("=" * 60)
    
    return results

if __name__ == "__main__":
    print("开始处理衣服照片...")
    print("=" * 60)
    process_all_images()
