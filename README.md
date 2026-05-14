# 👨‍👩‍👧‍👦 家庭资产管理系统

> 极简、轻量、支持 Docker 一键部署的家庭资产管理工具。前后端合并为单容器，适合 NAS、家庭服务器等低资源环境。

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📊 资产管理 | 现金类 / 其他资产分类，支持多币种 |
| 💰 负债管理 | 等额本息 / 等额本金还款计算 |
| 🏷️ 标签系统 | 自定义标签维度，灵活组织资产 |
| 👥 多用户权限 | 管理员 / 普通用户，数据按账号隔离 |
| 🔐 安全认证 | 密码 SHA256 加密，Token 认证（7天有效） |
| 💾 数据备份 | JSON 格式一键导出 / 导入 |
| 🌗 明暗主题 | 自动跟随系统，支持手动切换 |
| 📱 响应式 | 支持手机、平板、桌面端访问 |

## 🚀 快速部署（Docker 推荐）

### 前置要求

- Docker 20.10+ / Docker Compose 2.0+

### 方式一：Docker 命令部署（单容器）

```bash
# 1. 构建镜像
git clone <你的仓库地址> family-assets
cd family-assets
docker build -f Dockerfile.merged -t family-assets .

# 2. 运行容器
docker run -d \
  --name family-assets \
  -p 3001:3001 \
  -v family-assets-data:/app/data \
  -e JWT_SECRET=your-secret-key-here \
  -e PORT=3001 \
  --restart unless-stopped \
  family-assets
```

访问 `http://你的IP:3001`，首次注册的用户自动成为管理员。

> ⚠️ `JWT_SECRET` 建议设置一个固定字符串，否则每次容器重启后所有用户需要重新登录。

### 方式二：Docker Compose 部署

```yaml
version: '3.8'

services:
  family-assets:
    build:
      context: .
      dockerfile: Dockerfile.merged
    container_name: family-assets
    ports:
      - "3001:3001"
    environment:
      - JWT_SECRET=your-secret-key-here
      - PORT=3001
    volumes:
      - family-assets-data:/app/data
    restart: unless-stopped

volumes:
  family-assets-data:
```

```bash
docker compose up -d
```

### 环境变量说明

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `JWT_SECRET` | 否 | 随机临时值 | Token 签名密钥，**生产环境强烈建议设置固定值** |
| `PORT` | 否 | `3001` | 服务监听端口 |

### 数据持久化

数据存储在 SQLite 文件中（`/app/data/assets.db`），通过 Docker Volume 持久化。

- 查看数据卷：`docker volume inspect family-assets-data`
- 备份数据：`docker cp family-assets:/app/data ./backup`
- 恢复数据：`docker cp ./backup family-assets:/app/data`

---

## 🔧 本地开发

```bash
# 后端（端口 3001）
cd backend
npm install
node server.js

# 前端（端口 3000，开发模式）
cd frontend
npm install
npm run dev
```

前端开发模式下访问 `http://localhost:3000`，自动代理 API 请求到后端 3001 端口。

## 📡 API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:----:|
| POST | `/api/auth/register` | 用户注册 | ❌ |
| POST | `/api/auth/login` | 用户登录 | ❌ |
| POST | `/api/auth/change-password` | 修改密码 | ✅ |
| GET | `/api/assets` | 获取资产列表 | ✅ |
| POST | `/api/assets` | 添加资产 | ✅ |
| PUT | `/api/assets/:id` | 更新资产 | ✅ |
| DELETE | `/api/assets/:id` | 删除资产 | ✅ |
| GET | `/api/liabilities` | 获取负债列表 | ✅ |
| POST | `/api/liabilities` | 添加负债 | ✅ |
| PUT | `/api/liabilities/:id` | 更新负债 | ✅ |
| DELETE | `/api/liabilities/:id` | 删除负债 | ✅ |
| GET | `/api/tags` | 获取标签列表 | ✅ |
| POST | `/api/tags` | 创建标签 | ✅ |
| DELETE | `/api/tags/:id` | 删除标签 | ✅ |
| GET | `/api/backup/export` | 导出备份（JSON） | ✅ |
| POST | `/api/backup/import` | 导入备份 | ✅ |

## 👤 用户角色

| 角色 | 权限 |
|------|------|
| **管理员 (admin)** | 管理所有数据、创建新账户 |
| **普通用户 (user)** | 仅查看和操作自己的数据 |

> 首次注册的用户自动成为管理员。

## 📁 项目结构

```
family-assets/
├── backend/
│   ├── package.json
│   └── server.js          # 后端主程序（Express + sql.js）
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.js
│       └── App.vue        # 前端主程序（Vue 3 单文件）
├── Dockerfile.merged       # 单容器构建文件
├── docker-compose.yml      # Compose 部署配置
└── README.md
```

## 💻 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js 20 + Express + sql.js (SQLite) |
| 前端 | Vue 3 + Vite |
| 认证 | 自定义 Token（SHA256 密码加密） |
| 部署 | Docker（Alpine 基础镜像） |

## 📊 资源占用

| 项目 | 数值 |
|------|------|
| 内存占用 | ~50-80MB |
| CPU 占用 | 几乎为 0 |
| 镜像大小 | ~200MB |
| 数据库文件 | 按实际数据，通常 < 1MB |

适合运行在群晖 NAS、树莓派、VPS 等低资源设备上。

## 📄 License

MIT
