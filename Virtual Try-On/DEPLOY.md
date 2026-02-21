# 腾讯云服务器部署指南

## 服务器信息
- 配置: 2核2G3M
- 系统: 宝塔Linux面板

## 一、宝塔面板安装Python环境

### 1. 登录宝塔面板
在浏览器访问 `http://你的服务器IP:8888`

### 2. 安装Python项目管理器
1. 点击左侧菜单「软件商店」
2. 搜索「Python项目管理器」
3. 点击安装

### 3. 安装Python版本
1. 打开Python项目管理器
2. 点击「版本管理」
3. 安装 Python 3.9 或更高版本

## 二、上传项目代码

> **重要提示**: 项目路径不能包含空格，否则会导致部署失败。请按以下步骤操作。

### 使用Git克隆并移动项目
在终端执行：
```bash
cd /www/wwwroot
git clone https://github.com/jianghx1997-sudo/AI.git

# 将项目移动到无空格路径
mv "AI/Virtual Try-On" /www/wwwroot/wardrobe

# 进入项目目录
cd /www/wwwroot/wardrobe
```

### 创建必要的目录
```bash
cd /www/wwwroot/wardrobe
mkdir -p data/images
mkdir -p uploads
mkdir -p output/transparent
```

## 三、部署项目

### 方法A：使用Supervisor管理（推荐）

如果Python项目管理器出现问题，推荐使用Supervisor来管理进程。

#### 1. 安装Supervisor
在宝塔「软件商店」搜索并安装「Supervisor管理器」

#### 2. 添加守护进程
1. 打开「Supervisor管理器」
2. 点击「添加守护进程」
3. 填写配置：
   - 名称: `smart-wardrobe`
   - 运行目录: `/www/wwwroot/wardrobe`
   - 启动命令: `/www/server/pyporject_evn/versions/3.11.9/bin/python run.py`
   - 进程数量: `1`
   - 用户: `root`

> **注意**: 请将 `3.11.9` 替换为你实际安装的Python版本

#### 3. 安装依赖
```bash
# 查看Python版本
ls /www/server/pyporject_evn/versions/

# 使用对应版本的pip安装依赖（假设是3.11.9）
cd /www/wwwroot/wardrobe
/www/server/pyporject_evn/versions/3.11.9/bin/pip install -r requirements.txt
```

### 方法B：使用Python项目管理器

#### 1. 添加项目
1. 打开「Python项目管理器」
2. 点击「添加项目」
3. 填写配置：
   - 项目名称: `smart-wardrobe`
   - 项目路径: `/www/wwwroot/wardrobe`
   - Python版本: 选择已安装的版本
   - 框架: 选择 `python`（通用Python项目）
   - 启动方式: `python`
   - 启动文件: 选择 `run.py`
   - 端口: `8000`
   - 运行用户: `root`

> **注意**: 如果添加项目时出现错误，请使用方法A（Supervisor方式）

#### 2. 安装依赖
项目添加后，使用Python项目管理器安装依赖：

**方法1：通过项目管理器安装（推荐）**
1. 在Python项目管理器中找到项目
2. 点击「模块」或「依赖管理」
3. 点击「安装模块」或「从requirements.txt安装」
4. 输入模块名称或选择 requirements.txt 文件

**方法2：通过终端安装**
```bash
# 先查看Python版本对应的路径
ls /www/server/pyporject_evn/versions/

# 使用对应版本的pip（假设是3.11.9）
cd /www/wwwroot/wardrobe
/www/server/pyporject_evn/versions/3.11.9/bin/pip install -r requirements.txt
```

**方法3：使用系统pip3**
```bash
# 如果系统有pip3
pip3 install -r requirements.txt
```

## 四、启动项目

在Python项目管理器中点击项目的「启动」按钮

如果启动失败，检查日志排查问题。

## 五、配置Nginx反向代理

### 1. 在宝塔创建网站
1. 点击「网站」→「添加站点」
2. 填写域名（或使用服务器IP）
3. PHP版本选择「纯静态」

### 2. 配置反向代理
点击网站「设置」→「反向代理」→「添加反向代理」：
- 代理名称: `smart-wardrobe`
- 目标URL: `http://127.0.0.1:8000`
- 发送域名: `$host`

### 3. 修改Nginx配置
点击「配置文件」，在server块中添加：
```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # 增加文件上传大小限制
    client_max_body_size 50M;
}

# 静态文件缓存
location /static/ {
    alias /www/wwwroot/wardrobe/frontend/;
    expires 30d;
}
```

## 六、配置防火墙

### 1. 宝塔防火墙
在「安全」中放行端口：
- 8000 (Python应用)
- 8888 (宝塔面板)
- 80 (HTTP)
- 443 (HTTPS)

### 2. 腾讯云安全组
在腾讯云控制台，找到安全组规则，添加：
- 放行 80 端口
- 放行 443 端口

## 七、访问测试

在浏览器访问：
- `http://你的服务器IP` - 前端页面
- `http://你的服务器IP/docs` - API文档

## 常见问题

### 1. 端口被占用
```bash
# 查看8000端口占用
lsof -i:8000
# 结束进程
kill -9 进程ID
```

### 2. 权限问题
```bash
# 给www用户权限
chown -R www:www /www/wwwroot/wardrobe
chmod -R 755 /www/wwwroot/wardrobe
```

### 3. 查看日志
```bash
# 项目日志
tail -f /www/wwwroot/wardrobe/logs/app.log
# Python项目管理器日志
在宝塔面板Python项目管理器中查看
```

## 八、设置开机自启

在Python项目管理器中，项目已经默认设置开机自启。

## 九、配置域名（可选）

如果有域名，可以在宝塔面板：
1. 添加域名到网站
2. 申请免费SSL证书
3. 强制HTTPS

---

## 快速部署脚本

将以下内容保存为 `deploy.sh`：

```bash
#!/bin/bash
cd /www/wwwroot/wardrobe

# 拉取最新代码
cd /www/wwwroot/AI && git pull

# 安装依赖
pip install -r requirements.txt

# 创建目录
mkdir -p data/images uploads output/transparent

# 重启服务
# 在宝塔Python项目管理器中重启，或使用：
# supervisorctl restart smart-wardrobe
```

然后执行：
```bash
chmod +x deploy.sh
```

后续更新只需执行 `./deploy.sh`
