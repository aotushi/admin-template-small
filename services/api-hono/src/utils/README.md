<!-- 🔄 自维护声明：本文件夹内任何文件变更后，请立即更新本文档 -->

# Backend Utils | 后端工具函数

**架构定位**：基础设施层，被所有业务模块依赖
**核心职责**：提供通用工具函数，处理日期、日志、验证等跨模块需求
**依赖关系**：无业务依赖，仅依赖 TypeScript 标准库和 Cloudflare Workers API

---

## 📁 文件清单

| 文件名 | 地位 | 功能 |
|--------|------|------|
| `logger.ts` | 核心基础设施 | 结构化日志记录，自动过滤敏感信息，环境分级输出 |
| `datetime.ts` | 时区工具 | 东八区时间处理，确保跨时区部署的时间一致性 |
| `excel-validator.ts` | 数据验证 | Excel 数据格式验证，日期格式检查 |
| `data-processor.ts` | 数据处理 | 数据转换和处理逻辑 |

---

## 🔧 工具函数详解

### logger.ts - 日志系统
**Input**:
- `env`: 环境变量 (production/development)
- `message`: 日志消息
- `context`: 上下文对象（可选）

**Output**:
- `logger.debug()`: 调试日志（仅开发环境）
- `logger.info()`: 信息日志
- `logger.warn()`: 警告日志
- `logger.error()`: 错误日志

**核心特性**:
- ✅ 自动过滤敏感字段（password, token, secret 等）
- ✅ 环境感知（生产环境只输出 error/warn）
- ✅ 结构化输出

### datetime.ts - 时区处理
**Input**: 无（使用系统时间）

**Output**:
- `getCurrentShanghaiTime()`: 返回东八区时间字符串

**核心特性**:
- ✅ 统一使用东八区（Asia/Shanghai）
- ✅ ISO 格式输出（YYYY-MM-DDTHH:mm:ss）
- ✅ 避免 Cloudflare Workers 跨时区部署问题

### excel-validator.ts - 数据验证
**Input**:
- `dateStr`: 日期字符串
- 其他数据字段

**Output**:
- 验证结果（通过/失败 + 错误信息）

**核心特性**:
- ✅ 日期格式验证（仅接受 YYYY-MM-DD）
- ✅ 必填字段检查
- ✅ 数据完整性验证

---

## 🔄 更新规则

**当本文件夹发生以下变更时，必须更新本文档**：
1. ✅ 新增工具函数文件
2. ✅ 删除工具函数文件
3. ✅ 工具函数的核心功能变更（Input/Output/特性）

**同时需要更新**：
- 上级文档：`../README.md` - utils 部分
- 根目录文档：`../../../CLAUDE.md` - Backend 部分（如有架构性变更）

---

**最后更新**：2026-01-05
