# Family Assets v1.0

发布日期：2026-05-15

## 功能清单

### 核心功能
- ✅ 资产管理（添加/编辑/删除/搜索）
- ✅ 负债管理（支持等额本息/等额本金计算）
- ✅ 现金类 vs 其他资产分类
- ✅ 标签系统（自定义标签、多标签筛选）
- ✅ 数据概览（净资产、负债率、现金占比、智能建议）

### 用户系统
- ✅ 登录/注册（首次注册为管理员）
- ✅ JWT Token 认证（7天过期）
- ✅ 多用户数据隔离（每人只看自己的数据）
- ✅ 管理员可管理所有数据

### 数据管理
- ✅ JSON 导出备份
- ✅ JSON 导入恢复
- ✅ SQLite 数据库（sql.js 纯 JS 实现）

### UI/UX
- ✅ 明暗主题切换（自动检测 + 手动切换）
- ✅ 弹窗式日历选择器（月份导航、今天高亮、周末标红）
- ✅ 响应式设计（PC/移动端适配）

## 技术栈

- 后端：Node.js + Express + sql.js
- 前端：Vue 3 (CDN) + Vite
- 部署：Docker (node:20-alpine)

## 文件结构

```
v1/
├── backend/
│   ├── server.js          # 后端代码 (34813 bytes)
│   └── package.json       # 依赖配置
├── frontend/
│   ├── src/
│   │   ├── App.vue        # 前端源码 (97476 bytes)
│   │   └── main.js        # 入口文件
│   ├── index.html         # HTML 模板
│   ├── vite.config.js     # Vite 配置
│   └── package.json       # 依赖配置
├── Dockerfile.merged      # Docker 构建文件
├── docker-compose.yml     # Compose 配置
└── README.md              # 使用文档
```

## 部署命令

```bash
# 构建
docker build -f Dockerfile.merged -t family-assets:v1 .

# 运行
docker run -d -p 3001:3001 -v family-assets-data:/app/data -e JWT_SECRET=your-secret family-assets:v1
```

## 已修复的 Bug

1. Docker 白屏问题（静态文件路径 + 路由顺序）
2. 负债 INSERT 语句占位符数量错误
3. 导入功能 404 错误（前端路由修复）
4. tag_ids vs tag_id 字段名不一致
5. 导入后页面不刷新

---

此版本已验证可用，可作为稳定基线版本。
