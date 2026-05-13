# 🚀 部署指南

本文档将指导您把 AI智能衣橱 应用部署到您的服务器上。

## 📋 前置要求

- 一台云服务器（2核2G即可）
- 一个已备案的域名（国内服务器需要）
- 服务器操作系统：Ubuntu 20.04+ / CentOS 7+ / Debian 10+
- 服务器已安装：Node.js 18+, npm, git

---

## 第一步：服务器环境准备

### 1.1 安装 Node.js 18+

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 1.2 安装 PM2（进程管理器）

```bash
sudo npm install -g pm2
```

### 1.3 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y nginx

# CentOS
sudo yum install -y epel-release
sudo yum install -y nginx
```

---

## 第二步：上传项目代码

### 2.1 从本地上传到服务器

```bash
# 在项目根目录执行，将代码打包
cd /path/to/vr_seeyou
zip -r seeyou.zip backend frontend

# 上传到服务器（替换为您的服务器IP）
scp seeyou.zip root@your-server-ip:/root/
```

### 2.2 在服务器上解压

```bash
ssh root@your-server-ip
cd /root
unzip seeyou.zip
mv vr_seeyou /var/www/seeyou
cd /var/www/seeyou
```

---

## 第三步：部署后端服务

### 3.1 安装依赖

```bash
cd /var/www/seeyou/backend
npm install
```

### 3.2 配置环境变量

```bash
cp .env.example .env
nano .env
```

编辑 `.env` 文件：

```env
# AI API 配置（任选其一或同时配置）

# 阿里云视觉智能
ALIYUN_ACCESS_KEY_ID=your_access_key_id
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret

# 百度AI开放平台
BAIDU_APP_ID=your_app_id
BAIDU_API_KEY=your_api_key
BAIDU_SECRET_KEY=your_secret_key

# 服务配置
PORT=3000
UPLOAD_DIR=./uploads

# 开发模式：设置为 true 则使用模拟AI（无需申请API即可体验）
MOCK_AI=true
```

**首次部署建议设置 `MOCK_AI=true`，无需申请API即可体验完整功能。**

### 3.3 使用 PM2 启动后端

```bash
pm2 start server.js --name "seeyou-backend"
pm2 save
pm2 startup
```

---

## 第四步：构建前端

### 4.1 安装依赖并构建

```bash
cd /var/www/seeyou/frontend
npm install
npm run build
```

构建完成后，`dist/` 目录包含所有静态文件。

---

## 第五步：配置 Nginx

### 5.1 创建 Nginx 配置文件

```bash
sudo nano /etc/nginx/sites-available/seeyou
```

写入以下内容（替换 `your-domain.com` 为您的域名）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/seeyou/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 图片文件代理
    location /uploads/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

### 5.2 启用配置

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/seeyou /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# CentOS
sudo ln -s /etc/nginx/conf.d/seeyou.conf /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 第六步：配置 HTTPS（强烈推荐）

使用 Let's Encrypt 免费证书：

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx  # Ubuntu/Debian
sudo yum install -y certbot python3-certbot-nginx      # CentOS

# 申请证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 第七步：验证部署

### 7.1 检查服务状态

```bash
# 检查后端
pm2 status

# 检查 Nginx
sudo systemctl status nginx

# 测试 API
curl http://your-domain.com/api/health
```

### 7.2 手机访问测试

1. 打开手机浏览器
2. 访问 `https://your-domain.com`
3. 点击"添加到主屏幕"
4. 像 App 一样使用

---

## 🔄 后续更新

### 更新前端

```bash
cd /var/www/seeyou/frontend
git pull  # 或重新上传代码
npm install
npm run build
```

### 更新后端

```bash
cd /var/www/seeyou/backend
git pull  # 或重新上传代码
npm install
pm2 restart seeyou-backend
```

---

## 📁 最终目录结构

```
/var/www/seeyou/
├── backend/
│   ├── node_modules/
│   ├── uploads/          # 上传的图片
│   ├── wardrobe.db       # SQLite 数据库
│   ├── .env              # 环境变量
│   ├── server.js
│   ├── database.js
│   └── aiService.js
├── frontend/
│   ├── node_modules/
│   ├── dist/             # 构建产物（Nginx 服务）
│   ├── src/
│   └── public/
└── deploy.md
```

---

## 🆘 常见问题

### 1. 上传图片失败

检查 `uploads` 目录权限：
```bash
chmod 755 /var/www/seeyou/backend/uploads
```

### 2. API 返回 502

检查后端是否运行：
```bash
pm2 logs seeyou-backend
```

### 3. 前端刷新 404

确认 Nginx 配置中有 `try_files $uri $uri/ /index.html;`

### 4. 跨域错误

确认后端 `.env` 中 `PORT=3000`，且 Nginx 正确代理了 `/api/` 路径。

---

## 📞 需要帮助？

如有问题，请检查：
1. 后端日志：`pm2 logs seeyou-backend`
2. Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`
3. 浏览器开发者工具 Network 面板
