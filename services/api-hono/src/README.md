<!-- 🔄 自维护声明：本文件夹内任何文件变更后，请立即更新本文档 -->

# Backend Source Code | 后端源代码

**架构定位**：Cloudflare Workers + D1 数据库的无服务器后端
**核心职责**：提供 RESTful API，处理业务逻辑，管理数据库操作
**依赖关系**：依赖 Cloudflare Workers Runtime，对外提供 HTTP API

---

## 📁 目录结构

| 文件/文件夹 | 地位 | 功能 |
|------------|------|------|
| `index.ts` | 入口文件 | Workers 请求处理入口，路由分发 |
| `router/` | 核心模块 | API 路由定义和业务逻辑处理 |
| `utils/` | 工具模块 | 通用工具函数（日期、验证、日志等） |
| `config/` | 配置模块 | 数据库配置、环境变量管理 |
| `types/` | 类型定义 | TypeScript 类型声明 |

---

## 🔗 子模块说明

### router/ - API 路由
- `excel.ts` - Excel 数据上传和管理 API
- `data-reports.ts` - 数据报告编辑和发布 API
- `users.ts` - 用户管理 API
- `auth.ts` - 认证和授权 API

### utils/ - 工具函数
- `date-formatter.ts` - 日期格式化工具
- `datetime.ts` - 时区处理工具
- `logger.ts` - 日志记录工具
- `excel-validator.ts` - Excel 数据验证

### config/ - 配置管理
- `index.ts` - 数据库连接配置
- `cors.ts` - CORS 跨域配置

---

## 🔄 更新规则

**当本文件夹发生以下变更时，必须更新本文档**：
1. ✅ 新增文件或文件夹
2. ✅ 删除文件或文件夹
3. ✅ 重命名文件或文件夹
4. ✅ 文件的核心功能发生变化

**同时需要更新**：
- 上级文档：`../../CLAUDE.md` - Backend 部分

---

**最后更新**：2026-01-05
