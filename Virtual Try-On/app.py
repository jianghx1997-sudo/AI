#!/usr/bin/env python3
"""
衣服照片处理Web应用
使用Streamlit构建 - 目录导航版本
"""

import os
import sys
import base64
import json
import shutil
from pathlib import Path
from datetime import datetime
import streamlit as st
from PIL import Image
from rembg import remove
import requests

# 页面配置
st.set_page_config(
    page_title="衣服照片智能处理系统",
    page_icon="👔",
    layout="wide",
    initial_sidebar_state="expanded"
)

# CSS样式
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .category-card {
        background-color: #f8f9fa;
        padding: 1.5rem;
        border-radius: 10px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;
        border: 2px solid #e9ecef;
    }
    .category-card:hover {
        background-color: #e3f2fd;
        border-color: #2196f3;
        transform: translateY(-2px);
    }
    .item-row {
        background-color: #f8f9fa;
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        border: 1px solid #e9ecef;
    }
    .confidence-high {
        color: #28a745;
        font-weight: bold;
    }
    .confidence-medium {
        color: #ffc107;
        font-weight: bold;
    }
    .confidence-low {
        color: #dc3545;
        font-weight: bold;
    }
</style>
""", unsafe_allow_html=True)

# 阿里云通义千问API配置
DASHSCOPE_API_KEY = "sk-475537d9b1634c5487b87e81b9d44230"
DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

# 文件夹配置
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
TRANSPARENT_DIR = OUTPUT_DIR / "transparent"

# 确保目录存在
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
TRANSPARENT_DIR.mkdir(exist_ok=True)

def remove_background(input_path, output_path):
    """使用rembg去除图片背景"""
    with open(input_path, 'rb') as f:
        input_image = f.read()
    output_image = remove(input_image)
    with open(output_path, 'wb') as f:
        f.write(output_image)
    return output_path

def encode_image_to_base64(image_path):
    """将图片转换为base64编码"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def classify_with_qwen(image_path):
    """使用阿里云通义千问进行图像识别"""
    base64_image = encode_image_to_base64(image_path)
    
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "qwen-vl-max",
        "messages": [
            {
                "role": "system",
                "content": "你是一个专业的服装识别专家。请分析图片中的服装，并提供详细的分类信息。"
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
    "category": "服装类别（如：上衣、裤子、裙子、外套、鞋子等）",
    "type": "具体类型（如：T恤、牛仔裤、连衣裙、运动鞋等）",
    "color": "主要颜色",
    "style": "风格（如：休闲、正式、运动、时尚等）",
    "material": "材质（如棉、牛仔、皮革等，如看不清可写未知）",
    "features": ["显著特征1", "显著特征2"],
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
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            classification = json.loads(content)
            return classification
            
        except json.JSONDecodeError:
            return {
                "category": "unknown",
                "type": "clothing",
                "color": "unknown",
                "style": "unknown",
                "material": "unknown",
                "features": [],
                "description": content,
                "confidence": "low"
            }
            
    except Exception as e:
        st.error(f"API调用失败: {e}")
        return None

def process_single_image(uploaded_file, progress_bar, status_text):
    """处理单张图片"""
    # 保存上传的文件
    file_path = UPLOAD_DIR / uploaded_file.name
    with open(file_path, 'wb') as f:
        f.write(uploaded_file.getvalue())
    
    status_text.text(f"正在处理: {uploaded_file.name}")
    
    # 背景透明化
    transparent_path = TRANSPARENT_DIR / f"{file_path.stem}_transparent.png"
    remove_background(file_path, transparent_path)
    progress_bar.progress(50)
    
    status_text.text(f"正在进行AI分类: {uploaded_file.name}")
    
    # AI分类
    classification = classify_with_qwen(file_path)
    progress_bar.progress(100)
    
    if classification:
        classification["original_filename"] = uploaded_file.name
        classification["original_path"] = str(file_path)
        classification["transparent_path"] = str(transparent_path)
        classification["processed_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return classification
    
    return None

def get_confidence_class(confidence):
    """获取置信度样式类"""
    if confidence == "high":
        return "confidence-high"
    elif confidence == "medium":
        return "confidence-medium"
    else:
        return "confidence-low"

def show_category_list(results):
    """显示类别目录列表"""
    st.subheader("📁 选择类别查看")
    
    # 按类别分组统计
    category_count = {}
    
    for r in results:
        cat = r.get('category', 'unknown')
        category_count[cat] = category_count.get(cat, 0) + 1
    
    # 显示类别卡片网格
    categories = sorted(category_count.keys())
    cols = st.columns(3)
    
    for idx, category in enumerate(categories):
        with cols[idx % 3]:
            with st.container():
                # 显示类别卡片
                st.markdown(f"""
                <div class="category-card">
                    <h3>📂 {category}</h3>
                    <p style="font-size: 1.2rem; color: #666;">{category_count[category]} 件衣物</p>
                </div>
                """, unsafe_allow_html=True)
                
                # 使用按钮进入类别详情
                if st.button(f"查看详情", key=f"btn_{category}", use_container_width=True):
                    st.session_state.selected_category = category
                    st.rerun()

def show_category_detail(results, category):
    """显示类别详情"""
    # 返回按钮
    if st.button("← 返回目录", type="secondary"):
        del st.session_state.selected_category
        st.rerun()
    
    st.header(f"📂 {category}")
    
    # 获取该类别的所有衣物
    category_items = [r for r in results if r.get('category') == category]
    
    st.write(f"共 {len(category_items)} 件衣物")
    
    # 显示每件衣物的信息卡片
    for idx, item in enumerate(category_items):
        with st.container():
            st.markdown("<div class='item-row'>", unsafe_allow_html=True)
            
            # 第一行：图片
            col1, col2, col3 = st.columns([2, 2, 3])
            
            with col1:
                st.caption("📷 原图")
                if os.path.exists(item.get('original_path', '')):
                    st.image(item['original_path'], width=200)
            
            with col2:
                st.caption("✂️ 透明背景")
                if os.path.exists(item.get('transparent_path', '')):
                    st.image(item['transparent_path'], width=200)
            
            with col3:
                st.caption("📋 基本信息")
                
                # 使用纯文本表格显示基本信息
                info_lines = [
                    f"**文件名:** {item.get('original_filename', 'N/A')}",
                    f"**类型:** {item.get('type', 'N/A')}",
                    f"**颜色:** {item.get('color', 'N/A')}",
                    f"**风格:** {item.get('style', 'N/A')}",
                    f"**材质:** {item.get('material', 'N/A')}",
                ]
                
                for line in info_lines:
                    st.markdown(line)
                
                # 置信度带颜色显示
                conf = item.get('confidence', 'N/A')
                if conf == "high":
                    st.markdown(f"**置信度:** <span style='color: #28a745; font-weight: bold;'>{conf}</span>", unsafe_allow_html=True)
                elif conf == "medium":
                    st.markdown(f"**置信度:** <span style='color: #ffc107; font-weight: bold;'>{conf}</span>", unsafe_allow_html=True)
                elif conf == "low":
                    st.markdown(f"**置信度:** <span style='color: #dc3545; font-weight: bold;'>{conf}</span>", unsafe_allow_html=True)
                else:
                    st.markdown(f"**置信度:** {conf}")
            
            # 第二行：描述和特征
            st.markdown("---")
            col_desc, col_feat = st.columns([3, 2])
            
            with col_desc:
                st.caption("📝 详细描述")
                st.write(item.get('description', '暂无描述'))
            
            with col_feat:
                st.caption("✨ 特征")
                features = item.get('features', [])
                if features:
                    for feat in features:
                        st.markdown(f"• {feat}")
                else:
                    st.write("暂无特征信息")
            
            st.markdown("</div>", unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)

def main():
    # 标题
    st.markdown('<h1 class="main-header">👔 衣服照片智能处理系统</h1>', unsafe_allow_html=True)
    
    # 侧边栏
    with st.sidebar:
        st.header("📁 上传设置")
        
        # 文件上传
        uploaded_files = st.file_uploader(
            "选择衣服照片（可多选）",
            type=['jpg', 'jpeg', 'png', 'webp', 'bmp'],
            accept_multiple_files=True,
            help="支持 JPG, PNG, WEBP, BMP 格式"
        )
        
        st.markdown("---")
        
        # 处理按钮
        if uploaded_files:
            if st.button("🚀 开始处理", type="primary", use_container_width=True):
                st.session_state.processing = True
                st.session_state.uploaded_files = uploaded_files
                # 清除之前选择的类别
                if 'selected_category' in st.session_state:
                    del st.session_state.selected_category
        
        st.markdown("---")
        
        # 快捷导航
        if 'all_results' in st.session_state and st.session_state.all_results:
            st.subheader("📂 快捷导航")
            category_count = {}
            for r in st.session_state.all_results:
                cat = r.get('category', 'unknown')
                category_count[cat] = category_count.get(cat, 0) + 1
            
            for cat, count in sorted(category_count.items()):
                if st.button(f"{cat} ({count}件)", key=f"nav_{cat}", use_container_width=True):
                    st.session_state.selected_category = cat
                    st.rerun()
        
        st.markdown("---")
        st.info("""
        **处理流程：**
        1. 📤 上传衣服照片
        2. ✂️ 自动去除背景
        3. 🤖 AI智能分类
        4. 📂 按类别查看
        """)
    
    # 主内容区
    if 'processing' in st.session_state and st.session_state.processing:
        uploaded_files = st.session_state.uploaded_files
        
        # 处理进度
        st.subheader("🔄 处理进度")
        progress_container = st.container()
        
        results = []
        
        with progress_container:
            for i, uploaded_file in enumerate(uploaded_files):
                col1, col2 = st.columns([3, 1])
                
                with col1:
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                
                with col2:
                    st.write(f"{i+1}/{len(uploaded_files)}")
                
                # 处理图片
                result = process_single_image(uploaded_file, progress_bar, status_text)
                if result:
                    results.append(result)
                
                status_text.empty()
                progress_bar.empty()
        
        # 保存结果到session state
        if 'all_results' not in st.session_state:
            st.session_state.all_results = []
        st.session_state.all_results.extend(results)
        st.session_state.processing = False
        
        st.success(f"✅ 成功处理 {len(results)} 张图片！")
        st.rerun()
    
    # 显示结果
    if 'all_results' in st.session_state and st.session_state.all_results:
        results = st.session_state.all_results
        
        # 统计信息
        st.markdown("---")
        cols = st.columns(4)
        
        with cols[0]:
            st.metric("总图片数", len(results))
        
        category_count = len(set(r.get('category', 'unknown') for r in results))
        with cols[1]:
            st.metric("类别数量", category_count)
        
        high_conf = sum(1 for r in results if r.get('confidence') == 'high')
        with cols[2]:
            st.metric("高置信度", high_conf)
        
        colors = len(set(r.get('color', 'unknown') for r in results))
        with cols[3]:
            st.metric("颜色种类", colors)
        
        st.markdown("---")
        
        # 根据是否选择类别来决定显示内容
        if 'selected_category' in st.session_state:
            # 显示类别详情
            show_category_detail(results, st.session_state.selected_category)
        else:
            # 显示类别目录
            show_category_list(results)
        
        # 导出功能
        st.markdown("---")
        col1, col2 = st.columns([1, 4])
        
        with col1:
            json_str = json.dumps(results, ensure_ascii=False, indent=2)
            st.download_button(
                label="📥 导出JSON",
                data=json_str,
                file_name="classification_results.json",
                mime="application/json"
            )
        
        with col2:
            if st.button("🗑️ 清空所有结果", type="secondary"):
                st.session_state.all_results = []
                if 'selected_category' in st.session_state:
                    del st.session_state.selected_category
                shutil.rmtree(UPLOAD_DIR, ignore_errors=True)
                shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
                UPLOAD_DIR.mkdir(exist_ok=True)
                OUTPUT_DIR.mkdir(exist_ok=True)
                TRANSPARENT_DIR.mkdir(exist_ok=True)
                st.rerun()
    else:
        # 空状态
        st.info("👈 请从左侧上传衣服照片开始处理")
        
        # 显示示例
        with st.expander("📝 查看使用说明"):
            st.markdown("""
            ### 使用步骤：
            1. 在左侧边栏点击 **"Browse files"** 选择衣服照片（可多选）
            2. 点击 **"🚀 开始处理"** 按钮
            3. 等待处理完成（每张照片约需10-20秒）
            4. 在 **类别目录** 中选择类别查看详情
            5. 查看每件衣物的原图、透明背景图和详细信息
            
            ### 功能说明：
            - **📂 类别目录**：按AI识别的类别（外套、裤子等）分类展示
            - **📋 信息卡片**：包含原图、透明背景图、类型、颜色、风格、描述、特征等
            - **📥 导出JSON**：下载完整的分类结果数据
            """)

if __name__ == "__main__":
    main()
