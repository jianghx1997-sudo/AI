# 腾讯云服务器部署指南

## 服务器信息
- 配置: 2核2G3M
- 系统: 宝塔Linux面板
- 域名: `vrseeyou.icu`

## 一、宝塔面板安装环境

### 1. 登录宝塔面板
在浏览器访问 `http://你的服务器IP:8888`

### 2. 安装必要软件
在「软件商店」安装：
- **Nginx** - Web服务器
- **Python项目管理器** - Python环境管理
- **Supervisor管理器** - 进程守护

### 3. 安装Python版本
1. 打开Python项目管理器
2. 点击「版本管理」
3. 安装 Python 3.12（推荐）

## 二、上传项目代码

### 使用Git克隆项目
在终端执行：
```bash
cd /www/wwwroot
git clone https://github.com/jianghx1997-sudo/AI.git

# 项目已在 AI/smart-wardrobe 目录下
cd /www/wwwroot/AI/smart-wardrobe
```

### 创建必要的目录
```bash
cd /www/wwwroot/AI/smart-wardrobe
mkdir -p data/images
mkdir -p uploads
mkdir -p output/transparent
```

## 三、安装依赖

### 查找Python路径
```bash
# 查看已安装的Python版本
ls /www/server/python_manager/versions/
```

### 安装依赖（使用正确的Python版本）
```bash
cd /www/wwwroot/AI/smart-wardrobe

# 使用Python 3.12.0（根据实际安装的版本调整）
/www/server/python_manager/versions/3.12.0/bin/python3.12 -m pip install -r requirements.txt
```

## 四、配置Supervisor守护进程

### 1. 打开Supervisor管理器
在宝塔「软件商店」找到「Supervisor管理器」，点击「设置」

### 2. 添加守护进程
点击「添加守护进程」，填写配置：
- **名称**: `smart-wardrobe`
- **运行目录**: `/www/wwwroot/AI/smart-wardrobe`
- **启动命令**: `/www/server/python_manager/versions/3.12.0/bin/python3.12 run.py`
- **进程数量**: `1`
- **用户**: `root`

> **注意**: 请将 `3.12.0` 替换为你实际安装的Python版本

### 3. 启动进程
添加后，Supervisor会自动启动进程。可以点击「日志」查看运行状态。

### 4. 验证服务运行
```bash
# 检查8000端口是否在监听
netstat -tlnp | grep 8000

# 或
lsof -i:8000
```

## 五、配置域名和Nginx

### 1. 添加网站
1. 点击「网站」→「添加站点」
2. 填写配置：
   - **域名**: `vrseeyou.icu`
   - **根目录**: `/www/wwwroot/vrseeyou.icu`（可自定义）
   - **PHP版本**: 纯静态
   - **数据库**: 不创建
3. 点击「提交」

### 2. 配置反向代理
1. 点击刚创建的网站「设置」
2. 点击「反向代理」→「添加反向代理」
3. 填写配置：
   - **代理名称**: `smart-wardrobe`
   - **目标URL**: `http://127.0.0.1:8000`
   - **发送域名**: `$host`
4. 点击「提交」

### 3. 修改Nginx配置（高级设置）
点击「配置文件」，替换为以下内容：

```nginx
server {
    listen 80;
    server_name vrseeyou.icu www.vrseeyou.icu;
    
    # 访问日志
    access_log /www/wwwlogs/vrseeyou.icu.log;
    error_log /www/wwwlogs/vrseeyou.icu.error.log;
    
    # 客户端上传大小限制
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 静态文件缓存（可选）
    location /static/ {
        alias /www/wwwroot/AI/smart-wardrobe/frontend/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

保存后，点击「重载配置」。

## 六、配置SSL证书（HTTPS）

### 方法1：宝塔免费证书（推荐）
1. 在网站设置中，点击「SSL」
2. 选择「Let's Encrypt」
3. 勾选域名 `vrseeyou.icu` 和 `www.vrseeyou.icu`
4. 点击「申请」
5. 申请成功后，开启「强制HTTPS」

### 方法2：其他免费证书
1. 在网站设置中，点击「SSL」
2. 选择「其他证书」
3. 粘贴证书内容（pem格式）和私钥内容
4. 保存并开启「强制HTTPS」

## 七、配置防火墙

### 1. 宝塔防火墙
在「安全」中放行端口：
- 8888 (宝塔面板)
- 80 (HTTP)
- 443 (HTTPS)

### 2. 腾讯云安全组
在腾讯云控制台，找到安全组规则，添加：
- 放行 80 端口
- 放行 443 端口
- 放行 8888 端口（可选，用于访问宝塔面板）

## 八、域名解析

### 1. 添加DNS解析
在域名服务商控制台添加A记录：
- **主机记录**: `@`
- **记录类型**: `A`
- **记录值**: 你的服务器公网IP
- **TTL**: 600

添加www记录：
- **主机记录**: `www`
- **记录类型**: `A`
- **记录值**: 你的服务器公网IP
- **TTL**: 600

### 2. 等待解析生效
DNS解析通常需要几分钟到几小时生效

## 九、访问测试

### HTTP访问（未配置SSL）
- `http://vrseeyou.icu` - 前端页面
- `http://vrseeyou.icu/docs` - API文档

### HTTPS访问（配置SSL后）
- `https://vrseeyou.icu` - 前端页面
- `https://vrseeyou.icu/docs` - API文档

## 常见问题

### 1. 端口被占用
```bash
# 查看8000端口占用
lsof -i:8000
# 结束进程
kill -9 <PID>
```

### 2. 502 Bad Gateway
检查Python服务是否正在运行：
```bash
# 查看Supervisor状态
supervisorctl status

# 查看进程日志
tail -f /var/log/supervisor/smart-wardrobe*.log
```

### 3. 域名无法访问
1. 检查DNS解析是否生效：`ping vrseeyou.icu`
2. 检查防火墙是否放行80/443端口
3. 检查Nginx是否运行：`systemctl status nginx`

### 4. 权限问题
```bash
# 给项目目录授权
chown -R www:www /www/wwwroot/AI/smart-wardrobe
chmod -R 755 /www/wwwroot/AI/smart-wardrobe
```

### 5. 查看日志
```bash
# Nginx访问日志
tail -f /www/wwwlogs/vrseeyou.icu.log

# Nginx错误日志
tail -f /www/wwwlogs/vrseeyou.icu.error.log

# Supervisor日志
在宝塔Supervisor管理器中查看
```

## 十、维护命令

### Supervisor管理
```bash
# 查看进程状态
supervisorctl status smart-wardrobe

# 重启进程
supervisorctl restart smart-wardrobe

# 停止进程
supervisorctl stop smart-wardrobe

# 启动进程
supervisorctl start smart-wardrobe
```

### Nginx管理
```bash
# 测试配置
nginx -t

# 重载配置
nginx -s reload

# 重启Nginx
systemctl restart nginx
```

### 更新代码
```bash
cd /www/wwwroot/AI
git pull

# 重启服务
supervisorctl restart smart-wardrobe
```

---

## 快速部署脚本

将以下内容保存为 `deploy.sh`：

```bash
#!/bin/bash
cd /www/wwwroot/AI/smart-wardrobe

# 拉取最新代码
cd /www/wwwroot/AI && git pull

# 创建目录
mkdir -p data/images uploads output/transparent

# 重启服务
supervisorctl restart smart-wardrobe

echo "部署完成！"
echo "访问地址: https://vrseeyou.icu"
```

然后执行：
```bash
chmod +x deploy.sh
```

后续更新只需执行 `./deploy.sh`

---

## 部署检查清单

- [ ] 安装Nginx
- [ ] 安装Python项目管理器
- [ ] 安装Supervisor管理器
- [ ] 安装Python 3.12
- [ ] 克隆项目代码
- [ ] 安装项目依赖
- [ ] 配置Supervisor守护进程
- [ ] 添加网站（域名：vrseeyou.icu）
- [ ] 配置Nginx反向代理
- [ ] 申请SSL证书
- [ ] 开启强制HTTPS
- [ ] 配置防火墙放行端口
- [ ] 配置DNS解析
- [ ] 测试访问