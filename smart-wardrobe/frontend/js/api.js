/**
 * API 服务层
 * 与后端API进行通信
 */

const API_BASE_URL = '/api/v1';

// API请求封装
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// 衣服相关API
const ClothesAPI = {
    // 获取衣服列表
    async getList(params = {}) {
        const queryStr = new URLSearchParams(
            Object.entries(params).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        ).toString();
        return apiRequest(`/clothes/?${queryStr}`);
    },
    
    // 获取单件衣服详情
    async getById(id) {
        return apiRequest(`/clothes/${id}`);
    },
    
    // 上传衣服图片
    async uploadImage(file, autoClassify = true) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('auto_classify', autoClassify);
        
        const response = await fetch(`${API_BASE_URL}/clothes/upload`, {
            method: 'POST',
            body: formData,
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || '上传失败');
        }
        return data;
    },
    
    // 更新衣服信息
    async update(id, data) {
        return apiRequest(`/clothes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    
    // 删除衣服
    async delete(id) {
        return apiRequest(`/clothes/${id}`, {
            method: 'DELETE',
        });
    },
    
    // 切换收藏状态
    async toggleFavorite(id) {
        return apiRequest(`/clothes/${id}/favorite`, {
            method: 'POST',
        });
    },
    
    // 切换归档状态
    async toggleArchive(id) {
        return apiRequest(`/clothes/${id}/archive`, {
            method: 'POST',
        });
    },
    
    // 记录穿着
    async recordWear(id) {
        return apiRequest(`/clothes/${id}/wear`, {
            method: 'POST',
        });
    },
    
    // 重新分类
    async reclassify(id) {
        return apiRequest(`/clothes/${id}/reclassify`, {
            method: 'POST',
        });
    },
    
    // 获取统计信息
    async getStatistics() {
        return apiRequest('/clothes/statistics');
    },
    
    // 获取筛选选项
    async getFilterOptions() {
        return apiRequest('/clothes/filters');
    },
    
    // 获取图片URL
    getImageUrl(id, transparent = false) {
        return `${API_BASE_URL}/clothes/${id}/image?transparent=${transparent}`;
    },
    
    // 确认并保存衣服信息
    async confirm(data) {
        return apiRequest('/clothes/confirm', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    
    // 获取搭配推荐
    async getOutfitRecommendation(id, params = {}) {
        const queryStr = new URLSearchParams(
            Object.entries(params).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        ).toString();
        return apiRequest(`/clothes/${id}/outfit?${queryStr}`);
    },
    
    // 根据场合推荐搭配
    async getOutfitByOccasion(occasion, season = null, style = null) {
        const params = { occasion };
        if (season) params.season = season;
        if (style) params.style = style;
        const queryStr = new URLSearchParams(params).toString();
        return apiRequest(`/clothes/outfit/occasion?${queryStr}`);
    },
    
    // 获取颜色搭配建议
    async getColorMatching(color) {
        return apiRequest(`/clothes/colors/${encodeURIComponent(color)}/matching`);
    }
};
