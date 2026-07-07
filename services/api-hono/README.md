# Pure Admin Backend

基于Hono.js的高性能后端，支持Cloudflare Workers部署和本地开发环境。

## 技术架构

- **框架**: Hono.js (高性能Web框架)
- **数据库**:
  - 本地开发: SQLite (better-sqlite3)
  - 生产环境: Cloudflare D1 (SQLite)
- **认证**: JWT (JSON Web Tokens)
- **语言**: TypeScript
- **部署**: Cloudflare Workers / 本地Node.js

## 项目结构

```
backend/
├── src/
│   ├── index.ts          # 主入口文件
│   ├── models/
│   │   └── database.ts   # 数据库封装 (兼容SQLite/D1)
│   ├── routes/
│   │   ├── auth.ts       # 用户认证API
│   │   └── files.ts      # Excel文件管理API
│   └── utils/            # 工具函数
├── database.sqlite       # 本地SQLite数据库
├── wrangler.toml         # Cloudflare Workers配置
└── package.json          # 依赖配置
```

## 快速启动

### 1. 安装依赖

```bash
pnpm install
```

### 2. 本地开发启动

```bash
# 使用 wrangler 本地开发，默认端口 8788
pnpm dev
```

### 3. 验证启动

- 健康检查: http://localhost:8788/admin/health
- API测试: http://localhost:8788/admin/

## 数据库

项目使用SQLite数据库，首次启动会自动创建：

- `users` - 用户表
- `excel_files` - Excel文件记录表
- `excel_data` - Excel数据表

### 本地演示账户

本地开发和前端登录页的快速账号保持一致：

| 展示名称 | 用户名  | 密码     | 角色  | 管理员层级 |
| -------- | ------- | -------- | ----- | ---------- |
| Super    | `vben`  | `123456` | admin | super      |
| Admin    | `admin` | `123456` | admin | sub        |
| User     | `jack`  | `123456` | user  | -          |

## API接口

### 认证接口

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册 (管理员)
- `GET /api/auth/profile` - 获取用户信息
- `GET /api/auth/users` - 获取用户列表 (管理员)

### 文件管理接口

- `POST /api/files/upload` - 上传Excel文件 (管理员)
- `GET /api/files/list` - 获取文件列表
- `GET /api/files/data/:fileId` - 获取文件数据
- `DELETE /api/files/:fileId` - 删除文件 (管理员)

## 部署

### 本地开发

```bash
pnpm start:local
```

### Cloudflare Workers部署

```bash
# 部署到Cloudflare Workers
pnpm deploy
```

### 环境变量

生产环境需要配置以下环境变量：

- `JWT_SECRET` - JWT密钥
- `DATABASE_URL` - D1数据库绑定
- `STORAGE_BUCKET` - R2存储桶绑定

## 测试API

```bash
# 测试登录
curl -X POST http://localhost:8788/admin/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"vben","password":"123456"}'

# 测试文件列表 (需要登录获取token)
curl -X GET http://localhost:3000/api/files/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## pnpm卸载

1.  完全清理 pnpm 安装的内容
    Remove-Item -Recurse -Force node_modules
    Remove-Item -Force pnpm-lock.yaml

2.  清理 npm 缓存（解决之前的 npm 错误）
    npm cache clean --force

3.  用 npm 重新安装所有依赖
    npm install

## 其它

### 同步远程数据库到本地

```sh
# 1. 导出远程数据库 例子
  cd site66/backend
  npx wrangler d1 export site66-admin-system --remote --output ./remote-backup.sql

  # 2. 删除旧本地数据库
  rm .wrangler/state/v3/d1/miniflare-D1DatabaseObject/753c18516e81cfbeff1f900c97285f056f3470b
  b6c0b4fb4456fff225e366de8.sqlite

  # 3.导入
  sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/753c18516e81cfbeff1f900c97285f056f
  3470bb6c0b4fb4456fff225e366de8.sqlite < remote-backup.sql

```

. 导出远程数据库  
 cd site66/backend  
 npx wrangler d1 export site66-admin-system --remote --output ./remote-backup.sql

# 2. 删除旧本地数据库并导入

rm .wrangler/state/v3/d1/miniflare-D1DatabaseObject/753c18516e81cfbeff1f900c97285f056f3470b
b6c0b4fb4456fff225e366de8.sqlite
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/753c18516e81cfbeff1f900c97285f056f
3470bb6c0b4fb4456fff225e366de8.sqlite < remote-backup.sql

````

```470bb6c0b4fb4456fff225e366de8.sqlite < remote-backup.sql

````
