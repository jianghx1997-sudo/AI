/**
 * 智能衣柜管理系统 - 主应用逻辑
 */

// 全局状态
let currentClothes = [];
let currentClothingItem = null;
let pendingFiles = [];
let useTransparentImage = false;
let batchMode = false;
let selectedItems = new Set();
let pendingUploadData = null; // 待确认的上传数据
let currentUploadIndex = 0; // 当前上传的文件索引

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSearch();
    initUpload();
    loadClothes();
    loadFilterOptions();
    loadStatistics();
});

// ==================== 导航功能 ====================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            showPage(page);
        });
    });
}

function showPage(pageName) {
    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    
    // 显示对应页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // 加载页面数据
    if (pageName === 'wardrobe') {
        loadClothes();
    } else if (pageName === 'statistics') {
        loadStatistics();
    } else if (pageName === 'favorites') {
        loadFavorites();
    } else if (pageName === 'outfit') {
        initOutfitPage();
    }
}

// ==================== 搜索功能 ====================

function initSearch() {
    let searchTimeout;
    const searchInput = document.getElementById('search-input');
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadClothes({ search: e.target.value });
        }, 300);
    });
}

// ==================== 衣服列表 ====================

async function loadClothes(extraParams = {}) {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const grid = document.getElementById('clothes-grid');
    
    loading.style.display = 'flex';
    emptyState.style.display = 'none';
    grid.innerHTML = '';
    
    try {
        const params = {
            category: document.getElementById('filter-category')?.value || '',
            color: document.getElementById('filter-color')?.value || '',
            style: document.getElementById('filter-style')?.value || '',
            season: document.getElementById('filter-season')?.value || '',
            is_favorite: document.getElementById('filter-favorite')?.value || '',
            ...extraParams
        };
        
        const response = await ClothesAPI.getList(params);
        currentClothes = response.data || [];
        
        loading.style.display = 'none';
        
        if (currentClothes.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            renderClothesGrid(currentClothes);
        }
        
        // 更新侧边栏统计
        updateSidebarStats();
        
    } catch (error) {
        loading.style.display = 'none';
        showToast('加载失败: ' + error.message, 'error');
    }
}

function renderClothesGrid(clothes) {
    const grid = document.getElementById('clothes-grid');
    grid.innerHTML = clothes.map(item => createClothesCard(item)).join('');
    
    // 如果在批量模式，重新绑定事件
    if (batchMode) {
        updateBatchModeUI();
    }
}

function createClothesCard(item) {
    // 添加时间戳参数防止浏览器缓存
    const imageUrl = item.id ? `${ClothesAPI.getImageUrl(item.id, false)}&t=${Date.now()}` : '';
    const seasonTags = (item.season || []).slice(0, 2).map(s => 
        `<span class="clothes-card-tag">${s}</span>`
    ).join('');
    
    const batchClass = batchMode ? 'batch-mode' : '';
    const selectedClass = selectedItems.has(item.id) ? 'selected' : '';
    const checkedClass = selectedItems.has(item.id) ? 'checked' : '';
    
    return `
        <div class="clothes-card ${batchClass} ${selectedClass}" data-id="${item.id}" onclick="${batchMode ? `toggleSelectItem(${item.id})` : `showDetail(${item.id})`}">
            ${batchMode ? `
                <div class="clothes-card-checkbox ${checkedClass}" onclick="event.stopPropagation(); toggleSelectItem(${item.id})">
                    <i class="fas fa-check"></i>
                </div>
            ` : ''}
            <div class="clothes-card-image">
                <img src="${imageUrl}" alt="${item.type || '衣服'}" loading="lazy">
                ${item.is_favorite && !batchMode ? '<i class="fas fa-heart clothes-card-favorite"></i>' : ''}
            </div>
            <div class="clothes-card-info">
                <div class="clothes-card-type">${item.type || '未分类'}</div>
                <div class="clothes-card-meta">
                    ${item.color ? `<span>${item.color}</span>` : ''}
                    ${item.style && item.style.length > 0 ? `<span>${item.style.join('、')}</span>` : ''}
                </div>
                ${seasonTags ? `<div class="clothes-card-tags">${seasonTags}</div>` : ''}
            </div>
        </div>
    `;
}

// ==================== 详情弹窗 ====================

async function showDetail(id) {
    try {
        const response = await ClothesAPI.getById(id);
        currentClothingItem = response.data;
        useTransparentImage = false;
        
        renderDetail(currentClothingItem);
        document.getElementById('detail-modal').classList.add('active');
    } catch (error) {
        showToast('加载详情失败: ' + error.message, 'error');
    }
}

function renderDetail(item) {
    // 图片 - 添加时间戳防止缓存
    document.getElementById('detail-image').src = `${ClothesAPI.getImageUrl(item.id, false)}&t=${Date.now()}`;
    
    // 标题
    document.getElementById('detail-type').textContent = item.type || '未分类';
    
    // 收藏按钮
    const favoriteBtn = document.getElementById('detail-favorite');
    favoriteBtn.innerHTML = item.is_favorite 
        ? '<i class="fas fa-heart"></i>' 
        : '<i class="far fa-heart"></i>';
    
    // 标签 - 风格可以是数组
    const tags = [];
    if (item.style && item.style.length > 0) {
        tags.push(...item.style);
    }
    if (item.thickness) tags.push(item.thickness);
    if (item.color_tone) tags.push(item.color_tone);
    document.getElementById('detail-tags').innerHTML = tags.map(t => 
        `<span class="detail-tag">${t}</span>`
    ).join('');
    
    // 基本信息
    document.getElementById('detail-category').textContent = item.category || '-';
    document.getElementById('detail-color').textContent = item.color || '-';
    document.getElementById('detail-style').textContent = formatArray(item.style);
    document.getElementById('detail-material').textContent = item.material || '-';
    
    // 适用场景
    document.getElementById('detail-season').textContent = formatArray(item.season);
    document.getElementById('detail-weather').textContent = formatArray(item.suitable_weather);
    document.getElementById('detail-occasion').textContent = formatArray(item.suitable_occasions);
    
    // 穿搭建议
    const matchingSection = document.getElementById('matching-section');
    let matchingHtml = '';
    
    if (item.matching_tops?.length) {
        matchingHtml += createMatchingItem('上衣', item.matching_tops);
    }
    if (item.matching_bottoms?.length) {
        matchingHtml += createMatchingItem('下装', item.matching_bottoms);
    }
    if (item.matching_shoes?.length) {
        matchingHtml += createMatchingItem('鞋子', item.matching_shoes);
    }
    if (item.matching_colors?.length) {
        matchingHtml += createMatchingItem('配色', item.matching_colors);
    }
    matchingSection.innerHTML = matchingHtml || '<span class="text-muted">暂无穿搭建议</span>';
    
    // 描述
    document.getElementById('detail-description').textContent = item.description || '暂无描述';
    
    // 穿着信息
    document.getElementById('detail-wear-count').textContent = item.wear_count || 0;
    document.getElementById('detail-last-worn').textContent = item.last_worn_date 
        ? formatDate(item.last_worn_date) 
        : '从未';
}

function createMatchingItem(label, values) {
    return `
        <div class="matching-item">
            <span class="matching-label">${label}:</span>
            <div class="matching-values">
                ${values.map(v => `<span class="matching-tag">${v}</span>`).join('')}
            </div>
        </div>
    `;
}

function closeModal() {
    document.getElementById('detail-modal').classList.remove('active');
    currentClothingItem = null;
}

function toggleTransparent() {
    if (!currentClothingItem) return;
    useTransparentImage = !useTransparentImage;
    document.getElementById('detail-image').src = ClothesAPI.getImageUrl(
        currentClothingItem.id, 
        useTransparentImage
    );
}

// ==================== 衣服操作 ====================

async function toggleFavorite() {
    if (!currentClothingItem) return;
    
    try {
        await ClothesAPI.toggleFavorite(currentClothingItem.id);
        currentClothingItem.is_favorite = !currentClothingItem.is_favorite;
        
        const favoriteBtn = document.getElementById('detail-favorite');
        favoriteBtn.innerHTML = currentClothingItem.is_favorite 
            ? '<i class="fas fa-heart"></i>' 
            : '<i class="far fa-heart"></i>';
        
        showToast(currentClothingItem.is_favorite ? '已收藏' : '已取消收藏', 'success');
        updateSidebarStats();
    } catch (error) {
        showToast('操作失败: ' + error.message, 'error');
    }
}

async function recordWear() {
    if (!currentClothingItem) return;
    
    try {
        await ClothesAPI.recordWear(currentClothingItem.id);
        currentClothingItem.wear_count = (currentClothingItem.wear_count || 0) + 1;
        currentClothingItem.last_worn_date = new Date().toISOString();
        
        document.getElementById('detail-wear-count').textContent = currentClothingItem.wear_count;
        document.getElementById('detail-last-worn').textContent = '今天';
        
        showToast('记录成功！', 'success');
    } catch (error) {
        showToast('记录失败: ' + error.message, 'error');
    }
}

async function reclassifyItem() {
    if (!currentClothingItem) return;
    
    showToast('正在重新分类...', 'info');
    
    try {
        const response = await ClothesAPI.reclassify(currentClothingItem.id);
        currentClothingItem = response.data;
        renderDetail(currentClothingItem);
        showToast('重新分类完成！', 'success');
    } catch (error) {
        showToast('分类失败: ' + error.message, 'error');
    }
}

async function deleteItem() {
    if (!currentClothingItem) return;
    
    if (!confirm('确定要删除这件衣服吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        await ClothesAPI.delete(currentClothingItem.id);
        closeModal();
        loadClothes();
        showToast('删除成功', 'success');
    } catch (error) {
        showToast('删除失败: ' + error.message, 'error');
    }
}

// ==================== 上传功能 ====================

function initUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const selectFileBtn = document.getElementById('select-file-btn');
    
    // 选择图片按钮点击事件
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    // 点击上传区域
    if (uploadArea) {
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }
    
    // 文件选择
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
        // 清空 value，允许选择相同文件
        e.target.value = '';
    });
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
}

function handleFiles(files) {
    const validFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/')
    );
    
    if (validFiles.length === 0) {
        showToast('请选择有效的图片文件', 'error');
        return;
    }
    
    pendingFiles = [...pendingFiles, ...validFiles];
    renderPreview();
}

function renderPreview() {
    const previewSection = document.getElementById('upload-preview');
    const previewGrid = document.getElementById('preview-grid');
    
    if (pendingFiles.length === 0) {
        previewSection.style.display = 'none';
        return;
    }
    
    previewSection.style.display = 'block';
    
    // 添加 pending 类，使图片显示为灰色
    previewGrid.innerHTML = pendingFiles.map((file, index) => `
        <div class="preview-item pending" data-index="${index}">
            <img src="${URL.createObjectURL(file)}" alt="${file.name}">
            <button class="remove-btn" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeFile(index) {
    pendingFiles.splice(index, 1);
    renderPreview();
}

// ==================== 统计页面 ====================

async function loadStatistics() {
    try {
        const response = await ClothesAPI.getStatistics();
        const stats = response.data;
        
        document.getElementById('stat-total').textContent = stats.total_items || 0;
        document.getElementById('stat-favorites').textContent = stats.favorites || 0;
        document.getElementById('stat-unworn').textContent = stats.never_worn_count || 0;
        
        // 类别分布图
        renderCategoryChart(stats.category_distribution || {});
        
        // 最近穿着
        renderRecentList(stats.recently_worn || []);
        
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

function renderCategoryChart(distribution) {
    const chartContainer = document.getElementById('category-chart');
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    
    if (total === 0) {
        chartContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">暂无数据</p>';
        return;
    }
    
    chartContainer.innerHTML = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => {
            const percent = Math.round((count / total) * 100);
            return `
                <div class="chart-bar">
                    <span class="chart-bar-label">${category || '其他'}</span>
                    <div class="chart-bar-track">
                        <div class="chart-bar-fill" style="width: ${Math.max(percent, 10)}%">
                            ${count}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
}

function renderRecentList(items) {
    const listContainer = document.getElementById('recent-list');
    
    if (items.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">暂无记录</p>';
        return;
    }
    
    listContainer.innerHTML = items.map(item => `
        <div class="recent-item" onclick="showDetail(${item.id})">
            <img src="${ClothesAPI.getImageUrl(item.id, false)}&t=${Date.now()}" alt="${item.type}">
            <div class="recent-item-info">
                <div class="recent-item-type">${item.type || '未分类'}</div>
                <div class="recent-item-date">${item.last_worn_date ? formatDate(item.last_worn_date) : ''}</div>
            </div>
        </div>
    `).join('');
}

// ==================== 收藏页面 ====================

async function loadFavorites() {
    try {
        const response = await ClothesAPI.getList({ is_favorite: 'true' });
        const grid = document.getElementById('favorites-grid');
        
        if (response.data.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fas fa-heart"></i>
                    <h3>还没有收藏的衣服</h3>
                    <p>在衣服详情中点击心形图标即可收藏</p>
                </div>
            `;
        } else {
            grid.innerHTML = response.data.map(item => createClothesCard(item)).join('');
        }
    } catch (error) {
        showToast('加载收藏失败: ' + error.message, 'error');
    }
}

// ==================== 筛选功能 ====================

async function loadFilterOptions() {
    try {
        const response = await ClothesAPI.getFilterOptions();
        const { categories, colors, styles } = response.data;
        
        populateSelect('filter-category', categories);
        populateSelect('filter-color', colors);
        populateSelect('filter-style', styles);
    } catch (error) {
        console.error('加载筛选选项失败:', error);
    }
}

function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">全部</option>';
    
    options.forEach(option => {
        if (option) {
            const optionEl = document.createElement('option');
            optionEl.value = option;
            optionEl.textContent = option;
            select.appendChild(optionEl);
        }
    });
    
    select.value = currentValue;
}

function clearFilters() {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-color').value = '';
    document.getElementById('filter-style').value = '';
    document.getElementById('filter-season').value = '';
    document.getElementById('filter-favorite').value = '';
    loadClothes();
}

// ==================== 辅助函数 ====================

function updateSidebarStats() {
    const total = currentClothes.length;
    const favorites = currentClothes.filter(item => item.is_favorite).length;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('favorite-count').textContent = favorites;
}

function formatArray(arr) {
    if (!arr || arr.length === 0) return '-';
    return arr.join('、');
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) { // 24小时内
        return '今天';
    } else if (diff < 172800000) { // 48小时内
        return '昨天';
    } else {
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 点击弹窗外部关闭
document.getElementById('detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'detail-modal') {
        closeModal();
    }
});

// ESC键关闭弹窗
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ==================== 批量管理功能 ====================

// 切换批量管理模式
function toggleBatchMode() {
    batchMode = !batchMode;
    selectedItems.clear();
    
    const batchBtn = document.getElementById('batch-mode-btn');
    const batchBar = document.getElementById('batch-actions-bar');
    
    if (batchMode) {
        batchBtn.innerHTML = '<i class="fas fa-times"></i> 退出管理';
        batchBtn.classList.remove('btn-primary');
        batchBtn.classList.add('btn-secondary');
        batchBar.style.display = 'flex';
    } else {
        batchBtn.innerHTML = '<i class="fas fa-check-square"></i> 批量管理';
        batchBtn.classList.remove('btn-secondary');
        batchBtn.classList.add('btn-primary');
        batchBar.style.display = 'none';
    }
    
    // 重新渲染衣服列表
    renderClothesGrid(currentClothes);
    updateSelectedCount();
}

// 取消批量模式
function cancelBatchMode() {
    batchMode = false;
    selectedItems.clear();
    
    const batchBtn = document.getElementById('batch-mode-btn');
    const batchBar = document.getElementById('batch-actions-bar');
    
    batchBtn.innerHTML = '<i class="fas fa-check-square"></i> 批量管理';
    batchBtn.classList.remove('btn-secondary');
    batchBtn.classList.add('btn-primary');
    batchBar.style.display = 'none';
    
    renderClothesGrid(currentClothes);
}

// 切换选择单个项目
function toggleSelectItem(id) {
    if (selectedItems.has(id)) {
        selectedItems.delete(id);
    } else {
        selectedItems.add(id);
    }
    
    // 更新UI
    const card = document.querySelector(`.clothes-card[data-id="${id}"]`);
    const checkbox = card?.querySelector('.clothes-card-checkbox');
    
    if (card) {
        card.classList.toggle('selected', selectedItems.has(id));
    }
    if (checkbox) {
        checkbox.classList.toggle('checked', selectedItems.has(id));
    }
    
    updateSelectedCount();
    updateSelectAllCheckbox();
}

// 全选/取消全选
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all');
    const allIds = currentClothes.map(item => item.id);
    
    if (selectAllCheckbox.checked) {
        allIds.forEach(id => selectedItems.add(id));
    } else {
        selectedItems.clear();
    }
    
    // 更新所有卡片的UI
    document.querySelectorAll('.clothes-card').forEach(card => {
        const id = parseInt(card.dataset.id);
        const checkbox = card.querySelector('.clothes-card-checkbox');
        
        card.classList.toggle('selected', selectedItems.has(id));
        if (checkbox) {
            checkbox.classList.toggle('checked', selectedItems.has(id));
        }
    });
    
    updateSelectedCount();
}

// 更新全选复选框状态
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all');
    const allIds = currentClothes.map(item => item.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedItems.has(id));
    
    selectAllCheckbox.checked = allSelected;
}

// 更新已选择数量显示
function updateSelectedCount() {
    const countEl = document.getElementById('selected-count');
    countEl.textContent = `已选择 ${selectedItems.size} 件`;
}

// 批量收藏/取消收藏
async function toggleBatchFavorite() {
    if (selectedItems.size === 0) {
        showToast('请先选择衣服', 'error');
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedItems) {
        try {
            await ClothesAPI.toggleFavorite(id);
            successCount++;
        } catch (error) {
            failCount++;
        }
    }
    
    if (successCount > 0) {
        showToast(`成功处理 ${successCount} 件衣服`, 'success');
        loadClothes();
        cancelBatchMode();
    }
    
    if (failCount > 0) {
        showToast(`${failCount} 件衣服操作失败`, 'error');
    }
}

// 批量删除
async function batchDelete() {
    if (selectedItems.size === 0) {
        showToast('请先选择衣服', 'error');
        return;
    }
    
    if (!confirm(`确定要删除选中的 ${selectedItems.size} 件衣服吗？此操作不可撤销。`)) {
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedItems) {
        try {
            await ClothesAPI.delete(id);
            successCount++;
        } catch (error) {
            failCount++;
        }
    }
    
    if (successCount > 0) {
        showToast(`成功删除 ${successCount} 件衣服`, 'success');
        loadClothes();
        cancelBatchMode();
    }
    
    if (failCount > 0) {
        showToast(`${failCount} 件衣服删除失败`, 'error');
    }
}

// 更新批量模式UI
function updateBatchModeUI() {
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }
    updateSelectedCount();
}

// ==================== 上传确认弹窗功能 ====================

// 打开确认弹窗
function openConfirmModal(data, imageUrl) {
    pendingUploadData = data;
    
    // 设置图片预览
    document.getElementById('confirm-image').src = imageUrl;
    
    // 填充AI识别的数据
    if (data.category) {
        document.getElementById('confirm-category').value = data.category;
    }
    if (data.type) {
        document.getElementById('confirm-type').value = data.type;
    }
    if (data.material) {
        document.getElementById('confirm-material').value = data.material;
    }
    if (data.thickness) {
        document.getElementById('confirm-thickness').value = data.thickness;
    }
    if (data.description) {
        document.getElementById('confirm-description').value = data.description;
    }
    
    // 设置多选框的值
    setMultiSelectValues('color-options', data.color ? [data.color] : []);
    setMultiSelectValues('style-options', data.style ? [data.style] : []);
    setMultiSelectValues('season-options', data.season || []);
    setMultiSelectValues('occasion-options', data.suitable_occasions || []);
    
    // 显示弹窗
    document.getElementById('confirm-modal').classList.add('active');
}

// 关闭确认弹窗
function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    pendingUploadData = null;
}

// 设置多选框的值
function setMultiSelectValues(containerId, values) {
    const container = document.getElementById(containerId);
    if (!container || !values) return;
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = values.includes(cb.value);
    });
}

// 获取多选框的值
function getMultiSelectValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const checked = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(cb => cb.value);
}

// 验证表单
function validateConfirmForm() {
    const category = document.getElementById('confirm-category').value;
    const colors = getMultiSelectValues('color-options');
    const styles = getMultiSelectValues('style-options');
    const seasons = getMultiSelectValues('season-options');
    
    if (!category) {
        showToast('请选择类别', 'error');
        return false;
    }
    if (colors.length === 0) {
        showToast('请至少选择一种颜色', 'error');
        return false;
    }
    if (styles.length === 0) {
        showToast('请至少选择一种风格', 'error');
        return false;
    }
    if (seasons.length === 0) {
        showToast('请至少选择一个季节', 'error');
        return false;
    }
    
    return true;
}

// 确认并保存
async function confirmAndSave() {
    if (!pendingUploadData) {
        showToast('数据丢失，请重新上传', 'error');
        closeConfirmModal();
        return;
    }
    
    // 验证表单
    if (!validateConfirmForm()) {
        return;
    }
    
    // 收集表单数据
    const formData = {
        filename: pendingUploadData.filename,
        original_path: pendingUploadData.original_path,
        category: document.getElementById('confirm-category').value,
        type: document.getElementById('confirm-type').value,
        color: getMultiSelectValues('color-options').join('、'),
        style: getMultiSelectValues('style-options'),  // 风格改为数组
        season: getMultiSelectValues('season-options'),
        material: document.getElementById('confirm-material').value,
        thickness: document.getElementById('confirm-thickness').value,
        suitable_occasions: getMultiSelectValues('occasion-options'),
        description: document.getElementById('confirm-description').value
    };
    
    try {
        showToast('正在保存...', 'info');
        const response = await ClothesAPI.confirm(formData);
        
        if (response.success) {
            showToast('保存成功！', 'success');
            closeConfirmModal();
            
            // 继续处理下一个文件
            processNextFile();
        }
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

// 处理下一个文件
async function processNextFile() {
    currentUploadIndex++;
    
    if (currentUploadIndex >= pendingFiles.length) {
        // 所有文件处理完成
        pendingFiles = [];
        document.getElementById('upload-preview').style.display = 'none';
        currentUploadIndex = 0;
        showPage('wardrobe');
        return;
    }
    
    // 处理下一个文件
    const file = pendingFiles[currentUploadIndex];
    const autoClassify = document.getElementById('auto-classify').checked;
    
    try {
        showToast(`正在处理第 ${currentUploadIndex + 1} 张图片...`, 'info');
        const response = await ClothesAPI.uploadImage(file, autoClassify);
        
        if (response.success) {
            const imageUrl = URL.createObjectURL(file);
            openConfirmModal(response.data, imageUrl);
        }
    } catch (error) {
        showToast(`第 ${currentUploadIndex + 1} 张图片处理失败: ${error.message}`, 'error');
        // 跳过失败的文件，继续处理下一个
        processNextFile();
    }
}

// 新的上传流程
async function uploadFiles() {
    if (pendingFiles.length === 0) {
        showToast('请先选择要上传的图片', 'error');
        return;
    }
    
    const uploadBtn = document.getElementById('start-upload-btn');
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    }
    
    // 重置索引
    currentUploadIndex = 0;
    
    // 开始处理第一个文件
    const file = pendingFiles[0];
    const autoClassify = document.getElementById('auto-classify').checked;
    
    try {
        showToast('正在处理图片...', 'info');
        const response = await ClothesAPI.uploadImage(file, autoClassify);
        
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 开始上传';
        }
        
        if (response.success) {
            const imageUrl = URL.createObjectURL(file);
            openConfirmModal(response.data, imageUrl);
        }
    } catch (error) {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 开始上传';
        }
        showToast('上传失败: ' + error.message, 'error');
    }
}

// 确认弹窗外部点击关闭
document.getElementById('confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') {
        closeConfirmModal();
    }
});

// ==================== 搭配推荐功能 ====================

let currentOutfitMode = 'item';  // 当前搭配模式
let selectedBaseItem = null;     // 选中的基础单品
let selectedOccasion = null;     // 选中的场合

// 切换搭配模式
function setOutfitMode(mode) {
    currentOutfitMode = mode;
    
    // 更新模式卡片UI
    document.querySelectorAll('.outfit-mode-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`mode-${mode}`).classList.add('active');
    
    // 显示/隐藏对应区域
    document.getElementById('item-based-section').style.display = mode === 'item' ? 'block' : 'none';
    document.getElementById('occasion-based-section').style.display = mode === 'occasion' ? 'block' : 'none';
    
    // 隐藏结果区域
    document.getElementById('outfit-result-section').style.display = 'none';
    
    // 重置选择
    selectedBaseItem = null;
    selectedOccasion = null;
    
    // 如果是单品模式，加载可选单品
    if (mode === 'item') {
        loadOutfitBaseItems();
    }
}

// 加载可选的基础单品
async function loadOutfitBaseItems() {
    const grid = document.getElementById('outfit-base-grid');
    grid.innerHTML = '<div class="outfit-loading"><i class="fas fa-spinner fa-spin"></i><span>加载中...</span></div>';
    
    try {
        const category = document.getElementById('outfit-filter-category').value;
        const params = category ? { category } : {};
        const response = await ClothesAPI.getList(params);
        const items = response.data || [];
        
        if (items.length === 0) {
            grid.innerHTML = `
                <div class="outfit-empty">
                    <i class="fas fa-tshirt"></i>
                    <p>衣柜中没有符合条件的衣服</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = items.map(item => `
            <div class="outfit-base-item ${selectedBaseItem?.id === item.id ? 'selected' : ''}" 
                 onclick="selectBaseItem(${item.id})" data-id="${item.id}">
                <img src="${ClothesAPI.getImageUrl(item.id, false)}&t=${Date.now()}" alt="${item.type}">
                <div class="item-label">${item.type || '未分类'}</div>
                ${selectedBaseItem?.id === item.id ? '<div class="selected-badge"><i class="fas fa-check"></i></div>' : ''}
            </div>
        `).join('');
        
    } catch (error) {
        grid.innerHTML = `<div class="outfit-empty"><i class="fas fa-exclamation-circle"></i><p>加载失败</p></div>`;
    }
}

// 选择基础单品
async function selectBaseItem(itemId) {
    selectedBaseItem = currentClothes.find(item => item.id === itemId);
    
    // 更新UI
    document.querySelectorAll('.outfit-base-item').forEach(el => {
        el.classList.remove('selected');
        const badge = el.querySelector('.selected-badge');
        if (badge) badge.remove();
    });
    
    const selectedItem = document.querySelector(`.outfit-base-item[data-id="${itemId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
        selectedItem.innerHTML += '<div class="selected-badge"><i class="fas fa-check"></i></div>';
    }
    
    // 获取推荐
    await loadItemOutfitRecommendation(itemId);
}

// 基于单品获取搭配推荐
async function loadItemOutfitRecommendation(itemId) {
    const resultSection = document.getElementById('outfit-result-section');
    const resultContent = document.getElementById('outfit-result-content');
    
    resultSection.style.display = 'block';
    resultContent.innerHTML = '<div class="outfit-loading"><i class="fas fa-spinner fa-spin"></i><span>正在生成搭配推荐...</span></div>';
    
    try {
        const response = await ClothesAPI.getOutfitRecommendation(itemId);
        const data = response.data;
        
        if (!data || !data.recommendations) {
            resultContent.innerHTML = `
                <div class="outfit-empty">
                    <i class="fas fa-magic"></i>
                    <p>暂无合适的搭配推荐</p>
                </div>
            `;
            return;
        }
        
        renderOutfitRecommendation(data);
        
    } catch (error) {
        resultContent.innerHTML = `<div class="outfit-empty"><i class="fas fa-exclamation-circle"></i><p>获取推荐失败: ${error.message}</p></div>`;
    }
}

// 渲染搭配推荐结果
function renderOutfitRecommendation(data) {
    const resultContent = document.getElementById('outfit-result-content');
    const baseItem = data.base_item;
    const recommendations = data.recommendations;
    const suggestions = data.suggestions || [];
    
    let html = '<div class="outfit-recommendation">';
    
    // 基础单品显示
    html += `
        <div class="outfit-base-display">
            <img src="${ClothesAPI.getImageUrl(baseItem.id, false)}&t=${Date.now()}" alt="${baseItem.type}">
            <div class="base-label">${baseItem.type || '未分类'}</div>
            <div class="base-meta">${baseItem.color || ''} ${baseItem.style?.join('、') || ''}</div>
        </div>
    `;
    
    // 推荐搭配
    html += '<div class="outfit-matches">';
    
    const categoryNames = {
        '上衣': '上衣',
        '裤子': '裤子',
        '裙子': '裙子',
        '外套': '外套',
        '鞋子': '鞋子',
        '帽子': '帽子',
        '包包': '包包',
        '配饰': '配饰'
    };
    
    for (const [category, items] of Object.entries(recommendations)) {
        if (items && items.length > 0) {
            html += `
                <div class="match-category">
                    <div class="match-category-title">推荐${categoryNames[category] || category}</div>
                    <div class="match-items">
                        ${items.map(item => `
                            <div class="match-item" onclick="showDetail(${item.id})">
                                <img src="${ClothesAPI.getImageUrl(item.id, false)}&t=${Date.now()}" alt="${item.type}">
                                <div class="match-item-name">${item.type || '未分类'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    html += '</div></div>';
    
    // 搭配建议
    if (suggestions.length > 0) {
        html += `
            <div class="outfit-suggestions">
                <h4><i class="fas fa-lightbulb"></i> 搭配小贴士</h4>
                <ul>
                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    resultContent.innerHTML = html;
}

// 选择场合
async function selectOccasion(occasion) {
    selectedOccasion = occasion;
    
    // 更新UI
    document.querySelectorAll('.occasion-card').forEach(card => {
        card.classList.remove('selected');
        if (card.querySelector('span').textContent === occasion) {
            card.classList.add('selected');
        }
    });
    
    // 获取场合推荐
    await loadOccasionOutfitRecommendation(occasion);
}

// 基于场合获取搭配推荐
async function loadOccasionOutfitRecommendation(occasion) {
    const resultSection = document.getElementById('outfit-result-section');
    const resultContent = document.getElementById('outfit-result-content');
    
    resultSection.style.display = 'block';
    resultContent.innerHTML = '<div class="outfit-loading"><i class="fas fa-spinner fa-spin"></i><span>正在生成搭配方案...</span></div>';
    
    try {
        const season = document.getElementById('outfit-season').value;
        const style = document.getElementById('outfit-style').value;
        
        const response = await ClothesAPI.getOutfitByOccasion(occasion, season, style);
        const data = response.data;
        
        if (!data.outfits || data.outfits.length === 0) {
            resultContent.innerHTML = `
                <div class="outfit-empty">
                    <i class="fas fa-magic"></i>
                    <p>暂无适合${occasion}的搭配方案</p>
                </div>
            `;
            return;
        }
        
        renderOccasionOutfits(data.outfits, occasion);
        
    } catch (error) {
        resultContent.innerHTML = `<div class="outfit-empty"><i class="fas fa-exclamation-circle"></i><p>获取推荐失败: ${error.message}</p></div>`;
    }
}

// 渲染场合搭配结果
function renderOccasionOutfits(outfits, occasion) {
    const resultContent = document.getElementById('outfit-result-content');
    
    let html = `
        <div style="margin-bottom: 16px;">
            <span style="color: var(--text-secondary);">为您的</span>
            <strong style="color: var(--primary-color);">${occasion}</strong>
            <span style="color: var(--text-secondary);">场合推荐以下搭配方案：</span>
        </div>
    `;
    
    html += '<div class="outfit-combinations">';
    
    outfits.forEach((outfit, index) => {
        const score = Math.round(outfit.score * 100);
        
        html += `
            <div class="outfit-combination">
                <div class="combination-header">
                    <span class="combination-type">方案 ${index + 1}</span>
                    <span class="combination-score">
                        <i class="fas fa-star"></i>
                        匹配度 ${score}%
                    </span>
                </div>
                <div class="combination-items">
                    ${outfit.items.map(item => `
                        <div class="combination-item" onclick="showDetail(${item.id})">
                            <img src="${ClothesAPI.getImageUrl(item.id, false)}&t=${Date.now()}" alt="${item.type}">
                            <div class="combination-item-name">${item.type || '未分类'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    resultContent.innerHTML = html;
}

// 初始化搭配页面
function initOutfitPage() {
    // 加载基础单品
    loadOutfitBaseItems();
    
    // 绑定场合筛选事件
    document.getElementById('outfit-season')?.addEventListener('change', () => {
        if (selectedOccasion) {
            loadOccasionOutfitRecommendation(selectedOccasion);
        }
    });
    
    document.getElementById('outfit-style')?.addEventListener('change', () => {
        if (selectedOccasion) {
            loadOccasionOutfitRecommendation(selectedOccasion);
        }
    });
}
